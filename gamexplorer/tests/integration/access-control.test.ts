import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";

const suite = integrationSuite("access-control");
const { call, signUp, ratedAspect } = suite;

describe("Server-side access control", () => {
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
    expect(suite.steam.lookups).toBe(0);
    expect(suite.steam.searches).toBe(0);
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
