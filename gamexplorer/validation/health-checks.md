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
- Full suite: 84 tests, 625 assertions, including eight health tests using real
  MongoDB reads and fixtures created through concept actions.
- Production Bun process on `0.0.0.0`: GET and HEAD returned 200, 20 concurrent
  probes passed, and SIGTERM drained the server and exited with code 0.
- Database loss returned 503; reconnection restored 200. Responses and diagnostics
  do not disclose connection strings or database contents.
- The eight health tests also passed under Linux with the official Bun 1.4.2 image
  and a read-only application filesystem. Fixtures were created with concept actions.
- An isolated TCP proxy delayed real MongoDB responses by 1,500 ms. With a 500 ms
  HTTP deadline, the previous implementation timed out. The periodic-check version
  returned 200 for seven probes in 2, 1, 1, 3, 1, 1, and 1 ms while database checks
  continued through the delayed connection. No external database or user data was
  modified. This reproduces the response-latency risk; it does not establish the
  hosted platform's exact timeout configuration.
- Raw TCP verification checks the complete status line, response framing, JSON,
  and EOF within one second. The previous keep-alive response times out under this
  check; the explicit Connection: close response succeeds. A complete 503 is refused.
  The real Linux production process logs successful wire verification at startup.

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

The periodic-readiness commit `672ec25` was attempted in deployment
`147f31f3-4160-4590-a679-10217413afcf`. It also failed the gate. Its first three
HTTP samples were GET 200 with database ages 29, 37, and 46 ms; there were no
recorded unavailable transitions. This rules out failed or stale readiness for
those samples, but logging a returned Response does not prove its full transmission.
The following correction uses fetch dispatch, explicit JSON framing and connection
closure, and the raw socket startup self-check. The hosted cause is not yet claimed.

## Successful rollout

Commit `f0a1529e44b01e856dfb67ab3694877de646a6e5` passed the worker gate in
deployment `70b3379e-f6eb-4ee0-a89e-24ac067fd054`. Overview marks it current and
Healthy, and the deployment operation succeeded. Production output confirms
`Wire health check: HTTP 200, complete JSON body, connection closed.`

Three public GET checks spaced three seconds apart and one HEAD check returned
200. The deployment ID header matched the new deployment on every health, catalog,
detail, and frontend request. The catalog still contains 69 games, all eight added
Steam entries retain their identities and cover metadata, and their detail endpoints
passed. The browser rendered the public catalog. One detail request timed out during
the traffic switch and succeeded after predecessor cleanup; all final checks passed.

See [deployed checks](health-success-deployed-checks.json) and
[Healthy/current deployment](screenshots/health-success-deployment.jpg). This final
verification record was saved before the following interface refinement. The successful transport increment
changed framing, connection closure, and dispatch together; the exact earlier failure
mechanism is not established by the available logs.
