import { frontendHandler } from "./serve.ts";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:3000";
const frontend = await frontendHandler();

// Pass API requests and health checks on to the backend.
function proxy(request: Request) {
  const url = new URL(request.url);
  return fetch(new URL(url.pathname + url.search, backend), request).catch(
    () => Response.json({ error: "UNAVAILABLE" }, { status: 503 }),
  );
}

const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8080),
  routes: {
    "/api/*": proxy,
    "/health": proxy,
  },
  fetch: frontend,
});

console.log(`Frontend listening on ${server.url}`);
