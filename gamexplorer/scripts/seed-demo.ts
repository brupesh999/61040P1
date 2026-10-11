import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "../src/assembly.ts";
import { client, db } from "../src/db.ts";
import { policy } from "../src/http.ts";

const application = assembleApplication(db);
const handler = createHttpHandler({ application, gateway: createGateway({ application }), policy });

async function call(path: string, body: Record<string, unknown>) {
  const response = await handler(
    new Request(`http://127.0.0.1:3000/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json()) as Record<string, any>;
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function addGame(
  session: string,
  title: string,
  developer: string,
  releaseYear: number,
  aspects: Array<{ name: string; description: string; score: number; review: string }>,
) {
  const { game } = await call("/games/add", { session, title, developer, releaseYear });
  for (const aspect of aspects) {
    const { aspect: aspectId } = await call("/aspects/create", {
      session,
      game,
      name: aspect.name,
      description: aspect.description,
    });
    await call("/ratings/rate", {
      session,
      aspect: aspectId,
      score: aspect.score,
      microNote: aspect.review,
    });
  }
}

try {
  await db.dropDatabase();

  const { session } = await call("/auth/register", { username: "Mr. NotReal", password: "demo" });

  await addGame(session, "Final Fantasy VII Rebirth", "Square Enix", 2024, [
    {
      name: "Narrative Depth",
      description: "Character drama, party chemistry, and story payoff.",
      score: 9,
      review: "Huge, heartfelt, and full of memorable character moments.",
    },
    {
      name: "Combat Feel",
      description: "How satisfying the moment-to-moment battles feel.",
      score: 9,
      review: "Fast tactical swaps make every fight feel active.",
    },
  ]);

  await addGame(session, "Devil May Cry 5", "Capcom", 2019, [
    {
      name: "Combat Feel",
      description: "Depth, responsiveness, and style expression in combat.",
      score: 10,
      review: "Still one of the cleanest action combat systems around.",
    },
    {
      name: "Visual Polish",
      description: "Animation, effects, environments, and overall presentation.",
      score: 9,
      review: "Flashy without getting in the way of the action.",
    },
  ]);

  await addGame(session, "Tomodachi Life: Living the Dream", "Nintendo", 2026, [
    {
      name: "Social Chaos",
      description: "How funny and surprising the island interactions become.",
      score: 8,
      review: "The best moments come from letting the island get weird.",
    },
    {
      name: "Relaxed Pacing",
      description: "How well the game works as a low-pressure daily check-in.",
      score: 9,
      review: "Easy to dip into for a few minutes and still feel rewarded.",
    },
  ]);

  console.log("Seeded demo data with username mira and password demo.");
} finally {
  await client.close();
}
