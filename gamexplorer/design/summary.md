# Gamexplorer design summary

Gamexplorer lets people review individual aspects of games and find games whose
community scores meet their preferences. The final design uses five concepts. This
summary compares the [P1 design](https://github.com/brupesh999/61040P1/blob/f3ca725ffbd049133d5337e839c0cb8608bdb7a0/p1.md)
with the [submitted P3 beta](https://github.com/brupesh999/61040P1/tree/09e14a95ac4b0d934c7f5494a8b7efb1ba2eaea5/gamexplorer)
and the P4 refinements.

## Concepts and reactions

- **Separate mechanisms from games.** P1's aspect concepts depended too much on
  the game domain. DimensionDefining now gives any subject named dimensions;
  Rating evaluates opaque targets; ThresholdFiltering matches supplied numbers
  against an owner's requirements. Rating can evaluate whole books, and filtering
  can select rooms by capacity. Compositions connect these independent mechanisms
  to GameCatalog entries and authenticated users.
- **Keep ratings authoritative.** Reactions project the current average into
  discovery after a rating is saved or removed. Scores of 9 and 7 produce 8;
  removing the 7 produces 9. Removing the final rating removes the discovery value,
  because an unrated aspect provides no evidence that a minimum is met. Queries
  read facts in `where`; `then` invokes actions. Each linkage is a separate reaction.
- **Reuse names without losing contributions.** Combat and Combat Depth previously
  split discovery criteria. Shared presets and an explicit backend alias resolve
  this known synonym. Custom names remain reusable; automatic semantic grouping
  is outside the design. Legacy identities, reviews, and saved criteria are retained.
  Conflicting dimension identities stop startup for review instead of silently merging.

## Authentication and access control

- Password and Commons credentials now share UserAuthenticating's single purpose:
  establishing account identity. P3's separate Federating instance brought the total
  to six; consolidating it returns the app to the expected 3–5 concepts. Existing
  links and sessions retain their identities. Matching usernames never merge accounts.
  Local accounts support testers outside the class.
- HttpOnly cookies hold sessions and sign-in attempts. Compositions derive rating
  authorship and filter ownership from the session, so JSON fields cannot select
  another account. Browsing catalog entries and reviews remains public.

## Visual design from P3

- The [visual study](visual-study.pdf) led to navy surfaces, ruby accents, portrait
  covers, and pixel headings. P4 retains that direction. Pixelify Sans labels pages;
  Geist Pixel displays game titles and scores; Archivo keeps reviews and small text
  readable. All fonts are served locally. Game titles moved away from Pixelify
  because its numerals were difficult to distinguish.
- P4 keeps the catalog opening immediately, with promotional copy removed. Reviews and Write
  a Review distinguish reading from contributing. My Ratings opens the exact aspect
  editor. Shared aspect choices precede custom creation, reducing accidental duplicate
  names. Discovery groups editable criteria separately from matches and shows the
  averages and counts behind each result. Refused drafts are retained; account changes
  clear private page state.

## P4 catalog and validation

- **Verify additions at their source.** Steam search replaces manual metadata entry.
  GameCatalog verifies the selected app ID and stores metadata with its official
  cover URL. Repeated selection returns the existing identity, preserving reviews.
  Search rows show the cover, developer, and year to distinguish editions. No new
  concept is needed. Stored games remain browsable during a provider failure; adding
  games outside Steam or without a published release year is not supported.
- **Make setup reproducible.** Containers pin Bun 1.4.2, wait for database/backend
  readiness, and exclude private environment files. Local commands supply defaults;
  production requires its database configuration. Artifact generation needs no live database.
- **Test composition directly.** Focused integration suites share HTTP/cookie setup
  while retaining separate disposable databases. New checks follow two-criterion
  matching through missing ratings, revisions, and removals, and verify state and
  ownership across application reassembly. Existing checks cover concurrent reviewers,
  provider failures, and legacy data through actions/endpoints. The [saved output](../validation/tests.txt)
  and [hosted checks](../validation/p4-deployed-checks.json) distinguish local evidence
  from deployed persistence, access-control, and error checks.
