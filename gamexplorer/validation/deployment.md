# Hosted deployment — updated October 16, 2026

URL: https://gamexplorer.mit-sdg.dev

Running application commit: `9112e59d20918918e551449e11afde9a9d802b2c`.
Deployment ID: `57d68be1-e3ba-4ad9-9abb-144f9219a206`.
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

The checked refinement commit `8fa803a1d` was deployed on the same URL and database.
Startup reported zero added games and 60 attached covers, confirming the repeated
catalog import did not create duplicates. The saved [hosted regression report](refinement-deployed-checks.json)
passes health, frontend asset delivery, all 60 catalog/detail requests, persisted cover
metadata, the ten requested additions, authentication refusals, forged JSON credentials,
origin enforcement, and callback privacy checks. Existing game links retained their IDs.

After reloading the public app, the existing Commons session remained signed in.
My Ratings and Discover loaded the account's stored empty state successfully. The checks
did not submit reviews, aspects, or filters under the user's production account.
[Platform capture](screenshots/refinement-deployment.jpg) records the active commit.
That refinement's automated run passed 70 tests with 518 assertions; compatibility and real
write journeys use isolated MongoDB databases and the local browser preview.

## Shared-aspect deployment

Commit `e003487f1` is now active. Its read-only [hosted checks](shared-aspects-deployed-checks.json)
pass the new public aspect-options endpoint, its 32 presets and canonical Combat alias,
all 60 catalog/detail requests, cover metadata, authentication refusals, forged credentials,
origin enforcement, and callback privacy. A pre-deployment [naming check](naming-preflight.json)
found no conflicting legacy dimensions on those games.

The browser retained the existing Commons session after reload. Bastion's unchanged game
link opened the new picker; searching combat depth returned Combat, and Add a new aspect
appeared below the shared list. No aspect or review was submitted on production during
these checks. The automated suite now passes 76 tests and 554 assertions. Local browser
writes and legacy-data compatibility checks remain separate evidence from these public reads.

- [Live shared picker](screenshots/live-shared-aspects.jpg)
- [Active application commit](screenshots/shared-aspects-deployment.jpg)

The full write journey still needs to be rehearsed on the public app before the
beta recording. The automated write/error/access-control journeys used isolated
MongoDB databases; they are separate evidence from the hosted checks above.


## Voice Acting and picker wording

Commit `441d0c1b2` is active on the same app and database. The focused
[hosted checks](voice-acting-deployed-checks.json) pass MongoDB health, all 33 shared
choices including Voice Acting, the existing Combat alias, the four clarified action
labels in served JavaScript, and the scoped picker styles in served CSS.

After reloading Bastion's existing game link, the Commons session remained signed in.
Searching voice and selecting Voice Acting showed its description and Add to this game.
The panel title is Choose an aspect; Create a custom aspect remains below the list.
Computed title/field/disclosure text sizes match the specified 1.1rem/1.05rem/1rem.
No production contribution was submitted. Temporary viewport overrides were reset.
[Live page capture](screenshots/live-voice-acting-picker.jpg).

The saved automated suite passes 76 tests with 555 assertions. This small update
changes one suggested category and interface wording/styles; existing hosted regression
evidence above covers the unchanged catalog and security behavior.


## Bold catalog titles — October 16

The platform made commit `9112e59d2` current and reported Deployment healthy. After
reloading the public catalog, all 60 titles use Geist Pixel Square at weight 700 with
weight synthesis enabled. No title overflows its container; the session remains signed
in and the catalog still contains 60 entries. The screenshot shows the desktop layout.
[Live catalog](screenshots/live-bold-catalog.jpg). Temporary viewport overrides were reset.

This is a CSS-only change. Design, artifact generation, source, and TypeScript checks
pass; unchanged application behavior retains the previously saved 76-test evidence.


## Catalog extension — October 16

The user approved committing, pushing, and deploying the eight-game catalog extension.
Commit `ade2a9117bad65d820d7db13abc131d1ab69e823` adds DMC HD Collection, DMC 4
Special Edition, Crisis Core Reunion, NieR:Automata, NieR Replicant, FFX/X-2 HD
Remaster, FFXIII, and FFXV Windows Edition to the import manifest.

The first worker imported seven new games and attached 68 covers; HD Collection had
already been added through the interface and retained its existing identity. The
same-commit retry imported zero new games and attached the same 68 covers. Public
reads verify each of the eight requested entries, its exact Steam cover metadata,
and its detail page. The browser loaded all eight portrait images at 300 × 450.
The live catalog contains 69 entries because the separately created Dirge of Cerberus
entry remains pending removal; the original PSP Crisis Core was never created.

Both deployments failed the platform's worker health gate:
`671a2480-4f6d-4449-9389-601c4ce2b92b` and retry
`347b604c-1f1c-4a68-a5e9-3a44a04fcbfe`. The platform reports that /health on port
3000 did not return HTTP 2xx. Saved worker output confirms startup at 0.0.0.0:3000
and completion of the import, but does not expose why the health probe failed.
The existing public /health returns 200 with status ok, and Overview still marks
`9112e59d2` current and Healthy. Those public checks exercise the previous active
version against the shared database, not the rejected worker. No successful rollout
of `ade2a9117` is claimed. The code still reads HOST/PORT and uses client.db() without
a fixed database name, as required by the deployment guide. No code change or third
retry was made without a diagnosed cause.

- [Public catalog verification](catalog-additions-deployed-checks.json)
- [Live DMC covers](screenshots/live-dmc-import.jpg)
- [Failed worker health-check report](screenshots/catalog-deployment-health-failure.jpg)

These verification notes and captures are local working-tree changes, not another
pushed audit commit. Production has the requested catalog data; deployment of the
submitted commit and removal of Dirge remained unresolved at that point.

## Health correction deployed — October 16

The later health correction at `f0a1529e44b01e856dfb67ab3694877de646a6e5`
successfully deployed as `70b3379e-f6eb-4ee0-a89e-24ac067fd054`. The platform
marks that commit current and Healthy. This supersedes the failed-rollout status
above; Dirge removal remains pending. The catalog import and all eight requested
Steam entries persist in the live database.

The [successful hosted checks](health-success-deployed-checks.json) verify the
deployment header on every health, catalog, detail, and frontend request. See the
[health diagnosis and verification](health-checks.md#successful-rollout) for the
tested correction and what the logs cannot establish. These are public read checks;
they do not claim a completed authenticated production-write journey.
