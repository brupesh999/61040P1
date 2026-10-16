import type { Collection, Db } from "mongodb";
import { nameRules, type NameOptions } from "../lib/names.ts";

export class EmptyCriterion extends Error {}
export class InvalidValue extends Error {}
export class InvalidMinimum extends Error {}
export class CriterionNotFound extends Error {}

// These physical columns retain P2 data. No rating counts or peer state are interpreted.
interface ValueDoc { _id: string; game: string; aspectName: string; aspectKey: string; average: number }
interface RequirementDoc { _id: string; owner: string; aspectName: string; aspectKey: string; minScore: number }
function cleanName(name: string) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean) throw new EmptyCriterion("A criterion needs a name.");
  return clean;
}

export class ThresholdFilteringConcept<Owner extends string = string, Item extends string = string> {
  private readonly values: Collection<ValueDoc>;
  private readonly requirements: Collection<RequirementDoc>;
  private readonly names;
  private indexed = false;
  constructor(db: Db, options: NameOptions = {}) {
    this.values = db.collection<ValueDoc>("aspectFiltering.scores");
    this.requirements = db.collection<RequirementDoc>("aspectFiltering.criteria");
    this.names = nameRules(options);
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
    const match = { game: item, aspectKey: { $in: this.names.keys(name) } };
    const rows = await this.values.find(match).sort({ _id: 1 }).toArray();
    const previous = rows.find(row => row.aspectKey === this.names.key(name)) ?? rows[0];
    if (previous) await this.values.deleteMany({ ...match, _id: { $ne: previous._id } });
    await this.values.updateOne(previous ? { _id: previous._id } : { game: item, aspectKey: this.names.key(name) }, {
      $set: { aspectName: this.names.label(name), aspectKey: this.names.key(name), average: value },
      $setOnInsert: { _id: crypto.randomUUID() },
    }, { upsert: true });
    return {};
  }

  async forgetValue({ item, criterion }: { item: Item; criterion: string }) {
    await this.values.deleteMany({ game: item, aspectKey: { $in: this.names.keys(String(criterion)) } });
    return {};
  }

  async setCriterion({ owner, criterion, minimum }: { owner: Owner; criterion: string; minimum: number }) {
    const name = cleanName(criterion);
    if (!Number.isFinite(minimum)) throw new InvalidMinimum("A minimum must be a finite number.");
    await this.#ensureIndexes();
    const match = { owner, aspectKey: { $in: this.names.keys(name) } };
    const previous = await this.requirements.findOne(match);
    if (previous) await this.requirements.deleteMany({ ...match, _id: { $ne: previous._id } });
    await this.requirements.updateOne(previous ? { _id: previous._id } : { owner, aspectKey: this.names.key(name) }, {
      $set: { aspectName: this.names.label(name), aspectKey: this.names.key(name), minScore: minimum },
      $setOnInsert: { _id: crypto.randomUUID() },
    }, { upsert: true });
    return {};
  }

  async removeCriterion({ owner, criterion }: { owner: Owner; criterion: string }) {
    const result = await this.requirements.deleteMany({ owner, aspectKey: { $in: this.names.keys(String(criterion)) } });
    if (!result.deletedCount) throw new CriterionNotFound("This owner has no requirement for this criterion.");
    return {};
  }

  async clearCriteria({ owner }: { owner: Owner }) {
    await this.requirements.deleteMany({ owner });
    return {};
  }

  async _criteria({ owner }: { owner: Owner }) {
    const rows = await this.requirements.find({ owner }).sort({ aspectKey: 1 }).toArray();
    const criteria = new Map<string, { criterion: string; minimum: number }>();
    for (const row of rows) {
      const key = this.names.key(row.aspectName);
      const existing = criteria.get(key);
      if (!existing || existing.minimum < row.minScore)
        criteria.set(key, { criterion: this.names.label(row.aspectName), minimum: row.minScore });
    }
    return [...criteria].sort(([a], [b]) => a.localeCompare(b)).map(([, criterion]) => criterion);
  }

  #preferredValues(rows: ValueDoc[], criterion: string) {
    const preferred = new Map<string, ValueDoc>();
    for (const row of rows) {
      const current = preferred.get(row.game);
      if (!current || row.aspectKey === this.names.key(criterion)) preferred.set(row.game, row);
    }
    return [...preferred.values()];
  }

  async _matches({ owner }: { owner: Owner }) {
    const requirements = await this._criteria({ owner });
    if (!requirements.length) return [];
    let candidates: Set<string> | undefined;
    const best = new Map<string, number>();
    for (const { criterion, minimum } of requirements) {
      const rows = await this.values.find({ aspectKey: { $in: this.names.keys(criterion) } }).sort({ _id: 1 }).toArray();
      const passing = this.#preferredValues(rows, criterion).filter(row => row.average >= minimum);
      const items = new Set(passing.map(row => row.game));
      candidates = candidates === undefined ? items : new Set([...candidates].filter(item => items.has(item)));
      for (const row of passing) best.set(row.game, Math.max(best.get(row.game) ?? -Infinity, row.average));
    }
    return [...(candidates ?? [])].sort((a, b) => best.get(b)! - best.get(a)! || a.localeCompare(b))
      .map(item => ({ item: item as Item }));
  }

  async _value({ item, criterion }: { item: Item; criterion: string }) {
    const rows = await this.values.find({ game: item, aspectKey: { $in: this.names.keys(String(criterion)) } }).sort({ _id: 1 }).toArray();
    const row = this.#preferredValues(rows, criterion)[0];
    return row ? [{ value: row.average }] : [];
  }

  async _criterionNames(_input: Record<string, never>) {
    const names = new Map<string, string>();
    for (const row of await this.values.find({}).sort({ aspectName: 1 }).toArray())
      if (!names.has(this.names.key(row.aspectName))) names.set(this.names.key(row.aspectName), this.names.label(row.aspectName));
    return [...names].sort(([a], [b]) => a.localeCompare(b)).map(([, criterion]) => ({ criterion }));
  }
}
