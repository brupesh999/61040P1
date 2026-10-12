# 6.1040 Gamexplorer — Project Rules & Grading Rubrics

## Overview
Gamexplorer is an aspect-based video game evaluation and discovery platform built for MIT 6.1040.
This project strictly follows Specification-Driven Development using `sync-engine`.

## Tech Stack & Runtime
- **Runtime & Package Manager:** Bun
- **Framework:** `sync-engine` (MIT 6.1040 declarative framework)
- **Database:** MongoDB
- **Frontend:** Vue.js 3 (Reactive state, no page refreshes)

---

## 1. Architectural & Modularity Rules (STRICT)

1. **Concept Independence (No Broken Boundaries):**
   - Concepts in `src/concepts/` MUST remain 100% independent.
   - **NEVER** import or invoke one concept from inside another concept file.
   - **NEVER** pass objects that expose another concept's internals.
   - Each concept manages its own isolated MongoDB state.
2. **Composition via Reactions:**
   - All cross-concept logic, data flow, and access controls MUST be defined in `src/syncs/` (Reactions).
3. **Backend Access Control:**
   - Enforce authentication and authorization checks on the server side (via sync reactions or endpoint middleware), never relying solely on frontend UI checks.
4. **Specification Faithfulness:**
   - TypeScript concept code and error identifiers must match files in `design/concepts/` and `design/syncs/` exactly.

---

## 2. Testing & Validation Rubric Checklist

When writing or updating tests (e.g., `src/concepts/*.test.ts`):
- **Operational Principles & Variants:** Cover happy-path operational principles AND error variants (e.g., invalid ranges, unauthorized actions, duplicate entries).
- **No Direct DB Writes in Setup (Crucial Pitfall):** Populate test state using concept actions ONLY—never manipulate raw MongoDB collections directly during test setup.
- **Programmatic Assertions:** Ensure assertions check actual return values and refusal errors programmatically (`expect(refuse)...`).
- **No Testing Around the Problem:** Do not skip authentication checks or mock out core domain logic in integration tests.

---

## 4. Workflow Protocol
Before outputting any code or file edits, execute this internal checklist:
1. Did I check `design/` specs to ensure exact naming and refusal strings match?
2. Did I introduce any cross-concept imports? (If yes, move logic to a Sync reaction).
3. Do unit tests set up data via concept actions rather than direct database writes?
4. Is client-side state reactive in Vue without forcing `location.reload()`?

## Running the app

- `bun run dev` starts MongoDB in a container, then the backend at http://127.0.0.1:3000 and the frontend at http://127.0.0.1:8080, both in watch mode.
- `bun run up` runs all three in containers. `bun run down` stops them, and `bun run db:reset` deletes the local data.
- Change `design/` before the code. Check it with `bun run check:design`, then run `bun run generate` and `bun run check`.
- Check the folder reservations/ for a full working example app with the complete correct format! everything runs perfectly with no bugs here.
