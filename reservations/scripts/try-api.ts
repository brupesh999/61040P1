import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { ReservationsWireHttp } from "../generated/wire.ts";

const client = createHttpClient<ReservationsWireHttp>({ baseUrl: "http://127.0.0.1:3000/api" });

console.log("barish:", await client.reservations.reserve({ user: "barish", resource: "friday-7pm-table-4" }));
console.log("eagon:", await client.reservations.reserve({ user: "eagon", resource: "friday-7pm-table-4" }));
console.log("carmel:", await client.reservations.reserve({ user: "carmel", resource: "friday-8pm-table-4" }));

const result = await client.reservations.list({});
if (!("error" in result)) {
  for (const { resource, user } of result.book.reservations) {
    console.log(`${resource} is reserved by ${user}`);
  }
}
