import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  AlreadyLinked,
  type Attempt,
  UserAuthenticatingConcept,
  UnknownUser,
  NotConfirmed,
  SignInExpired,
  SignInRefused,
} from "./UserAuthenticating.ts";
import { MemoryProvider } from "./UserAuthenticating/provider.ts";
import { testDb } from "./testing.ts";
import type { Db } from "mongodb";
let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
beforeAll(async () => ({ db, reset, close } = await testDb("auth")));
beforeEach(async () => reset());
afterAll(async () => close());
async function expectOneWinner(actions: Promise<unknown>[], refusal: new (...args: any[]) => Error) {
  const results = await Promise.allSettled(actions);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  for (const result of results) if (result.status === "rejected") expect(result.reason).toBeInstanceOf(refusal);
}

const MINUTE = 60 * 1000;
const SAM = { subject: "u7f3", username: "sam" };
const LEO = { subject: "u2b9", username: "leo" };

async function setup() {
  let now = new Date("2026-10-07T12:00:00Z");
  const provider = new MemoryProvider();
  const redeem = spyOn(provider, "redeem");
  const auth = new UserAuthenticatingConcept(db, () => now, provider);

  /** Starts an attempt and approves it on the other site as `identity`, the way a browser does: returns what finish takes. */
  async function approved(identity = SAM) {
    const { attempt, address } = await auth.startExternal();
    const { code, state } = provider.approve(address, identity);
    return { attempt, nonce: state, code };
  }

  const samUser = (await auth.registerExternal({ username: "sam-account" })).user;
  const sam2User = (await auth.registerExternal({ username: "sam-second" })).user;
  return {
    samUser, sam2User,
    auth,
    provider,
    approved,
    redeem,
    advance: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

describe("UserAuthenticating external credentials", () => {
  test("its principle: Sam comes back to the same user after his Commons username changes, and neither Leo's link nor Sam's code read by Leo finishes a sign-in", async () => {
    const { auth, approved, redeem, samUser, sam2User } = await setup();

    const first = await approved(SAM);
    expect(await auth.finishExternal(first)).toEqual({ username: "sam" });
    expect(await auth._externalUser(first)).toEqual([]);
    expect(await auth.linkExternal({ attempt: first.attempt, user: samUser })).toEqual({ user: samUser });
    expect(await auth._externalUser(first)).toEqual([{ user: samUser }]);

    const again = await approved({ subject: SAM.subject, username: "samuel" });
    expect(await auth.finishExternal(again)).toEqual({ username: "samuel" });
    expect(await auth._externalUser(again)).toEqual([{ user: samUser }]);

    const leos = await approved(LEO);
    const { attempt: sams } = await auth.startExternal();
    redeem.mockClear();
    const forged = auth.finishExternal({ ...leos, attempt: sams });
    await expect(forged).rejects.toThrow(SignInExpired);
    await expect(forged).rejects.toThrow("This sign-in has expired. Start again.");
    expect(redeem).not.toHaveBeenCalled();
    expect(await auth.finishExternal(leos)).toEqual({ username: "leo" });

    const samsCode = await approved(SAM);
    const leosOwn = await approved(LEO);
    const replayed = auth.finishExternal({ ...leosOwn, code: samsCode.code });
    await expect(replayed).rejects.toThrow(SignInRefused);
    await expect(replayed).rejects.toThrow("The other site didn't confirm this sign-in. Start again.");
  });

  test("a provider response arriving at the deadline cannot confirm an expired attempt", async () => {
    const { auth, approved, provider, advance } = await setup();
    const attempt = await approved();
    const redeem = MemoryProvider.prototype.redeem.bind(provider);
    spyOn(provider, "redeem").mockImplementation(async input => {
      const identity = await redeem(input);
      advance(10 * MINUTE);
      return identity;
    });
    await expect(auth.finishExternal(attempt)).rejects.toThrow(SignInExpired);
    expect(await auth._externalLinkable(attempt)).toEqual({ linkable: false });
  });

  test("start returns an address carrying a fresh nonce and challenge in the forms Commons accepts, and an attempt that expires in 10 minutes", async () => {
    const { auth } = await setup();
    const one = await auth.startExternal();
    const two = await auth.startExternal();
    const nonce = new URL(one.address).searchParams.get("state");
    const challenge = new URL(one.address).searchParams.get("code_challenge");
    expect(nonce).toMatch(/^[A-Za-z0-9._~-]{16,256}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nonce).not.toBe(new URL(two.address).searchParams.get("state"));
    expect(challenge).not.toBe(new URL(two.address).searchParams.get("code_challenge"));
    expect(one.attempt).not.toBe(two.attempt);
    expect(one.attempt).not.toBe(nonce);
    expect(one.expiresAt).toEqual(new Date("2026-10-07T12:10:00Z"));
  });

  test("finish refuses an unknown, expired, or confirmed attempt, or another nonce, with SIGN_IN_EXPIRED before contacting the other site", async () => {
    const { auth, approved, redeem, advance, samUser, sam2User } = await setup();

    const sams = await approved();
    for (const attempt of [null, "unknown"]) {
      await expect(auth.finishExternal({ ...sams, attempt: attempt as Attempt })).rejects.toThrow(SignInExpired);
    }
    await expect(auth.finishExternal({ ...sams, nonce: "another-nonce-123456" })).rejects.toThrow(SignInExpired);

    const late = await approved();
    advance(10 * MINUTE);
    await expect(auth.finishExternal(late)).rejects.toThrow(SignInExpired);
    expect(redeem).not.toHaveBeenCalled();

    const replayed = await approved();
    await auth.finishExternal(replayed);
    await expect(auth.finishExternal(replayed)).rejects.toThrow(SignInExpired);
    expect(redeem).toHaveBeenCalledTimes(1);
  });

  test("finish refuses a code the other site doesn't confirm with SIGN_IN_REFUSED, and the attempt stays unconfirmed", async () => {
    const { auth, approved, samUser, sam2User } = await setup();
    const sams = await approved();
    const refused = auth.finishExternal({ ...sams, code: "a-code-nobody-issued" });
    await expect(refused).rejects.toThrow(SignInRefused);
    await expect(refused).rejects.toThrow("The other site didn't confirm this sign-in. Start again.");
    expect(await auth._externalLinkable(sams)).toEqual({ linkable: false });
    await expect(auth.linkExternal({ attempt: sams.attempt, user: samUser })).rejects.toThrow(NotConfirmed);
  });

  test("of two finishes of one attempt at once, one confirms it and the other is refused", async () => {
    const { auth, provider, samUser, sam2User } = await setup();
    const { attempt, address } = await auth.startExternal();
    const one = provider.approve(address, SAM);
    const two = provider.approve(address, SAM);
    await expectOneWinner(
      [
        auth.finishExternal({ attempt, nonce: one.state, code: one.code }),
        auth.finishExternal({ attempt, nonce: two.state, code: two.code }),
      ],
      SignInExpired,
    );
  });

  test("link refuses an unconfirmed attempt with NOT_CONFIRMED and a subject already linked with ALREADY_LINKED", async () => {
    const { auth, approved, samUser, sam2User } = await setup();
    const { attempt: unconfirmed } = await auth.startExternal();
    const notConfirmed = auth.linkExternal({ attempt: unconfirmed, user: samUser });
    await expect(notConfirmed).rejects.toThrow(NotConfirmed);
    await expect(notConfirmed).rejects.toThrow("This sign-in hasn't been confirmed.");

    const first = await approved(SAM);
    const second = await approved(SAM);
    await auth.finishExternal(first);
    await auth.finishExternal(second);
    await auth.linkExternal({ attempt: first.attempt, user: samUser });
    const linked = auth.linkExternal({ attempt: second.attempt, user: sam2User });
    await expect(linked).rejects.toThrow(AlreadyLinked);
    await expect(linked).rejects.toThrow("This account on the other site is already linked.");
    expect(await auth._externalUser(second)).toEqual([{ user: samUser }]);
  });

  test("_linkable is true only for a confirmed, unexpired attempt whose subject is unlinked, and linking is refused after expiry", async () => {
    const { auth, approved, advance, samUser, sam2User } = await setup();
    const sams = await approved();
    expect(await auth._externalLinkable(sams)).toEqual({ linkable: false });
    await auth.finishExternal(sams);
    expect(await auth._externalLinkable(sams)).toEqual({ linkable: true });

    advance(10 * MINUTE);
    expect(await auth._externalLinkable(sams)).toEqual({ linkable: false });
    await expect(auth.linkExternal({ attempt: sams.attempt, user: samUser })).rejects.toThrow(NotConfirmed);

    const again = await approved();
    await auth.finishExternal(again);
    expect(await auth._externalLinkable(again)).toEqual({ linkable: true });
    await expect(auth.linkExternal({ attempt: again.attempt, user: "unknown-user" })).rejects.toThrow(UnknownUser);
    expect(await auth._externalLinkable(again)).toEqual({ linkable: true });
    await auth.linkExternal({ attempt: again.attempt, user: samUser });
    expect(await auth._externalLinkable(again)).toEqual({ linkable: false });
    expect(await auth._externalLinkable({ attempt: "unknown" as Attempt })).toEqual({ linkable: false });
  });
});
