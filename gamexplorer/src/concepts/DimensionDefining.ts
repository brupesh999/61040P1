import { MongoServerError, type Collection, type Db } from "mongodb";
import { nameRules, type NameOptions, type NameSuggestion } from "../lib/names.ts";

export class EmptyDimensionName extends Error {}
export class DimensionExists extends Error {}

// Preserve the P2 storage encoding and identities; `game` is an opaque Subject column.
interface DimensionDoc {
  _id: string;
  game: string;
  name: string;
  nameKey: string;
  description: string;
}

export class DimensionDefiningConcept<Subject extends string = string> {
  private readonly dimensions: Collection<DimensionDoc>;
  private indexed = false;
  private readonly names;
  private readonly presets: readonly NameSuggestion[];
  constructor(db: Db, options: NameOptions & { presets?: readonly NameSuggestion[] } = {}) {
    this.dimensions = db.collection<DimensionDoc>("aspectManaging.aspects");
    this.names = nameRules(options);
    this.presets = (options.presets ?? []).map(preset => ({ ...preset }));
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.dimensions.createIndex({ game: 1, nameKey: 1 }, { unique: true });
    this.indexed = true;
  }

  async define({ subject, name, description }: { subject: Subject; name: string; description: string }) {
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) throw new EmptyDimensionName("A dimension needs a name.");
    await this.#ensureIndexes();
    const known = (await this._names({})).find(option => this.names.key(option.name) === this.names.key(cleanName));
    const displayName = known?.name ?? this.names.label(cleanName);
    if (await this.dimensions.findOne({ game: subject, nameKey: { $in: this.names.keys(displayName) } }))
      throw new DimensionExists("This dimension name is already defined for this subject.");
    const dimension = crypto.randomUUID();
    try {
      await this.dimensions.insertOne({ _id: dimension, game: subject, name: displayName,
        nameKey: this.names.key(displayName), description: (typeof description === "string" ? description.trim() : "") || known?.description || "" });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new DimensionExists("This dimension name is already defined for this subject.");
      throw error;
    }
    return { dimension };
  }

  async _forSubject({ subject }: { subject: Subject }) {
    const rows = await this.dimensions.find({ game: subject }).sort({ nameKey: 1 }).toArray();
    return rows.map(({ _id, name, description }) => ({ dimension: _id, name: this.names.label(name), description }))
      .sort((a, b) => this.names.key(a.name).localeCompare(this.names.key(b.name)));
  }

  async _get({ dimension }: { dimension: string }) {
    const row = await this.dimensions.findOne({ _id: dimension });
    return row ? [{ subject: row.game as Subject, name: this.names.label(row.name), description: row.description }] : [];
  }

  async _named({ subject, name }: { subject: Subject; name: string }) {
    const row = await this.dimensions.findOne({ game: subject, nameKey: { $in: this.names.keys(name) } });
    return row ? [{ dimension: row._id, description: row.description }] : [];
  }

  async _names(_input: Record<string, never>) {
    const choices = new Map<string, { name: string; description: string; aliases: string }>();
    for (const preset of this.presets) choices.set(this.names.key(preset.name), {
      ...preset, name: this.names.label(preset.name), aliases: this.names.alternatives(preset.name),
    });
    for (const row of await this.dimensions.find({}).sort({ nameKey: 1, _id: 1 }).toArray()) {
      const key = this.names.key(row.name);
      if (!choices.has(key)) choices.set(key, { name: this.names.label(row.name), description: row.description, aliases: this.names.alternatives(row.name) });
    }
    const presetKeys = new Set(this.presets.map(preset => this.names.key(preset.name)));
    return [
      ...[...choices.values()].filter(choice => presetKeys.has(this.names.key(choice.name))),
      ...[...choices.values()].filter(choice => !presetKeys.has(this.names.key(choice.name)))
        .sort((a, b) => this.names.key(a.name).localeCompare(this.names.key(b.name))),
    ];
  }

  async _nameConflicts(_input: Record<string, never>) {
    const seen = new Set<string>();
    const conflicts = new Map<string, { subject: Subject; name: string }>();
    for (const row of await this.dimensions.find({}).toArray()) {
      const key = JSON.stringify([row.game, this.names.key(row.name)]);
      if (seen.has(key)) conflicts.set(key, { subject: row.game as Subject, name: this.names.label(row.name) });
      seen.add(key);
    }
    return [...conflicts.values()];
  }

}
