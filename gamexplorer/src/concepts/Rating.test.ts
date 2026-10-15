import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { RatingConcept, InvalidScore, NoteTooLong, RatingNotFound } from "./Rating.ts";
import { testDb } from "./testing.ts";
let db: Db, reset: () => Promise<void>, close: () => Promise<void>;
let rating: RatingConcept;
beforeAll(async () => ({ db, reset, close } = await testDb("rating")));
beforeEach(async () => { await reset(); rating = new RatingConcept(db); });
afterAll(async () => close());

describe("Rating", () => {
  test("principle: independent evaluations contribute once, revisions replace, withdrawal preserves others", async () => {
    await rating.rate({ rater: "reader-a", target: "book-1", score: 9, note: "Clear prose." });
    await rating.rate({ rater: "reader-b", target: "book-1", score: 5, note: "" });
    expect(await rating._summary({ target: "book-1" })).toEqual({ average: 7, count: 2 });
    await rating.rate({ rater: "reader-a", target: "book-1", score: 7, note: "Revised." });
    expect(await rating._summary({ target: "book-1" })).toEqual({ average: 6, count: 2 });
    expect(await rating._byRater({ rater: "reader-a" })).toEqual([{ target: "book-1", score: 7, note: "Revised." }]);
    await rating.remove({ rater: "reader-a", target: "book-1" });
    expect(await rating._forTarget({ target: "book-1" })).toEqual([{ rater: "reader-b", score: 5, note: "" }]);
    expect(await rating._summary({ target: "book-1" })).toEqual({ average: 5, count: 1 });
    await expect(rating.remove({ rater: "reader-a", target: "book-1" })).rejects.toThrow(RatingNotFound);
  });

  test("ratings can target whole books directly without creating evaluation dimensions or a game catalog", async () => {
    await rating.rate({ rater: "reader", target: "isbn-9780141187761", score: 10, note: "" });
    await rating.rate({ rater: "reader", target: "isbn-9780141182803", score: 1, note: "" });
    expect(await rating._byRater({ rater: "reader" })).toHaveLength(2);
    expect(await rating._summary({ target: "isbn-9780141187761" })).toEqual({ average: 10, count: 1 });
  });

  test("invalid scores preserve the previous evaluation", async () => {
    await rating.rate({ rater: "r", target: "t", score: 8, note: "Saved." });
    for (const score of [0, 11, 1.5, Number.NaN, Infinity])
      await expect(rating.rate({ rater: "r", target: "t", score, note: "Wrong." })).rejects.toThrow(InvalidScore);
    expect(await rating._byRater({ rater: "r" })).toEqual([{ target: "t", score: 8, note: "Saved." }]);
  });

  test("notes are trimmed before the 280-character bound and a refused note preserves state", async () => {
    await rating.rate({ rater: "r", target: "t", score: 8, note: "  " + "x".repeat(280) + "  " });
    await expect(rating.rate({ rater: "r", target: "t", score: 1, note: "x".repeat(281) })).rejects.toThrow(NoteTooLong);
    expect(await rating._byRater({ rater: "r" })).toEqual([{ target: "t", score: 8, note: "x".repeat(280) }]);
  });

  test("means round to one decimal and empty targets answer zero count", async () => {
    for (const [rater, score] of [["a", 8], ["b", 8], ["c", 9]] as const)
      await rating.rate({ rater, target: "t", score, note: "" });
    expect(await rating._summary({ target: "t" })).toEqual({ average: 8.3, count: 3 });
    expect(await rating._summary({ target: "unknown" })).toEqual({ average: 0, count: 0 });
    expect(await rating._forTarget({ target: "unknown" })).toEqual([]);
    expect(await rating._byRater({ rater: "unknown" })).toEqual([]);
  });

  test("an extra parent value cannot manufacture a second evaluation of the same target", async () => {
    const first = { rater: "r", target: "t", score: 8, note: "", parent: "one" };
    const second = { ...first, score: 6, parent: "two" };
    await rating.rate(first); await rating.rate(second);
    expect(await rating._summary({ target: "t" })).toEqual({ average: 6, count: 1 });
  });
});
