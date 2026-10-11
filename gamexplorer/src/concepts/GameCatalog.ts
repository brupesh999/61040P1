import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidGame extends Error {}
export class GameExists extends Error {}

interface GameDoc {
  _id: string;
  title: string;
  // Lowercased, trimmed title. Its unique index makes "Hades" and " hades " the same game.
  titleKey: string;
  developer: string;
  releaseYear: number;
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
