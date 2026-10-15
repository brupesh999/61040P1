import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL;
if (!url) {
  throw new Error("MONGODB_URL is not set. Add it to your .env file.");
}

export const client = new MongoClient(url, { maxPoolSize: 3, minPoolSize: 0, maxConnecting: 1 });
export const db = client.db();
