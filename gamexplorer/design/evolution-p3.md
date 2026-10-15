# P3 response to P1 concept-design feedback

P1's purpose and pitch remain Gamexplorer's motivation. This revision changes the mechanism
boundaries rather than merely replacing the word Game with Item.

| P1 concern | P3 refinement | Why it changes the design |
| --- | --- | --- |
| Managing looked like an object table | DimensionDefining gives normalized names stable identities within a subject | Duplicate names cannot create ambiguous evaluation categories; separate subjects may reuse a name. |
| Rating assumes both game and aspect | Rating keeps only Rater and Target | It can rate a whole book directly, or a game dimension via composition. A rater cannot contribute twice by supplying a different parent game. |
| Filtering knows ratings and aggregates | ThresholdFiltering receives finite numeric values, with explicit withdrawal | It can filter capacities or temperatures as well as review averages, with no review counts or 1–10 assumption. |
| Queries in reaction then clauses | Queries supply conditions/data in where; actions change state in then | Read-only observations do not pretend to be effects. |
| AspectManaging missing from composition | Creation checks the catalog, rating resolves a dimension, projection reads its subject/name | Dimension identities have a defined role in both reviewing and discovery. |
| Reviewer interface absent from sketches | Current Vue detail page has labelled score/note editors, update/removal, and My Ratings | The reviewer path is implemented and must appear in the beta journey and recording. |

The framework uses compositions for endpoints, reactions, and read formers. A request's
session resolution and domain action are distinct from the post-rating projection rules.
The application-specific names GameDimensions, DimensionRatings, and GameDiscovery appear
in design/types.md; generic concept definitions do not depend on those instantiations.

## Reuse checks

Define a book's "Clarity" dimension, or define a restaurant's "Service" dimension, using
DimensionDefining. Independently, use Rating to evaluate whole book identities without any
dimension concept. Use ThresholdFiltering to select rooms by capacity and negative
measurements without any rating concept. Unit tests should exercise these uses, as well as
the unchanged Gamexplorer endpoints.

## Data continuity

The new logical state is encoded in the existing isolated MongoDB collections to preserve
P2 identities, saved ratings, saved criteria, and deep links. Legacy physical keys are a
storage compatibility detail: game encodes Subject/Item, aspect encodes Target, user encodes
Rater, and average encodes a received Value. Rating ignores the old redundant game field and
new evaluations do not store a parent game. A unique rater/target index enforces its new
invariant. No concept imports another concept or interprets the referenced identities.
This avoids introducing a migration concept or rewriting existing user data merely to
rename columns. Tests create legacy state with archived P2 concept actions, then exercise
the new concepts and application endpoints against that state.

The P1 document is labelled as revised for P3, with the submitted version preserved in Git.
The private design notebook should explain the student's review of this refinement; these
public implementation notes do not replace that notebook.

## Checked increment

The Vue source is unchanged in this increment. HTTP routes and request fields remain
the same. Rating/removal success acknowledgements now contain only the aspect identity;
their unused game field was removed. Detail, My Ratings, and discovery responses retain
the game-facing structure consumed by Vue. Error codes for generic concept refusals
are updated in their specifications, registration, and HTTP policy together.

Validation passed 70 tests with 518 assertions. The compatibility journeys verify that
old IDs, review ownership, saved criteria, editing, and final-rating withdrawal still work.
The real browser also loaded the existing preview data, edited/restored a saved review,
followed My Ratings back to its editor, and loaded saved discovery matches. See
[browser evidence](../validation/browser-checks.md#p1-concept-feedback-refinement).

The projection is updated by reactions after successful rating actions. Concurrent
replacement/removal tests check three reviewers in one process. There is no claim of
distributed serialization or automatic reconstruction after an interrupted projection;
those require a separate recovery design if the deployment grows beyond this scope.
