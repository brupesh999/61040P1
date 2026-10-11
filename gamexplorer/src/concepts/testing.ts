import { MongoClient, type Db } from "mongodb";

/**
 * Each test file gets its own throwaway database on the dev Mongo server. Tests only drop
 * the database between cases; all state is created through concept actions.
 */
export async function testDb(name: string): Promise<{ db: Db; reset: () => Promise<void>; close: () => Promise<void> }> {
  const base = process.env.MONGODB_URL ?? "mongodb://dev:dev@127.0.0.1:27017/?authSource=admin";
  const client = new MongoClient(base);
  await client.connect();
  const db = client.db(`gamexplorer-test-${name}`);
  return {
    db,
    reset: async () => {
      await db.dropDatabase();
    },
    close: async () => {
      await db.dropDatabase();
      await client.close();
    },
  };
}
