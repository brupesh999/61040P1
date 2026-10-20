export interface SteamGame {
  steamAppId: number;
  title: string;
  developer: string;
  releaseYear: number;
  coverUrl: string;
}

export interface SteamSource {
  search(query: string): Promise<SteamGame[]>;
  lookup(steamAppId: number): Promise<SteamGame | null>;
}

export class SteamUnavailable extends Error {
  constructor() { super("Steam is unavailable. Try again shortly."); }
}

/** Steam's storefront JSON is isolated here so source changes do not affect catalog rules. */
export class SteamStore implements SteamSource {
  private readonly cache = new Map<number, { until: number; game: SteamGame | null }>();

  constructor(private readonly request: typeof fetch = fetch, private readonly timeoutMs = 5000) {}

  private async json(url: URL): Promise<any> {
    try {
      const response = await this.request(url, { signal: AbortSignal.timeout(this.timeoutMs), redirect: "error" });
      if (!response.ok) throw new SteamUnavailable();
      return await response.json();
    } catch {
      throw new SteamUnavailable();
    }
  }

  async lookup(steamAppId: number): Promise<SteamGame | null> {
    const saved = this.cache.get(steamAppId);
    if (saved && saved.until > Date.now()) return saved.game;
    const url = new URL("https://store.steampowered.com/api/appdetails/");
    url.search = new URLSearchParams({ appids: String(steamAppId), l: "english", cc: "US" }).toString();
    const payload = await this.json(url);
    const entry = payload?.[String(steamAppId)];
    if (!entry || typeof entry.success !== "boolean") throw new SteamUnavailable();
    const data = entry.success ? entry.data : null;
    const year = typeof data?.release_date?.date === "string"
      ? Number(data.release_date.date.match(/\b(?:19|20)\d{2}\b/)?.[0]) : NaN;
    const title = typeof data?.name === "string" ? data.name.trim() : "";
    const developers = Array.isArray(data?.developers)
      ? data.developers.filter((value: unknown): value is string => typeof value === "string" && !!value.trim()) : [];
    const game = data?.type === "game" && data.steam_appid === steamAppId && title && developers.length &&
      Number.isInteger(year) && year >= 1950 && year <= 2100 ? {
        steamAppId, title, developer: developers.join(", "), releaseYear: year,
        coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg`,
      } : null;
    if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(steamAppId, { until: Date.now() + 5 * 60_000, game });
    return game;
  }

  async search(query: string): Promise<SteamGame[]> {
    const url = new URL("https://store.steampowered.com/api/storesearch/");
    url.search = new URLSearchParams({ term: query, l: "english", cc: "US" }).toString();
    const payload = await this.json(url);
    if (!Array.isArray(payload?.items)) throw new SteamUnavailable();
    const ids = [...new Set<number>(payload.items
      .filter((item: any) => item?.type === "app" && Number.isInteger(item.id) && item.id > 0 && item.id <= 0xffff_ffff)
      .map((item: any) => item.id))].slice(0, 10);
    const matches: Array<SteamGame | null> = [];
    // Bound concurrency; DLC, demos, software, and incomplete listings are omitted.
    for (let start = 0; start < ids.length; start += 3) {
      matches.push(...await Promise.all(ids.slice(start, start + 3).map(id => this.lookup(id))));
    }
    return matches.filter((game): game is SteamGame => game !== null);
  }
}
