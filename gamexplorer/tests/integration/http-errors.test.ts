import { describe, expect, test } from "bun:test";
import { integrationSuite } from "../support/application.ts";

const suite = integrationSuite("http-errors");
const { call, signUp } = suite;

describe("HTTP refusal mapping", () => {
  test("duplicate usernames, bad credentials, invalid Steam choices, bad scores, and missing targets", async () => {
    const session = await signUp("mira");
    expect((await call("/auth/register", { username: "mira", password: "x" })).body.error).toBe("CONFLICT");
    expect((await call("/auth/login", { username: "mira", password: "wrong" })).body.error).toBe("UNAUTHORIZED");
    const game = (await call("/games/add", { session, steamAppId: 3 })).body.game;
    expect((await call("/games/add", { session, steamAppId: 3 })).body.game).toBe(game);
    expect((await call("/games/add", { session, steamAppId: -1 })).body.error).toBe("INVALID_REQUEST");
    const aspect = (await call("/aspects/create", { session, game, name: "Pacing", description: "" })).body.aspect;
    expect((await call("/aspects/create", { session, game, name: "pacing", description: "" })).body.error).toBe("CONFLICT");
    expect((await call("/aspects/create", { session, game: "nope", name: "Pacing", description: "" })).status).toBe(404);
    expect((await call("/ratings/rate", { session, aspect, score: 11, microNote: "" })).body.error).toBe("INVALID_REQUEST");
    expect((await call("/ratings/rate", { session, aspect: "nope", score: 5, microNote: "" })).status).toBe(404);
    expect((await call("/ratings/remove", { session, aspect })).status).toBe(404);
    expect((await call("/discover/set", { session, aspectName: "Pacing", minScore: 0 })).body.error).toBe("INVALID_REQUEST");
    expect((await call("/games/detail", { game: "nope" })).status).toBe(404);
  });
});
