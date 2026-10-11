# Catalog

Anyone, signed in or not, can [search the catalog](reaction:Catalog.Search). The
[search results](former:Catalog.SearchResults) list each matching game's title, developer,
and release year in title order.

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
exists. Aspects are dynamic: any reviewer can add a dimension that matters to them, such as
"Narrative Depth", without a fixed form.

```endpoints
Catalog.CreateAspect at /aspects/create
```

Each micro note on the game page is labelled with [the reviewer's username](former:Catalog.ReviewerName).
