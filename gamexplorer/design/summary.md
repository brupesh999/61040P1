# Gamexplorer design summary

Gamexplorer lets people review individual aspects of games and find games whose
community scores meet their preferences. This summary compares the
[P1 design](https://github.com/brupesh999/61040P1/blob/f3ca725ffbd049133d5337e839c0cb8608bdb7a0/p1.md)
with the [submitted beta](https://github.com/brupesh999/61040P1/tree/09e14a95ac4b0d934c7f5494a8b7efb1ba2eaea5/gamexplorer)
and the P4 refinements.

## Concepts and reactions

- **Separate mechanisms from games.** P1's aspect concepts were specific to the
  application despite their external types. DimensionDefining now gives any subject
  named dimensions; Rating evaluates opaque targets; ThresholdFiltering matches
  received numbers against an owner's requirements. Their state and actions contain
  no calls to one another. Compositions connect their identities to games and users.
- **Keep ratings authoritative.** Rating stores each person's score and optional
  review. Reactions read the updated average and supply it to discovery after a
  rating is saved or removed. Removing the last rating removes the discovery value;
  an unrated aspect is not a zero score. Queries belong in `where`; `then` invokes
  actions. The composition records each linkage separately.
- **Reuse aspect names.** Independent per-game names could split Combat and Combat
  Depth into different discovery criteria. A shared preset list and reusable custom
  names encourage consistency. An explicit alias resolves that known synonym on
  the backend. Other synonyms remain distinct; automatic semantic grouping is outside
  the current design. Custom creation stays available below the shared picker.
- **Preserve existing contributions.** The concept refinement retained MongoDB
  identities, review ownership, and saved criteria. Compatibility tests construct P2
  state through its archived actions and exercise the current endpoints. Conflicting
  legacy aspect identities are reported rather than silently merged or deleted.

## Authentication and access control

- UserAuthenticating handles password and Commons credentials under one account-authentication
  purpose. P3's separate Federating instance exceeded the five-concept limit; P4 moves
  its verified sign-in protocol into UserAuthenticating. Existing external links and
  sessions keep their stored identities. Matching usernames never merge accounts.
  Local password accounts remain available for testers outside the class.
- HttpOnly cookies hold sessions and sign-in attempts. Compositions resolve the
  authenticated user before personal reads and writes; request fields cannot choose
  a different rating author or filter owner. Catalog entries and reviews are public.
- The browser preserves refused drafts, reports errors, and clears private page state
  on account changes. These controls supplement server checks.

## Interface decisions

- The [visual study](visual-study.pdf) informed the navy background, ruby accents,
  portrait game covers, and pixel typography. Pixelify Sans identifies the app and
  page headings; Geist Pixel gives game titles and scores their gaming character;
  Archivo keeps reviews and small metadata readable. Fonts are served locally.
- The catalog opens immediately. Promotional headings and repeated explanations were
  removed. Game pages distinguish Reviews from Write a Review; My Ratings links
  directly to the aspect editor. Discovery groups criteria separately from results
  and shows the scores and counts behind each match.
- Shared aspect selection is the normal route; creating a custom category is a
  separate, less prominent action. Existing criteria can be edited in place, with
  keyboard focus moved to the relevant control and an explicit cancel action.

## P4 refinements

- **Verified catalog additions.** Manual metadata entry is replaced by Steam search.
  GameCatalog verifies the chosen app ID, excludes non-game or incomplete listings,
  and stores the metadata and official cover URL together. A unique Steam identity
  prevents duplicate additions. Existing matching entries keep their identities and
  reviews. The Steam provider adds no concept and receives no account data.
- **Visual continuity.** P4 carries the P3 palette, typography, and portrait grid into
  the Steam results. Each row groups the cover, identifying metadata, and add/open
  control so users can distinguish editions before selecting one.
- **Useful failure behavior.** Browsing stored games continues when Steam is down.
  Adding a new game reports the failure and retains the search. Selecting an existing
  Steam ID works without contacting Steam. Games outside Steam, or without published
  release-year information, cannot currently be added through this flow.
- **Reproducible setup.** Containers use Bun 1.4.2, wait for database and backend
  readiness, and configure the same origin the browser opens. Local commands supply
  development defaults; production requires its database configuration explicitly.
  Image builds exclude environment files. Artifact generation uses a disconnected
  database handle and needs no private configuration.
- **Validation.** Tests exercise concept principles, refusal cases, ownership,
  naming compatibility, rating projections, and Steam metadata verification using
  disposable databases. Core application behavior remains real when external
  provider fixtures are used. The [saved results](../validation/tests.txt) identify
  the run; deployment and browser evidence distinguish hosted checks from local ones.
