import { expect, test } from "bun:test";
import { integrationSuite, SESSION } from "../support/application.ts";
import { DimensionDefiningConcept, DimensionExists } from "../../src/concepts/DimensionDefining.ts";
import { ThresholdFilteringConcept } from "../../src/concepts/ThresholdFiltering.ts";
import { RatingConcept } from "../../src/concepts/Rating.ts";
import { AspectManagingConcept } from "../../src/concepts/fixtures/AspectManagingP2.ts";
import { AspectRatingConcept } from "../../src/concepts/fixtures/AspectRatingP2.ts";
import { AspectFilteringConcept } from "../../src/concepts/fixtures/AspectFilteringP2.ts";
import { aspectNaming, checkAspectNames } from "../../src/compositions/aspectVocabulary.ts";
import { GameCatalogConcept } from "../../src/concepts/GameCatalog.ts";

const suite = integrationSuite("naming");
function call(path: string, body: Record<string, unknown> = {}, session?: string) {
  if (!session) return suite.browser().post(path, body);
  const client = suite.browser();
  client.jar.set(SESSION, session);
  return client.post(path, body);
}
const signIn = () => suite.signUp("reviewer");

test("presets are public suggestions and do not create game dimensions or ratings", async () => {
  const result = await call("/aspects/options");
  expect(result.status).toBe(200);
  expect(result.body.choices.options).toHaveLength(33);
  expect(result.body.choices.options).toContainEqual({ name: "Voice Acting", description: "The quality and delivery of spoken performances.", aliases: "" });
  expect(result.body.choices.options[0]).toMatchObject({ name: "Combat", aliases: "combat depth" });
  expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  expect((await call("/aspects/create", { game: "unknown", name: "Combat", description: "" })).status).toBe(401);
});

test("custom names remain allowed and become shared choices for other games", async () => {
  const session = await signIn();
  const games: string[] = [];
  for (const title of ["First game", "Second game"]) games.push((await new GameCatalogConcept(suite.db).addGame({ title, developer: "Studio", releaseYear: 2020 })).game);
  const first = await call("/aspects/create", { game: games[0], name: "Companion AI", description: "Companion decisions." }, session);
  expect(first.status).toBe(200);
  expect((await call("/aspects/options")).body.choices.options).toContainEqual({ name: "Companion AI", description: "Companion decisions.", aliases: "" });
  const second = await call("/aspects/create", { game: games[1], name: "companion ai", description: "" }, session);
  expect(second.status).toBe(200);
  expect(second.body.aspect).not.toBe(first.body.aspect);
  expect((await call("/games/detail", { game: games[1] })).body.page.aspects[0]).toMatchObject({ name: "Companion AI", description: "Companion decisions.", summary: { average: 0, count: 0 } });
});

test("Combat filters find legacy Combat Depth and new Combat games, keeping existing review identities", async () => {
  const session = await signIn();
  const user = (await call("/auth/me", {}, session)).body.me.user;
  const games: string[] = [];
  for (const title of ["Legacy game", "New game"]) games.push((await new GameCatalogConcept(suite.db).addGame({ title, developer: "Studio", releaseYear: 2020 })).game);
  const { aspect } = await new AspectManagingConcept(suite.db).createAspect({ game: games[0], name: "Combat Depth", description: "Old description." });
  await new AspectRatingConcept(suite.db).rateAspect({ user, game: games[0], aspect, score: 9, microNote: "Original review." });
  const oldFiltering = new AspectFilteringConcept(suite.db);
  await oldFiltering.recordScore({ game: games[0], aspectName: "Combat Depth", average: 9, count: 1 });
  await oldFiltering.setFilter({ owner: user, aspectName: "Combat Depth", minScore: 8 });
  await checkAspectNames(suite.db);
  const added = await call("/aspects/create", { game: games[1], name: "Combat", description: "" }, session);
  expect((await call("/ratings/rate", { aspect: added.body.aspect, score: 8, microNote: "New review." }, session)).status).toBe(200);
  const results = (await call("/discover/results", {}, session)).body.results;
  expect(results.filters).toEqual([{ aspectName: "Combat", minScore: 8 }]);
  expect(results.aspectNames.filter((entry: any) => /combat/i.test(entry.aspectName))).toEqual([{ aspectName: "Combat" }]);
  expect(results.matches.map((match: any) => match.game).sort()).toEqual([...games].sort());
  expect(results.matches.find((match: any) => match.game === games[0]).scores[0].score).toEqual({ average: 9, count: 1 });
  const detail = (await call("/games/detail", { game: games[0] })).body.page.aspects[0];
  expect(detail).toMatchObject({ aspect, name: "Combat", description: "Old description." });
  expect(detail.ratings[0]).toMatchObject({ user, score: 9, microNote: "Original review." });
  expect((await call("/aspects/create", { game: games[0], name: "Combat", description: "Duplicate." }, session)).status).toBe(409);
  expect((await call("/discover/set", { aspectName: "combat depth", minScore: 9 }, session)).body.results.filters).toEqual([{ aspectName: "Combat", minScore: 9 }]);
  expect((await call("/ratings/remove", { aspect }, session)).status).toBe(200);
  expect((await call("/discover/results", {}, session)).body.results.matches).toEqual([]);
  expect((await call("/games/detail", { game: games[0] })).body.page.aspects[0].aspect).toBe(aspect);
});

test("equivalent saved requirements retain the stricter minimum, then edit and remove as one", async () => {
  const old = new AspectFilteringConcept(suite.db);
  await old.recordScore({ game: "g", aspectName: "Combat Depth", average: 8, count: 1 });
  await old.setFilter({ owner: "u", aspectName: "Combat Depth", minScore: 9 });
  await old.setFilter({ owner: "u", aspectName: "Combat", minScore: 7 });
  const filtering = new ThresholdFilteringConcept(suite.db, aspectNaming);
  expect(await filtering._criteria({ owner: "u" })).toEqual([{ criterion: "Combat", minimum: 9 }]);
  expect(await filtering._matches({ owner: "u" })).toEqual([]);
  await filtering.setCriterion({ owner: "u", criterion: "Combat", minimum: 8 });
  expect(await filtering._matches({ owner: "u" })).toEqual([{ item: "g" }]);
  await filtering.recordValue({ item: "g", criterion: "Combat", value: 7 });
  expect(await filtering._matches({ owner: "u" })).toEqual([]);
  await filtering.forgetValue({ item: "g", criterion: "Combat Depth" });
  expect(await filtering._value({ item: "g", criterion: "Combat" })).toEqual([]);
  await filtering.removeCriterion({ owner: "u", criterion: "Combat Depth" });
  expect(await filtering._criteria({ owner: "u" })).toEqual([]);
});

test("naming aliases work for another domain without game-specific rules", async () => {
  const dimensions = new DimensionDefiningConcept(suite.db, { aliases: { Readability: "Clarity" }, presets: [{ name: "Clarity", description: "Clear explanations." }] });
  const first = await dimensions.define({ subject: "book", name: "Readability", description: "" });
  expect(await dimensions._get({ dimension: first.dimension })).toEqual([{ subject: "book", name: "Clarity", description: "Clear explanations." }]);
  await expect(dimensions.define({ subject: "book", name: "Clarity", description: "" })).rejects.toThrow(DimensionExists);
  expect(await dimensions._nameConflicts({})).toEqual([]);
});

test("conflicting legacy dimension identities block startup without losing either review", async () => {
  const old = new AspectManagingConcept(suite.db);
  const a = await old.createAspect({ game: "g", name: "Combat", description: "One." });
  const b = await old.createAspect({ game: "g", name: "Combat Depth", description: "Two." });
  const ratings = new AspectRatingConcept(suite.db);
  for (const aspect of [a.aspect, b.aspect]) await ratings.rateAspect({ user: "u", game: "g", aspect, score: 8, microNote: "Kept." });
  await expect(checkAspectNames(suite.db)).rejects.toThrow("Aspect aliases would combine existing dimensions");
  const current = new RatingConcept(suite.db);
  expect(await current._forTarget({ target: a.aspect })).toEqual([{ rater: "u", score: 8, note: "Kept." }]);
  expect(await current._forTarget({ target: b.aspect })).toEqual([{ rater: "u", score: 8, note: "Kept." }]);
});
