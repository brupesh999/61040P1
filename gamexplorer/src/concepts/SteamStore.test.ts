import { expect, test } from "bun:test";
import { SteamStore, SteamUnavailable } from "./GameCatalog/steam.ts";

const details = (id: number, type = "game", date = "Apr 18, 2011") => ({
  [id]: { success: true, data: { steam_appid: id, type, name: `Game ${id}`, developers: ["Studio"], release_date: { date } } },
});

test("Steam search verifies base games, preserves source order, and reuses verified details", async () => {
  const calls: URL[] = [];
  const request = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input)); calls.push(url);
    if (url.pathname.endsWith("storesearch/")) return Response.json({ items: [
      { type: "app", id: 3 }, { type: "bundle", id: 50 }, { type: "app", id: 2 },
      { type: "app", id: 1 }, { type: "app", id: 3 }, { type: "app", id: 4 },
    ] });
    const id = Number(url.searchParams.get("appids"));
    return Response.json(details(id, id === 2 ? "dlc" : "game", id === 4 ? "Coming soon" : "Apr 18, 2011"));
  }) as typeof fetch;
  const source = new SteamStore(request);
  const games = await source.search("Final Fantasy & friends");
  expect(calls[0]!.hostname).toBe("store.steampowered.com");
  expect(calls[0]!.searchParams.get("term")).toBe("Final Fantasy & friends");
  expect(games.map(game => game.steamAppId)).toEqual([3, 1]);
  expect(games[0]).toEqual({ steamAppId: 3, title: "Game 3", developer: "Studio", releaseYear: 2011,
    coverUrl: "https://cdn.akamai.steamstatic.com/steam/apps/3/library_600x900.jpg" });
  const before = calls.length;
  expect(await source.lookup(3)).toEqual(games[0]!);
  expect(await source.lookup(2)).toBeNull();
  expect(calls).toHaveLength(before);
});

test("unavailable or malformed Steam responses are errors, not empty search results", async () => {
  for (const response of [new Response("busy", { status: 429 }), Response.json({}), new Response("<html>Unavailable</html>")]) {
    const source = new SteamStore((async () => response.clone()) as unknown as typeof fetch);
    await expect(source.search("Portal")).rejects.toThrow(SteamUnavailable);
  }
  const empty = new SteamStore((async () => Response.json({ items: [] })) as unknown as typeof fetch);
  expect(await empty.search("No matching game")).toEqual([]);
  const missing = new SteamStore((async () => Response.json({ 620: { success: false } })) as unknown as typeof fetch);
  expect(await missing.lookup(620)).toBeNull();
});

test("metadata for another app and incomplete game metadata cannot be imported", async () => {
  const wrong = details(620); wrong[620]!.data.steam_appid = 400;
  const blank = details(620); blank[620]!.data.developers = [];
  for (const payload of [wrong, blank, details(620, "demo"), details(620, "game", "TBA")]) {
    const source = new SteamStore((async () => Response.json(payload)) as unknown as typeof fetch);
    expect(await source.lookup(620)).toBeNull();
  }
});

test("a real stalled HTTP response is aborted within the configured deadline", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Promise<Response>(() => {}) });
  const source = new SteamStore(((input, init) => fetch(new URL(new URL(String(input)).pathname, server.url), init)) as typeof fetch, 50);
  const started = performance.now();
  try {
    await expect(source.lookup(620)).rejects.toThrow(SteamUnavailable);
    expect(performance.now() - started).toBeLessThan(1000);
  } finally { await server.stop(true); }
});
