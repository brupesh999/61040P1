# Catalog

Anyone, signed in or not, can [search the catalog](reaction:Catalog.Search). The
[search results](former:Catalog.SearchResults) list each matching game's title, developer,
and release year in title order.
Each result also includes its optional [Steam cover](former:Catalog.SteamCover).

```endpoints
Catalog.Search at /games/search
```

A signed-in user can [add a game](reaction:Catalog.AddGame). The journey starts from an
empty database, so players add the games they want to review.

```endpoints
Catalog.AddGame at /games/add
```

Anyone can [open a game's page](reaction:Catalog.GameDetail). The
[game page](former:Catalog.GamePage) shows the game's metadata and every aspect defined for
it. Each aspect has its average score, its number of ratings, and the micro notes reviewers
attached, each labelled with the reviewer's username. Asking for a game that does not exist
answers `GAME_NOT_FOUND`. Each aspect's numbers come from [the aspect summary](former:Catalog.AspectSummary), which reports average 0 and count 0 for an unrated aspect.

```endpoints
Catalog.GameDetail at /games/detail
```

A signed-in user can [create an aspect](reaction:Catalog.CreateAspect) for a game that
exists. Authentication resolves the session first. A GameCatalog query in where checks
the subject exists, then GameDimensions.define creates its dimension. GameDimensions
prevents normalized duplicate names for that game, so reviews do not split between
ambiguous copies of "Narrative Depth". Another game can define that name independently.
The dimension's identity is the aspect identity used by the existing HTTP interface.

GamePage joins GameDimensions._forSubject with DimensionRatings._forTarget and
DimensionRatings._summary. The concepts never exchange game or dimension objects:
the composition supplies identities and separately reads the values needed for display.

```endpoints
Catalog.CreateAspect at /aspects/create
```

Each micro note on the game page is labelled with [the reviewer's username](former:Catalog.ReviewerName).

The optional [Steam cover](former:Catalog.SteamCover) appears on the game detail page
as well. Covers are publisher-supplied Steam store images attached through the
catalog import action. There is no public endpoint accepting arbitrary artwork URLs.
Games without a stored cover remain visible and usable.

## Shared aspect choices

The public [aspect options endpoint](reaction:Catalog.AspectOptions) lists
[shared choices](former:Catalog.AspectChoices) from GameDimensions._names.
The application configures a broad preset vocabulary and
an explicit Combat Depth → Combat alias. The backend applies it even to direct requests.
Other custom names remain allowed; defining one makes it available to other games.
Names with different meanings are not merged through fuzzy matching.

```endpoints
Catalog.AspectOptions at /aspects/options
```

Before startup, the naming diagnostic checks for legacy dimensions on the same game
that resolve to one name. Such a conflict stops the new deployment for review; it does
not delete targets or overwrite ratings. Otherwise aliases work with existing IDs and
stored names without a destructive data migration.
