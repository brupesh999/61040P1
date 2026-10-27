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

Readiness checks read access to `gameCatalog.games` before opening the HTTP
listener and every two seconds afterward. Each read has a two-second server
limit, plus a three-second driver timeout and abort signal, including initial
connection. Overlapping checks share one database operation. The client also
bounds connection establishment and server selection; a query timeout alone does
not bound the driver's initial connection. A failed startup check prevents startup.

`/health` responds immediately without waiting for a database operation. It returns
HTTP 200 with `status: ok` only when the latest completed database check succeeded
and that success is less than five seconds old. It returns HTTP 503 with
`status: unavailable` before any successful check, after a failed check, or when
the last success is five seconds old, even if another check is still pending.
An empty catalog is healthy. A failure that begins between checks can take up to
five seconds to appear. Both responses prohibit caching; GET and HEAD must work
through the production Bun server. This bounds freshness without making a health
probe wait behind database network latency or connection-pool contention.

Shutdown stops periodic checks before draining requests and closing MongoDB. Log
database health transitions, the first three HTTP health response statuses, later
HTTP status changes, and shutdown. Include the latest successful check's age in
HTTP diagnostics. Failure logs include only a sanitized error class and numeric
error code, never connection strings, database contents, or arbitrary messages.

Health responses use an explicit JSON string, Content-Type, Content-Length,
Cache-Control: no-store, and Connection: close. Dispatch `/health` through the
server's fetch handler, separately from API routes. This gives one-shot health
clients a complete, closed response without waiting for the keep-alive idle timer.
After binding the listener, perform a raw loopback HTTP GET that checks the actual
status line, headers, complete JSON body, and connection closure within one second.
Log its success. If it fails, stop the monitor and server, close MongoDB, and fail
startup. This verifies transmission rather than only logging the handler's result.

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

## Local setup

The local Compose stack builds with Bun 1.4.2 and starts MongoDB, the backend,
and the frontend without a private environment file. Image builds exclude environment
files and host dependencies. MongoDB must pass an authenticated ping before the
backend starts; the backend must pass its readiness check before the frontend starts.
The database-only startup command also waits for MongoDB health before returning.
The backend's PUBLIC_ORIGIN matches the frontend browser address. Local startup
imports the catalog through concept actions, without creating reviews.

Default host ports are 27017, 3000, and 8080. MONGO_PORT, API_PORT, and WEB_PORT
can select separate ports for an isolated checkout. Container-internal ports stay
fixed. Development and preview commands supply the same local database default;
production start still requires an explicit MONGODB_URL. A private override remains
optional, and its contents must never enter the image or repository.

Application assembly receives its database explicitly. Design checks and artifact
generation use a disconnected database handle: inspecting declarations must not
require credentials, a running database, or importing the production connection.

Each automated test file uses a randomly named throwaway database, clears it between
cases, and drops it during cleanup. All fixture data is created through concept
actions or endpoints. Integration tests check failed updates preserve prior state,
removing the final rating removes its discovery contribution, and session identity
controls rating and filter ownership even when requests include forged identities.
Integration suites in `tests/integration/` separate catalog, ratings, discovery,
authentication, compatibility, and HTTP-error behavior. Shared setup in `tests/support/`
constructs the real application and cookie boundary; each suite owns its database
and provider fixtures. Restart checks reassemble the application over the same database.
Multi-criterion checks distinguish a missing rating from a score below the threshold.

The design notebook and reflections belong in the private individual repository at
`reflections/journal.md`. They are not published in this application repository.
