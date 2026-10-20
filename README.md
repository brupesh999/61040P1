# Gamexplorer

Game reviews and discovery using per-aspect scores.

[Live app](https://gamexplorer.mit-sdg.dev)

## Project materials

- [Code](gamexplorer/) and [specifications](gamexplorer/design/)
- [Design summary](gamexplorer/design/summary.md)
- [Tests](gamexplorer/src/), [test instructions](#tests), and [saved output](gamexplorer/validation/tests.txt)
- [Visual design study](gamexplorer/design/visual-study.pdf) ([Google Slides](https://docs.google.com/presentation/d/1brCUaB3Atrse3NUdq7dwBrI2gGlQhCvelLQqlNPdLbM/edit?usp=sharing))
- [User journey](#user-journey)
- [Current demo (P3)](https://youtu.be/Y1i6PMFE8-U)

The design notebook is in the private individual repository at `reflections/journal.md`.

## Build and run locally

Requires **Bun 1.4.2**, **Podman**, and **Docker Compose v2 or later** as its Compose provider. On macOS or Windows,
start the Podman machine first. From the repository root:

```sh
cd gamexplorer
bun install --frozen-lockfile
bun run up
```

Open **http://127.0.0.1:8080**. This builds and starts MongoDB, the backend, and the
frontend, and imports game metadata without reviews. Local containers need no `.env`
file or API keys. Sign in with Commons, or create a local account through **Sign in →
Use a local account**. `bun run down` stops the containers and retains their data.

For development with watch mode, use `bun run dev` instead of `bun run up`.
It starts MongoDB and runs the backend and frontend on the host.

## User journey

A player rates a game's story, uses Narrative Depth to find games, and updates
their rating. The beta demo follows this journey:

1. Sign in with Commons.
2. Search the catalog for Crisis Core –Final Fantasy VII– Reunion and open it.
3. Rate Narrative Depth 9/10.
4. Open Discover and filter by Narrative Depth with a minimum of 8/10. The game appears.
5. Raise the minimum to 10/10. The game no longer appears.
6. Open My Ratings, select the Crisis Core rating, and update it to 10/10.
7. Reload the page to confirm the updated rating persists.

## Tests

From `gamexplorer/`, with Podman running:

```sh
bun run db:up
bun run check:design
bun run generate
bun run check
bun test --timeout 20000
```

`db:up` starts local MongoDB. Tests use disposable databases and leave the app database
unchanged. Set `MONGODB_URL` only if using a different MongoDB connection.
