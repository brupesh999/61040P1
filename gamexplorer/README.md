# Gamexplorer P2 MVP

Gamexplorer is an aspect-based video game evaluation and discovery app. A reviewer adds
games, defines the dimensions that matter for each game, and rates only the aspects they
have an opinion about. A buyer filters by aspect score thresholds to find games that match
their preferences.

## Core User Journey

Starting from an empty database, a reviewer registers, adds a real game such as
`Devil May Cry 5`, creates two aspects such as `Combat Feel` and `Narrative Depth`, and
rates one aspect high and one aspect low with tiny reviews. The reviewer searches the
catalog to confirm the game is listed, logs out, and the app shows that logged-out visitors
can browse but cannot use account-specific actions. A buyer then logs in, filters Discover
with a high threshold on the low-rated aspect and sees no matches, removes that filter,
then filters with a high threshold on the high-rated aspect and sees the game appear.
Finally, the reviewer logs back in and opens `My ratings` to confirm the ratings persisted
under their account. I use this path to check accounts, catalog entries, aspect management,
sparse ratings, discovery filters, reactions, MongoDB persistence, backend access control,
and the Vue frontend without page refreshes.

## Assignment Map

- Design notes and incremental plan: [reflections/journal.md](reflections/journal.md)
- Concept specifications: [design/concepts/](design/concepts/)
- Composition specifications: [design/compositions/](design/compositions/)
- Concept implementations and unit tests: [src/concepts/](src/concepts/)
- Endpoints, formers, views, and reactions: [src/compositions/](src/compositions/)
- HTTP policy: [src/http.ts](src/http.ts)
- Vue frontend: [web/app.ts](web/app.ts)
- Full user-journey integration tests: [src/app.test.ts](src/app.test.ts)

## Validation

Run these commands from this directory:

```sh
bun run check:design
bun run check
bun test --timeout 20000
```

Last validation run:

- `bun run check:design`: passes for all 10 design files.
- `bun run check`: passes sync-engine artifact checks and TypeScript.
- `bun test --timeout 20000`: 38 passing tests, 0 failing tests.

The tests use concept actions and real endpoints rather than direct MongoDB writes for
setup. The integration suite drives the HTTP handler against MongoDB and checks the core
journey, error cases, access control, and that ratings are attributed to the authenticated
session rather than user-supplied fields.

## Running Locally

```sh
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

## Screen Recording Checklist

Keep the recording under two minutes. Show the app running locally, register a reviewer,
add a game, add two aspects, rate one aspect high and one low, search for the game, log
out, switch to a buyer account, show one discovery filter with no matches and another with
a match, then log back into the reviewer account and open `My ratings`. Narrate that the
score shown in Discover comes from a backend reaction that updates aggregate filtering
state after ratings change.

## P3 Scope

P2 intentionally focuses on the MVP journey. P3 should expand editing workflows, richer
metadata, game images or box art, better discovery UX, fuller frontend states, and visual
polish.

The current `UserAuthenticating` concept is a local MVP account system. If the class later
expects MIT SDG development account authentication, this concept should be replaced or
wrapped with the provided auth mechanism while keeping the rest of the app tied only to
abstract user identities.
