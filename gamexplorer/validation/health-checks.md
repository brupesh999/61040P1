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
Concurrent probes share a read; later probes check the database again.

Validation passed:

- `bun run check:design`, `bun run generate`, and `bun run check`.
- Full suite: 80 tests, 582 assertions, including four health tests using real
  MongoDB reads and fixtures created through concept actions.
- Production Bun process on `0.0.0.0`: GET and HEAD returned 200, 20 concurrent
  probes passed, and SIGTERM drained the server and exited with code 0.
- Database loss returned 503; reconnection restored 200. Responses and diagnostics
  do not disclose connection strings or database contents.

These are local results. Production resolution remains unverified until a new
deployment passes the platform's worker health gate.
