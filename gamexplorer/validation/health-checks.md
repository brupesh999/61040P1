# Health-check validation — October 16, 2026

The health implementation and lockfile were unchanged between the successful
`9112e59` deployment and the rejected `ade2a91` deployments. Local GET and HEAD
requests passed before this correction. Saved platform logs do not establish
the hosted failure's cause.

A failure test showed that the MongoDB query's `timeoutMS: 3000` did not bound
initial connection: an unreachable server exceeded the 20-second test deadline.
An abort signal now returns HTTP 503 in about three seconds. The patch also
reduces the connection pool, bounds connection/server selection, closes idle
connections, drains requests on shutdown, and records sanitized health diagnostics.
Concurrent checks share a read.

The next refinement separates periodic database checks from HTTP responses.
Database checks run every two seconds. HTTP probes respond immediately, returning
503 before readiness, after a failed check, or when the last successful check is
five seconds old. Startup still requires a successful database read. This removes
the database network round trip from the health probe's response deadline.

Validation passed:

- `bun run check:design`, `bun run generate`, and `bun run check`.
- Full suite: 82 tests, 620 assertions, including six health tests using real
  MongoDB reads and fixtures created through concept actions.
- Production Bun process on `0.0.0.0`: GET and HEAD returned 200, 20 concurrent
  probes passed, and SIGTERM drained the server and exited with code 0.
- Database loss returned 503; reconnection restored 200. Responses and diagnostics
  do not disclose connection strings or database contents.
- The six health tests also passed under Linux with the official Bun 1.4.2 image
  and a read-only application filesystem. Fixtures were created with concept actions.
- An isolated TCP proxy delayed real MongoDB responses by 1,500 ms. With a 500 ms
  HTTP deadline, the previous implementation timed out. The periodic-check version
  returned 200 for seven probes in 2, 1, 1, 3, 1, 1, and 1 ms while database checks
  continued through the delayed connection. No external database or user data was
  modified. This reproduces the response-latency risk; it does not establish the
  hosted platform's exact timeout configuration.

These are local results. Production resolution remains unverified until a new
deployment passes the platform's worker health gate.

## Hosted attempt

Deployment `c1d7b792-0a2c-4330-98cb-1fba84ab4a82` attempted commit
`3c9cfb90ff1f9eda979fcef23ae4468dcb780cfb` and was rejected by the worker health
gate. Saved output records a successful startup database read, a listener at
`0.0.0.0:3000`, and receipt of the first HTTP health probe. No unavailable-health
transition or application exception appears in the saved streams. Startup readiness
does not prove the subsequent HTTP response reached the platform successfully;
the dashboard does not expose that response or the probe's network error.

The previous `9112e59` deployment remains active. Three public GET checks and one
HEAD check returned 200; the public catalog retained all eight requested entries.
Those checks exercise the previous version, not the rejected worker.

That attempt predates the periodic readiness refinement. The next rollout must
verify the new worker rather than treating the old version's public health result
as evidence of a successful deployment. HTTP diagnostics now include the returned
status and the age of the database check, rather than only recording request arrival.
