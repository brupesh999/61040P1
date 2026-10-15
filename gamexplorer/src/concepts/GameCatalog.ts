import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidGame extends Error {}
export class GameExists extends Error {}
export class InvalidCover extends Error {}
export class GameNotFound extends Error {}

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

export class GameCatalogConcept {
  private readonly games: Collection<GameDoc>;
  private indexed = false;

  constructor(db: Db) {
    this.games = db.collection<GameDoc>("gameCatalog.games");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.games.createIndex({ titleKey: 1 }, { unique: true });
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

  async setSteamCover({ game, steamAppId, coverUrl }: { game: string; steamAppId: number; coverUrl: string }) {
    const hosts = new Set([
      "shared.fastly.steamstatic.com", "shared.akamai.steamstatic.com",
      "shared.cloudflare.steamstatic.com", "cdn.akamai.steamstatic.com",
      "cdn.cloudflare.steamstatic.com",
    ]);
    let valid = false;
    try {
      const url = new URL(coverUrl);
      valid = typeof coverUrl === "string" && Number.isInteger(steamAppId) && steamAppId > 0 &&
        url.protocol === "https:" && !url.username && !url.password && !url.port &&
        hosts.has(url.hostname) && /\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname) &&
        [`/steam/apps/${steamAppId}/`, `/store_item_assets/steam/apps/${steamAppId}/`].some(prefix => url.pathname.startsWith(prefix));
    } catch { /* Refuse malformed URLs with the same public error. */ }
    if (!valid) throw new InvalidCover("A cover needs a positive Steam app ID and its HTTPS Steam store image URL.");
    const result = await this.games.updateOne({ _id: game }, { $set: { steamAppId, coverUrl } });
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
