# Discovery

Discovery filters belong to the signed-in user, so changing one person's requirements
does not change another person's results. Each game must meet every selected minimum.
For example, Combat ≥ 8 and Narrative Depth ≥ 7 exclude a game with Combat 9 if
Narrative Depth is below 7 or has no ratings. Missing evidence cannot satisfy a requirement.

A signed-in user can [read their discovery results](reaction:Discovery.Results). The
[discovery results](former:Discovery.DiscoveryResults) list their current filters, every
aspect name that has scores to filter on, and each matching game. Each match comes with its
current Rating average and rating count for every filtered aspect, so the user sees *why* the game
matched.

```endpoints
Discovery.Results at /discover/results
```

The user can [set a minimum score](reaction:Discovery.SetFilter) for an aspect name,
[remove a filter](reaction:Discovery.RemoveFilter), or
[clear every filter](reaction:Discovery.ClearFilters). Each of these answers with the updated
discovery results, so Vue can update the criteria and matches without a page reload.

```endpoints
Discovery.SetFilter at /discover/set
Discovery.RemoveFilter at /discover/remove
Discovery.ClearFilters at /discover/clear
```

The application restricts discovery thresholds to 1–10 at the endpoint boundary.
ThresholdFiltering itself accepts arbitrary finite numeric values. Compositions map
its item identities to games and criterion strings to dimension names, then query
Rating for current averages/counts; no review count is stored by ThresholdFiltering.

Each match shows [its catalog entry](former:Discovery.GameInfo) and
[its recorded score](former:Discovery.MatchedScore) for each filtered aspect.
The catalog entry includes its optional [Steam cover](former:Discovery.SteamCover).

The same immutable name vocabulary used for GameDimensions is supplied to GameDiscovery.
Thus an existing Combat Depth criterion/value and a new Combat criterion use one key.
Requirements that become equivalent retain the stricter minimum until explicitly edited.
The matching former resolves the canonical name back to the game's dimension and reads
Rating for its count. No concept queries its peer for naming rules.
