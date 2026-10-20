import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { Db } from "mongodb";
import { assembleApplication } from "./assembly.ts";
import { gamexplorerPolicy } from "./http.ts";
import { testDb } from "./concepts/testing.ts";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { importSteamCatalog } from "./catalogImport.ts";
import { AspectManagingConcept } from "./concepts/fixtures/AspectManagingP2.ts";
import { AspectRatingConcept } from "./concepts/fixtures/AspectRatingP2.ts";
import { AspectFilteringConcept } from "./concepts/fixtures/AspectFilteringP2.ts";
import { FixtureSteam, steamGame } from "./testing/steam.ts";

/**
 * Drives the real HTTP handler, reactions, and concepts against a throwaway Mongo database.
 * Steam supplies fixture metadata; core application logic is not mocked.
 * State is created through concept actions or endpoints.
 */
let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let handler: (request: Request) => Promise<Response>;
let steam: FixtureSteam;

beforeAll(async () => ({ db, reset, close } = await testDb("app")));
beforeEach(async () => {
  await reset();
  steam = new FixtureSteam([
    steamGame(1, "Lantern Tales", "Tiny Owl", 2021),
    steamGame(2, "Shiny Blaster", "Big Studio", 2023),
    steamGame(3, "Hades", "Supergiant", 2020),
    steamGame(4, "G", "D", 2020),
  ]);
  const application = assembleApplication(db, undefined, steam);
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
    session: reviewer, steamAppId: 1,
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
  test("P2 contributions remain editable through the current HTTP endpoints", async () => {
    const session = await signUp("returning-player");
    const user = (await call("/auth/me", { session })).body.me.user;
    const { game } = await new GameCatalogConcept(db).addGame({
      title: "Returning Game", developer: "Existing Studio", releaseYear: 2020,
    });
    // Use the actual former implementation's actions to reproduce persisted P2 state.
    const { aspect } = await new AspectManagingConcept(db).createAspect({
      game, name: "Pacing", description: "An existing dimension.",
    });
    await new AspectRatingConcept(db).rateAspect({ user, game, aspect, score: 8, microNote: "Original review." });
    const oldDiscovery = new AspectFilteringConcept(db);
    await oldDiscovery.recordScore({ game, aspectName: "Pacing", average: 8, count: 1 });
    await oldDiscovery.setFilter({ owner: user, aspectName: "Pacing", minScore: 7 });

    const before = (await call("/games/detail", { game })).body.page.aspects[0];
    expect(before).toMatchObject({ aspect, name: "Pacing", summary: { average: 8, count: 1 } });
    expect(before.ratings[0]).toMatchObject({ score: 8, microNote: "Original review." });
    expect((await call("/ratings/mine", { session })).body.mine.ratings[0]).toMatchObject({
      game, aspect, score: 8, gameInfo: { title: "Returning Game" }, aspectInfo: { name: "Pacing" },
    });
    expect((await call("/discover/results", { session })).body.results.matches[0]).toMatchObject({ game });

    expect((await call("/ratings/rate", {
      session, aspect, game: "forged-parent", score: 9, microNote: "Updated review.",
    })).status).toBe(200);
    const after = (await call("/games/detail", { game })).body.page.aspects[0];
    expect(after.summary).toEqual({ average: 9, count: 1 });
    expect(after.ratings).toHaveLength(1);
    expect(after.ratings[0]).toMatchObject({ score: 9, microNote: "Updated review." });
    expect((await call("/discover/results", { session })).body.results.matches[0].scores[0].score)
      .toEqual({ average: 9, count: 1 });

    expect((await call("/ratings/remove", { session, aspect })).status).toBe(200);
    expect((await call("/ratings/mine", { session })).body.mine.ratings).toEqual([]);
    const discovery = (await call("/discover/results", { session })).body.results;
    expect(discovery.matches).toEqual([]);
    expect(discovery.filters).toEqual([{ aspectName: "Pacing", minScore: 7 }]);
    expect((await call("/games/detail", { game })).body.page.aspects[0]).toMatchObject({
      aspect, name: "Pacing", summary: { average: 0, count: 0 }, ratings: [],
    });
  });

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

  test("overlapping reviewers leave discovery equal to the final stored average", async () => {
    const { reviewer, buyer, game, aspect } = await ratedAspect();
    const third = await signUp("third-reviewer");
    // Separate HTTP roots contend for the same dimension; no core logic is mocked.
    for (const scores of [[1, 4, 10], [10, 9, 8], [3, 7, 9]]) {
      const replies = await Promise.all([reviewer, buyer, third].map((session, index) =>
        call("/ratings/rate", { session, aspect, score: scores[index], microNote: "Concurrent review." }),
      ));
      expect(replies.map(reply => reply.status)).toEqual([200, 200, 200]);
      const expected = { average: Math.round(scores.reduce((sum, score) => sum + score, 0) / 3 * 10) / 10, count: 3 };
      expect((await call("/games/detail", { game })).body.page.aspects[0].summary).toEqual(expected);
      const minimum = expected.average + 0.1;
      const excluded = await call("/discover/set", { session: buyer, aspectName: "Narrative Depth", minScore: minimum });
      expect(excluded.body.results.matches).toEqual([]);
      const included = await call("/discover/set", { session: buyer, aspectName: "Narrative Depth", minScore: expected.average });
      expect(included.body.results.matches).toHaveLength(1);
      expect(included.body.results.matches[0].scores[0].score).toEqual(expected);
    }
    expect((await Promise.all([reviewer, buyer, third].map(session =>
      call("/ratings/remove", { session, aspect }),
    ))).map(reply => reply.status)).toEqual([200, 200, 200]);
    expect((await call("/discover/results", { session: buyer })).body.results.matches).toEqual([]);
    expect((await call("/games/detail", { game })).body.page.aspects[0].summary).toEqual({ average: 0, count: 0 });
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
      steamAppId: 1,
    });
    const game = added.game as string;
    const { body: other } = await call("/games/add", {
      session: reviewer,
      steamAppId: 2,
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

    // The reaction projected averages into GameDiscovery; a filter of >= 8 finds only Lantern Tales.
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
      ["/games/add", { session: "invented", steamAppId: 1 }],
      ["/games/steam/search", { session: "invented", query: "Lantern" }],
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
    expect(steam.lookups).toBe(0);
    expect(steam.searches).toBe(0);
  });

  test("a logged-out session no longer authorizes anything", async () => {
    const session = await signUp("mira");
    expect((await call("/auth/me", { session })).body.me.username).toBe("mira");
    expect((await call("/auth/logout", { session })).status).toBe(200);
    expect((await call("/games/add", { session, steamAppId: 1 })).status).toBe(401);
  });

  test("a rating is always attributed to the session's user, never a claimed one", async () => {
    const mira = await signUp("mira");
    const game = (await call("/games/add", { session: mira, steamAppId: 4 })).body.game;
    const aspect = (await call("/aspects/create", { session: mira, game, name: "Pacing", description: "" })).body.aspect;
    // An extra "user" field is ignored: the endpoint only ever rates as the session's user.
    const forged = await call("/ratings/rate", { session: mira, aspect, score: 5, microNote: "", user: "someone-else" });
    expect(forged.status).toBe(200);
    const { body } = await call("/games/detail", { game });
    expect(body.page.aspects[0].ratings[0].reviewer.username).toBe("mira");
  });

  test("a body-supplied session operator cannot authenticate without a cookie", async () => {
    const result = await call("/games/add", { session: { $ne: null }, steamAppId: 1 });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("UNAUTHORIZED");
  });
});

describe("Steam catalog HTTP workflow", () => {
  test("a verified choice overrides forged browser metadata and repeated additions preserve reviews", async () => {
    const session = await signUp("steam-reviewer");
    const search = await call("/games/steam/search", { session, query: "Lantern" });
    expect(search.status).toBe(200);
    expect(search.body.results.games).toHaveLength(1);
    expect(search.body.results.games[0]).toMatchObject({ steamAppId: 1, title: "Lantern Tales" });
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
    const added = await call("/games/add", {
      session, steamAppId: 1, title: "Forged title", developer: "Fake developer", releaseYear: 1950,
      coverUrl: "https://example.org/fake.jpg", user: "someone-else",
    });
    expect(added.status).toBe(200);
    const game = added.body.game;
    const aspect = (await call("/aspects/create", { session, game, name: "Pacing", description: "" })).body.aspect;
    await call("/ratings/rate", { session, aspect, score: 9, microNote: "Preserve this review." });
    const before = (await call("/games/detail", { game })).body;
    expect(before.page).toMatchObject({ title: "Lantern Tales", developer: "Tiny Owl", releaseYear: 2021,
      cover: { steamAppId: 1, coverUrl: steam.games[0]!.coverUrl } });
    expect((await call("/games/steam/search", { session, query: "Lantern" })).body.results.games[0].existing).toEqual({ game });
    steam.available = false;
    expect((await call("/games/add", { session, steamAppId: 1 })).body).toEqual({ game });
    expect((await call("/games/detail", { game })).body).toEqual(before);
    expect((await call("/games/search", { query: "" })).body.results.games).toHaveLength(1);
  });

  test("manual metadata, operator IDs, malformed searches, and unavailable Steam cannot create catalog state", async () => {
    const session = await signUp("steam-player");
    for (const payload of [
      { title: "Manual game", developer: "Studio", releaseYear: 2020 },
      { steamAppId: { $ne: null } }, { steamAppId: "1" }, { steamAppId: 1.5 }, { steamAppId: 999 },
    ]) {
      const result = await call("/games/add", { session, ...payload });
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "INVALID_REQUEST" });
    }
    for (const query of ["", "x", "x".repeat(101)]) {
      expect((await call("/games/steam/search", { session, query })).status).toBe(400);
    }
    expect(steam.searches).toBe(0);
    steam.available = false;
    expect((await call("/games/add", { session, steamAppId: 1 })).status).toBe(500);
    expect((await call("/games/steam/search", { session, query: "Lantern" })).status).toBe(500);
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  });
});

describe("Refusals surface as HTTP errors", () => {
  test("duplicate usernames, bad credentials, invalid Steam choices, bad scores, and missing targets", async () => {
    const session = await signUp("mira");
    expect((await call("/auth/register", { username: "mira", password: "x" })).body.error).toBe("CONFLICT");
    expect((await call("/auth/login", { username: "mira", password: "wrong" })).body.error).toBe("UNAUTHORIZED");
    const game = (await call("/games/add", { session, steamAppId: 3 })).body.game;
    expect((await call("/games/add", { session, steamAppId: 3 })).body.game).toBe(game);
    expect((await call("/games/add", { session, steamAppId: -1 })).body.error).toBe("INVALID_REQUEST");
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
