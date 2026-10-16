# Deployment and validation

Gamexplorer's production process serves the Vue interface, `/api/*`, and `/health`
from one Bun server. It uses Bun.build to bundle the existing frontend in
memory, without adding Vite or writing assets to the deployment's read-only filesystem.
The in-memory Bun.build output is served with Referrer-Policy: no-referrer, including
the Commons callback at /auth/commons/callback. Absolute asset paths let that callback
load the same interface at a nested URL. PUBLIC_ORIGIN supplies the exact browser origin
to both CommonsProvider and the cookie HTTP policy.
Production disables Bun's development mode. The server reads `HOST` and `PORT` from
the environment, while local development may continue to use the frontend proxy on 8080.

The repository root forwards `start` to the application in `gamexplorer/`. The class
platform installs the root Bun workspace in `.`, uses Bun 1.4.2, leaves the
build script empty, runs `start`, and checks `/health` on port 3000. The MongoDB
variable is `MONGODB_URL`; the application's shared client uses `client.db()` to
select the database supplied by the connection string. Use a pool of at most two
application connections per server, with no minimum and a 30-second idle limit.
MongoDB monitoring uses additional connections; leaving headroom matters when old
and new versions overlap during deployment. On SIGTERM or SIGINT, stop accepting
requests, let current requests finish, and close the shared MongoDB client before
exiting. No local `.env` is committed.

`/health` checks read access to `gameCatalog.games` with a two-second server limit
and a three-second driver timeout and abort signal (including initial connection).
The client also limits connection establishment and server selection to three
seconds; a query timeout alone does not bound the driver's initial connection.
It returns HTTP 200 with `status: ok`
only after a successful read (an empty catalog is healthy), or HTTP 503 with
`status: unavailable` after a failure. Both responses prohibit caching. Concurrent
probes share the current database operation; its result is not cached for later
probes. GET and HEAD must both work through the production Bun server.

Before opening the HTTP listener, run the same database check and fail startup if
it fails. Log when the first HTTP health probe arrives, changes between healthy
and unavailable, and graceful shutdown. Failure logs include only a sanitized
error class and numeric error code, never connection strings, database contents,
or arbitrary error messages. This distinguishes a worker that cannot read MongoDB
from a worker whose health route is never reached by the platform.

Set PUBLIC_ORIGIN to https://gamexplorer.mit-sdg.dev. The initial hosted database
is populated with the existing 68-game manifest by setting IMPORT_STEAM_CATALOG=1.
The host invokes the same GameCatalog-action importer before serving requests.
Repeated starts append no duplicate titles and preserve reviews and other concepts.
This flag is optional; without it, normal startup does not import anything. Metadata
and remote cover URLs are persisted in MongoDB, and no image files are downloaded.

Local production preview runs the same server with `NODE_ENV=production`. Its
frontend API calls remain relative to `/api`. Endpoint authorization stays in the
compositions. Authentication uses HttpOnly session and sign-in-attempt cookies;
request JSON cannot override those credentials.

Each automated test file uses a randomly named throwaway database, clears it between
cases, and drops it during cleanup. All fixture data is created through concept
actions or endpoints. Integration tests check failed updates preserve prior state,
removing the final rating removes its discovery contribution, and session identity
controls rating and filter ownership even when requests include forged identities.

The design notebook and reflections belong in the private individual repository at
`reflections/journal.md`. They are not published in this application repository.
