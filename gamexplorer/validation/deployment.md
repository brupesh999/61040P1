# Hosted deployment — October 15, 2026

URL: https://gamexplorer.mit-sdg.dev

Running application commit: `8fa803a1d05945c4b4b2f11a233275e1f93aacea`.
Deployment ID: `26493c42-e162-4c2b-b530-c85ff41bbf52`.
The platform Overview reports Healthy and the deployed commit above.
The initial beta deployment was commit `272b540c2731dde141fb5d73265e3f71feed8662`;
the evidence below distinguishes that initial run from the concept refinement.

## Configuration

The public repository is `brupesh999/61040P1`, branch `main`. Package directories is
`.`; runtime is Bun 1.4.2; build script is empty; start script is `start`; port is
3000; health path is `/health`. The platform provisions MongoDB and binds its URI
to `MONGODB_URL` without copying local credentials. `PUBLIC_ORIGIN` is
`https://gamexplorer.mit-sdg.dev`, and `IMPORT_STEAM_CATALOG=1` enables the idempotent
60-game import through GameCatalog actions. No cover image files are downloaded.
The local database, demo credentials, and demo reviews were not copied.

## Evidence

[Initial programmatic live checks](deployed-checks.json) verify the health endpoint, frontend
HTML/JS/CSS, all 60 catalog entries and detail pages, the ten requested additions,
stored cover metadata, empty imported aspects/reviews, missing-session refusals,
forged JSON credentials, foreign-origin rejection, and callback privacy headers.

The user approved Commons on the production origin. The browser returned signed in,
retained the identity after reload, and loaded My Ratings and Discover with the new
account's empty state. Visible portrait covers loaded at 300 × 450. No test reviews
or aspects were created on the public site.

- [Live catalog](screenshots/deployed-catalog.jpg)
- [Platform Overview](screenshots/deployment-overview.jpg)
- [Fresh production-startup and repeat-import preflight](deployment-preflight.txt)
- [Current automated regression results](tests.txt) (refreshed after the initial deployment)

## Concept-refinement deployment

The checked refinement commit `8fa803a1d` is active on the same URL and database.
Startup reported zero added games and 60 attached covers, confirming the repeated
catalog import did not create duplicates. The saved [hosted regression report](refinement-deployed-checks.json)
passes health, frontend asset delivery, all 60 catalog/detail requests, persisted cover
metadata, the ten requested additions, authentication refusals, forged JSON credentials,
origin enforcement, and callback privacy checks. Existing game links retained their IDs.

After reloading the public app, the existing Commons session remained signed in.
My Ratings and Discover loaded the account's stored empty state successfully. The checks
did not submit reviews, aspects, or filters under the user's production account.
[Platform capture](screenshots/refinement-deployment.jpg) records the active commit.
The current automated run passes 70 tests with 518 assertions; compatibility and real
write journeys use isolated MongoDB databases and the local browser preview.

The full write journey still needs to be rehearsed on the public app before the
beta recording. The automated write/error/access-control journeys used isolated
MongoDB databases; they are separate evidence from the hosted checks above.
