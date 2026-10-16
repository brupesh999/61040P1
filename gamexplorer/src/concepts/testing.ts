import { MongoClient, type Db } from "mongodb";

/**
 * Each test file gets its own throwaway database on the dev Mongo server. Tests only drop
 * the database between cases; all state is created through concept actions.
 */
export async function testDb(name: string, monitorCommands = false): Promise<{ db: Db; reset: () => Promise<void>; close: () => Promise<void> }> {
  const base = process.env.MONGODB_URL ?? "mongodb://dev:dev@127.0.0.1:27017/?authSource=admin";
  const client = new MongoClient(base, { serverSelectionTimeoutMS: 3000, monitorCommands });
  try {
    await client.connect();
  } catch {
    await client.close();
    throw new Error("Could not reach the test MongoDB. Run `bun run db:up` first and check MONGODB_URL.");
  }
  const db = client.db(`gamexplorer-test-${name.slice(0, 12)}-${crypto.randomUUID().replaceAll("-", "")}`);
  return {
    db,
    reset: async () => {
      await db.dropDatabase();
    },
    close: async () => {
      try {
        await db.dropDatabase();
      } finally {
        await client.close();
      }
    },
  };
}
