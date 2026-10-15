# Gamexplorer

Aspect-based game evaluation and discovery platform for 6.1040 (Fall 2026).

## Deliverables
- [P1 Design Submission](p1.md)
- [P2 MVP Implementation](gamexplorer/)
- [P2 Individual README](gamexplorer/README.md)
- [P2 Demo Video](https://youtu.be/fuJ5cUlKh6U)
- Design notes and reflections: `reflections/journal.md` in the private individual repository.
- [Concept Specifications](gamexplorer/design/concepts/)
- [Composition Specifications](gamexplorer/design/compositions/)
- [Backend Concepts](gamexplorer/src/concepts/)
- [Backend Compositions, Endpoints, Formers, and Reactions](gamexplorer/src/compositions/)
- [Vue Frontend](gamexplorer/web/app.ts)
- [Integration Tests](gamexplorer/src/app.test.ts)

## P2 Core User Journey

Starting from an empty database, a reviewer registers, adds a real game to the catalog, creates two game-specific aspects, and rates one aspect high and one aspect low with tiny reviews. The reviewer searches the catalog to confirm the added game is listed, logs out, and the app shows that logged-out visitors have limited functionality. A buyer then logs in, tries a high discovery threshold on the low-rated aspect and sees no matches, removes that filter, then tries a high threshold on the high-rated aspect and sees the game appear. Finally, the reviewer logs back in and checks `My ratings` to confirm the ratings persisted under their account. This is a reasonable path to show accounts, catalog entries, aspect management, sparse ratings, discovery filters, reactions, persistent MongoDB state, and the Vue frontend working together.

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

The backend runs at `http://127.0.0.1:3000` and the frontend runs at `http://127.0.0.1:8080`.

## Implementation Notes

The implementation follows sync-engine's concept separation and files in `gamexplorer/src/concepts/` do not import or call each other. All the cross-concept behavior is in `gamexplorer/src/compositions/`. The tests create state through concept actions or real endpoints instead of directly writing MongoDB.

## P3 Beta

- [Gamexplorer deployment address](https://gamexplorer.mit-sdg.dev)
- [Production preview and class deployment settings](gamexplorer/README.md#production-preview-and-deployment)
- [Deployment design](gamexplorer/design/deployment.md)
- [Commons authentication design](gamexplorer/design/authentication.md)
- [Beta interface specification](gamexplorer/design/interface.md)
- [P1 feedback and P3 concept refinements](gamexplorer/design/evolution-p3.md)
- [Updated beta user journey](gamexplorer/README.md#beta-user-journey)
- [Browser journey validation](gamexplorer/validation/browser-checks.md)
- [Saved automated validation output](gamexplorer/validation/)

The beta is in progress. Deployment uses the address above; its live checks are
recorded in the validation directory. The visual-study export and beta video still
need to be linked. P2 artifacts above remain available for reference.
