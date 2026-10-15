// Archived P2 implementation, used only to create genuine legacy state in compatibility tests.
import type { Collection, Db } from "mongodb";

export class EmptyFilterAspect extends Error {}
export class InvalidThreshold extends Error {}
export class FilterNotFound extends Error {}

interface ScoreDoc {
  _id: string;
  game: string;
  aspectName: string;
  // Aspect names are compared ignoring case and surrounding spaces.
  aspectKey: string;
  average: number;
  count: number;
}

interface CriterionDoc {
  _id: string;
  owner: string;
  aspectName: string;
  aspectKey: string;
  minScore: number;
}

function keyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export class AspectFilteringConcept {
  private readonly scores: Collection<ScoreDoc>;
  private readonly criteria: Collection<CriterionDoc>;
  private indexed = false;

  constructor(db: Db) {
    this.scores = db.collection<ScoreDoc>("aspectFiltering.scores");
    this.criteria = db.collection<CriterionDoc>("aspectFiltering.criteria");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.scores.createIndex({ game: 1, aspectKey: 1 }, { unique: true });
    await this.scores.createIndex({ aspectKey: 1, average: -1 });
    await this.criteria.createIndex({ owner: 1, aspectKey: 1 }, { unique: true });
    this.indexed = true;
  }

  async recordScore({
    game,
    aspectName,
    average,
    count,
  }: {
    game: string;
    aspectName: string;
    average: number;
    count: number;
  }) {
    await this.#ensureIndexes();
    const aspectKey = keyOf(String(aspectName));
    if (count <= 0) {
      await this.scores.deleteOne({ game, aspectKey });
      return {};
    }
    await this.scores.updateOne(
      { game, aspectKey },
      {
        $set: { aspectName: String(aspectName).trim(), average, count },
        $setOnInsert: { _id: crypto.randomUUID() },
      },
      { upsert: true },
    );
    return {};
  }

  async setFilter({
    owner,
    aspectName,
    minScore,
  }: {
    owner: string;
    aspectName: string;
    minScore: number;
  }) {
    const name = typeof aspectName === "string" ? aspectName.trim() : "";
    if (name === "") throw new EmptyFilterAspect("A filter needs an aspect name.");
    if (typeof minScore !== "number" || !(minScore >= 1 && minScore <= 10)) {
      throw new InvalidThreshold("Threshold score must be between 1 and 10.");
    }
    await this.#ensureIndexes();
    await this.criteria.updateOne(
      { owner, aspectKey: keyOf(name) },
      { $set: { aspectName: name, minScore }, $setOnInsert: { _id: crypto.randomUUID() } },
      { upsert: true },
    );
    return {};
  }

  async removeFilter({ owner, aspectName }: { owner: string; aspectName: string }) {
    const result = await this.criteria.deleteOne({ owner, aspectKey: keyOf(String(aspectName)) });
    if (result.deletedCount === 0) throw new FilterNotFound("There is no filter on that aspect.");
    return {};
  }

  async clearFilters({ owner }: { owner: string }) {
    await this.criteria.deleteMany({ owner });
    return {};
  }

  async _filters({ owner }: { owner: string }) {
    const rows = await this.criteria.find({ owner }).sort({ aspectKey: 1 }).toArray();
    return rows.map(({ aspectName, minScore }) => ({ aspectName, minScore }));
  }

  async _matchGames({ owner }: { owner: string }) {
    const criteria = await this.criteria.find({ owner }).toArray();
    if (criteria.length === 0) return [];
    let candidates: Set<string> | undefined;
    const best = new Map<string, number>();
    for (const { aspectKey, minScore } of criteria) {
      const passing = await this.scores.find({ aspectKey, average: { $gte: minScore } }).toArray();
      const games = new Set(passing.map((row) => row.game));
      candidates = candidates === undefined ? games : new Set([...candidates].filter((g) => games.has(g)));
      for (const row of passing) best.set(row.game, Math.max(best.get(row.game) ?? 0, row.average));
    }
    return [...(candidates ?? [])]
      .sort((a, b) => (best.get(b) ?? 0) - (best.get(a) ?? 0) || a.localeCompare(b))
      .map((game) => ({ game }));
  }

  async _score({ game, aspectName }: { game: string; aspectName: string }) {
    const found = await this.scores.findOne({ game, aspectKey: keyOf(String(aspectName)) });
    return found ? [{ average: found.average, count: found.count }] : [];
  }

  async _aspectNames(_input: Record<string, never>) {
    const rows = await this.scores
      .aggregate<{ _id: string; aspectName: string }>([
        { $sort: { aspectName: 1 } },
        { $group: { _id: "$aspectKey", aspectName: { $first: "$aspectName" } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    return rows.map(({ aspectName }) => ({ aspectName }));
  }
}
