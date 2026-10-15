import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { testDb } from "./testing.ts";
import { AspectManagingConcept } from "./fixtures/AspectManagingP2.ts";
import { AspectRatingConcept } from "./fixtures/AspectRatingP2.ts";
import { AspectFilteringConcept } from "./fixtures/AspectFilteringP2.ts";
import { DimensionDefiningConcept } from "./DimensionDefining.ts";
import { RatingConcept } from "./Rating.ts";
import { ThresholdFilteringConcept } from "./ThresholdFiltering.ts";
let db: Db, reset: () => Promise<void>, close: () => Promise<void>;
beforeAll(async () => ({ db, reset, close } = await testDb("compatibility")));
beforeEach(async () => reset());
afterAll(async () => close());

test("P2 dimension identities, sparse reviews, and owner criteria remain usable without a database rewrite", async () => {
  // Genuine old actions create the legacy state; no fixture writes raw documents.
  const oldDimensions = new AspectManagingConcept(db);
  const oldRating = new AspectRatingConcept(db);
  const oldFiltering = new AspectFilteringConcept(db);
  const { aspect } = await oldDimensions.createAspect({ game: "kept-game", name: "Pacing", description: "Kept description." });
  await oldRating.rateAspect({ user: "kept-user", game: "kept-game", aspect, score: 8, microNote: "Kept review." });
  await oldFiltering.recordScore({ game: "kept-game", aspectName: "Pacing", average: 8, count: 1 });
  await oldFiltering.setFilter({ owner: "kept-buyer", aspectName: "Pacing", minScore: 7 });

  const dimensions = new DimensionDefiningConcept(db);
  const rating = new RatingConcept(db);
  const filtering = new ThresholdFilteringConcept(db);
  expect(await dimensions._forSubject({ subject: "kept-game" })).toEqual([
    { dimension: aspect, name: "Pacing", description: "Kept description." },
  ]);
  expect(await rating._byRater({ rater: "kept-user" })).toEqual([{ target: aspect, score: 8, note: "Kept review." }]);
  expect(await filtering._criteria({ owner: "kept-buyer" })).toEqual([{ criterion: "Pacing", minimum: 7 }]);
  expect(await filtering._matches({ owner: "kept-buyer" })).toEqual([{ item: "kept-game" }]);

  await rating.rate({ rater: "kept-user", target: aspect, score: 9, note: "Updated review." });
  expect(await rating._summary({ target: aspect })).toEqual({ average: 9, count: 1 });
  await filtering.recordValue({ item: "kept-game", criterion: "Pacing", value: 9 });
  expect(await filtering._value({ item: "kept-game", criterion: "Pacing" })).toEqual([{ value: 9 }]);
  await rating.remove({ rater: "kept-user", target: aspect });
  await filtering.forgetValue({ item: "kept-game", criterion: "Pacing" });
  expect(await filtering._matches({ owner: "kept-buyer" })).toEqual([]);
  expect(await filtering._criteria({ owner: "kept-buyer" })).toHaveLength(1);
  expect(await dimensions._get({ dimension: aspect })).toEqual([
    { subject: "kept-game", name: "Pacing", description: "Kept description." },
  ]);
});
