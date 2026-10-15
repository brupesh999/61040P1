import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { gamexplorerPolicy } from "./http.ts";
import { db } from "./db.ts";
import { frontendHandler } from "../web/serve.ts";
import { CommonsProvider } from "./concepts/Federating/provider.ts";

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

const server = Bun.serve({
  development: process.env.NODE_ENV !== "production",
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": api,
    "/health": async () => {
      try {
        await db.collection("gameCatalog.games").findOne({}, { maxTimeMS: 2000, timeoutMS: 3000 });
        return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json(
          { status: "unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    },
  },
  fetch: frontend,
});

console.log(`Backend ready on ${server.url}`);
