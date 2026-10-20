# Gamexplorer

Game reviews and discovery using per-aspect scores.

[Live app](https://gamexplorer.mit-sdg.dev)

## P3 deliverables

- [Code](gamexplorer/) and [specifications](gamexplorer/design/)
- [Tests](gamexplorer/src/), [test instructions](#tests), and [saved output](gamexplorer/validation/tests.txt)
- [Visual design study](gamexplorer/design/visual-study.pdf) ([Google Slides](https://docs.google.com/presentation/d/1brCUaB3Atrse3NUdq7dwBrI2gGlQhCvelLQqlNPdLbM/edit?usp=sharing))
- [User journey](#user-journey)
- [Narrated beta demo](https://youtu.be/m5XII5H1tfU)

The design notebook is in the private individual repository at `reflections/journal.md`.

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

Requires Bun 1.4.2 and a running Podman installation with Compose. From the repository root:

```sh
cd gamexplorer
bun install --frozen-lockfile
bun run db:up
bun run check:design
bun run generate
bun run check
bun test --timeout 20000
```

`db:up` starts local MongoDB. Tests use disposable databases and leave the app database
unchanged. Set `MONGODB_URL` only if using a different MongoDB connection.
