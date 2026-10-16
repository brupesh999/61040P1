import { afterAll, beforeAll, expect, test } from "bun:test";
import { MongoClient, type CommandStartedEvent, type Db } from "mongodb";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { testDb } from "./concepts/testing.ts";
import { createHealthMonitor } from "./health.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb("health", true)));
afterAll(async () => close());

test("production HTTP health accepts GET and HEAD with an empty or populated MongoDB", async () => {
  const lines: string[] = [];
  const health = createHealthMonitor(db, line => lines.push(line));
  expect(await health.refresh()).toBe(true);
  const server = Bun.serve({
    development: false, hostname: "0.0.0.0", port: 0,
    routes: { "/health": health.respond }, fetch: () => new Response("Not found", { status: 404 }),
  });
  const url = `http://127.0.0.1:${server.port}/health`;
  try {
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    const head = await fetch(url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    await new GameCatalogConcept(db).addGame({ title: "Health fixture", developer: "Test", releaseYear: 2026 });
    expect((await fetch(url)).status).toBe(200);
    expect(lines[0]).toBe('Database health: {"status":"ok"}');
    expect(lines.filter(line => line.startsWith("HTTP health response: GET 200"))).toHaveLength(2);
    expect(lines.some(line => line.startsWith("HTTP health response: HEAD 200"))).toBe(true);
  } finally {
    await server.stop(true);
  }
});

test("overlapping refreshes share a read and HTTP probes do not use the database pool", async () => {
  let reads = 0;
  const observe = (event: CommandStartedEvent) => {
    if (event.commandName === "find" && event.command.find === "gameCatalog.games") reads++;
  };
  db.client.on("commandStarted", observe);
  try {
    const health = createHealthMonitor(db, () => {});
    expect(await Promise.all(Array.from({ length: 20 }, () => health.refresh()))).toEqual(Array(20).fill(true));
    expect(reads).toBe(1);
    for (let index = 0; index < 20; index++) {
      expect(health.respond(new Request("http://localhost/health")).status).toBe(200);
    }
    expect(reads).toBe(1);
    expect(await health.refresh()).toBe(true);
    expect(reads).toBe(2);
  } finally {
    db.client.off("commandStarted", observe);
  }
});

test("a lost database returns 503 without stale success and recovers after reconnection", async () => {
  const lines: string[] = [];
  const health = createHealthMonitor(db, line => lines.push(line));
  const probe = () => health.respond(new Request("http://localhost/health"));
  expect(await health.refresh()).toBe(true);
  expect(probe().status).toBe(200);
  await db.client.close();
  try {
    expect(await health.refresh()).toBe(false);
    const response = probe();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(lines.filter(line => line.startsWith("Database health:"))).toEqual([
      'Database health: {"status":"ok"}',
      'Database health: {"status":"unavailable","error":"MongoNotConnectedError"}',
    ]);
    expect(await health.refresh()).toBe(false);
    expect(probe().status).toBe(503);
    expect(lines.filter(line => line.startsWith("Database health:"))).toHaveLength(2);
  } finally {
    await db.client.connect();
  }
  expect(await health.refresh()).toBe(true);
  expect(probe().status).toBe(200);
  expect(lines).toContain('Database health: {"status":"ok"}');
});

test("HTTP readiness responds immediately while an unreachable database check is pending", async () => {
  const temporary = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = temporary.port;
  await temporary.stop(true);
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/unavailable`);
  const lines: string[] = [];
  try {
    const started = performance.now();
    const health = createHealthMonitor(client.db(), line => lines.push(line));
    const checking = health.refresh();
    const response = health.respond(new Request("http://localhost/health"));
    expect(response.status).toBe(503);
    expect(performance.now() - started).toBeLessThan(100);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(await checking).toBe(false);
    expect(performance.now() - started).toBeLessThan(5000);
    const diagnostic = lines.find(line => line.startsWith("Database health:"))!;
    expect(JSON.parse(diagnostic.replace("Database health: ", ""))).toMatchObject({
      status: "unavailable", error: "TimeoutError",
    });
    expect(lines.join()).not.toContain("127.0.0.1");
    expect(lines.join()).not.toContain("mongodb://");
  } finally {
    await client.close();
  }
});

test("a stale success refuses health even while the previous result was healthy", async () => {
  let time = 0;
  const health = createHealthMonitor(db, () => {}, () => time);
  const probe = () => health.respond(new Request("http://localhost/health"));
  expect(probe().status).toBe(503);
  expect(await health.refresh()).toBe(true);
  time = 4999;
  expect(probe().status).toBe(200);
  time = 5000;
  expect(probe().status).toBe(503);
  expect(await health.refresh()).toBe(true);
  expect(probe().status).toBe(200);
});

test("scheduled checks detect database loss and recovery without any HTTP-triggered queries", async () => {
  const health = createHealthMonitor(db, () => {});
  const probe = () => health.respond(new Request("http://localhost/health"));
  async function waitFor(status: number) {
    const deadline = performance.now() + 6000;
    while (probe().status !== status && performance.now() < deadline) await Bun.sleep(25);
    expect(probe().status).toBe(status);
  }
  expect(await health.refresh()).toBe(true);
  health.start();
  try {
    await db.client.close();
    await waitFor(503);
    await db.client.connect();
    await waitFor(200);
  } finally {
    health.stop();
    await db.client.connect();
  }
});
