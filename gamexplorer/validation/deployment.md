# Hosted deployment — October 15, 2026

URL: https://gamexplorer.mit-sdg.dev

Running commit: `272b540c2731dde141fb5d73265e3f71feed8662`.
Deployment ID: `2756dfc3-390a-4a13-85f2-f5aecf9619cc`.
The platform Overview reports Healthy and the deployed commit above.

## Configuration

The public repository is `brupesh999/61040P1`, branch `main`. Package directories is
`.`; runtime is Bun 1.4.2; build script is empty; start script is `start`; port is
3000; health path is `/health`. The platform provisions MongoDB and binds its URI
to `MONGODB_URL` without copying local credentials. `PUBLIC_ORIGIN` is
`https://gamexplorer.mit-sdg.dev`, and `IMPORT_STEAM_CATALOG=1` enables the idempotent
60-game import through GameCatalog actions. No cover image files are downloaded.
The local database, demo credentials, and demo reviews were not copied.

## Evidence

[Programmatic live checks](deployed-checks.json) verify the health endpoint, frontend
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

The full write journey still needs to be rehearsed on the public app before the
beta recording. The automated write/error/access-control journeys used isolated
MongoDB databases; they are separate evidence from the hosted checks above.
