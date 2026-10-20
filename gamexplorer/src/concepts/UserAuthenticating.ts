import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { password as passwordHash } from "bun";
import { MongoServerError, type Collection, type Db } from "mongodb";
import { MemoryProvider, type Provider } from "./UserAuthenticating/provider.ts";

export class EmptyCredentials extends Error {}
export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}
export class UnknownSession extends Error {}
export class InvalidUsername extends Error {}
export class UnknownUser extends Error {}

export class SignInExpired extends Error {}
export class SignInRefused extends Error {}
export class NotConfirmed extends Error {}
export class AlreadyLinked extends Error {}

const LIFETIME = 10 * 60 * 1000;

export type Attempt = string & { readonly __brand: "Attempt" };

interface AttemptDocument {
  _id: Attempt;
  nonce: string;
  verifier: string;
  expiresAt: Date;
  subject?: string;
}

/** An attempt is in Confirmed Attempts once it has a subject. */
type ConfirmedAttempt = Required<AttemptDocument>;

const CONFIRMED = { subject: { $exists: true } };
const UNCONFIRMED = { subject: { $exists: false } };

interface LinkDocument {
  subject: string;
  user: string;
}

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
  private readonly attempts: Collection<AttemptDocument>;
  private readonly links: Collection<LinkDocument>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db, private readonly clock: () => Date = () => new Date(), private readonly provider: Provider = new MemoryProvider()) {
    this.users = db.collection<UserDoc>("userAuthenticating.users");
    this.sessions = db.collection<SessionDoc>("userAuthenticating.sessions");
    // Keep P3 collection names so existing Commons identities and attempts remain valid.
    this.attempts = db.collection<AttemptDocument>("commonsfederating.attempts");
    this.links = db.collection<LinkDocument>("commonsfederating.links");
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

  /** Creates the indexes once. One makes MongoDB delete expired attempts, and the other makes MongoDB refuse a second link for the same subject, even when two requests arrive at once. If creating them fails, the next action tries again. */
  #ready() {
    this.indexes ??= Promise.all([
      // A minute's grace, so an attempt that expires while finish or link is running is still there.
      this.attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 60 }),
      this.links.createIndex({ subject: 1 }, { unique: true }),
    ]).catch((error: unknown) => {
      this.indexes = undefined;
      throw error;
    });
    return this.indexes;
  }

  async startExternal() {
    const attempt = unguessable() as Attempt;
    const nonce = unguessable();
    const verifier = unguessable();
    const expiresAt = new Date(this.clock().getTime() + LIFETIME);
    await this.#ready();
    await this.attempts.insertOne({ _id: attempt, nonce, verifier, expiresAt });
    return { attempt, expiresAt, address: this.provider.address({ nonce, verifier }) };
  }

  async finishExternal({ attempt, nonce, code }: { attempt: Attempt; nonce: string; code: string }) {
    if (typeof attempt !== "string") throw new SignInExpired("This sign-in has expired. Start again.");
    const found = await this.attempts.findOne({ _id: attempt, expiresAt: { $gt: this.clock() }, ...UNCONFIRMED });
    if (found === null || found.nonce !== nonce) throw new SignInExpired("This sign-in has expired. Start again.");

    const identity = await this.provider.redeem({ code, verifier: found.verifier });
    if (identity === undefined) {
      throw new SignInRefused("The other site didn't confirm this sign-in. Start again.");
    }

    const { matchedCount } = await this.attempts.updateOne(
      { _id: attempt, expiresAt: { $gt: this.clock() }, ...UNCONFIRMED },
      { $set: { subject: identity.subject } },
    );
    if (matchedCount === 0) throw new SignInExpired("This sign-in has expired. Start again.");
    return { username: identity.username };
  }

  async linkExternal({ attempt, user }: { attempt: Attempt; user: string }) {
    const confirmed = await this.#confirmed(attempt);
    if (confirmed === null || confirmed.expiresAt <= this.clock()) throw new NotConfirmed("This sign-in hasn't been confirmed.");
    if (!(await this.users.findOne({ _id: user }))) throw new UnknownUser("This user could not be found.");
    await this.#ready();
    try {
      await this.links.insertOne({ subject: confirmed.subject, user });
    } catch (error) {
      if (isDuplicate(error)) throw new AlreadyLinked("This account on the other site is already linked.");
      throw error;
    }
    return { user };
  }

  async _externalUser({ attempt }: { attempt: Attempt }) {
    const confirmed = await this.#confirmed(attempt);
    if (confirmed === null) return [];
    const link = await this.links.findOne({ subject: confirmed.subject });
    return link === null ? [] : [{ user: link.user }];
  }

  async _externalLinkable({ attempt }: { attempt: Attempt }) {
    const confirmed = await this.#confirmed(attempt);
    if (confirmed === null || confirmed.expiresAt <= this.clock()) return { linkable: false };
    const link = await this.links.findOne({ subject: confirmed.subject });
    return { linkable: link === null };
  }

  #confirmed(attempt: Attempt) {
    if (typeof attempt !== "string") return Promise.resolve(null);
    return this.attempts.findOne<ConfirmedAttempt>({ _id: attempt, ...CONFIRMED });
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

function unguessable(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** 11000 is the code MongoDB gives a write that breaks a unique index. */
const isDuplicate = (error: unknown) => error instanceof MongoServerError && error.code === 11000;
