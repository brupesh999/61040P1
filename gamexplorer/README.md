# Gamexplorer

## Tests

- [Test commands and database setup](../README.md#tests).
- Tests create and delete disposable databases; the app database is unchanged.
- Fixtures use concept actions or endpoints. `MONGODB_URL` can override local MongoDB.
- [Saved results](validation/tests.txt): 102 tests, 784 assertions (October 24, isolated local database).
- Design, generated-artifact, and TypeScript checks passed; 24 sync-engine advisories remain.
- [P4 hosted validation](validation/p4-deployed-checks.json): 37 checks passed on `cb73d777`; deployment succeeded and health passed.

## HTTP API and generated contracts

- [HTTP contracts](generated/wire.ts): request fields, responses, and errors.
- JSON requests use `POST /api/<path>`; errors return `{ "error": "<category>" }`.
- Protected endpoints require HttpOnly session cookies; JSON fields cannot supply authentication.
- Catalog search, game details, and aspect choices are public. Compositions handle cross-concept logic and access checks.

## Deployment

- Class platform: root workspace, Bun 1.4.2, no build script, start script `start`, port `3000`.
- Health checks: `GET /health` and `HEAD /health`.
- Set `MONGODB_URL` and `PUBLIC_ORIGIN=https://gamexplorer.mit-sdg.dev`.
- Optional: `IMPORT_STEAM_CATALOG=1` imports catalog metadata and cover URLs without duplicating games.
