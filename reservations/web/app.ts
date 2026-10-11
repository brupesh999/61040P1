import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { ReservationsWireHttp } from "../generated/wire.ts";

const client = createHttpClient<ReservationsWireHttp>({ baseUrl: "/api" });

const form = document.querySelector<HTMLFormElement>("#reserve")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const list = document.querySelector<HTMLUListElement>("#reservations")!;

async function showReservations() {
  const result = await client.reservations.list({});
  if ("error" in result) {
    status.textContent = `Could not load reservations: ${result.error}`;
    return;
  }
  list.replaceChildren(
    ...result.book.reservations.map(({ reservation, user, resource }) => {
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", async () => {
        await client.reservations.cancel({ reservation });
        await showReservations();
      });
      const item = document.createElement("li");
      item.append(`${resource}, reserved by ${user} `, cancel);
      return item;
    }),
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const result = await client.reservations.reserve({
    user: String(data.get("user")),
    resource: String(data.get("resource")),
  });
  status.textContent = "error" in result ? `Could not reserve: ${result.error}` : "Reserved!";
  await showReservations();
});

showReservations();
