import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import {
  EmptyCredentials,
  InvalidCredentials,
  UnknownSession,
  UserAuthenticatingConcept,
  UsernameTaken,
  InvalidUsername,
  UnknownUser,
} from "./UserAuthenticating.ts";
import { testDb } from "./testing.ts";
import { UserAuthenticatingConcept as P2Authenticating } from "./fixtures/UserAuthenticatingP2.ts";

let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
let auth: UserAuthenticatingConcept;

beforeAll(async () => ({ db, reset, close } = await testDb("auth")));
beforeEach(async () => {
  await reset();
  auth = new UserAuthenticatingConcept(db);
});
afterAll(async () => close());

describe("UserAuthenticating", () => {
  test("P2 accounts retain their identity and upgrade their password hash only after a successful login", async () => {
    // The archived P2 concept creates the old state through its original public actions.
    const legacy = new P2Authenticating(db);
    const { user } = await legacy.register({ username: "p2-user", password: "old-password" });
    const oldSession = await legacy.authenticate({ username: "p2-user", password: "old-password" });
    await expect(auth.current(oldSession)).rejects.toThrow(UnknownSession);
    const before = await db.collection("userAuthenticating.users").findOne({ _id: user as any });
    await expect(auth.authenticate({ username: "p2-user", password: "wrong-password" })).rejects.toThrow(InvalidCredentials);
    const unchanged = await db.collection("userAuthenticating.users").findOne({ _id: user as any });
    expect(unchanged?.passwordHash).toBe(before?.passwordHash);
    const login = await auth.authenticate({ username: "p2-user", password: "old-password" });
    expect(login.user).toBe(user);
    expect(await auth.current(login)).toEqual({ user });
    const upgraded = await db.collection("userAuthenticating.users").findOne({ _id: user as any });
    expect(upgraded?.passwordHash).toStartWith("$argon2id$");
    expect(upgraded?.salt).toBeUndefined();
    expect((await auth.authenticate({ username: "p2-user", password: "old-password" })).user).toBe(user);
  });
  test("external accounts have no password, can start sessions, and cannot take a local username", async () => {
    const { user } = await auth.registerExternal({ username: "commons-user" });
    const signedIn = await auth.startSession({ user });
    expect(await auth.current(signedIn)).toEqual({ user });
    await expect(auth.authenticate({ username: "commons-user", password: "anything" })).rejects.toThrow(InvalidCredentials);
    await expect(auth.registerExternal({ username: "commons-user" })).rejects.toThrow(UsernameTaken);
    await auth.register({ username: "local-user", password: "local-password" });
    await expect(auth.registerExternal({ username: "local-user" })).rejects.toThrow(UsernameTaken);
    for (const username of ["", "ab", "has spaces", "x".repeat(33)]) {
      await expect(auth.registerExternal({ username })).rejects.toThrow(InvalidUsername);
      expect(await auth._getUser({ username })).toEqual([]);
    }
    await expect(auth.startSession({ user: "unknown" })).rejects.toThrow(UnknownUser);
    expect(await auth.current(signedIn)).toEqual({ user });
  });

  test("new local passwords use Argon2id and expired sessions refuse use and logout", async () => {
    let now = new Date("2026-10-15T12:00:00Z");
    const timed = new UserAuthenticatingConcept(db, () => now);
    const { user } = await timed.register({ username: "timed-user", password: "safe-test-password" });
    const stored = await db.collection("userAuthenticating.users").findOne({ _id: user as any });
    expect(stored?.passwordHash).toStartWith("$argon2id$");
    expect(stored?.passwordHash).not.toContain("safe-test-password");
    const session = await timed.authenticate({ username: "timed-user", password: "safe-test-password" });
    expect(session.expiresAt).toEqual(new Date("2027-01-13T12:00:00Z"));
    now = session.expiresAt;
    await expect(timed.current(session)).rejects.toThrow(UnknownSession);
    await expect(timed.logout(session)).rejects.toThrow(UnknownSession);
    expect(await timed._getUser({ username: "timed-user" })).toEqual([{ user }]);
  });
  test("principle: register, authenticate with exact credentials, resolve session, log out", async () => {
    const { user } = await auth.register({ username: "mira", password: "hunter22" });
    await expect(user).toBeString();
    await expect(await auth._getUser({ username: "mira" })).toEqual([{ user }]);
    await expect(await auth._username({ user })).toEqual([{ username: "mira" }]);

    const signedIn = await auth.authenticate({ username: "mira", password: "hunter22" });
    await expect(signedIn.user).toBe(user);
    await expect(signedIn.session).toBeString();

    await expect(await auth.current({ session: signedIn.session })).toEqual({ user });
    await expect(await auth.logout({ session: signedIn.session })).toEqual({ user });
    await expect(auth.current({ session: signedIn.session })).rejects.toThrow(UnknownSession);
  });

  test("a duplicate username is refused with USERNAME_TAKEN", async () => {
    await auth.register({ username: "mira", password: "hunter22" });
    const duplicate = auth.register({ username: "mira", password: "different" });
    await expect(duplicate).rejects.toThrow(UsernameTaken);
    await expect(duplicate).rejects.toThrow("The requested username is already registered.");
  });

  test("empty username or password is refused and creates no user", async () => {
    await expect(auth.register({ username: "  ", password: "x" })).rejects.toThrow(EmptyCredentials);
    await expect(auth.register({ username: "mira", password: "" })).rejects.toThrow(EmptyCredentials);
    await expect(await auth._getUser({ username: "mira" })).toEqual([]);
  });

  test("wrong password and unknown user are both refused with INVALID_CREDENTIALS", async () => {
    await auth.register({ username: "mira", password: "hunter22" });
    const wrong = auth.authenticate({ username: "mira", password: "hunter23" });
    await expect(wrong).rejects.toThrow(InvalidCredentials);
    await expect(wrong).rejects.toThrow("Invalid username or password.");
    await expect(auth.authenticate({ username: "nobody", password: "hunter22" })).rejects.toThrow(
      InvalidCredentials,
    );
  });

  test("an invented session is refused, and logging out twice is refused", async () => {
    await expect(auth.current({ session: "invented" })).rejects.toThrow(UnknownSession);
    await auth.register({ username: "mira", password: "hunter22" });
    const { session } = await auth.authenticate({ username: "mira", password: "hunter22" });
    await auth.logout({ session });
    await expect(auth.logout({ session })).rejects.toThrow("You must be signed in to do that.");
  });

  test("sessions are independent: logging out one leaves the other active", async () => {
    const { user } = await auth.register({ username: "mira", password: "hunter22" });
    const a = await auth.authenticate({ username: "mira", password: "hunter22" });
    const b = await auth.authenticate({ username: "mira", password: "hunter22" });
    await expect(a.session).not.toBe(b.session);
    await auth.logout({ session: a.session });
    await expect(await auth.current({ session: b.session })).toEqual({ user });
  });
});
