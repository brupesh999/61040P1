import { assemble } from "@mit-sdg/sync-engine/assembly";
import { composition } from "./compositions/Reservations.ts";
import { ReservingConcept } from "./concepts/Reserving.ts";
import { applicationConceptSet } from "./concepts.ts";
import { db } from "./db.ts";

export function assembleApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: { Reserving: new ReservingConcept(db) },
    composition: { Reservations: composition },
    // Print what went wrong. Otherwise a failure only shows up as INTERNAL_ERROR.
    rawFaultReporter: ({ error }) => console.error(error),
  });
}
