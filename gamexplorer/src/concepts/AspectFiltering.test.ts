import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import {
  AspectFilteringConcept,
  EmptyFilterAspect,
  FilterNotFound,
  InvalidThreshold,
} from "./AspectFiltering.ts";
import { testDb } from "./testing.ts";

let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let filtering: AspectFilteringConcept;

beforeAll(async () => ({ db, reset, close } = await testDb("filtering")));
beforeEach(async () => {
  await reset();
  filtering = new AspectFilteringConcept(db);
});
afterAll(async () => close());

describe("AspectFiltering", () => {
  test("principle: games match only when every criterion's threshold is met", async () => {
    await filtering.recordScore({ game: "g1", aspectName: "Narrative Depth", average: 9, count: 58 });
    await filtering.recordScore({ game: "g2", aspectName: "Narrative Depth", average: 6, count: 10 });

    await filtering.setFilter({ owner: "mira", aspectName: "narrative depth", minScore: 8 });
    await expect(await filtering._matchGames({ owner: "mira" })).toEqual([{ game: "g1" }]);

    // g1 has no Combat Depth score, so adding that criterion removes it.
    await filtering.setFilter({ owner: "mira", aspectName: "Combat Depth", minScore: 5 });
    await expect(await filtering._matchGames({ owner: "mira" })).toEqual([]);

    await filtering.clearFilters({ owner: "mira" });
    await expect(await filtering._filters({ owner: "mira" })).toEqual([]);
    await expect(await filtering._matchGames({ owner: "mira" })).toEqual([]);
  });

  test("thresholds outside 1-10 are refused with INVALID_THRESHOLD", async () => {
    for (const minScore of [0, 10.5, -1, Number.NaN]) {
      await expect(filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore })).rejects.toThrow(
        InvalidThreshold,
      );
    }
    await expect(filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore: 0 })).rejects.toThrow(
      "Threshold score must be between 1 and 10.",
    );
    await expect(await filtering._filters({ owner: "mira" })).toEqual([]);
  });

  test("a blank aspect name is refused with EMPTY_FILTER_ASPECT", async () => {
    await expect(filtering.setFilter({ owner: "mira", aspectName: " ", minScore: 5 })).rejects.toThrow(
      EmptyFilterAspect,
    );
  });

  test("setting a filter on the same aspect replaces its threshold", async () => {
    await filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore: 4 });
    await filtering.setFilter({ owner: "mira", aspectName: "PACING", minScore: 7 });
    await expect(await filtering._filters({ owner: "mira" })).toEqual([{ aspectName: "PACING", minScore: 7 }]);
  });

  test("filters are per owner", async () => {
    await filtering.recordScore({ game: "g1", aspectName: "Pacing", average: 3, count: 1 });
    await filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore: 2 });
    await filtering.setFilter({ owner: "jo", aspectName: "Pacing", minScore: 9 });
    await expect(await filtering._matchGames({ owner: "mira" })).toEqual([{ game: "g1" }]);
    await expect(await filtering._matchGames({ owner: "jo" })).toEqual([]);
    await filtering.clearFilters({ owner: "jo" });
    await expect(await filtering._filters({ owner: "mira" })).toHaveLength(1);
  });

  test("removing a filter that does not exist is refused with FILTER_NOT_FOUND", async () => {
    await filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore: 4 });
    await filtering.removeFilter({ owner: "mira", aspectName: "pacing" });
    await expect(filtering.removeFilter({ owner: "mira", aspectName: "Pacing" })).rejects.toThrow(FilterNotFound);
  });

  test("recordScore updates and, with count 0, removes a score", async () => {
    await filtering.recordScore({ game: "g1", aspectName: "Pacing", average: 5, count: 1 });
    await filtering.recordScore({ game: "g1", aspectName: "Pacing", average: 7.5, count: 2 });
    await expect(await filtering._score({ game: "g1", aspectName: "pacing" })).toEqual([{ average: 7.5, count: 2 }]);
    await expect(await filtering._aspectNames({})).toEqual([{ aspectName: "Pacing" }]);
    await filtering.recordScore({ game: "g1", aspectName: "Pacing", average: 0, count: 0 });
    await expect(await filtering._score({ game: "g1", aspectName: "Pacing" })).toEqual([]);
    await expect(await filtering._aspectNames({})).toEqual([]);
  });

  test("matches are ordered by best matched average, and the threshold is inclusive", async () => {
    await filtering.recordScore({ game: "low", aspectName: "Pacing", average: 8, count: 1 });
    await filtering.recordScore({ game: "high", aspectName: "Pacing", average: 9.5, count: 1 });
    await filtering.setFilter({ owner: "mira", aspectName: "Pacing", minScore: 8 });
    await expect(await filtering._matchGames({ owner: "mira" })).toEqual([{ game: "high" }, { game: "low" }]);
  });
});
