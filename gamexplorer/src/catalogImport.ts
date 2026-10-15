import { GameCatalogConcept, GameExists } from "./concepts/GameCatalog.ts";

export interface SteamCatalogEntry {
  title: string;
  developer: string;
  releaseYear: number;
  steamAppId: number;
  coverUrl: string;
}

/** Administrative import through one concept's public interface; never resets data. */
export async function importSteamCatalog(catalog: GameCatalogConcept, entries: readonly SteamCatalogEntry[]) {
  let created = 0;
  for (const entry of entries) {
    let [found] = await catalog._getGame({ title: entry.title });
    if (!found) {
      try {
        found = await catalog.addGame(entry);
        created++;
      } catch (error) {
        if (!(error instanceof GameExists)) throw error;
        [found] = await catalog._getGame({ title: entry.title });
        if (!found) throw error;
      }
    }
    await catalog.setSteamCover({ game: found.game, steamAppId: entry.steamAppId, coverUrl: entry.coverUrl });
  }
  return { created, covers: entries.length };
}

/** Optional deployment/bootstrap input; all durable state still goes through GameCatalog actions. */
export async function importBundledSteamCatalog(catalog: GameCatalogConcept) {
  const manifest = await Bun.file(new URL("../data/steam-catalog.json", import.meta.url)).json() as {
    games: SteamCatalogEntry[];
    existingCovers?: SteamCatalogEntry[];
  };
  const result = await importSteamCatalog(catalog, manifest.games);
  let existingCoversUpdated = 0;
  for (const entry of manifest.existingCovers ?? []) {
    const [found] = await catalog._getGame({ title: entry.title });
    if (!found) continue;
    await catalog.setSteamCover({ game: found.game, steamAppId: entry.steamAppId, coverUrl: entry.coverUrl });
    existingCoversUpdated++;
  }
  return { ...result, existingCoversUpdated };
}
