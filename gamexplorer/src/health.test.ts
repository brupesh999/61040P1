import { afterAll, beforeAll, expect, test } from "bun:test";
import { MongoClient, type CommandStartedEvent, type Db } from "mongodb";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { testDb } from "./concepts/testing.ts";
import { createHealthHandler } from "./health.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await testDb("health", true)));
afterAll(async () => close());

test("production HTTP health accepts GET and HEAD with an empty or populated MongoDB", async () => {
  const lines: string[] = [];
  const health = createHealthHandler(db, line => lines.push(line));
  const server = Bun.serve({
    development: false, hostname: "0.0.0.0", port: 0,
    routes: { "/health": health }, fetch: () => new Response("Not found", { status: 404 }),
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
    expect(lines).toEqual(["First HTTP health probe received.", 'Database health: {"status":"ok"}']);
  } finally {
    await server.stop(true);
  }
});

test("overlapping probes share a real database read but later probes read again", async () => {
  let reads = 0;
  const observe = (event: CommandStartedEvent) => {
    if (event.commandName === "find" && event.command.find === "gameCatalog.games") reads++;
  };
  db.client.on("commandStarted", observe);
  try {
    const health = createHealthHandler(db, () => {});
    const responses = await Promise.all(Array.from({ length: 20 }, () => health()));
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(reads).toBe(1);
    expect((await health()).status).toBe(200);
    expect(reads).toBe(2);
  } finally {
    db.client.off("commandStarted", observe);
  }
});

test("a lost database returns 503 without stale success and recovers after reconnection", async () => {
  const lines: string[] = [];
  const health = createHealthHandler(db, line => lines.push(line));
  expect((await health()).status).toBe(200);
  await db.client.close();
  try {
    const response = await health();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(lines).toEqual([
      'Database health: {"status":"ok"}',
      'Database health: {"status":"unavailable","error":"MongoNotConnectedError"}',
    ]);
    expect((await health()).status).toBe(503);
    expect(lines).toHaveLength(2);
  } finally {
    await db.client.connect();
  }
  expect((await health()).status).toBe(200);
  expect(lines.at(-1)).toBe('Database health: {"status":"ok"}');
});

test("an unreachable database fails within the probe deadline", async () => {
  const temporary = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const port = temporary.port;
  await temporary.stop(true);
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/unavailable`);
  const lines: string[] = [];
  try {
    const started = performance.now();
    const response = await createHealthHandler(client.db(), line => lines.push(line))();
    expect(response.status).toBe(503);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!.replace("Database health: ", ""))).toMatchObject({
      status: "unavailable", error: "TimeoutError",
    });
    expect(lines.join()).not.toContain("127.0.0.1");
    expect(lines.join()).not.toContain("mongodb://");
  } finally {
    await client.close();
  }
});
