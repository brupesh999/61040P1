import { describe, expect, spyOn, test } from "bun:test";
import { integrationSuite, SESSION, ATTEMPT } from "../support/application.ts";
import { UserAuthenticatingConcept } from "../../src/concepts/UserAuthenticating.ts";
import { FederatingConcept as P3Federating } from "../../src/concepts/fixtures/FederatingP3.ts";
import { concepts } from "../../src/concepts.ts";
import { GameCatalogConcept } from "../../src/concepts/GameCatalog.ts";

const suite = integrationSuite("commons-http");
const { browser } = suite;

async function commonsLogin(client: ReturnType<typeof browser>, subject = "commons-sam", username = "sam") {
  const start = await client.post("/auth/commons/start");
  const approved = suite.provider.approve(start.body.address, { subject, username });
  const finish = await client.post("/auth/commons/finish", approved);
  expect(finish.status).toBe(200);
  return finish.body.user as string;
}

describe("Commons authentication through HTTP and MongoDB", () => {
  test("the application registers exactly five concepts", () => {
    expect(Object.keys(concepts).sort()).toEqual([
      "UserAuthenticating", "GameCatalog", "GameDimensions", "DimensionRatings", "GameDiscovery",
    ].sort());
  });

  test("P3 Commons links and active sessions retain their identity and contributions", async () => {
    // Original P3 protocol actions create the old collection layout, never direct writes.
    const accounts = new UserAuthenticatingConcept(suite.db);
    const { user } = await accounts.registerExternal({ username: "legacy-commons" });
    const oldSession = await accounts.startSession({ user });
    const legacy = new P3Federating<string>(suite.db, suite.provider, "CommonsFederating");
    const start = await legacy.start();
    const approval = suite.provider.approve(start.address, { subject: "legacy-subject", username: "legacy-commons" });
    await legacy.finish({ attempt: start.attempt, nonce: approval.state, code: approval.code });
    await legacy.link({ attempt: start.attempt, user });
    const client = browser();
    client.jar.set(SESSION, oldSession.session);
    const { game } = await new GameCatalogConcept(suite.db).addGame({ title: "Legacy game", developer: "Studio", releaseYear: 2024 });
    const aspect = (await client.post("/aspects/create", { game, name: "Combat", description: "" })).body.aspect;
    await client.post("/ratings/rate", { aspect, score: 9, microNote: "Existing review." });
    await client.post("/discover/set", { aspectName: "Combat", minScore: 8 });
    // Reassemble to represent the refined application reading existing persistent state.
    suite.restart();
    expect((await client.post("/auth/me")).body.me.user).toBe(user);
    expect(await commonsLogin(client, "legacy-subject", "changed-name")).toBe(user);
    expect((await client.post("/ratings/mine")).body.mine.ratings[0]).toMatchObject({ game, score: 9, microNote: "Existing review." });
    expect((await client.post("/discover/results")).body.results.matches[0].game).toBe(game);
  });

  test("sign-in issues private cookies; the same Commons subject keeps its reviews after a name change", async () => {
    const sam = browser();
    const start = await sam.post("/auth/commons/start");
    expect(start.body).toEqual({ address: expect.any(String) });
    expect(start.cookies[0]).toContain("HttpOnly");
    expect(start.cookies[0]).toContain("Secure");
    expect(start.cookies[0]).toContain("SameSite=Strict");
    expect(sam.jar.has(ATTEMPT)).toBe(true);
    const finish = await sam.post("/auth/commons/finish", suite.provider.approve(start.body.address, { subject: "sam-id", username: "sam" }));
    expect(finish.body).toEqual({ user: expect.any(String) });
    expect(sam.jar.has(ATTEMPT)).toBe(false);
    expect(sam.jar.has(SESSION)).toBe(true);
    const user = finish.body.user;
    expect((await sam.post("/auth/me")).body).toEqual({ me: { user, username: "sam" } });
    const { game } = await new GameCatalogConcept(suite.db).addGame({ title: "A Game", developer: "Studio", releaseYear: 2024 });
    const aspect = (await sam.post("/aspects/create", { game, name: "Combat", description: "" })).body.aspect;
    expect((await sam.post("/ratings/rate", { aspect, score: 9, microNote: "Responsive combat." })).status).toBe(200);
    expect((await sam.post("/discover/set", { aspectName: "Combat", minScore: 8 })).body.results.matches).toHaveLength(1);
    expect((await sam.post("/auth/logout")).status).toBe(200);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/ratings/mine")).status).toBe(401);
    expect(await commonsLogin(sam, "sam-id", "sam-renamed")).toBe(user);
    expect((await sam.post("/ratings/mine")).body.mine.ratings).toHaveLength(1);
    const other = browser();
    await commonsLogin(other, "other-id", "other");
    expect((await other.post("/ratings/mine", { user })).body.mine.ratings).toEqual([]);
    expect((await other.post("/discover/results", { owner: user })).body.results.filters).toEqual([]);
  });

  test("another browser cannot supply an attempt in JSON or finish the caller's sign-in", async () => {
    const leo = browser(), sam = browser();
    const leos = await leo.post("/auth/commons/start");
    const approved = suite.provider.approve(leos.body.address, { subject: "leo-id", username: "leo" });
    await sam.post("/auth/commons/start");
    const ownAttempt = sam.jar.get(ATTEMPT);
    const redeem = spyOn(suite.provider, "redeem");
    const forged = await sam.post("/auth/commons/finish", { ...approved, attempt: leo.jar.get(ATTEMPT) });
    expect(forged.status).toBe(403);
    expect(forged.body).toEqual({ error: "FORBIDDEN" });
    expect(redeem).not.toHaveBeenCalled();
    expect(sam.jar.get(ATTEMPT)).toBe(ownAttempt);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await leo.post("/auth/commons/finish", approved)).status).toBe(200);
  });

  test("a stolen code fails PKCE in another attempt and cannot be replayed", async () => {
    const sam = browser(), leo = browser();
    const sams = await sam.post("/auth/commons/start");
    const samCode = suite.provider.approve(sams.body.address, { subject: "sam-id", username: "sam" });
    const leos = await leo.post("/auth/commons/start");
    const leoState = new URL(leos.body.address).searchParams.get("state");
    expect((await leo.post("/auth/commons/finish", { state: leoState, code: samCode.code })).status).toBe(403);
    expect(leo.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/auth/commons/finish", samCode)).status).toBe(403);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect(await commonsLogin(sam, "sam-id", "sam")).toBeString();
    expect((await sam.post("/auth/commons/finish", samCode)).status).toBe(403);
  });

  test("a local username is never automatically linked; a confirmed user can choose another", async () => {
    const local = browser();
    const localUser = (await local.post("/auth/register", { username: "sam", password: "local-password" })).body.user;
    const sam = browser();
    const start = await sam.post("/auth/commons/start");
    const approve = suite.provider.approve(start.body.address, { subject: "commons-sam", username: "sam" });
    expect((await sam.post("/auth/commons/finish", approve)).status).toBe(409);
    expect(sam.jar.has(ATTEMPT)).toBe(true);
    expect(sam.jar.has(SESSION)).toBe(false);
    expect((await sam.post("/auth/commons/choose", { username: "sam" })).status).toBe(409);
    expect((await sam.post("/auth/commons/choose", { username: "bad name" })).status).toBe(400);
    const chosen = await sam.post("/auth/commons/choose", { username: "sam-commons" });
    expect(chosen.status).toBe(200);
    expect(chosen.body.user).not.toBe(localUser);
    expect(sam.jar.has(ATTEMPT)).toBe(false);
    expect((await sam.post("/auth/me")).body.me.username).toBe("sam-commons");
    expect((await local.post("/auth/me")).body.me.user).toBe(localUser);
  });

  test("origin protection blocks sign-in and existing credentials cannot be supplied in JSON", async () => {
    const sam = browser();
    expect((await sam.post("/auth/commons/start", {}, "https://other.example")).status).toBe(403);
    expect((await sam.post("/auth/register", { username: "sam", password: "password" }, "https://other.example")).status).toBe(403);
    await commonsLogin(sam);
    const anonymous = browser();
    expect((await anonymous.post("/auth/me", { session: sam.jar.get(SESSION) })).status).toBe(401);
    expect((await sam.post("/auth/me", { session: "forged" })).body.me.username).toBe("sam");
    expect((await sam.post("/ratings/mine", {}, "https://other.example")).status).toBe(403);
    expect((await anonymous.post("/auth/commons/choose", { username: "unused" })).body.error).toBe("FORBIDDEN");
  });
});
