import { MongoServerError, type Collection, type Db } from "mongodb";

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
const keyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export class DimensionDefiningConcept<Subject extends string = string> {
  private readonly dimensions: Collection<DimensionDoc>;
  private indexed = false;
  constructor(db: Db) { this.dimensions = db.collection<DimensionDoc>("aspectManaging.aspects"); }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.dimensions.createIndex({ game: 1, nameKey: 1 }, { unique: true });
    this.indexed = true;
  }

  async define({ subject, name, description }: { subject: Subject; name: string; description: string }) {
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) throw new EmptyDimensionName("A dimension needs a name.");
    await this.#ensureIndexes();
    const dimension = crypto.randomUUID();
    try {
      await this.dimensions.insertOne({ _id: dimension, game: subject, name: cleanName,
        nameKey: keyOf(cleanName), description: typeof description === "string" ? description.trim() : "" });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000)
        throw new DimensionExists("This dimension name is already defined for this subject.");
      throw error;
    }
    return { dimension };
  }

  async _forSubject({ subject }: { subject: Subject }) {
    const rows = await this.dimensions.find({ game: subject }).sort({ nameKey: 1 }).toArray();
    return rows.map(({ _id, name, description }) => ({ dimension: _id, name, description }));
  }

  async _get({ dimension }: { dimension: string }) {
    const row = await this.dimensions.findOne({ _id: dimension });
    return row ? [{ subject: row.game as Subject, name: row.name, description: row.description }] : [];
  }

  async _named({ subject, name }: { subject: Subject; name: string }) {
    const row = await this.dimensions.findOne({ game: subject, nameKey: keyOf(name) });
    return row ? [{ dimension: row._id, description: row.description }] : [];
  }
}
