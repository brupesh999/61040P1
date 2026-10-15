import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { Db } from "mongodb";
import { assembleApplication } from "./assembly.ts";
import { gamexplorerPolicy } from "./http.ts";
import { MemoryProvider } from "./concepts/Federating/provider.ts";
import { testDb } from "./concepts/testing.ts";

const ORIGIN = "http://127.0.0.1:3011";
const SESSION = "__Host-gamexplorer-session";
const ATTEMPT = "__Host-gamexplorer-sign-in";
let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let provider: MemoryProvider;
let handle: (request: Request) => Promise<Response>;
beforeAll(async () => ({ db, reset, close } = await testDb("commons-http")));
beforeEach(async () => {
  await reset();
  provider = new MemoryProvider();
  const application = assembleApplication(db, provider);
  handle = createHttpHandler({ application, gateway: createGateway({ application }), policy: gamexplorerPolicy(ORIGIN) });
});
afterAll(async () => close());

/** Each simulated browser uses the same real HTTP cookie boundary as the running app. */
function browser() {
  const jar = new Map<string, string>();
  async function post(path: string, body: object = {}, origin = ORIGIN) {
    const response = await handle(new Request(`${ORIGIN}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: JSON.stringify(body),
    }));
    const cookies = response.headers.getSetCookie();
    for (const line of cookies) {
      const [name = "", value = ""] = line.split(";")[0]!.split("=");
      if (value) jar.set(name, value); else jar.delete(name);
    }
    return { status: response.status, body: await response.json() as any, cookies };
  }
  return { jar, post };
}

async function commonsLogin(client: ReturnType<typeof browser>, subject = "commons-sam", username = "sam") {
  const start = await client.post("/auth/commons/start");
  const approved = provider.approve(start.body.address, { subject, username });
  const finish = await client.post("/auth/commons/finish", approved);
  expect(finish.status).toBe(200);
  return finish.body.user as string;
}

describe("Commons authentication through HTTP and MongoDB", () => {
  test("sign-in issues private cookies; the same Commons subject keeps its reviews after a name change", async () => {
    const sam = browser();
    const start = await sam.post("/auth/commons/start");
    expect(start.body).toEqual({ address: expect.any(String) });
    expect(start.cookies[0]).toContain("HttpOnly");
    expect(start.cookies[0]).toContain("Secure");
    expect(start.cookies[0]).toContain("SameSite=Strict");
    expect(sam.jar.has(ATTEMPT)).toBe(true);
    const finish = await sam.post("/auth/commons/finish", provider.approve(start.body.address, { subject: "sam-id", username: "sam" }));
    expect(finish.body).toEqual({ user: expect.any(String) });
    expect(sam.jar.has(ATTEMPT)).toBe(false);
    expect(sam.jar.has(SESSION)).toBe(true);
    const user = finish.body.user;
    expect((await sam.post("/auth/me")).body).toEqual({ me: { user, username: "sam" } });
    const game = (await sam.post("/games/add", { title: "A Game", developer: "Studio", releaseYear: 2024 })).body.game;
    const aspect = (await sam.post("/aspects/create", { game, name: "Combat", description: "" })).body.aspect;
    expect((await sam.post("/ratings/rate", { aspect, score: 9, microNote: "Responsive combat." })).status).toBe(200);
    expect((await sam.post("/discover/set", { aspectName: "Combat", minScore: 8 })).body.results.matches).toHaveLength(1);
    expect((await sam.post("/auth/logout")).status).toBe(200);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/ratings/mine")).status).toBe(401);
    expect(await commonsLogin(sam, "sam-id", "sam-renamed")).toBe(user);
    expect((await sam.post("/ratings/mine")).body.mine.ratings).toHaveLength(1);
    const other = browser();
    await commonsLogin(other, "other-id", "other");
    expect((await other.post("/ratings/mine", { user })).body.mine.ratings).toEqual([]);
    expect((await other.post("/discover/results", { owner: user })).body.results.filters).toEqual([]);
  });

  test("another browser cannot supply an attempt in JSON or finish the caller's sign-in", async () => {
    const leo = browser(), sam = browser();
    const leos = await leo.post("/auth/commons/start");
    const approved = provider.approve(leos.body.address, { subject: "leo-id", username: "leo" });
    await sam.post("/auth/commons/start");
    const ownAttempt = sam.jar.get(ATTEMPT);
    const redeem = spyOn(provider, "redeem");
    const forged = await sam.post("/auth/commons/finish", { ...approved, attempt: leo.jar.get(ATTEMPT) });
    expect(forged.status).toBe(403);
    expect(forged.body).toEqual({ error: "FORBIDDEN" });
    expect(redeem).not.toHaveBeenCalled();
    expect(sam.jar.get(ATTEMPT)).toBe(ownAttempt);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await leo.post("/auth/commons/finish", approved)).status).toBe(200);
  });

  test("a stolen code fails PKCE in another attempt and cannot be replayed", async () => {
    const sam = browser(), leo = browser();
    const sams = await sam.post("/auth/commons/start");
    const samCode = provider.approve(sams.body.address, { subject: "sam-id", username: "sam" });
    const leos = await leo.post("/auth/commons/start");
    const leoState = new URL(leos.body.address).searchParams.get("state");
    expect((await leo.post("/auth/commons/finish", { state: leoState, code: samCode.code })).status).toBe(403);
    expect(leo.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/auth/commons/finish", samCode)).status).toBe(403);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect(await commonsLogin(sam, "sam-id", "sam")).toBeString();
    expect((await sam.post("/auth/commons/finish", samCode)).status).toBe(403);
  });

  test("a local username is never automatically linked; a confirmed user can choose another", async () => {
    const local = browser();
    const localUser = (await local.post("/auth/register", { username: "sam", password: "local-password" })).body.user;
    const sam = browser();
    const start = await sam.post("/auth/commons/start");
    const approve = provider.approve(start.body.address, { subject: "commons-sam", username: "sam" });
    expect((await sam.post("/auth/commons/finish", approve)).status).toBe(409);
    expect(sam.jar.has(ATTEMPT)).toBe(true);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/auth/commons/choose", { username: "sam" })).status).toBe(409);
    expect((await sam.post("/auth/commons/choose", { username: "bad name" })).status).toBe(400);
    const chosen = await sam.post("/auth/commons/choose", { username: "sam-commons" });
    expect(chosen.status).toBe(200);
    expect(chosen.body.user).not.toBe(localUser);
    expect(sam.jar.has(ATTEMPT)).toBe(false);
    expect((await sam.post("/auth/me")).body.me.username).toBe("sam-commons");
    expect((await local.post("/auth/me")).body.me.user).toBe(localUser);
  });

  test("origin protection blocks sign-in and existing credentials cannot be supplied in JSON", async () => {
    const sam = browser();
    expect((await sam.post("/auth/commons/start", {}, "https://other.example")).status).toBe(403);
    expect((await sam.post("/auth/register", { username: "sam", password: "password" }, "https://other.example")).status).toBe(403);
    await commonsLogin(sam);
    const anonymous = browser();
    expect((await anonymous.post("/auth/me", { session: sam.jar.get(SESSION) })).status).toBe(401);
    expect((await sam.post("/auth/me", { session: "forged" })).body.me.username).toBe("sam");
    expect((await sam.post("/ratings/mine", {}, "https://other.example")).status).toBe(403);
    expect((await anonymous.post("/auth/commons/choose", { username: "unused" })).body.error).toBe("FORBIDDEN");
  });
});
