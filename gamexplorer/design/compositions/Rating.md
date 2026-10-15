# Rating

A signed-in user can [rate one aspect](reaction:Rating.Rate). Authentication supplies the
rater. A GameDimensions query verifies that the dimension exists; neither the request nor
the Rating action supplies a parent game. The endpoint passes only the user's identity, dimension identity, score,
and note to DimensionRatings. Rating/removal responses acknowledge only the aspect identity;
the unused parent-game response field is removed. An unknown aspect answers ASPECT_NOT_FOUND.

[Removal](reaction:Rating.Remove) uses the same lookup and authenticated identity. The
[personal ratings endpoint](reaction:Rating.Mine) and [former](former:Rating.MyRatings)
join Rating's opaque target with GameDimensions and GameCatalog to display
[the game title](former:Rating.GameTitle) and dimension details from GameDimensions.
Sparse reviewing follows from rating individual dimensions; no concept fills unchosen targets.

```endpoints
Rating.Rate at /ratings/rate
Rating.Remove at /ratings/remove
Rating.Mine at /ratings/mine
```

## Independent projection rules

After a successful [rating](reaction:Rating.RecordValueAfterRating) or
[removal with evaluations remaining](reaction:Rating.RecordValueAfterRemoval), read the
current Rating summary and the dimension's subject/name in where, then invoke
GameDiscovery.recordValue with the average. After
[removal of the final evaluation](reaction:Rating.ForgetValueAfterRemoval), read the zero
count and dimension associations in where, then invoke GameDiscovery.forgetValue.

Queries occur only in where; then contains actions. The filtering concept does not receive
Rating's state or a review count. A name-to-game association and the 1–10 discovery policy
are explicit application choices. Rating owns the authoritative evaluations; filtering owns
its received numeric values. The reactions update this application projection within the
completed rating request. Full workflow tests verify creation, replacement, refusal, and
final-removal behavior. A concurrent HTTP test submits three reviewers' replacements and
removals against one dimension and checks the resulting discovery boundary against the
stored average. It covers in-process contention; it does not establish crash recovery or
cross-process ordering, which sync-engine does not guarantee.
