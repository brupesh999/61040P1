import { expect, test } from "bun:test";
import { frontendHandler } from "../../web/serve.ts";

test("the Commons callback serves the app with no-referrer and absolute assets without reflecting codes", async () => {
  const serve = await frontendHandler();
  const callback = serve(new Request("http://127.0.0.1:3011/auth/commons/callback?code=secret-test-code&state=secret-test-state"));
  expect(callback.status).toBe(200);
  expect(callback.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(callback.headers.get("Cache-Control")).toBe("no-store");
  const html = await callback.text();
  expect(html).not.toContain("secret-test-code");
  expect(html).not.toContain("secret-test-state");
  const script = html.match(/<script[^>]*src="([^"]+)"/);
  expect(script?.[1]).toStartWith("/");
  expect(serve(new Request("http://127.0.0.1:3011" + script![1])).status).toBe(200);
});
