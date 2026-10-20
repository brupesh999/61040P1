import { SteamUnavailable, type SteamGame, type SteamSource } from "../concepts/GameCatalog/steam.ts";

export function steamGame(steamAppId: number, title: string, developer = "Studio", releaseYear = 2020): SteamGame {
  return { steamAppId, title, developer, releaseYear,
    coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/library_600x900.jpg` };
}

/** Only the external metadata service is substituted; catalog rules and MongoDB remain real. */
export class FixtureSteam implements SteamSource {
  available = true;
  lookups = 0;
  searches = 0;
  constructor(readonly games: SteamGame[]) {}
  async lookup(steamAppId: number) {
    this.lookups++;
    if (!this.available) throw new SteamUnavailable();
    return this.games.find(game => game.steamAppId === steamAppId) ?? null;
  }
  async search(query: string) {
    this.searches++;
    if (!this.available) throw new SteamUnavailable();
    return this.games.filter(game => game.title.toLowerCase().includes(query.toLowerCase()));
  }
}
