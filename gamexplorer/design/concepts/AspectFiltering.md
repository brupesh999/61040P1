# AspectFiltering

## Purpose

Keep aggregate aspect scores per game and match games against a user's minimum score
thresholds, so a buyer can discover games by the dimensions they care about instead of a
single overall score.

## Principle

The application records that game `g1` has an average "Narrative Depth" score of 9 and game
`g2` has 6. Mira sets a filter requiring "narrative depth" of at least 8; matching names
ignores case. Only `g1` matches Mira's filters. When Mira also requires "Combat Depth" of at
least 5, `g1` no longer matches because it has no recorded Combat Depth score. A threshold
outside 1 to 10 is refused. Another user's filters never affect Mira's matches. After Mira
clears her filters, she has no criteria and no matches.

## Types

```types
external User
  The person who owns a set of filter criteria.

external Game
  The game whose aggregate scores are recorded.
```

## State

```state
a set of Scores with
  a game Game
  an aspectName String
  an average Number
  a count Number
  unique game and aspectName

a set of Criteria with
  an owner User
  an aspectName String
  a minScore Number
  unique owner and aspectName

Rule: aspect names are compared ignoring case and surrounding spaces.
```

## Actions

```actions
recordScore(game: Game, aspectName: String, average: Number, count: Number) : returns ()
  where count is 0
  then
    remove any score recorded for game and aspectName
    returns
  where count is greater than 0
  then
    set the score for game and aspectName to average and count, adding it if absent
    returns

setFilter(owner: User, aspectName: String, minScore: Number) : returns ()
  where aspectName is blank
  then
    refuses EMPTY_FILTER_ASPECT "A filter needs an aspect name."
  where minScore < 1 or minScore > 10
  then
    refuses INVALID_THRESHOLD "Threshold score must be between 1 and 10."
  where aspectName is not blank and minScore >= 1 and minScore <= 10
  then
    if an entry in Criteria exists for owner and aspectName, set its minScore
    otherwise add a new entry to Criteria with owner, aspectName, and minScore
    returns

removeFilter(owner: User, aspectName: String) : returns ()
  where no entry in Criteria exists for owner and aspectName
  then
    refuses FILTER_NOT_FOUND "There is no filter on that aspect."
  where an entry in Criteria exists for owner and aspectName
  then
    remove that entry from Criteria
    returns

clearFilters(owner: User) : returns ()
  where true
  then
    remove all entries from Criteria whose owner is owner
    returns
```

## Queries

```queries
_filters(owner: User) : many (aspectName: String, minScore: Number)
  Answers the criteria owned by owner, ordered by aspect name, and no rows when there are
  none.

_matchGames(owner: User) : many (game: Game)
  Answers every game that, for every criterion owned by owner, has a recorded score for that
  aspect name whose average is at least the criterion's minScore. Ordered by the game's
  highest-scoring matched average, descending. Answers no rows when owner has no criteria.

_score(game: Game, aspectName: String) : optional (average: Number, count: Number)
  Answers the recorded average and count for game and aspectName, and no row when none is
  recorded.

_aspectNames() : many (aspectName: String)
  Answers every distinct aspect name with at least one recorded score, ordered by name, and
  no rows when there are none.
```
