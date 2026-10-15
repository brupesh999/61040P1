import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { ThresholdFilteringConcept, EmptyCriterion, InvalidValue, InvalidMinimum, CriterionNotFound } from "./ThresholdFiltering.ts";
import { testDb } from "./testing.ts";
let db: Db, reset: () => Promise<void>, close: () => Promise<void>;
let filtering: ThresholdFilteringConcept;
beforeAll(async () => ({ db, reset, close } = await testDb("threshold")));
beforeEach(async () => { await reset(); filtering = new ThresholdFilteringConcept(db); });
afterAll(async () => close());

describe("ThresholdFiltering", () => {
  test("principle: all requirements must be present and met; withdrawing a value removes a match", async () => {
    await filtering.recordValue({ item: "room-a", criterion: "Capacity", value: 30 });
    await filtering.recordValue({ item: "room-b", criterion: "Capacity", value: 10 });
    await filtering.setCriterion({ owner: "organizer", criterion: "capacity", minimum: 20 });
    expect(await filtering._matches({ owner: "organizer" })).toEqual([{ item: "room-a" }]);
    await filtering.setCriterion({ owner: "organizer", criterion: "Desks", minimum: 15 });
    expect(await filtering._matches({ owner: "organizer" })).toEqual([]);
    await filtering.recordValue({ item: "room-a", criterion: "Desks", value: 15 });
    expect(await filtering._matches({ owner: "organizer" })).toEqual([{ item: "room-a" }]);
    await filtering.forgetValue({ item: "room-a", criterion: "Capacity" });
    expect(await filtering._matches({ owner: "organizer" })).toEqual([]);
    expect(await filtering._criteria({ owner: "organizer" })).toHaveLength(2);
    await filtering.clearCriteria({ owner: "organizer" });
    expect(await filtering._criteria({ owner: "organizer" })).toEqual([]);
    expect(await filtering._matches({ owner: "organizer" })).toEqual([]);
  });

  test("negative values and thresholds above ten work without rating concepts", async () => {
    await filtering.recordValue({ item: "station", criterion: "Temperature", value: -4 });
    await filtering.recordValue({ item: "station", criterion: "Capacity", value: 5000 });
    await filtering.setCriterion({ owner: "planner", criterion: "Temperature", minimum: -5 });
    await filtering.setCriterion({ owner: "planner", criterion: "Capacity", minimum: 4000 });
    expect(await filtering._matches({ owner: "planner" })).toEqual([{ item: "station" }]);
  });

  test("nonfinite values preserve the previous value", async () => {
    await filtering.recordValue({ item: "i", criterion: "c", value: 42 });
    for (const value of [NaN, Infinity, -Infinity])
      await expect(filtering.recordValue({ item: "i", criterion: "c", value })).rejects.toThrow(InvalidValue);
    expect(await filtering._value({ item: "i", criterion: "c" })).toEqual([{ value: 42 }]);
  });

  test("nonfinite minimums preserve the previous requirement", async () => {
    await filtering.setCriterion({ owner: "o", criterion: "c", minimum: 42 });
    for (const minimum of [NaN, Infinity, -Infinity])
      await expect(filtering.setCriterion({ owner: "o", criterion: "c", minimum })).rejects.toThrow(InvalidMinimum);
    expect(await filtering._criteria({ owner: "o" })).toEqual([{ criterion: "c", minimum: 42 }]);
  });

  test("blank criteria are refused before recording values or requirements", async () => {
    await expect(filtering.recordValue({ item: "i", criterion: "  ", value: 2 })).rejects.toThrow(EmptyCriterion);
    await expect(filtering.setCriterion({ owner: "o", criterion: "\t", minimum: 2 })).rejects.toThrow(EmptyCriterion);
    expect(await filtering._criterionNames({})).toEqual([]);
    expect(await filtering._criteria({ owner: "o" })).toEqual([]);
  });

  test("name normalization replaces an existing criterion and value", async () => {
    await filtering.setCriterion({ owner: "o", criterion: "  Desk   Count ", minimum: 4 });
    await filtering.setCriterion({ owner: "o", criterion: "desk count", minimum: 7 });
    expect(await filtering._criteria({ owner: "o" })).toEqual([{ criterion: "desk count", minimum: 7 }]);
    await filtering.recordValue({ item: "i", criterion: "Desk Count", value: 8 });
    await filtering.recordValue({ item: "i", criterion: "desk   count", value: 9 });
    expect(await filtering._value({ item: "i", criterion: "DESK COUNT" })).toEqual([{ value: 9 }]);
    expect(await filtering._criterionNames({})).toEqual([{ criterion: "desk   count" }]);
  });

  test("criteria and removal are scoped to one owner", async () => {
    await filtering.recordValue({ item: "i", criterion: "c", value: 8 });
    await filtering.setCriterion({ owner: "one", criterion: "c", minimum: 7 });
    await filtering.setCriterion({ owner: "two", criterion: "c", minimum: 9 });
    expect(await filtering._matches({ owner: "one" })).toEqual([{ item: "i" }]);
    expect(await filtering._matches({ owner: "two" })).toEqual([]);
    await filtering.removeCriterion({ owner: "two", criterion: "C" });
    await expect(filtering.removeCriterion({ owner: "two", criterion: "c" })).rejects.toThrow(CriterionNotFound);
    expect(await filtering._criteria({ owner: "one" })).toHaveLength(1);
  });

  test("forgetting unknown values is idempotent and unknown items have no values", async () => {
    await filtering.forgetValue({ item: "unknown", criterion: "c" });
    await filtering.forgetValue({ item: "unknown", criterion: "c" });
    expect(await filtering._value({ item: "unknown", criterion: "c" })).toEqual([]);
  });

  test("matching includes equality and orders by highest selected value", async () => {
    await filtering.recordValue({ item: "low", criterion: "c", value: 8 });
    await filtering.recordValue({ item: "high", criterion: "c", value: 9.5 });
    await filtering.setCriterion({ owner: "o", criterion: "c", minimum: 8 });
    expect(await filtering._matches({ owner: "o" })).toEqual([{ item: "high" }, { item: "low" }]);
  });
});
