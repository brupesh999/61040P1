import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL;
if (!url) {
  throw new Error("MONGODB_URL is not set. Configure the database connection before starting the server.");
}

export const client = new MongoClient(url, {
  maxPoolSize: 2, minPoolSize: 0, maxConnecting: 1, maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000,
});
export const db = client.db();
