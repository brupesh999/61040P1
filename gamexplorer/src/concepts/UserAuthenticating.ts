import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { password as passwordHash } from "bun";
import { MongoServerError, type Collection, type Db } from "mongodb";

export class EmptyCredentials extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}
export class UnknownSession extends Error {}
export class InvalidUsername extends Error {}
export class UnknownUser extends Error {}

interface UserDoc {
  _id: string;
  username: string;
  salt?: string;
  passwordHash?: string;
}

interface SessionDoc {
  _id: string;
  user: string;
  createdAt: Date;
  expiresAt: Date;
}

function hash(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
}

export class UserAuthenticatingConcept {
  private readonly users: Collection<UserDoc>;
  private readonly sessions: Collection<SessionDoc>;
  private indexed = false;

  constructor(db: Db, private readonly clock: () => Date = () => new Date()) {
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
    // ConceptBox's Authenticating uses Bun's Argon2id implementation.
    const verifier = await passwordHash.hash(password, { algorithm: "argon2id" });
    try {
      await this.users.insertOne({ _id: user, username: name, passwordHash: verifier });
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
    let matches = false;
    if (found?.passwordHash && typeof password === "string") {
      if (found.passwordHash.startsWith("$argon2")) matches = await passwordHash.verify(password, found.passwordHash);
      else if (found.salt && /^[a-f0-9]{64}$/.test(found.passwordHash)) {
        matches = timingSafeEqual(Buffer.from(found.passwordHash, "hex"), Buffer.from(hash(password, found.salt), "hex"));
        if (matches) {
          const verifier = await passwordHash.hash(password, { algorithm: "argon2id" });
          await this.users.updateOne({ _id: found._id }, { $set: { passwordHash: verifier }, $unset: { salt: "" } });
        }
      }
    }
    if (!found || !matches) {
      throw new InvalidCredentials("Invalid username or password.");
    }
    return this.#issue(found._id);
  }

  async registerExternal({ username }: { username: string }) {
    const name = typeof username === "string" ? username.trim() : "";
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(name)) {
      throw new InvalidUsername("A username must have 3 to 32 letters, digits, underscores, or hyphens.");
    }
    await this.#ensureIndexes();
    const user = crypto.randomUUID();
    try {
      await this.users.insertOne({ _id: user, username: name });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new UsernameTaken("The requested username is already registered.");
      }
      throw error;
    }
    return { user };
  }

  async startSession({ user }: { user: string }) {
    if (!(await this.users.findOne({ _id: user }))) throw new UnknownUser("This user could not be found.");
    return this.#issue(user);
  }

  async #issue(user: string) {
    const createdAt = this.clock();
    const expiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const session = randomBytes(32).toString("base64url");
    await this.sessions.insertOne({ _id: session, user, createdAt, expiresAt });
    return { user, session, expiresAt };
  }

  async current({ session }: { session: string }) {
    const found = typeof session === "string" ? await this.sessions.findOne({ _id: session, expiresAt: { $gt: this.clock() } }) : null;
    if (!found) throw new UnknownSession("You must be signed in to do that.");
    return { user: found.user };
  }

  async logout({ session }: { session: string }) {
    const found =
      typeof session === "string" ? await this.sessions.findOneAndDelete({ _id: session, expiresAt: { $gt: this.clock() } }) : null;
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
