import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { AspectRatingConcept, InvalidScore, NoteTooLong, RatingNotFound } from "./AspectRating.ts";
import { testDb } from "./testing.ts";

let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let ratings: AspectRatingConcept;

beforeAll(async () => ({ db, reset, close } = await testDb("ratings")));
beforeEach(async () => {
  await reset();
  ratings = new AspectRatingConcept(db);
});
afterAll(async () => close());

describe("AspectRating", () => {
  test("principle: a sparse rating is stored, replaced on re-rating, and removable", async () => {
    await ratings.rateAspect({ user: "u1", game: "g1", aspect: "story", score: 9, microNote: "Gripping." });
    await expect(await ratings._getUserRatings({ user: "u1" })).toEqual([
      { game: "g1", aspect: "story", score: 9, microNote: "Gripping." },
    ]);
    // The other aspect of the game stays unrated.
    await expect(await ratings._summary({ aspect: "combat" })).toEqual({ average: 0, count: 0 });

    await ratings.rateAspect({ user: "u1", game: "g1", aspect: "story", score: 7, microNote: "Slower 2nd act." });
    await expect(await ratings._forAspect({ aspect: "story" })).toEqual([
      { user: "u1", score: 7, microNote: "Slower 2nd act." },
    ]);
    await expect(await ratings._summary({ aspect: "story" })).toEqual({ average: 7, count: 1 });

    await expect(await ratings.removeRating({ user: "u1", game: "g1", aspect: "story" })).toEqual({});
    await expect(await ratings._getRatingsForGame({ game: "g1" })).toEqual([]);
    const again = ratings.removeRating({ user: "u1", game: "g1", aspect: "story" });
    await expect(again).rejects.toThrow(RatingNotFound);
    await expect(again).rejects.toThrow("No rating exists for this aspect by the user.");
  });

  test("scores outside 1-10 or non-integers are refused with INVALID_SCORE", async () => {
    for (const score of [0, 11, -3, 5.5, Number.NaN]) {
      const attempt = ratings.rateAspect({ user: "u1", game: "g1", aspect: "a", score, microNote: "" });
      await expect(attempt).rejects.toThrow(InvalidScore);
    }
    await expect(
      ratings.rateAspect({ user: "u1", game: "g1", aspect: "a", score: 0, microNote: "" }),
    ).rejects.toThrow("Score must be an integer between 1 and 10.");
    await expect(await ratings._getRatingsForGame({ game: "g1" })).toEqual([]);
  });

  test("boundary scores 1 and 10 are accepted", async () => {
    await ratings.rateAspect({ user: "u1", game: "g1", aspect: "a", score: 1, microNote: "" });
    await ratings.rateAspect({ user: "u2", game: "g1", aspect: "a", score: 10, microNote: "" });
    await expect(await ratings._summary({ aspect: "a" })).toEqual({ average: 5.5, count: 2 });
  });

  test("a micro note over 280 characters is refused with NOTE_TOO_LONG", async () => {
    const attempt = ratings.rateAspect({
      user: "u1",
      game: "g1",
      aspect: "a",
      score: 5,
      microNote: "x".repeat(281),
    });
    await expect(attempt).rejects.toThrow(NoteTooLong);
  });

  test("summary averages across users and rounds to one decimal", async () => {
    await ratings.rateAspect({ user: "u1", game: "g1", aspect: "a", score: 9, microNote: "" });
    await ratings.rateAspect({ user: "u2", game: "g1", aspect: "a", score: 8, microNote: "" });
    await ratings.rateAspect({ user: "u3", game: "g1", aspect: "a", score: 8, microNote: "" });
    await expect(await ratings._summary({ aspect: "a" })).toEqual({ average: 8.3, count: 3 });
  });

  test("one user's removal does not touch another user's rating", async () => {
    await ratings.rateAspect({ user: "u1", game: "g1", aspect: "a", score: 4, microNote: "" });
    await ratings.rateAspect({ user: "u2", game: "g1", aspect: "a", score: 8, microNote: "" });
    await ratings.removeRating({ user: "u1", game: "g1", aspect: "a" });
    await expect(await ratings._forAspect({ aspect: "a" })).toEqual([{ user: "u2", score: 8, microNote: "" }]);
    await expect(ratings.removeRating({ user: "u1", game: "g1", aspect: "a" })).rejects.toThrow(RatingNotFound);
  });
});
