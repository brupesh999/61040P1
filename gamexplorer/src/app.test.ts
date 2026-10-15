import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { Db } from "mongodb";
import { assembleApplication } from "./assembly.ts";
import { gamexplorerPolicy } from "./http.ts";
import { testDb } from "./concepts/testing.ts";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { importSteamCatalog } from "./catalogImport.ts";

/**
 * Drives the real HTTP handler, reactions, and concepts against a throwaway Mongo database.
 * Nothing is mocked and every piece of state is created through endpoints.
 */
let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let handler: (request: Request) => Promise<Response>;

beforeAll(async () => ({ db, reset, close } = await testDb("app")));
beforeEach(async () => {
  await reset();
  const application = assembleApplication(db);
  handler = createHttpHandler({ application, gateway: createGateway({ application }), policy: gamexplorerPolicy("http://127.0.0.1:3000") });
});
afterAll(async () => close());

async function call(path: string, body: Record<string, unknown>) {
  // Journey fixtures name their browser credential `session`; carry it through
  // the real cookie boundary, never as a trusted JSON field.
  const { session, ...payload } = body;
  const response = await handler(
    new Request(`http://127.0.0.1:3000/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3000", ...(typeof session === "string" ? { Cookie: `__Host-gamexplorer-session=${session}` } : {}) },
      body: JSON.stringify(typeof session === "string" ? payload : body),
    }),
  );
  return { status: response.status, body: (await response.json()) as any, cookies: response.headers.getSetCookie() };
}

async function signUp(username: string) {
  const { status, body, cookies } = await call("/auth/register", { username, password: "pw-" + username });
  expect(status).toBe(200);
  expect(body.session).toBeUndefined();
  const credential = cookies.find(line => line.startsWith("__Host-gamexplorer-session="))!.split(";")[0]!.split("=")[1]!;
  expect(credential).toBeString();
  return credential;
}

async function ratedAspect() {
  const reviewer = await signUp("reviewer");
  const buyer = await signUp("buyer");
  const added = await call("/games/add", {
    session: reviewer, title: "Lantern Tales", developer: "Tiny Owl", releaseYear: 2021,
  });
  expect(added.status).toBe(200);
  const game = added.body.game as string;
  const created = await call("/aspects/create", {
    session: reviewer, game, name: "Narrative Depth", description: "Story and characters",
  });
  expect(created.status).toBe(200);
  const aspect = created.body.aspect as string;
  expect((await call("/ratings/rate", {
    session: reviewer, aspect, score: 9, microNote: "Gripping dialogue.",
  })).status).toBe(200);
  expect((await call("/discover/set", {
    session: buyer, aspectName: "Narrative Depth", minScore: 8,
  })).status).toBe(200);
  return { reviewer, buyer, game, aspect };
}

describe("Rating aggregates remain consistent across reactions", () => {
  test("rejected updates preserve the saved rating and discovery aggregate", async () => {
    const { reviewer, buyer, game, aspect } = await ratedAspect();
    const before = (await call("/discover/results", { session: buyer })).body;
    for (const invalid of [{ score: 11, microNote: "" }, { score: 5, microNote: "x".repeat(281) }]) {
      const result = await call("/ratings/rate", { session: reviewer, aspect, ...invalid });
      expect(result.status).toBe(400);
      expect(result.body.error).toBe("INVALID_REQUEST");
      const detail = (await call("/games/detail", { game })).body.page.aspects[0];
      expect(detail.summary).toEqual({ average: 9, count: 1 });
      expect(detail.ratings).toHaveLength(1);
      expect(detail.ratings[0]).toMatchObject({ score: 9, microNote: "Gripping dialogue." });
      expect((await call("/discover/results", { session: buyer })).body).toEqual(before);
    }
  });

  test("removing the final rating removes discovery scores and a later rating restores them", async () => {
    const { reviewer, buyer, game, aspect } = await ratedAspect();
    expect((await call("/ratings/remove", { session: reviewer, aspect })).status).toBe(200);
    const detail = (await call("/games/detail", { game })).body.page.aspects[0];
    expect(detail.summary).toEqual({ average: 0, count: 0 });
    expect(detail.ratings).toEqual([]);
    const empty = (await call("/discover/results", { session: buyer })).body;
    expect(empty.results.matches).toEqual([]);
    expect(empty.results.aspectNames).toEqual([]);
    expect(empty.results.filters).toHaveLength(1);
    const repeated = await call("/ratings/remove", { session: reviewer, aspect });
    expect(repeated.status).toBe(404);
    expect(repeated.body.error).toBe("NOT_FOUND");
    expect((await call("/discover/results", { session: buyer })).body).toEqual(empty);
    expect((await call("/ratings/rate", {
      session: reviewer, aspect, score: 8, microNote: "Revisited.",
    })).status).toBe(200);
    const restored = (await call("/discover/results", { session: buyer })).body.results;
    expect(restored.matches).toHaveLength(1);
    expect(restored.matches[0].game).toBe(game);
    expect(restored.matches[0].scores[0].score).toEqual({ average: 8, count: 1 });
  });

  test("forged identities cannot remove another user's rating or filters", async () => {
    const { reviewer, buyer, aspect } = await ratedAspect();
    const reviewerUser = (await call("/auth/me", { session: reviewer })).body.me.user;
    const buyerUser = (await call("/auth/me", { session: buyer })).body.me.user;
    expect(reviewerUser).toBeString();
    expect(buyerUser).toBeString();
    const removed = await call("/ratings/remove", { session: buyer, aspect, user: reviewerUser });
    expect(removed.status).toBe(404);
    expect(removed.body.error).toBe("NOT_FOUND");
    expect((await call("/ratings/mine", { session: buyer, user: reviewerUser })).body.mine.ratings).toEqual([]);
    expect((await call("/ratings/mine", { session: reviewer })).body.mine.ratings).toHaveLength(1);

    const before = (await call("/discover/results", { session: buyer })).body;
    expect((await call("/discover/set", {
      session: reviewer, owner: buyerUser, aspectName: "Narrative Depth", minScore: 10,
    })).status).toBe(200);
    const invalid = await call("/discover/set", {
      session: buyer, aspectName: "Narrative Depth", minScore: 11,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("INVALID_REQUEST");
    expect((await call("/discover/results", { session: buyer })).body).toEqual(before);
    expect((await call("/discover/remove", {
      session: reviewer, owner: buyerUser, aspectName: "Narrative Depth",
    })).status).toBe(200);
    expect((await call("/discover/clear", { session: reviewer, owner: buyerUser })).status).toBe(200);
    expect((await call("/discover/results", { session: buyer })).body).toEqual(before);
    expect((await call("/discover/remove", {
      session: buyer, aspectName: "Narrative Depth",
    })).status).toBe(200);
    expect((await call("/discover/results", { session: buyer })).body.results.filters).toEqual([]);
  });
});

describe("Gamexplorer user journey", () => {
  test("catalog import is repeatable, exposes covers, and creates no ratings or aspects", async () => {
    const { reviewer, buyer } = await ratedAspect();
    const priorRatings = (await call("/ratings/mine", { session: reviewer })).body;
    const priorDiscovery = (await call("/discover/results", { session: buyer })).body;
    const catalog = new GameCatalogConcept(db);
    const entries = [{
      title: "Portal 2", developer: "Valve", releaseYear: 2011, steamAppId: 620,
      coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg",
    }];
    expect(await importSteamCatalog(catalog, entries)).toEqual({ created: 1, covers: 1 });
    const first = (await call("/games/search", { query: "Portal 2" })).body.results.games;
    expect(first).toHaveLength(1);
    expect(first[0].cover).toEqual({ steamAppId: 620, coverUrl: entries[0].coverUrl });
    expect(await importSteamCatalog(catalog, entries)).toEqual({ created: 0, covers: 1 });
    expect((await call("/games/search", { query: "Portal 2" })).body.results.games).toEqual(first);
    const detail = (await call("/games/detail", { game: first[0].game })).body.page;
    expect(detail.cover).toEqual(first[0].cover);
    expect(detail.aspects).toEqual([]);
    expect((await call("/ratings/mine", { session: reviewer })).body).toEqual(priorRatings);
    expect((await call("/discover/results", { session: buyer })).body).toEqual(priorDiscovery);
  });

  test("add a game, rate one aspect sparsely, discover it with a threshold filter, read notes", async () => {
    const reviewer = await signUp("reviewer");
    const buyer = await signUp("buyer");

    const { body: added } = await call("/games/add", {
      session: reviewer,
      title: "Lantern Tales",
      developer: "Tiny Owl",
      releaseYear: 2021,
    });
    const game = added.game as string;
    const { body: other } = await call("/games/add", {
      session: reviewer,
      title: "Shiny Blaster",
      developer: "Big Studio",
      releaseYear: 2023,
    });

    const story = (await call("/aspects/create", { session: reviewer, game, name: "Narrative Depth", description: "" })).body.aspect;
    await call("/aspects/create", { session: reviewer, game, name: "Visual Polish", description: "" });
    const otherStory = (
      await call("/aspects/create", { session: reviewer, game: other.game, name: "narrative depth", description: "" })
    ).body.aspect;

    // Sparse: only Narrative Depth is rated; Visual Polish stays unrated.
    expect((await call("/ratings/rate", { session: reviewer, aspect: story, score: 9, microNote: "Gripping dialogue." })).status).toBe(200);
    await call("/ratings/rate", { session: buyer, aspect: story, score: 8, microNote: "" });
    await call("/ratings/rate", { session: reviewer, aspect: otherStory, score: 4, microNote: "Thin." });

    // The reaction pushed the averages into AspectFiltering; a filter of >= 8 finds only Lantern Tales.
    const { body: discovered } = await call("/discover/set", { session: buyer, aspectName: "Narrative Depth", minScore: 8 });
    expect(discovered.results.matches).toHaveLength(1);
    expect(discovered.results.matches[0].game).toBe(game);
    expect(discovered.results.matches[0].info.title).toBe("Lantern Tales");
    expect(discovered.results.matches[0].scores).toEqual([
      { aspectName: "Narrative Depth", score: { average: 8.5, count: 2 } },
    ]);
    expect(discovered.results.aspectNames.map((a: any) => a.aspectName)).toEqual(["Narrative Depth"]);

    const { body: detail } = await call("/games/detail", { game });
    const aspects = detail.page.aspects;
    expect(aspects.map((a: any) => a.name)).toEqual(["Narrative Depth", "Visual Polish"]);
    expect(aspects[0].summary).toEqual({ average: 8.5, count: 2 });
    expect(aspects[1].summary).toEqual({ average: 0, count: 0 });
    const notes = aspects[0].ratings.map((r: any) => [r.reviewer.username, r.score, r.microNote]);
    expect(notes).toContainEqual(["reviewer", 9, "Gripping dialogue."]);

    // Re-rating replaces, and removing a rating flows through to discovery.
    await call("/ratings/rate", { session: buyer, aspect: story, score: 5, microNote: "" });
    expect((await call("/discover/results", { session: buyer })).body.results.matches).toEqual([]);
    await call("/ratings/remove", { session: buyer, aspect: story });
    expect((await call("/discover/results", { session: buyer })).body.results.matches).toHaveLength(1);

    const { body: mine } = await call("/ratings/mine", { session: reviewer });
    expect(mine.mine.ratings).toHaveLength(2);
    expect(mine.mine.ratings.map((r: any) => r.gameInfo.title).sort()).toEqual(["Lantern Tales", "Shiny Blaster"]);
  });

  test("search is public and works from an empty database", async () => {
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  });
});

describe("Access control is enforced on the server", () => {
  test("every state-changing endpoint refuses a missing or invented session with 401", async () => {
    const attempts: Array<[string, Record<string, unknown>]> = [
      ["/games/add", { session: "invented", title: "X", developer: "Y", releaseYear: 2020 }],
      ["/aspects/create", { session: "invented", game: "g", name: "n", description: "" }],
      ["/ratings/rate", { session: "invented", aspect: "a", score: 5, microNote: "" }],
      ["/ratings/remove", { session: "invented", aspect: "a" }],
      ["/ratings/mine", { session: "invented" }],
      ["/discover/set", { session: "invented", aspectName: "Pacing", minScore: 5 }],
      ["/discover/remove", { session: "invented", aspectName: "Pacing" }],
      ["/discover/clear", { session: "invented" }],
      ["/discover/results", { session: "invented" }],
      ["/auth/me", { session: "invented" }],
      ["/auth/logout", { session: "invented" }],
    ];
    for (const [path, body] of attempts) {
      const result = await call(path, body);
      expect(result.status).toBe(401);
      expect(result.body.error).toBe("UNAUTHORIZED");
      const { session: ignored, ...withoutSession } = body;
      const missing = await call(path, withoutSession);
      expect(missing.status).toBe(401);
      expect(missing.body.error).toBe("UNAUTHORIZED");
    }
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  });

  test("a logged-out session no longer authorizes anything", async () => {
    const session = await signUp("mira");
    expect((await call("/auth/me", { session })).body.me.username).toBe("mira");
    expect((await call("/auth/logout", { session })).status).toBe(200);
    expect((await call("/games/add", { session, title: "X", developer: "Y", releaseYear: 2020 })).status).toBe(401);
  });

  test("a rating is always attributed to the session's user, never a claimed one", async () => {
    const mira = await signUp("mira");
    const game = (await call("/games/add", { session: mira, title: "G", developer: "D", releaseYear: 2020 })).body.game;
    const aspect = (await call("/aspects/create", { session: mira, game, name: "Pacing", description: "" })).body.aspect;
    // An extra "user" field is ignored: the endpoint only ever rates as the session's user.
    const forged = await call("/ratings/rate", { session: mira, aspect, score: 5, microNote: "", user: "someone-else" });
    expect(forged.status).toBe(200);
    const { body } = await call("/games/detail", { game });
    expect(body.page.aspects[0].ratings[0].reviewer.username).toBe("mira");
  });

  test("a body-supplied session operator cannot authenticate without a cookie", async () => {
    const result = await call("/games/add", { session: { $ne: null }, title: "X", developer: "Y", releaseYear: 2020 });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("UNAUTHORIZED");
  });
});

describe("Refusals surface as HTTP errors", () => {
  test("duplicate usernames, bad credentials, duplicate games, bad scores, and missing targets", async () => {
    const session = await signUp("mira");
    expect((await call("/auth/register", { username: "mira", password: "x" })).body.error).toBe("CONFLICT");
    expect((await call("/auth/login", { username: "mira", password: "wrong" })).body.error).toBe("UNAUTHORIZED");
    const game = (await call("/games/add", { session, title: "Hades", developer: "SG", releaseYear: 2020 })).body.game;
    expect((await call("/games/add", { session, title: "hades", developer: "SG", releaseYear: 2020 })).body.error).toBe("CONFLICT");
    expect((await call("/games/add", { session, title: "", developer: "SG", releaseYear: 2020 })).body.error).toBe("INVALID_REQUEST");
    const aspect = (await call("/aspects/create", { session, game, name: "Pacing", description: "" })).body.aspect;
    expect((await call("/aspects/create", { session, game, name: "pacing", description: "" })).body.error).toBe("CONFLICT");
    expect((await call("/aspects/create", { session, game: "nope", name: "Pacing", description: "" })).status).toBe(404);
    expect((await call("/ratings/rate", { session, aspect, score: 11, microNote: "" })).body.error).toBe("INVALID_REQUEST");
    expect((await call("/ratings/rate", { session, aspect: "nope", score: 5, microNote: "" })).status).toBe(404);
    expect((await call("/ratings/remove", { session, aspect })).status).toBe(404);
    expect((await call("/discover/set", { session, aspectName: "Pacing", minScore: 0 })).body.error).toBe("INVALID_REQUEST");
    expect((await call("/games/detail", { game: "nope" })).status).toBe(404);
  });
});
