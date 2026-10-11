import type { Collection, Db } from "mongodb";

export class InvalidScore extends Error {}
export class NoteTooLong extends Error {}
export class RatingNotFound extends Error {}

interface RatingDoc {
  _id: string;
  user: string;
  game: string;
  aspect: string;
  score: number;
  microNote: string;
  updatedAt: Date;
}

const MAX_NOTE = 280;

export class AspectRatingConcept {
  private readonly ratings: Collection<RatingDoc>;
  private indexed = false;

  constructor(db: Db) {
    this.ratings = db.collection<RatingDoc>("aspectRating.ratings");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    // One rating per user, game, and aspect: rating again replaces the earlier one.
    await this.ratings.createIndex({ user: 1, game: 1, aspect: 1 }, { unique: true });
    await this.ratings.createIndex({ aspect: 1 });
    this.indexed = true;
  }

  async rateAspect({
    user,
    game,
    aspect,
    score,
    microNote,
  }: {
    user: string;
    game: string;
    aspect: string;
    score: number;
    microNote: string;
  }) {
    if (!Number.isInteger(score) || score < 1 || score > 10) {
      throw new InvalidScore("Score must be an integer between 1 and 10.");
    }
    const note = typeof microNote === "string" ? microNote.trim() : "";
    if (note.length > MAX_NOTE) {
      throw new NoteTooLong("A micro note must be at most 280 characters.");
    }
    await this.#ensureIndexes();
    await this.ratings.updateOne(
      { user, game, aspect },
      {
        $set: { score, microNote: note, updatedAt: new Date() },
        $setOnInsert: { _id: crypto.randomUUID() },
      },
      { upsert: true },
    );
    return {};
  }

  async removeRating({ user, game, aspect }: { user: string; game: string; aspect: string }) {
    const result = await this.ratings.deleteOne({ user, game, aspect });
    if (result.deletedCount === 0) {
      throw new RatingNotFound("No rating exists for this aspect by the user.");
    }
    return {};
  }

  async _getRatingsForGame({ game }: { game: string }) {
    const rows = await this.ratings.find({ game }).sort({ updatedAt: -1 }).toArray();
    return rows.map(({ user, aspect, score, microNote }) => ({ user, aspect, score, microNote }));
  }

  async _getUserRatings({ user }: { user: string }) {
    const rows = await this.ratings.find({ user }).sort({ updatedAt: -1 }).toArray();
    return rows.map(({ game, aspect, score, microNote }) => ({ game, aspect, score, microNote }));
  }

  async _forAspect({ aspect }: { aspect: string }) {
    const rows = await this.ratings.find({ aspect }).sort({ updatedAt: -1 }).toArray();
    return rows.map(({ user, score, microNote }) => ({ user, score, microNote }));
  }

  async _summary({ aspect }: { aspect: string }) {
    const [row] = await this.ratings
      .aggregate<{ average: number; count: number }>([
        { $match: { aspect } },
        { $group: { _id: null, average: { $avg: "$score" }, count: { $sum: 1 } } },
      ])
      .toArray();
    if (!row) return { average: 0, count: 0 };
    return { average: Math.round(row.average * 10) / 10, count: row.count };
  }
}
