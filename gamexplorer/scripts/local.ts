// Local defaults belong to local commands, never the production entry point.
const preview = process.argv[2] === "preview";
process.env.HOST = "127.0.0.1";
process.env.PORT = process.env.API_PORT ?? "3000";
process.env.MONGODB_URL ??= `mongodb://dev:dev@127.0.0.1:${process.env.MONGO_PORT ?? "27017"}/gamexplorer?authSource=admin`;
if (preview) {
  process.env.NODE_ENV = "production";
  process.env.PUBLIC_ORIGIN = `http://127.0.0.1:${process.env.PORT}`;
} else {
  process.env.PUBLIC_ORIGIN ??= `http://127.0.0.1:${process.env.WEB_PORT ?? "8080"}`;
}
await import("../src/main.ts");
