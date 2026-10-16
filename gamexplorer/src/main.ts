import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { gamexplorerPolicy } from "./http.ts";
import { client, db } from "./db.ts";
import { createHealthHandler } from "./health.ts";
import { frontendHandler } from "../web/serve.ts";
import { CommonsProvider } from "./concepts/Federating/provider.ts";

const { checkAspectNames } = await import("./compositions/aspectVocabulary.ts");
await checkAspectNames(db);

// Explicit opt-in for a fresh deployment; repeat imports preserve existing contributions.
if (process.env.IMPORT_STEAM_CATALOG === "1") {
  const { importBundledSteamCatalog } = await import("./catalogImport.ts");
  const { GameCatalogConcept } = await import("./concepts/GameCatalog.ts");
  const result = await importBundledSteamCatalog(new GameCatalogConcept(db));
  console.log(`Catalog import: ${result.created} games added; ${result.covers} covers attached.`);
}

const publicOrigin = process.env.PUBLIC_ORIGIN ?? (process.env.NODE_ENV === "production"
  ? `http://127.0.0.1:${process.env.PORT ?? 3000}` : "http://127.0.0.1:8080");
const policy = gamexplorerPolicy(publicOrigin);
const application = assembleApplication(db, new CommonsProvider({
  origin: process.env.COMMONS_ORIGIN ?? "https://class.mit-sdg.dev", app: publicOrigin,
}));
const gateway = createGateway({ application });
const api = createHttpHandler({ application, gateway, policy });
const frontend = await frontendHandler();
const health = createHealthHandler(db);
if (!(await health()).ok) {
  await client.close();
  throw new Error("Startup database readiness failed; see the database health diagnostic.");
}

const server = Bun.serve({
  development: process.env.NODE_ENV !== "production",
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": api,
    "/health": health,
  },
  fetch: frontend,
});

console.log(`Backend ready on ${server.url}`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.info(`Shutdown: ${signal}; draining requests and closing MongoDB.`);
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  try {
    await server.stop(false);
    await client.close();
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    console.error("Shutdown could not finish cleanly.");
    process.exit(1);
  }
}
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
