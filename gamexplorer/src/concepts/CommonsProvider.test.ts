import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { CommonsProvider } from "./UserAuthenticating/provider.ts";

const requests: unknown[] = [];
let answer: () => Response | Promise<Response> = () => Response.json({});

/** A stand-in for Commons' redeem endpoint that records each request and answers with `answer`. */
const commons = Bun.serve({
  port: 0,
  async fetch(request) {
    requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() });
    return answer();
  },
});
afterAll(() => commons.stop(true));
beforeEach(() => {
  requests.length = 0;
});

/** The verifier and challenge from RFC 7636, appendix B. */
const RFC_7636 = {
  verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
};

function provider(timeout?: number) {
  return new CommonsProvider({ origin: commons.url.href, app: "http://localhost:5173/", timeout });
}

describe("CommonsProvider", () => {
  test("the sign-in address names the app by its origin, carries the nonce as state, and the verifier's S256 challenge", () => {
    const address = new URL(provider().address({ nonce: "n0nce-n0nce-n0nce-n0nce", verifier: RFC_7636.verifier }));
    expect(address.origin).toBe(commons.url.origin);
    expect(address.pathname).toBe("/connect");
    expect([...address.searchParams]).toEqual([
      ["app", "http://localhost:5173"],
      ["state", "n0nce-n0nce-n0nce-n0nce"],
      ["code_challenge", RFC_7636.challenge],
      ["code_challenge_method", "S256"],
    ]);
  });

  test("redeeming posts exactly the code, the app, and the verifier, and returns Commons' user as the subject", async () => {
    answer = () => Response.json({ user: "u7f3", username: "sam", displayName: "Sam", email: "sam@example.edu" });
    expect(await provider().redeem({ code: "the-code", verifier: RFC_7636.verifier })).toEqual({
      subject: "u7f3",
      username: "sam",
    });
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/api/connect/redeem",
        body: { code: "the-code", app: "http://localhost:5173", code_verifier: RFC_7636.verifier },
      },
    ]);
  });

  test("a refused code, an error, or an answer without a user returns undefined, and nothing is retried", async () => {
    for (const refusal of [
      () => Response.json({ error: "CONNECT_CODE_INVALID" }, { status: 400 }),
      () => new Response("unavailable", { status: 503 }),
      () => Response.json({ username: "sam" }),
    ]) {
      answer = refusal;
      requests.length = 0;
      expect(await provider().redeem({ code: "the-code", verifier: RFC_7636.verifier })).toBeUndefined();
      expect(requests).toHaveLength(1);
    }
  });

  test("Commons not answering within the timeout returns undefined", async () => {
    answer = async () => {
      await Bun.sleep(500);
      return Response.json({ user: "u7f3", username: "sam" });
    };
    const started = Date.now();
    expect(await provider(50).redeem({ code: "the-code", verifier: RFC_7636.verifier })).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(400);
    expect(requests).toHaveLength(1);
  });

  test("a Commons that can't be reached returns undefined", async () => {
    const unreachable = new CommonsProvider({ origin: "http://127.0.0.1:9", app: "http://localhost:5173" });
    expect(await unreachable.redeem({ code: "the-code", verifier: RFC_7636.verifier })).toBeUndefined();
  });
});
