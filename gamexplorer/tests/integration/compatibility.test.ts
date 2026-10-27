import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";
import { GameCatalogConcept } from "../../src/concepts/GameCatalog.ts";
import { AspectManagingConcept } from "../../src/concepts/fixtures/AspectManagingP2.ts";
import { AspectRatingConcept } from "../../src/concepts/fixtures/AspectRatingP2.ts";
import { AspectFilteringConcept } from "../../src/concepts/fixtures/AspectFilteringP2.ts";

const suite = integrationSuite("compatibility");
const { call, signUp } = suite;

describe("P2 data compatibility", () => {
  test("P2 contributions remain editable through the current HTTP endpoints", async () => {
    const session = await signUp("returning-player");
    const user = (await call("/auth/me", { session })).body.me.user;
    const { game } = await new GameCatalogConcept(suite.db).addGame({
      title: "Returning Game", developer: "Existing Studio", releaseYear: 2020,
    });
    // Use the actual former implementation's actions to reproduce persisted P2 state.
    const { aspect } = await new AspectManagingConcept(suite.db).createAspect({
      game, name: "Pacing", description: "An existing dimension.",
    });
    await new AspectRatingConcept(suite.db).rateAspect({ user, game, aspect, score: 8, microNote: "Original review." });
    const oldDiscovery = new AspectFilteringConcept(suite.db);
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
});
