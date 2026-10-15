import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { MongoServerError, type Collection, type Db } from "mongodb";

export class EmptyCredentials extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}
export class UnknownSession extends Error {}

interface UserDoc {
  _id: string;
  username: string;
  salt: string;
  passwordHash: string;
}

interface SessionDoc {
  _id: string;
  user: string;
  createdAt: Date;
}

function hash(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
}

export class UserAuthenticatingConcept {
  private readonly users: Collection<UserDoc>;
  private readonly sessions: Collection<SessionDoc>;
  private indexed = false;

  constructor(db: Db) {
    this.users = db.collection<UserDoc>("userAuthenticating.users");
    this.sessions = db.collection<SessionDoc>("userAuthenticating.sessions");
  }

  async #ensureIndexes() {
    if (this.indexed) return;
    // The unique index stops two concurrent registrations from taking one username.
    await this.users.createIndex({ username: 1 }, { unique: true });
    this.indexed = true;
  }

  async register({ username, password }: { username: string; password: string }) {
    const name = typeof username === "string" ? username.trim() : "";
    if (name === "" || typeof password !== "string" || password === "") {
      throw new EmptyCredentials("Username and password must not be empty.");
    }
    await this.#ensureIndexes();
    const user = crypto.randomUUID();
    const salt = randomBytes(16).toString("hex");
    try {
      await this.users.insertOne({ _id: user, username: name, salt, passwordHash: hash(password, salt) });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new UsernameTaken("The requested username is already registered.");
      }
      throw error;
    }
    return { user };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    const name = typeof username === "string" ? username.trim() : "";
    const found = await this.users.findOne({ username: name });
    const matches =
      found !== null &&
      typeof password === "string" &&
      timingSafeEqual(Buffer.from(found.passwordHash, "hex"), Buffer.from(hash(password, found.salt), "hex"));
    if (!found || !matches) {
      throw new InvalidCredentials("Invalid username or password.");
    }
    const session = crypto.randomUUID();
    await this.sessions.insertOne({ _id: session, user: found._id, createdAt: new Date() });
    return { user: found._id, session };
  }

  async current({ session }: { session: string }) {
    const found = typeof session === "string" ? await this.sessions.findOne({ _id: session }) : null;
    if (!found) throw new UnknownSession("You must be signed in to do that.");
    return { user: found.user };
  }

  async logout({ session }: { session: string }) {
    const found =
      typeof session === "string" ? await this.sessions.findOneAndDelete({ _id: session }) : null;
    if (!found) throw new UnknownSession("You must be signed in to do that.");
    return { user: found.user };
  }

  async _getUser({ username }: { username: string }) {
    const found = await this.users.findOne({ username: String(username).trim() });
    return found ? [{ user: found._id }] : [];
  }

  async _username({ user }: { user: string }) {
    const found = await this.users.findOne({ _id: user });
    return found ? [{ username: found.username }] : [];
  }
}
