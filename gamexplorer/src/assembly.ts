import { aspectNaming, dimensionNaming } from "./compositions/aspectVocabulary.ts";
import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
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
import { MemoryProvider, type Provider } from "./concepts/UserAuthenticating/provider.ts";
import { composition as commons } from "./compositions/Commons.ts";
import { SteamStore, type SteamSource } from "./concepts/GameCatalog/steam.ts";

/** The host supplies its database; importing the design never opens a production connection. */
export function assembleApplication(db: Db, provider: Provider = new MemoryProvider(), steam: SteamSource = new SteamStore()) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      UserAuthenticating: new UserAuthenticatingConcept(db, undefined, provider),
      GameCatalog: new GameCatalogConcept(db, steam),
      GameDimensions: new DimensionDefiningConcept(db, dimensionNaming),
      DimensionRatings: new RatingConcept(db),
      GameDiscovery: new ThresholdFilteringConcept(db, aspectNaming),
    },
    composition: { Accounts: accounts, Commons: commons, Catalog: catalog, Rating: rating, Discovery: discovery },
    redaction: { fields: ["attempt", "nonce", "state", "code", "verifier", "code_verifier"] },
    // Print what went wrong. Otherwise a failure only shows up as INTERNAL_ERROR.
    rawFaultReporter: () => console.error("An application operation failed."),
  });
}

