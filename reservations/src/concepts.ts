import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Reserving.md" with { type: "text" };
import { AlreadyReserved, NoSuchReservation, ReservingConcept } from "./concepts/Reserving.ts";

const reserving = registerConcept({
  class: ReservingConcept,
  spec,
  refusals: { ALREADY_RESERVED: AlreadyReserved, NO_SUCH_RESERVATION: NoSuchReservation },
});

export const applicationConceptSet = conceptSet({ Reserving: reserving });
export const { concepts } = applicationConceptSet;
