import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { db as defaultDb } from "./db.ts";
import { composition as accounts } from "./compositions/Accounts.ts";
import { composition as catalog } from "./compositions/Catalog.ts";
import { composition as rating } from "./compositions/Rating.ts";
import { composition as discovery } from "./compositions/Discovery.ts";
import { AspectFilteringConcept } from "./concepts/AspectFiltering.ts";
import { AspectManagingConcept } from "./concepts/AspectManaging.ts";
import { AspectRatingConcept } from "./concepts/AspectRating.ts";
import { GameCatalogConcept } from "./concepts/GameCatalog.ts";
import { UserAuthenticatingConcept } from "./concepts/UserAuthenticating.ts";
import { applicationConceptSet } from "./concepts.ts";

/** Tests pass their own database; the server uses the one named by MONGODB_URL. */
export function assembleApplication(db: Db = defaultDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      UserAuthenticating: new UserAuthenticatingConcept(db),
      GameCatalog: new GameCatalogConcept(db),
      AspectManaging: new AspectManagingConcept(db),
      AspectRating: new AspectRatingConcept(db),
      AspectFiltering: new AspectFilteringConcept(db),
    },
    composition: { Accounts: accounts, Catalog: catalog, Rating: rating, Discovery: discovery },
    // Print what went wrong. Otherwise a failure only shows up as INTERNAL_ERROR.
    rawFaultReporter: ({ error }) => console.error(error),
  });
}

