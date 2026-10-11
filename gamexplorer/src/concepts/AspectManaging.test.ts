import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { AspectExists, AspectManagingConcept, EmptyAspectName } from "./AspectManaging.ts";
import { testDb } from "./testing.ts";

let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let aspects: AspectManagingConcept;

beforeAll(async () => ({ db, reset, close } = await testDb("aspects")));
beforeEach(async () => {
  await reset();
  aspects = new AspectManagingConcept(db);
});
afterAll(async () => close());

describe("AspectManaging", () => {
  test("principle: a created aspect is listed for its game and can be referenced", async () => {
    const { aspect } = await aspects.createAspect({
      game: "g1",
      name: "Combat Depth",
      description: "How deep the combat system is",
    });
    await expect(await aspects._getAspects({ game: "g1" })).toEqual([
      { aspect, name: "Combat Depth", description: "How deep the combat system is" },
    ]);
    await expect(await aspects._get({ aspect })).toEqual([
      { game: "g1", name: "Combat Depth", description: "How deep the combat system is" },
    ]);
  });

  test("a duplicate name for the same game is refused, ignoring case", async () => {
    await aspects.createAspect({ game: "g1", name: "Combat Depth", description: "" });
    const duplicate = aspects.createAspect({ game: "g1", name: " combat depth", description: "" });
    await expect(duplicate).rejects.toThrow(AspectExists);
    await expect(duplicate).rejects.toThrow("This aspect already exists for the specified game.");
    await expect(await aspects._getAspects({ game: "g1" })).toHaveLength(1);
  });

  test("the same name can be created for a different game", async () => {
    const a = await aspects.createAspect({ game: "g1", name: "Pacing", description: "" });
    const b = await aspects.createAspect({ game: "g2", name: "Pacing", description: "" });
    await expect(a.aspect).not.toBe(b.aspect);
  });

  test("a blank name is refused with EMPTY_ASPECT_NAME", async () => {
    await expect(aspects.createAspect({ game: "g1", name: "   ", description: "x" })).rejects.toThrow(
      EmptyAspectName,
    );
    await expect(await aspects._getAspects({ game: "g1" })).toEqual([]);
  });

  test("aspects are listed by name, and unknown games or aspects answer no rows", async () => {
    await aspects.createAspect({ game: "g1", name: "Pacing", description: "" });
    await aspects.createAspect({ game: "g1", name: "Combat Depth", description: "" });
    await expect((await aspects._getAspects({ game: "g1" })).map((a) => a.name)).toEqual([
      "Combat Depth",
      "Pacing",
    ]);
    await expect(await aspects._getAspects({ game: "nope" })).toEqual([]);
    await expect(await aspects._get({ aspect: "nope" })).toEqual([]);
  });
});
