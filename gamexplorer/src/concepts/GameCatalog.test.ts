import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import { GameCatalogConcept, GameExists, InvalidGame, InvalidCover, GameNotFound } from "./GameCatalog.ts";
import { testDb } from "./testing.ts";

let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let catalog: GameCatalogConcept;

beforeAll(async () => ({ db, reset, close } = await testDb("catalog")));
beforeEach(async () => {
  await reset();
  catalog = new GameCatalogConcept(db);
});
afterAll(async () => close());

describe("GameCatalog", () => {
  test("principle: an added game gets an identity usable to look it up and search for it", async () => {
    const { game } = await catalog.addGame({
      title: "Lantern Tales",
      developer: "Tiny Owl",
      releaseYear: 2021,
    });
    await expect(await catalog._getGame({ title: "Lantern Tales" })).toEqual([{ game }]);
    await expect(await catalog._get({ game })).toEqual([
      { title: "Lantern Tales", developer: "Tiny Owl", releaseYear: 2021 },
    ]);
    await expect(await catalog._searchGames({ query: "lantern" })).toEqual([
      { game, title: "Lantern Tales", developer: "Tiny Owl", releaseYear: 2021 },
    ]);
  });

  test("a duplicate title, ignoring case and spaces, is refused with GAME_EXISTS", async () => {
    await catalog.addGame({ title: "Hades", developer: "Supergiant", releaseYear: 2020 });
    const duplicate = catalog.addGame({ title: "  hades ", developer: "Other", releaseYear: 2021 });
    await expect(duplicate).rejects.toThrow(GameExists);
    await expect(duplicate).rejects.toThrow("A game with this title already exists.");
    await expect(await catalog._searchGames({ query: "" })).toHaveLength(1);
  });

  test("blank fields or an out-of-range year are refused with INVALID_GAME", async () => {
    await expect(catalog.addGame({ title: " ", developer: "X", releaseYear: 2020 })).rejects.toThrow(
      InvalidGame,
    );
    await expect(catalog.addGame({ title: "A", developer: "", releaseYear: 2020 })).rejects.toThrow(
      InvalidGame,
    );
    await expect(catalog.addGame({ title: "A", developer: "X", releaseYear: 1800 })).rejects.toThrow(
      InvalidGame,
    );
    await expect(catalog.addGame({ title: "A", developer: "X", releaseYear: 2020.5 })).rejects.toThrow(
      InvalidGame,
    );
    await expect(await catalog._searchGames({ query: "" })).toEqual([]);
  });

  test("search is case-insensitive, ordered by title, and empty for no match", async () => {
    await catalog.addGame({ title: "Star Drifter", developer: "A", releaseYear: 2019 });
    await catalog.addGame({ title: "Astral Chain", developer: "B", releaseYear: 2019 });
    await catalog.addGame({ title: "Hollow Knight", developer: "C", releaseYear: 2017 });
    const titles = (await catalog._searchGames({ query: "STAR" })).map((g) => g.title);
    await expect(titles).toEqual(["Star Drifter"]);
    const all = (await catalog._searchGames({ query: "" })).map((g) => g.title);
    await expect(all).toEqual(["Astral Chain", "Hollow Knight", "Star Drifter"]);
    await expect(await catalog._searchGames({ query: "zzz" })).toEqual([]);
  });

  test("regex characters in a query are treated literally", async () => {
    await catalog.addGame({ title: "Why? Because", developer: "A", releaseYear: 2019 });
    await expect(await catalog._searchGames({ query: ".*" })).toEqual([]);
    await expect(await catalog._searchGames({ query: "why?" })).toHaveLength(1);
  });

  test("unknown games answer no rows", async () => {
    await expect(await catalog._get({ game: "missing" })).toEqual([]);
    await expect(await catalog._getGame({ title: "missing" })).toEqual([]);
  });

  test("a Steam cover can be attached and replaced without changing game metadata", async () => {
    const { game } = await catalog.addGame({ title: "Portal 2", developer: "Valve", releaseYear: 2011 });
    expect(await catalog._steamCover({ game })).toEqual({ steamAppId: 0, coverUrl: "" });
    expect(await catalog._steamCover({ game: "missing" })).toEqual({ steamAppId: 0, coverUrl: "" });
    const coverUrl = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg";
    expect(await catalog.setSteamCover({ game, steamAppId: 620, coverUrl })).toEqual({});
    expect(await catalog._steamCover({ game })).toEqual({ steamAppId: 620, coverUrl });
    const replacement = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/620/version/header.jpg?t=1";
    await catalog.setSteamCover({ game, steamAppId: 620, coverUrl: replacement });
    expect(await catalog._steamCover({ game })).toEqual({ steamAppId: 620, coverUrl: replacement });
    expect(await catalog._get({ game })).toEqual([{ title: "Portal 2", developer: "Valve", releaseYear: 2011 }]);
    expect(await catalog._searchGames({ query: "" })).toHaveLength(1);
  });

  test("invalid cover identities and untrusted URLs preserve the previous cover", async () => {
    const { game } = await catalog.addGame({ title: "Portal 2", developer: "Valve", releaseYear: 2011 });
    const coverUrl = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg";
    await catalog.setSteamCover({ game, steamAppId: 620, coverUrl });
    const attempts = [
      { steamAppId: 0, coverUrl }, { steamAppId: 1.5, coverUrl }, { steamAppId: Number.NaN, coverUrl },
      { steamAppId: 620, coverUrl: "not a URL" },
      { steamAppId: 620, coverUrl: coverUrl.replace("https:", "http:") },
      { steamAppId: 620, coverUrl: coverUrl.replace("steamstatic.com", "steamstatic.com.example.org") },
      { steamAppId: 620, coverUrl: coverUrl.replace("/620/", "/400/") },
      { steamAppId: 620, coverUrl: "https://shared.akamai.steamstatic.com/steamcommunity/public/images/test.jpg" },
      { steamAppId: 620, coverUrl: "https://user:password@shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg" },
      { steamAppId: 620, coverUrl: coverUrl.replace(".jpg", ".html") },
    ];
    for (const invalid of attempts) {
      await expect(catalog.setSteamCover({ game, ...invalid })).rejects.toThrow(InvalidCover);
      expect(await catalog._steamCover({ game })).toEqual({ steamAppId: 620, coverUrl });
    }
    await expect(catalog.setSteamCover({ game, steamAppId: 0, coverUrl })).rejects.toThrow(
      "A cover needs a positive Steam app ID and its HTTPS Steam store image URL.",
    );
  });

  test("attaching a cover to an unknown game is refused without creating a game", async () => {
    const attempt = catalog.setSteamCover({
      game: "missing", steamAppId: 620,
      coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg",
    });
    await expect(attempt).rejects.toThrow(GameNotFound);
    await expect(attempt).rejects.toThrow("This game could not be found.");
    expect(await catalog._searchGames({ query: "" })).toEqual([]);
    expect(await catalog._steamCover({ game: "missing" })).toEqual({ steamAppId: 0, coverUrl: "" });
  });
});
