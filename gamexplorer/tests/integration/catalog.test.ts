import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";
import { GameCatalogConcept } from "../../src/concepts/GameCatalog.ts";
import { importSteamCatalog } from "../../src/catalogImport.ts";

const suite = integrationSuite("catalog");
const { call, signUp, ratedAspect } = suite;

describe("Catalog and Steam integration", () => {
  test("catalog import is repeatable, exposes covers, and creates no ratings or aspects", async () => {
    const { reviewer, buyer } = await ratedAspect();
    const priorRatings = (await call("/ratings/mine", { session: reviewer })).body;
    const priorDiscovery = (await call("/discover/results", { session: buyer })).body;
    const catalog = new GameCatalogConcept(suite.db);
    const entries = [{
      title: "Portal 2", developer: "Valve", releaseYear: 2011, steamAppId: 620,
      coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg",
    }];
    expect(await importSteamCatalog(catalog, entries)).toEqual({ created: 1, covers: 1 });
    const first = (await call("/games/search", { query: "Portal 2" })).body.results.games;
    expect(first).toHaveLength(1);
    expect(first[0].cover).toEqual({ steamAppId: 620, coverUrl: entries[0].coverUrl });
    expect(await importSteamCatalog(catalog, entries)).toEqual({ created: 0, covers: 1 });
    expect((await call("/games/search", { query: "Portal 2" })).body.results.games).toEqual(first);
    const detail = (await call("/games/detail", { game: first[0].game })).body.page;
    expect(detail.cover).toEqual(first[0].cover);
    expect(detail.aspects).toEqual([]);
    expect((await call("/ratings/mine", { session: reviewer })).body).toEqual(priorRatings);
    expect((await call("/discover/results", { session: buyer })).body).toEqual(priorDiscovery);
  });

  test("search is public and works from an empty database", async () => {
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  });

  test("a verified choice overrides forged browser metadata and repeated additions preserve reviews", async () => {
    const session = await signUp("steam-reviewer");
    const search = await call("/games/steam/search", { session, query: "Lantern" });
    expect(search.status).toBe(200);
    expect(search.body.results.games).toHaveLength(1);
    expect(search.body.results.games[0]).toMatchObject({ steamAppId: 1, title: "Lantern Tales" });
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
    const added = await call("/games/add", {
      session, steamAppId: 1, title: "Forged title", developer: "Fake developer", releaseYear: 1950,
      coverUrl: "https://example.org/fake.jpg", user: "someone-else",
    });
    expect(added.status).toBe(200);
    const game = added.body.game;
    const aspect = (await call("/aspects/create", { session, game, name: "Pacing", description: "" })).body.aspect;
    await call("/ratings/rate", { session, aspect, score: 9, microNote: "Preserve this review." });
    const before = (await call("/games/detail", { game })).body;
    expect(before.page).toMatchObject({ title: "Lantern Tales", developer: "Tiny Owl", releaseYear: 2021,
      cover: { steamAppId: 1, coverUrl: suite.steam.games[0]!.coverUrl } });
    expect((await call("/games/steam/search", { session, query: "Lantern" })).body.results.games[0].existing).toEqual({ game });
    suite.steam.available = false;
    expect((await call("/games/add", { session, steamAppId: 1 })).body).toEqual({ game });
    expect((await call("/games/detail", { game })).body).toEqual(before);
    expect((await call("/games/search", { query: "" })).body.results.games).toHaveLength(1);
  });

  test("manual metadata, operator IDs, malformed searches, and unavailable Steam cannot create catalog state", async () => {
    const session = await signUp("steam-player");
    for (const payload of [
      { title: "Manual game", developer: "Studio", releaseYear: 2020 },
      { steamAppId: { $ne: null } }, { steamAppId: "1" }, { steamAppId: 1.5 }, { steamAppId: 999 },
    ]) {
      const result = await call("/games/add", { session, ...payload });
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "INVALID_REQUEST" });
    }
    for (const query of ["", "x", "x".repeat(101)]) {
      expect((await call("/games/steam/search", { session, query })).status).toBe(400);
    }
    expect(suite.steam.searches).toBe(0);
    suite.steam.available = false;
    expect((await call("/games/add", { session, steamAppId: 1 })).status).toBe(500);
    expect((await call("/games/steam/search", { session, query: "Lantern" })).status).toBe(500);
    expect((await call("/games/search", { query: "" })).body.results.games).toEqual([]);
  });
});
