# Gamexplorer

Gamexplorer is an aspect-based video game evaluation and discovery app. A reviewer adds games, defines the dimensions that matter for each game, and rates only the aspects they have an opinion about. A buyer filters by aspect score thresholds to find games that match their preferences.

## P2 Baseline Journey

[P2 Demo Video](https://youtu.be/fuJ5cUlKh6U). This follows the core user journey below.

Starting from an empty database, a reviewer registers, adds a real game such as `Devil May Cry 5`, creates two aspects such as `Combat` and `Narrative Depth`, and rates one aspect high and one aspect low with tiny reviews. The reviewer searches the catalog to confirm the game is listed, logs out, and the app shows that logged-out visitors can browse but cannot use account-specific actions. A buyer then logs in, filters Discover with a high threshold on the low-rated aspect and sees no matches, removes that filter, then filters with a high threshold on the high-rated aspect and sees the game appear. Finally, the reviewer logs back in and opens `My ratings` to confirm the ratings persisted under their account. I use this path to check accounts, catalog entries, aspect management, sparse ratings, discovery filters, reactions, MongoDB persistence, backend access control, and the Vue frontend without page refreshes.

## Assignment Map

- Design notes and reflections: `reflections/journal.md` in the private individual repository.
- Concept specifications: [design/concepts/](design/concepts/)
- Composition specifications: [design/compositions/](design/compositions/)
- P1 feedback and P3 concept refinements: [design/evolution-p3.md](design/evolution-p3.md)
- Concept implementations and unit tests: [src/concepts/](src/concepts/)
- Endpoints, formers, views, and reactions: [src/compositions/](src/compositions/)
- HTTP policy: [src/http.ts](src/http.ts)
- Vue app shell and account dialog: [web/app.ts](web/app.ts)
- Page components: [web/pages/](web/pages/)
- Shared account/request state: [web/state.ts](web/state.ts)
- Beta interface specification: [design/interface.md](design/interface.md)
- Full user-journey integration tests: [src/app.test.ts](src/app.test.ts)

## Validation

Run these commands from this directory:

```sh
bun install --frozen-lockfile
bun run db:up
bun run check:design
bun run generate
bun run check
bun test --timeout 20000
```

Last validation run:

- `bun run check:design`: passes for all 12 design files.
- `bun run check`: passes sync-engine artifact checks and TypeScript.
- `bun test --timeout 20000`: 76 passing tests, 0 failing tests.

The tests use concept actions and real endpoints rather than direct MongoDB writes for setup. The integration suite drives the HTTP handler against MongoDB and checks the core journey, error cases, access control, and that ratings are attributed to the authenticated session rather than user-supplied fields.

Tests use the local MongoDB container and a randomly named database per test file/run.
They clear only their throwaway database between tests and delete it afterward; they
do not clear the application database. Podman must be running. `MONGODB_URL` may be
set in `.env`; otherwise tests use the local container's development connection.
Saved design checks, code checks, and test output are in [validation/](validation/).
The code check reports 22 sync-engine advisories; it exits successfully.

## Running Locally

If `.env` does not exist yet, copy `.env.example` to `.env` before starting.

```sh
bun install --frozen-lockfile
bun run dev
```

The backend runs at `http://127.0.0.1:3000`; the frontend runs at
`http://127.0.0.1:8080`.

For a clean empty-database demo:

```sh
bun run db:reset
bun run dev
```

For local browsing with preloaded example games:

```sh
bun run db:up
bun run seed:demo
bun run dev
```

To add 60 games with official Steam covers and no reviews:

```sh
bun run seed:catalog
```

This imports metadata and remote image URLs into the configured MongoDB database
through GameCatalog actions. It preserves existing games and contributions and can
be rerun without duplicating titles. Existing Hades and Devil May Cry 5 entries also
receive covers if present. The app reads MongoDB; `data/steam-catalog.json` is only
input to the import script. Images load directly from Steam, with no image files
saved and no API key required. See [cover design and sources](design/covers.md).

## Production Preview and Deployment

From the repository root, `bun install --frozen-lockfile` installs the Gamexplorer
Bun workspace. The root `start` script forwards to this application's `start`.
Both package files pin Bun 1.4.2; the root lockfile preserves the app's dependency
versions. Keep both lockfiles consistent when intentionally updating dependencies.

For a local production preview, stop any backend using port 3000, then run:

```sh
bun run preview
```

Open `http://127.0.0.1:3000` and `http://127.0.0.1:3000/health`. Production serves
the Vue interface and `/api` on the same port. Bun bundles the HTML entry and its
assets in memory with `Bun.build`; there is no Vite server, separate frontend process, or build script.
Local `bun run dev` still provides the frontend proxy on port 8080.

Use these settings on the class platform for this repository:

| Setting | Value |
| --- | --- |
| Repository | This public GitHub repository |
| Branch | The branch containing the commit you intend to deploy |
| Runtime | Bun; version 1.4.2 from the root `package.json` |
| Package directories | `.` (the root workspace installs `gamexplorer`) |
| Build script | Leave empty |
| Start script | `start` |
| Port | `3000` |
| Health check | `/health` |
| MongoDB URI variable | `MONGODB_URL` |
| Public origin variable | `PUBLIC_ORIGIN=https://gamexplorer.mit-sdg.dev` |
| Initial catalog import | `IMPORT_STEAM_CATALOG=1` |

Add MongoDB on the platform, map its supplied URI to `MONGODB_URL`, wait for setup,
then deploy a pushed commit. The platform supplies `HOST`, `PORT`, and `NODE_ENV`.
Do not upload `.env` or local database credentials. `PUBLIC_ORIGIN` must match the
exact browser origin, without a trailing slash; it configures Commons and the HTTP
cookie/origin policy. Local data is not copied to the deployed database; add initial
data through the deployed app or enable `IMPORT_STEAM_CATALOG=1`. That flag runs
the existing idempotent 60-game importer through GameCatalog actions on startup,
without adding reviews or resetting data. The MongoDB connection pool is limited to
three application connections to fit overlapping versions within the platform limit.

After deployment, verify sign-in, a write, discovery, and persistence on the public
URL. A passing local preview does not establish that the deployed version works.

## P3 Scope

The beta uses six concepts, including the independent Federating concept from ConceptBox.
The P1 feedback led to three reusable evaluation mechanisms: DimensionDefining gives
named dimensions stable identities within a subject, Rating evaluates opaque targets,
and ThresholdFiltering matches received numeric values against an owner's requirements.
Compositions supply the game-specific associations and connect Commons identities to
Gamexplorer accounts. Existing game/aspect identities, reviews, and filters are preserved;
compatibility tests create genuine P2 state through the archived concept actions and
exercise the current endpoints against it. See [the refinement record](design/evolution-p3.md).
The game page offers 32 shared aspect presets, reuses custom names added on other games,
and keeps Add a new aspect in a lower disclosure. Explicit aliases currently map
Combat Depth to Combat for definitions, stored criteria, and discovery values.
This extends naming configuration in the existing concepts without adding a concept.
Unrecognized custom synonyms remain distinct; the app does not infer meaning automatically.
Steam cover metadata is included in catalog and discovery responses.
It applies the visual study's pixel headings and navy/ruby palette,
separates page components, and improves discovery criteria editing, rating feedback,
keyboard navigation, narrow layouts, and account switching. Game cards show official
Steam portrait library covers when available and use title tiles as a fallback.

Commons is the primary sign-in option. Existing password accounts remain available
under **Use a local account**. See [Commons sign-in](#commons-sign-in) below.

## Commons Sign-in

Choose **Sign in → Sign in with Commons**, then sign in or approve Gamexplorer on
`class.mit-sdg.dev`. Commons redirects back to `/auth/commons/callback`. No Commons
API key, client secret, or deployment is needed for localhost testing. This follows
[ConceptBox](https://github.com/mit-sdg/conceptbox/tree/9374617263d0dce783f6ffc472b28092dc4ad96a)
and the [Commons protocol](https://github.com/mit-sdg/commons/blob/main/DEPLOYMENT.md#sign-in-with-commons-for-course-apps).

`PUBLIC_ORIGIN` must equal the URL you open, including its port. Local development
uses `http://127.0.0.1:8080`; `bun run preview` sets `http://127.0.0.1:3000`.
For a different preview port, set `PORT` and `PUBLIC_ORIGIN` together.
`COMMONS_ORIGIN` defaults to `https://class.mit-sdg.dev` and normally needs no change.

Sessions and sign-in attempts use Secure, HttpOnly cookies. Session credentials are
absent from response JSON and browser storage. Existing local users sign in again
once after this update; their saved ratings and filters retain the same user IDs.
A Commons identity is a separate account from a local account, even when their
usernames match. On a collision, choose a different Gamexplorer username.

The automated suite checks PKCE, wrong-browser attempts, replay, origin checks,
username conflicts, account ownership, expiry, and legacy password upgrades.
The provider tests use a local HTTP stand-in, and composition tests use ConceptBox's
MemoryProvider. The user completed sign-in through the real Commons service, and the browser
returned to Gamexplorer with the expected account shown in its header. See [authentication design](design/authentication.md).

## Beta User Journey

A player wants expressive combat and a strong story, and wants to evaluate those
aspects separately. This journey uses real catalog entries and community ratings;
an empty deployment first needs contributions through the interface.

1. Browse the public catalog, search for a title, and open its aspect breakdown.
   Unrated aspects are labelled explicitly, and each community average includes its
   rating count. Expand an aspect to read the reviewers' tiny reviews.
2. Sign in and open Discover. Choose Combat with a minimum average of 8.
   Add Narrative Depth with a minimum of 8. Results must satisfy both criteria, and
   each matching card explains its scores and counts.
3. If nothing matches, edit a threshold or remove a criterion. Open a matching game
   to inspect the reviews that explain its strengths.
4. After playing, open an aspect you know. If it is missing, use Add an aspect to
   search the shared list; Add a new aspect appears below it for a missing category.
   Submit a whole score from 1 to 10, optionally adding a tiny review within 280
   characters. Other aspects remain unrated.
5. Open My Ratings and use Edit rating to return to that exact aspect. Update the
   score or review, or remove the rating after confirming. The community average
   and discovery contribution change with the saved rating.
6. Reload deliberately to check persistence, then sign out. Another account starts
   with its own saved filters and rating forms; private drafts do not carry over.

Navigation uses hash URLs so game/aspect links and browser history work without
full-page refreshes. Source choices and font licensing are documented in
[the font attribution](web/fonts/SOURCES.md). The user's visual-study slides will
be linked after they are exported into this repository.

See [browser validation](validation/browser-checks.md) for the exercised journeys,
negative cases, viewport checks, and current limitations. [Hosted validation](validation/deployment.md)
separately records the class-platform deployment and Commons sign-in. The full hosted
write journey and beta recording still need to be completed.
