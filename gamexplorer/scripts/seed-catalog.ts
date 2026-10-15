import { GameCatalogConcept } from "../src/concepts/GameCatalog.ts";
import { importBundledSteamCatalog } from "../src/catalogImport.ts";
import { client, db } from "../src/db.ts";

try {
  const result = await importBundledSteamCatalog(new GameCatalogConcept(db));
  console.log(`Catalog import: ${result.created} games added, ${result.covers} covers attached.`);
  console.log(`Existing demo covers updated: ${result.existingCoversUpdated}.`);
  console.log("No users, aspects, ratings, or reviews created. No image files downloaded.");
} finally {
  await client.close();
}
