import { expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";

const suite = integrationSuite("discovery");
const { call, signUp } = suite;

test("two criteria require both scores, and a missing rating cannot satisfy the second", async () => {
  const session = await signUp("discovery-reader");
  const entries: Array<{ game: string; combat: string }> = [];
  for (const [steamAppId, storyScore, combatScore] of [[1, 9, 8], [2, 9, null], [3, 7, 10]] as const) {
    const added = await call("/games/add", { session, steamAppId });
    expect(added.status).toBe(200);
    const game = added.body.game as string;
    const story = await call("/aspects/create", { session, game, name: "Narrative Depth", description: "" });
    const combat = await call("/aspects/create", { session, game, name: "Combat", description: "" });
    expect(story.status).toBe(200);
    expect(combat.status).toBe(200);
    expect((await call("/ratings/rate", { session, aspect: story.body.aspect, score: storyScore, microNote: "" })).status).toBe(200);
    if (combatScore !== null) {
      expect((await call("/ratings/rate", { session, aspect: combat.body.aspect, score: combatScore, microNote: "" })).status).toBe(200);
    }
    entries.push({ game, combat: combat.body.aspect });
  }
  const [both, missing, lowStory] = entries;
  const narrative = await call("/discover/set", { session, aspectName: "Narrative Depth", minScore: 8 });
  expect(narrative.status).toBe(200);
  expect(narrative.body.results.matches.map((match: any) => match.game).sort()).toEqual([both.game, missing.game].sort());

  const conjunction = await call("/discover/set", { session, aspectName: "Combat", minScore: 8 });
  expect(conjunction.status).toBe(200);
  expect(conjunction.body.results.filters).toEqual([
    { aspectName: "Combat", minScore: 8 }, { aspectName: "Narrative Depth", minScore: 8 },
  ]);
  expect(conjunction.body.results.matches.map((match: any) => match.game)).toEqual([both.game]);
  expect(conjunction.body.results.matches[0].scores).toEqual([
    { aspectName: "Combat", score: { average: 8, count: 1 } },
    { aspectName: "Narrative Depth", score: { average: 9, count: 1 } },
  ]);
  const missingDetail = (await call("/games/detail", { game: missing.game })).body.page;
  expect(missingDetail.aspects.find((aspect: any) => aspect.aspect === missing.combat).summary).toEqual({ average: 0, count: 0 });
  expect(conjunction.body.results.matches.some((match: any) => match.game === lowStory.game)).toBe(false);

  // Revisions and final removals must update the same two-criterion projection.
  expect((await call("/ratings/rate", { session, aspect: both.combat, score: 7, microNote: "Revised." })).status).toBe(200);
  expect((await call("/discover/results", { session })).body.results.matches).toEqual([]);
  expect((await call("/ratings/rate", { session, aspect: missing.combat, score: 8, microNote: "" })).status).toBe(200);
  expect((await call("/discover/results", { session })).body.results.matches.map((match: any) => match.game)).toEqual([missing.game]);
  expect((await call("/ratings/remove", { session, aspect: missing.combat })).status).toBe(200);
  expect((await call("/discover/results", { session })).body.results.matches).toEqual([]);

  const relaxed = await call("/discover/remove", { session, aspectName: "Combat" });
  expect(relaxed.status).toBe(200);
  expect(relaxed.body.results.matches.map((match: any) => match.game).sort()).toEqual([both.game, missing.game].sort());
});
