# Rating

## Purpose

Summarize independent evaluations without double-counting a person's revised opinion.
A rater can update or withdraw an evaluation without affecting other raters' contributions.

An empty note means no written explanation. Rating does not decide what a target
represents, whether it exists elsewhere, who may rate it, or whether another target must
also be rated. Those policies belong to the composition. This concept can rate a whole
book or a separately identified evaluation dimension without changing its state or actions.

## Principle

When two raters *rate* the same target, its summary counts both scores and reports their
mean. If one rater *rates* it again, the new score and note replace that rater's previous
evaluation; the count stays two. If that rater *removes* their evaluation, only the other
rater's score contributes to the summary.

## Types

```types
external Rater
  An opaque identity contributing an evaluation.

external Target
  An opaque identity being evaluated; it has no implicit parent, name, or properties.
```

## State

```state
a set of Ratings with
  a rater Rater
  a target Target
  a score Number
  a note String
  an updatedAt DateTime
  unique rater and target
```

## Actions

```actions
rate(rater: Rater, target: Target, score: Number, note: String) : returns ()
  where score is not an integer from 1 to 10
  then
    refuses INVALID_SCORE "Score must be an integer between 1 and 10."
  where score is an integer from 1 to 10 and the trimmed note exceeds 280 characters
  then
    refuses NOTE_TOO_LONG "A review note must be at most 280 characters."
  where score is an integer from 1 to 10 and the trimmed note is at most 280 characters
  then
    replace the existing evaluation for rater and target with score and the trimmed note, or add it if absent; set updatedAt to the current time
    returns

remove(rater: Rater, target: Target) : returns ()
  where no evaluation exists for rater and target
  then
    refuses RATING_NOT_FOUND "This rater has no evaluation of this target."
  where an evaluation exists for rater and target
  then
    remove that evaluation without changing other raters' evaluations
    returns
```

## Queries

```queries
_byRater(rater: Rater) : many (target: Target, score: Number, note: String)
  Answers the rater's evaluations, ordered by updatedAt descending, or no rows when absent. Ties are unspecified.

_forTarget(target: Target) : many (rater: Rater, score: Number, note: String)
  Answers the target's evaluations, ordered by updatedAt descending, or no rows when absent. Ties are unspecified.

_summary(target: Target) : one (average: Number, count: Number)
  Answers the mean score rounded to one decimal and the number of evaluations. With no
  evaluations, answers average 0 and count 0; count distinguishes absence from a score.
```
