import type { Collection, Db } from "mongodb";

export class InvalidScore extends Error {}
export class NoteTooLong extends Error {}
export class RatingNotFound extends Error {}

// Legacy physical names encode Rater, Target, and note. A legacy parent `game` is never read.
interface RatingDoc {
  _id: string;
  user: string;
  aspect: string;
  score: number;
  microNote: string;
  updatedAt: Date;
}

export class RatingConcept<Rater extends string = string, Target extends string = string> {
  private readonly ratings: Collection<RatingDoc>;
  private indexed = false;
  constructor(db: Db) { this.ratings = db.collection<RatingDoc>("aspectRating.ratings"); }

  async #ensureIndexes() {
    if (this.indexed) return;
    // A parent identity can no longer be used to submit a second evaluation of one target.
    await this.ratings.createIndex({ user: 1, aspect: 1 }, { unique: true });
    await this.ratings.createIndex({ aspect: 1 });
    this.indexed = true;
  }

  async rate({ rater, target, score, note }: { rater: Rater; target: Target; score: number; note: string }) {
    if (!Number.isInteger(score) || score < 1 || score > 10)
      throw new InvalidScore("Score must be an integer between 1 and 10.");
    const text = typeof note === "string" ? note.trim() : "";
    if (text.length > 280) throw new NoteTooLong("A review note must be at most 280 characters.");
    await this.#ensureIndexes();
    await this.ratings.updateOne({ user: rater, aspect: target }, {
      $set: { score, microNote: text, updatedAt: new Date() },
      $setOnInsert: { _id: crypto.randomUUID() },
    }, { upsert: true });
    return {};
  }

  async remove({ rater, target }: { rater: Rater; target: Target }) {
    const result = await this.ratings.deleteOne({ user: rater, aspect: target });
    if (!result.deletedCount) throw new RatingNotFound("This rater has no evaluation of this target.");
    return {};
  }

  async _byRater({ rater }: { rater: Rater }) {
    const rows = await this.ratings.find({ user: rater }).sort({ updatedAt: -1 }).toArray();
    return rows.map(row => ({ target: row.aspect as Target, score: row.score, note: row.microNote }));
  }

  async _forTarget({ target }: { target: Target }) {
    const rows = await this.ratings.find({ aspect: target }).sort({ updatedAt: -1 }).toArray();
    return rows.map(row => ({ rater: row.user as Rater, score: row.score, note: row.microNote }));
  }

  async _summary({ target }: { target: Target }) {
    const [row] = await this.ratings.aggregate<{ average: number; count: number }>([
      { $match: { aspect: target } },
      { $group: { _id: null, average: { $avg: "$score" }, count: { $sum: 1 } } },
    ]).toArray();
    return row ? { average: Math.round(row.average * 10) / 10, count: row.count } : { average: 0, count: 0 };
  }
}
