import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { db as defaultDb } from "./db.ts";
import { composition as accounts } from "./compositions/Accounts.ts";
import { composition as catalog } from "./compositions/Catalog.ts";
import { composition as rating } from "./compositions/Rating.ts";
import { composition as discovery } from "./compositions/Discovery.ts";
import { ThresholdFilteringConcept } from "./concepts/ThresholdFiltering.ts";
import { DimensionDefiningConcept } from "./concepts/DimensionDefining.ts";
import { RatingConcept } from "./concepts/Rating.ts";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { UserAuthenticatingConcept } from "./concepts/UserAuthenticating.ts";
import { applicationConceptSet } from "./concepts.ts";
import { FederatingConcept } from "./concepts/Federating/Federating.ts";
import { MemoryProvider, type Provider } from "./concepts/Federating/provider.ts";
import { composition as commons } from "./compositions/Commons.ts";

/** Tests pass their own database; the server uses the one named by MONGODB_URL. */
export function assembleApplication(db: Db = defaultDb, provider: Provider = new MemoryProvider()) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      UserAuthenticating: new UserAuthenticatingConcept(db),
      CommonsFederating: new FederatingConcept<string>(db, provider, "CommonsFederating"),
      GameCatalog: new GameCatalogConcept(db),
      GameDimensions: new DimensionDefiningConcept(db),
      DimensionRatings: new RatingConcept(db),
      GameDiscovery: new ThresholdFilteringConcept(db),
    },
    composition: { Accounts: accounts, Commons: commons, Catalog: catalog, Rating: rating, Discovery: discovery },
    redaction: { fields: ["attempt", "nonce", "state", "code", "verifier", "code_verifier"] },
    // Print what went wrong. Otherwise a failure only shows up as INTERNAL_ERROR.
    rawFaultReporter: () => console.error("An application operation failed."),
  });
}

