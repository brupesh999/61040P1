import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Reserving } = concepts;

const ReservationBook = former("the reservation book", (_input, { reservation, user, resource }) =>
  form({
    reservations: each(Reserving._all({}).is({ reservation, user, resource })).form({
      reservation,
      user,
      resource,
    }),
  }),
);

const List = endpoint("/reservations/list", () =>
  receive({}).then(respond({ book: ReservationBook({}) })),
);

const Reserve = endpoint(
  "/reservations/reserve",
  ({ user, resource, reservation }) =>
    receive({ user, resource })
      .then(Reserving.reserve({ user, resource }).responds({ reservation }))
      .then(respond({ reservation })),
  { input: { required: ["user", "resource"] } },
);

const Cancel = endpoint(
  "/reservations/cancel",
  ({ reservation }) =>
    receive({ reservation })
      .then(Reserving.cancel({ reservation }).responds({ reservation }))
      .then(respond({ reservation })),
  { input: { required: ["reservation"] } },
);

export const composition = { ReservationBook, List, Reserve, Cancel };
