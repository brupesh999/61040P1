import { afterAll, beforeAll, beforeEach, expect } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { Db } from "mongodb";
import { assembleApplication } from "../../src/assembly.ts";
import { gamexplorerPolicy } from "../../src/http.ts";
import { testDb } from "../../src/concepts/testing.ts";
import { MemoryProvider } from "../../src/concepts/UserAuthenticating/provider.ts";
import { FixtureSteam, steamGame } from "../../src/testing/steam.ts";

export const ORIGIN = "http://127.0.0.1:3000";
export const SESSION = "__Host-gamexplorer-session";
export const ATTEMPT = "__Host-gamexplorer-sign-in";

/**
 * Call once in each suite. Hooks and mutable state belong to that suite's closure;
 * importing this module alone registers no hooks and opens no database.
 * Only external providers are fixtures. HTTP policy, reactions, concepts, and MongoDB are real.
 */
export function integrationSuite(name: string) {
  let db: Db;
  let reset: () => Promise<void>;
  let close: () => Promise<void>;
  let handler: (request: Request) => Promise<Response>;
  let steam: FixtureSteam;
  let provider: MemoryProvider;

  function restart() {
    const application = assembleApplication(db, provider, steam);
    handler = createHttpHandler({
      application, gateway: createGateway({ application }), policy: gamexplorerPolicy(ORIGIN),
    });
  }

  beforeAll(async () => ({ db, reset, close } = await testDb(name)));
  beforeEach(async () => {
    await reset();
    steam = new FixtureSteam([
      steamGame(1, "Lantern Tales", "Tiny Owl", 2021),
      steamGame(2, "Shiny Blaster", "Big Studio", 2023),
      steamGame(3, "Hades", "Supergiant", 2020),
      steamGame(4, "G", "D", 2020),
    ]);
    provider = new MemoryProvider();
    restart();
  });
  afterAll(async () => close());

  async function request(path: string, body: object, cookie = "", origin = ORIGIN) {
    const response = await handler(new Request(`${ORIGIN}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
      body: JSON.stringify(body),
    }));
    // Malformed and adversarial requests are intentional; assertions check their response shape.
    return { status: response.status, body: await response.json() as any, cookies: response.headers.getSetCookie() };
  }

  /** A simulated browser sends cookie credentials and leaves JSON fields untouched. */
  function browser() {
    const jar = new Map<string, string>();
    async function post(path: string, body: object = {}, origin = ORIGIN) {
      const result = await request(path, body, [...jar].map(([key, value]) => `${key}=${value}`).join("; "), origin);
      for (const line of result.cookies) {
        const [key = "", value = ""] = line.split(";")[0]!.split("=");
        if (value) jar.set(key, value); else jar.delete(key);
      }
      return result;
    }
    return { jar, post };
  }

  /** Existing journey fixtures name their cookie credential `session`; it is never trusted JSON. */
  function call(path: string, body: Record<string, unknown> = {}) {
    const { session, ...payload } = body;
    return typeof session === "string"
      ? request(path, payload, `${SESSION}=${session}`)
      : request(path, body);
  }

  async function signUp(username: string) {
    const result = await call("/auth/register", { username, password: "pw-" + username });
    expect(result.status).toBe(200);
    expect(result.body.session).toBeUndefined();
    const credential = result.cookies.find(line => line.startsWith(`${SESSION}=`))!.split(";")[0]!.split("=")[1]!;
    expect(credential).toBeString();
    return credential;
  }

  async function ratedAspect() {
    const reviewer = await signUp("reviewer");
    const buyer = await signUp("buyer");
    const added = await call("/games/add", { session: reviewer, steamAppId: 1 });
    expect(added.status).toBe(200);
    const game = added.body.game as string;
    const created = await call("/aspects/create", {
      session: reviewer, game, name: "Narrative Depth", description: "Story and characters",
    });
    expect(created.status).toBe(200);
    const aspect = created.body.aspect as string;
    expect((await call("/ratings/rate", { session: reviewer, aspect, score: 9, microNote: "Gripping dialogue." })).status).toBe(200);
    expect((await call("/discover/set", { session: buyer, aspectName: "Narrative Depth", minScore: 8 })).status).toBe(200);
    return { reviewer, buyer, game, aspect };
  }

  return { call, browser, signUp, ratedAspect, restart,
    get db() { return db; }, get steam() { return steam; }, get provider() { return provider; } };
}
