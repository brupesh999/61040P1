// Archived P2 implementation, used only to create genuine legacy state in compatibility tests.
import { MongoServerError, type Collection, type Db } from "mongodb";

export class EmptyAspectName extends Error {}
export class AspectExists extends Error {}

interface AspectDoc {
  _id: string;
  game: string;
  name: string;
  // Lowercased, trimmed name; unique together with game.
  nameKey: string;
  description: string;
}

function keyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export class AspectManagingConcept {
  private readonly aspects: Collection<AspectDoc>;
  private indexed = false;

  constructor(db: Db) {
    this.aspects = db.collection<AspectDoc>("aspectManaging.aspects");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    await this.aspects.createIndex({ game: 1, nameKey: 1 }, { unique: true });
    this.indexed = true;
  }

  async createAspect({
    game,
    name,
    description,
  }: {
    game: string;
    name: string;
    description: string;
  }) {
    const cleanName = typeof name === "string" ? name.trim() : "";
    if (cleanName === "") throw new EmptyAspectName("An aspect needs a name.");
    await this.#ensureIndexes();
    const aspect = crypto.randomUUID();
    try {
      await this.aspects.insertOne({
        _id: aspect,
        game,
        name: cleanName,
        nameKey: keyOf(cleanName),
        description: typeof description === "string" ? description.trim() : "",
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AspectExists("This aspect already exists for the specified game.");
      }
      throw error;
    }
    return { aspect };
  }

  async _getAspects({ game }: { game: string }) {
    const rows = await this.aspects.find({ game }).sort({ nameKey: 1 }).toArray();
    return rows.map(({ _id, name, description }) => ({ aspect: _id, name, description }));
  }

  async _get({ aspect }: { aspect: string }) {
    const found = await this.aspects.findOne({ _id: aspect });
    return found ? [{ game: found.game, name: found.name, description: found.description }] : [];
  }
}
