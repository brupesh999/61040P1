import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";

const suite = integrationSuite("journey");
const { call, signUp, ratedAspect } = suite;

describe("Review and discovery journey", () => {
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
});

test("reassembling over stored state retains sessions, ratings, filters, and their ownership", async () => {
  const { reviewer, buyer, game, aspect } = await ratedAspect();
  const beforeMine = (await call("/ratings/mine", { session: reviewer })).body;
  const beforeResults = (await call("/discover/results", { session: buyer })).body;
  const beforeDetail = (await call("/games/detail", { game })).body;

  // Rebuild the handler, engine, and all concept instances without resetting MongoDB.
  suite.restart();
  expect((await call("/auth/me", { session: reviewer })).body.me.username).toBe("reviewer");
  expect((await call("/ratings/mine", { session: reviewer })).body).toEqual(beforeMine);
  expect((await call("/discover/results", { session: buyer })).body).toEqual(beforeResults);
  expect((await call("/games/detail", { game })).body).toEqual(beforeDetail);
  expect((await call("/ratings/mine", { session: buyer })).body.mine.ratings).toEqual([]);
  expect((await call("/discover/results", { session: reviewer })).body.results.filters).toEqual([]);

  expect((await call("/ratings/rate", { session: reviewer, aspect, score: 10, microNote: "Updated after restart." })).status).toBe(200);
  expect((await call("/discover/results", { session: buyer })).body.results.matches[0].scores[0].score).toEqual({ average: 10, count: 1 });
  expect((await call("/ratings/mine", { session: reviewer })).body.mine.ratings[0]).toMatchObject({ aspect, score: 10, microNote: "Updated after restart." });
});
