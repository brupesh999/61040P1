import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  AlreadyLinked,
  type Attempt,
  FederatingConcept,
  NotConfirmed,
  SignInExpired,
  SignInRefused,
} from "./Federating/Federating.ts";
import { MemoryProvider } from "./Federating/provider.ts";
import { testDb } from "./testing.ts";
import type { Db } from "mongodb";
let db: Db;
let reset: () => Promise<void>;
let close: () => Promise<void>;
beforeAll(async () => ({ db, reset, close } = await testDb("federating")));
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
  const federating = new FederatingConcept<string>(db, provider, "Federating", () => now);

  /** Starts an attempt and approves it on the other site as `identity`, the way a browser does: returns what finish takes. */
  async function approved(identity = SAM) {
    const { attempt, address } = await federating.start();
    const { code, state } = provider.approve(address, identity);
    return { attempt, nonce: state, code };
  }

  return {
    federating,
    provider,
    approved,
    redeem,
    advance: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

describe("Federating", () => {
  test("its principle: Sam comes back to the same user after his Commons username changes, and neither Leo's link nor Sam's code read by Leo finishes a sign-in", async () => {
    const { federating, approved, redeem } = await setup();

    const first = await approved(SAM);
    expect(await federating.finish(first)).toEqual({ username: "sam" });
    expect(await federating._user(first)).toEqual([]);
    expect(await federating.link({ attempt: first.attempt, user: "sam-user" })).toEqual({ user: "sam-user" });
    expect(await federating._user(first)).toEqual([{ user: "sam-user" }]);

    const again = await approved({ subject: SAM.subject, username: "samuel" });
    expect(await federating.finish(again)).toEqual({ username: "samuel" });
    expect(await federating._user(again)).toEqual([{ user: "sam-user" }]);

    const leos = await approved(LEO);
    const { attempt: sams } = await federating.start();
    redeem.mockClear();
    const forged = federating.finish({ ...leos, attempt: sams });
    await expect(forged).rejects.toThrow(SignInExpired);
    await expect(forged).rejects.toThrow("This sign-in has expired. Start again.");
    expect(redeem).not.toHaveBeenCalled();
    expect(await federating.finish(leos)).toEqual({ username: "leo" });

    const samsCode = await approved(SAM);
    const leosOwn = await approved(LEO);
    const replayed = federating.finish({ ...leosOwn, code: samsCode.code });
    await expect(replayed).rejects.toThrow(SignInRefused);
    await expect(replayed).rejects.toThrow("The other site didn't confirm this sign-in. Start again.");
  });

  test("start returns an address carrying a fresh nonce and challenge in the forms Commons accepts, and an attempt that expires in 10 minutes", async () => {
    const { federating } = await setup();
    const one = await federating.start();
    const two = await federating.start();
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
    const { federating, approved, redeem, advance } = await setup();

    const sams = await approved();
    for (const attempt of [null, "unknown"]) {
      await expect(federating.finish({ ...sams, attempt: attempt as Attempt })).rejects.toThrow(SignInExpired);
    }
    await expect(federating.finish({ ...sams, nonce: "another-nonce-123456" })).rejects.toThrow(SignInExpired);

    const late = await approved();
    advance(10 * MINUTE);
    await expect(federating.finish(late)).rejects.toThrow(SignInExpired);
    expect(redeem).not.toHaveBeenCalled();

    const replayed = await approved();
    await federating.finish(replayed);
    await expect(federating.finish(replayed)).rejects.toThrow(SignInExpired);
    expect(redeem).toHaveBeenCalledTimes(1);
  });

  test("finish refuses a code the other site doesn't confirm with SIGN_IN_REFUSED, and the attempt stays unconfirmed", async () => {
    const { federating, approved } = await setup();
    const sams = await approved();
    const refused = federating.finish({ ...sams, code: "a-code-nobody-issued" });
    await expect(refused).rejects.toThrow(SignInRefused);
    await expect(refused).rejects.toThrow("The other site didn't confirm this sign-in. Start again.");
    expect(await federating._linkable(sams)).toEqual({ linkable: false });
    await expect(federating.link({ attempt: sams.attempt, user: "sam-user" })).rejects.toThrow(NotConfirmed);
  });

  test("of two finishes of one attempt at once, one confirms it and the other is refused", async () => {
    const { federating, provider } = await setup();
    const { attempt, address } = await federating.start();
    const one = provider.approve(address, SAM);
    const two = provider.approve(address, SAM);
    await expectOneWinner(
      [
        federating.finish({ attempt, nonce: one.state, code: one.code }),
        federating.finish({ attempt, nonce: two.state, code: two.code }),
      ],
      SignInExpired,
    );
  });

  test("link refuses an unconfirmed attempt with NOT_CONFIRMED and a subject already linked with ALREADY_LINKED", async () => {
    const { federating, approved } = await setup();
    const { attempt: unconfirmed } = await federating.start();
    const notConfirmed = federating.link({ attempt: unconfirmed, user: "sam-user" });
    await expect(notConfirmed).rejects.toThrow(NotConfirmed);
    await expect(notConfirmed).rejects.toThrow("This sign-in hasn't been confirmed.");

    const first = await approved(SAM);
    const second = await approved(SAM);
    await federating.finish(first);
    await federating.finish(second);
    await federating.link({ attempt: first.attempt, user: "sam-user" });
    const linked = federating.link({ attempt: second.attempt, user: "sam2-user" });
    await expect(linked).rejects.toThrow(AlreadyLinked);
    await expect(linked).rejects.toThrow("This account on the other site is already linked.");
    expect(await federating._user(second)).toEqual([{ user: "sam-user" }]);
  });

  test("_linkable is true only for a confirmed, unexpired attempt whose subject is unlinked, and link still links after expiry", async () => {
    const { federating, approved, advance } = await setup();
    const sams = await approved();
    expect(await federating._linkable(sams)).toEqual({ linkable: false });
    await federating.finish(sams);
    expect(await federating._linkable(sams)).toEqual({ linkable: true });

    advance(10 * MINUTE);
    expect(await federating._linkable(sams)).toEqual({ linkable: false });
    expect(await federating.link({ attempt: sams.attempt, user: "sam-user" })).toEqual({ user: "sam-user" });

    const again = await approved();
    await federating.finish(again);
    expect(await federating._linkable(again)).toEqual({ linkable: false });
    expect(await federating._linkable({ attempt: "unknown" as Attempt })).toEqual({ linkable: false });
  });
});
