import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";

const suite = integrationSuite("ratings");
const { call, signUp, ratedAspect } = suite;

describe("Rating projections", () => {
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
});
