import { MongoServerError, type Collection, type Db } from "mongodb";
import { SteamStore, SteamUnavailable, type SteamGame, type SteamSource } from "./GameCatalog/steam.ts";
export { SteamUnavailable } from "./GameCatalog/steam.ts";

export class InvalidGame extends Error {}
export class GameExists extends Error {}
export class InvalidCover extends Error {}
export class GameNotFound extends Error {}
export class InvalidSteamGame extends Error {}
export class SteamGameExists extends Error {}

interface GameDoc {
  _id: string;
  title: string;
  // Lowercased, trimmed title. Its unique index makes "Hades" and " hades " the same game.
  titleKey: string;
  developer: string;
  releaseYear: number;
  steamAppId?: number;
  coverUrl?: string;
}

function keyOf(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validCover(steamAppId: number, coverUrl: string): boolean {
  try {
    const url = new URL(coverUrl);
    return typeof coverUrl === "string" && Number.isInteger(steamAppId) && steamAppId > 0 &&
      url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["shared.fastly.steamstatic.com", "shared.akamai.steamstatic.com", "shared.cloudflare.steamstatic.com",
        "cdn.akamai.steamstatic.com", "cdn.cloudflare.steamstatic.com"].includes(url.hostname) &&
      /\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname) &&
      [`/steam/apps/${steamAppId}/`, `/store_item_assets/steam/apps/${steamAppId}/`].some(prefix => url.pathname.startsWith(prefix));
  } catch { return false; }
}

function validSteamGame(game: SteamGame): boolean {
  return typeof game.title === "string" && !!game.title.trim() &&
    typeof game.developer === "string" && !!game.developer.trim() &&
    Number.isInteger(game.releaseYear) && game.releaseYear >= 1950 && game.releaseYear <= 2100 &&
    validCover(game.steamAppId, game.coverUrl);
}

export class GameCatalogConcept {
  private readonly games: Collection<GameDoc>;
  private indexed = false;

  constructor(db: Db, private readonly steam: SteamSource = new SteamStore()) {
    this.games = db.collection<GameDoc>("gameCatalog.games");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.games.createIndex({ titleKey: 1 }, { unique: true });
    await this.games.createIndex({ steamAppId: 1 }, {
      unique: true, partialFilterExpression: { steamAppId: { $type: "number" } },
    });
    this.indexed = true;
  }

  async addGame({
    title,
    developer,
    releaseYear,
  }: {
    title: string;
    developer: string;
    releaseYear: number;
  }) {
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanDeveloper = typeof developer === "string" ? developer.trim() : "";
    if (
      cleanTitle === "" ||
      cleanDeveloper === "" ||
      !Number.isInteger(releaseYear) ||
      releaseYear < 1950 ||
      releaseYear > 2100
    ) {
      throw new InvalidGame(
        "A game needs a title, a developer, and a release year from 1950 to 2100.",
      );
    }
    await this.#ensureIndexes();
    const game = crypto.randomUUID();
    try {
      await this.games.insertOne({
        _id: game,
        title: cleanTitle,
        titleKey: keyOf(cleanTitle),
        developer: cleanDeveloper,
        releaseYear,
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new GameExists("A game with this title already exists.");
      }
      throw error;
    }
    return { game };
  }

  async _getGame({ title }: { title: string }) {
    const found = await this.games.findOne({ titleKey: keyOf(String(title)) });
    return found ? [{ game: found._id }] : [];
  }

  async _fromSteam({ steamAppId }: { steamAppId: number }) {
    if (!Number.isInteger(steamAppId) || steamAppId <= 0 || steamAppId > 0xffff_ffff) return { game: "" };
    const found = await this.games.findOne({ steamAppId });
    return { game: found?._id ?? "" };
  }

  async _searchSteam({ query }: { query: string }) {
    const text = typeof query === "string" ? query.trim() : "";
    if (text.length < 2 || text.length > 100) return [];
    return (await this.steam.search(text)).filter(validSteamGame);
  }

  async addSteamGame({ steamAppId }: { steamAppId: number }) {
    if (!Number.isInteger(steamAppId) || steamAppId <= 0 || steamAppId > 0xffff_ffff) {
      throw new InvalidSteamGame("Choose a Steam game with published developer and release-year information.");
    }
    await this.#ensureIndexes();
    const stored = await this._fromSteam({ steamAppId });
    if (stored.game) return stored;
    let source: SteamGame | null;
    try { source = await this.steam.lookup(steamAppId); }
    catch { throw new SteamUnavailable(); }
    if (!source || source.steamAppId !== steamAppId || !validSteamGame(source)) {
      throw new InvalidSteamGame("Choose a Steam game with published developer and release-year information.");
    }
    const metadata = { title: source.title.trim(), developer: source.developer.trim(), titleKey: keyOf(source.title),
      releaseYear: source.releaseYear, steamAppId, coverUrl: source.coverUrl };
    try {
      const existing = await this.games.findOne({ titleKey: metadata.titleKey });
      if (existing) {
        if (existing.steamAppId !== undefined && existing.steamAppId !== steamAppId) {
          throw new GameExists("A game with this title already exists.");
        }
        const updated = await this.games.findOneAndUpdate({
          _id: existing._id, $or: [{ steamAppId: { $exists: false } }, { steamAppId }],
        }, { $set: metadata }, { returnDocument: "after" });
        if (!updated) throw new GameExists("A game with this title already exists.");
        return { game: updated._id };
      }
      const game = crypto.randomUUID();
      await this.games.insertOne({ _id: game, ...metadata });
      return { game };
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        const winner = await this._fromSteam({ steamAppId });
        if (winner.game) return winner;
        throw new GameExists("A game with this title already exists.");
      }
      throw error;
    }
  }

  async setSteamCover({ game, steamAppId, coverUrl }: { game: string; steamAppId: number; coverUrl: string }) {
    if (!validCover(steamAppId, coverUrl)) throw new InvalidCover("A cover needs a positive Steam app ID and its HTTPS Steam store image URL.");
    await this.#ensureIndexes();
    let result;
    try { result = await this.games.updateOne({ _id: game }, { $set: { steamAppId, coverUrl } }); }
    catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new SteamGameExists("This Steam game is already in the catalog.");
      }
      throw error;
    }
    if (result.matchedCount === 0) throw new GameNotFound("This game could not be found.");
    return {};
  }

  async _steamCover({ game }: { game: string }) {
    const found = await this.games.findOne({ _id: game });
    return found?.steamAppId && found.coverUrl
      ? { steamAppId: found.steamAppId, coverUrl: found.coverUrl }
      : { steamAppId: 0, coverUrl: "" };
  }

  async _get({ game }: { game: string }) {
    const found = await this.games.findOne({ _id: game });
    return found
      ? [{ title: found.title, developer: found.developer, releaseYear: found.releaseYear }]
      : [];
  }

  async _searchGames({ query }: { query: string }) {
    const text = typeof query === "string" ? query.trim() : "";
    const filter = text === "" ? {} : { title: { $regex: escapeRegex(text), $options: "i" } };
    const rows = await this.games.find(filter).sort({ titleKey: 1 }).toArray();
    return rows.map(({ _id, title, developer, releaseYear }) => ({
      game: _id,
      title,
      developer,
      releaseYear,
    }));
  }
}
