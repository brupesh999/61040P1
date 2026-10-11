import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "mongodb";
import {
  EmptyCredentials,
  InvalidCredentials,
  UnknownSession,
  UserAuthenticatingConcept,
  UsernameTaken,
} from "./UserAuthenticating.ts";
import { testDb } from "./testing.ts";

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
