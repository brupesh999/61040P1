import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { DimensionExists, DimensionDefiningConcept, EmptyDimensionName } from "./DimensionDefining.ts";
import { testDb } from "./testing.ts";
let db: Db, reset: () => Promise<void>, close: () => Promise<void>;
let dimensions: DimensionDefiningConcept;
beforeAll(async () => ({ db, reset, close } = await testDb("dimensions")));
beforeEach(async () => { await reset(); dimensions = new DimensionDefiningConcept(db); });
afterAll(async () => close());

describe("DimensionDefining", () => {
  test("principle: names identify stable dimensions within each subject", async () => {
    const first = await dimensions.define({ subject: "book-a", name: "Clarity", description: "Clarity of explanation" });
    const second = await dimensions.define({ subject: "book-b", name: "Clarity", description: "" });
    expect(first.dimension).not.toBe(second.dimension);
    expect(await dimensions._forSubject({ subject: "book-a" })).toEqual([
      { dimension: first.dimension, name: "Clarity", description: "Clarity of explanation" },
    ]);
    expect(await dimensions._named({ subject: "book-a", name: " clarity " })).toEqual([
      { dimension: first.dimension, description: "Clarity of explanation" },
    ]);
    expect(await dimensions._get({ dimension: first.dimension })).toEqual([
      { subject: "book-a", name: "Clarity", description: "Clarity of explanation" },
    ]);
  });

  test("duplicate normalized names are refused without changing the existing definition", async () => {
    const original = await dimensions.define({ subject: "s", name: "  Argument   Quality ", description: "  Original.  " });
    await expect(dimensions.define({ subject: "s", name: "argument quality", description: "Wrong." })).rejects.toThrow(DimensionExists);
    await expect(dimensions.define({ subject: "s", name: "ARGUMENT QUALITY", description: "" })).rejects.toThrow(
      "This dimension name is already defined for this subject.",
    );
    expect(await dimensions._get({ dimension: original.dimension })).toEqual([
      { subject: "s", name: "Argument   Quality", description: "Original." },
    ]);
    expect(await dimensions._forSubject({ subject: "s" })).toHaveLength(1);
  });

  test("blank names are refused and create no dimension", async () => {
    await expect(dimensions.define({ subject: "s", name: " \t ", description: "" })).rejects.toThrow(EmptyDimensionName);
    expect(await dimensions._forSubject({ subject: "s" })).toEqual([]);
  });

  test("lists are ordered by normalized name and all unknown lookups answer no rows", async () => {
    await dimensions.define({ subject: "s", name: "Pacing", description: "" });
    await dimensions.define({ subject: "s", name: "Clarity", description: "" });
    expect((await dimensions._forSubject({ subject: "s" })).map(row => row.name)).toEqual(["Clarity", "Pacing"]);
    expect(await dimensions._forSubject({ subject: "unknown" })).toEqual([]);
    expect(await dimensions._get({ dimension: "unknown" })).toEqual([]);
    expect(await dimensions._named({ subject: "s", name: "missing" })).toEqual([]);
  });

  test("one subject's definition cannot change or shadow another subject's definition", async () => {
    const a = await dimensions.define({ subject: "restaurant-a", name: "Service", description: "Attentiveness" });
    const b = await dimensions.define({ subject: "restaurant-b", name: "Service", description: "Speed" });
    expect(await dimensions._get({ dimension: a.dimension })).toEqual([{ subject: "restaurant-a", name: "Service", description: "Attentiveness" }]);
    expect(await dimensions._get({ dimension: b.dimension })).toEqual([{ subject: "restaurant-b", name: "Service", description: "Speed" }]);
  });
});
