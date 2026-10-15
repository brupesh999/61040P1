# Discovery

Discovery filters belong to the signed-in user. In P1 the criteria were a single global set,
which meant one person's filter would change everyone's results.

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
discovery results, so the page refreshes in one round trip without reloading.

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
