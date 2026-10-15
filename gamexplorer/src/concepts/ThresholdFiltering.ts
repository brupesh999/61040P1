import type { Collection, Db } from "mongodb";

export class EmptyCriterion extends Error {}
export class InvalidValue extends Error {}
export class InvalidMinimum extends Error {}
export class CriterionNotFound extends Error {}

// These physical columns retain P2 data. No rating counts or peer state are interpreted.
interface ValueDoc { _id: string; game: string; aspectName: string; aspectKey: string; average: number }
interface RequirementDoc { _id: string; owner: string; aspectName: string; aspectKey: string; minScore: number }
const keyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
function cleanName(name: string) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean) throw new EmptyCriterion("A criterion needs a name.");
  return clean;
}

export class ThresholdFilteringConcept<Owner extends string = string, Item extends string = string> {
  private readonly values: Collection<ValueDoc>;
  private readonly requirements: Collection<RequirementDoc>;
  private indexed = false;
  constructor(db: Db) {
    this.values = db.collection<ValueDoc>("aspectFiltering.scores");
    this.requirements = db.collection<RequirementDoc>("aspectFiltering.criteria");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.values.createIndex({ game: 1, aspectKey: 1 }, { unique: true });
    await this.values.createIndex({ aspectKey: 1, average: -1 });
    await this.requirements.createIndex({ owner: 1, aspectKey: 1 }, { unique: true });
    this.indexed = true;
  }

  async recordValue({ item, criterion, value }: { item: Item; criterion: string; value: number }) {
    const name = cleanName(criterion);
    if (!Number.isFinite(value)) throw new InvalidValue("A recorded value must be a finite number.");
    await this.#ensureIndexes();
    await this.values.updateOne({ game: item, aspectKey: keyOf(name) }, {
      $set: { aspectName: name, average: value }, $setOnInsert: { _id: crypto.randomUUID() },
    }, { upsert: true });
    return {};
  }

  async forgetValue({ item, criterion }: { item: Item; criterion: string }) {
    await this.values.deleteOne({ game: item, aspectKey: keyOf(String(criterion)) });
    return {};
  }

  async setCriterion({ owner, criterion, minimum }: { owner: Owner; criterion: string; minimum: number }) {
    const name = cleanName(criterion);
    if (!Number.isFinite(minimum)) throw new InvalidMinimum("A minimum must be a finite number.");
    await this.#ensureIndexes();
    await this.requirements.updateOne({ owner, aspectKey: keyOf(name) }, {
      $set: { aspectName: name, minScore: minimum }, $setOnInsert: { _id: crypto.randomUUID() },
    }, { upsert: true });
    return {};
  }

  async removeCriterion({ owner, criterion }: { owner: Owner; criterion: string }) {
    const result = await this.requirements.deleteOne({ owner, aspectKey: keyOf(String(criterion)) });
    if (!result.deletedCount) throw new CriterionNotFound("This owner has no requirement for this criterion.");
    return {};
  }

  async clearCriteria({ owner }: { owner: Owner }) {
    await this.requirements.deleteMany({ owner });
    return {};
  }

  async _criteria({ owner }: { owner: Owner }) {
    const rows = await this.requirements.find({ owner }).sort({ aspectKey: 1 }).toArray();
    return rows.map(row => ({ criterion: row.aspectName, minimum: row.minScore }));
  }

  async _matches({ owner }: { owner: Owner }) {
    const requirements = await this.requirements.find({ owner }).toArray();
    if (!requirements.length) return [];
    let candidates: Set<string> | undefined;
    const best = new Map<string, number>();
    for (const { aspectKey, minScore } of requirements) {
      const passing = await this.values.find({ aspectKey, average: { $gte: minScore } }).toArray();
      const items = new Set(passing.map(row => row.game));
      candidates = candidates === undefined ? items : new Set([...candidates].filter(item => items.has(item)));
      for (const row of passing) best.set(row.game, Math.max(best.get(row.game) ?? -Infinity, row.average));
    }
    return [...(candidates ?? [])].sort((a, b) => best.get(b)! - best.get(a)! || a.localeCompare(b))
      .map(item => ({ item: item as Item }));
  }

  async _value({ item, criterion }: { item: Item; criterion: string }) {
    const row = await this.values.findOne({ game: item, aspectKey: keyOf(String(criterion)) });
    return row ? [{ value: row.average }] : [];
  }

  async _criterionNames(_input: Record<string, never>) {
    const rows = await this.values.aggregate<{ _id: string; criterion: string }>([
      { $sort: { aspectName: 1 } }, { $group: { _id: "$aspectKey", criterion: { $first: "$aspectName" } } },
      { $sort: { _id: 1 } },
    ]).toArray();
    return rows.map(({ criterion }) => ({ criterion }));
  }
}
