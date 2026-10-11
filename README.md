# Gamexplorer

Aspect-based game evaluation and discovery platform for 6.1040 (Fall 2026).

## Deliverables
- [P1 Design Submission](p1.md)
- [P2 MVP Implementation](gamexplorer/)
- [P2 Submission Guide](gamexplorer/README.md)
- [P2 Design Notes and Incremental Plan](gamexplorer/reflections/journal.md)
- [Concept Specifications](gamexplorer/design/concepts/)
- [Composition Specifications](gamexplorer/design/compositions/)
- [Backend Concepts](gamexplorer/src/concepts/)
- [Backend Compositions, Endpoints, Formers, and Reactions](gamexplorer/src/compositions/)
- [Vue Frontend](gamexplorer/web/app.ts)
- [Integration Tests](gamexplorer/src/app.test.ts)

## P2 Core User Journey

A reviewer registers or logs in, adds a game, creates game-specific aspects, and rates only
the aspects they have an opinion about. A buyer logs in, sets aspect score filters, and
discovers matching games with reviewer notes. This is the path I use to show accounts,
catalog entries, aspect management, sparse ratings, discovery filters, reactions,
persistent MongoDB state, and the Vue frontend working together.

## Running and Checking P2

From `gamexplorer/`:

```sh
bun run check:design
bun run check
bun test --timeout 20000
```

To run the app locally:

```sh
bun run dev
```

The backend runs at `http://127.0.0.1:3000` and the frontend at
`http://127.0.0.1:8080`.

## Implementation Notes

The implementation follows sync-engine's concept separation: files in
`gamexplorer/src/concepts/` do not import or call each other. Cross-concept behavior,
including authentication checks and rating-to-discovery aggregate updates, lives in
`gamexplorer/src/compositions/`. Tests create state through concept actions or real
endpoints rather than direct MongoDB writes.
