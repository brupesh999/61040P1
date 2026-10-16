# ThresholdFiltering

## Purpose

Exclude candidates that fail any of an owner's minimum requirements, including candidates
with no recorded value for a required criterion.

Values are supplied independently of their source. This concept does not compute averages,
count reviews, read ratings, or know evaluation dimensions. Its ordering is useful when the
caller supplies comparable values with larger values preferred. A room's capacity, a book's
score, or a measured temperature can be filtered without assuming a 1–10 rating scale.

## Principle

After values are *recorded* for two items, an owner *sets a criterion* that only one item
meets, and that item is the only match. Setting another required criterion narrows the
matches to items meeting both. If a required value is *forgotten*, that item stops matching
until a suitable value is recorded again.

## Types

```types
external Owner
  An opaque identity with its own selection requirements.

external Item
  An opaque candidate identity; this concept knows only values explicitly recorded for it.
```

## State

```state
a set of Values with
  an item Item
  a criterion String
  a value Number
  unique item and criterion

a set of Requirements with
  an owner Owner
  a criterion String
  a minimum Number
  unique owner and criterion

Rule: criterion names are compared after trimming, lowercasing, collapsing internal whitespace, and resolving aliases supplied as immutable string configuration by the instantiation.
Rule: legacy equivalent requirements are treated as one requirement with the greatest minimum, preserving their AND meaning. An explicit set replaces them all; remove removes them all.
Rule: if legacy received values use equivalent names for an item, a row stored under the canonical name takes precedence. recordValue replaces all equivalent received values; forgetValue removes them all.
Rule: recorded values and minimums are finite numbers; negative values and values above 10 are allowed.
```

## Actions

```actions
recordValue(item: Item, criterion: String, value: Number) : returns ()
  where criterion is blank
  then
    refuses EMPTY_CRITERION "A criterion needs a name."
  where criterion is not blank and value is not a finite number
  then
    refuses INVALID_VALUE "A recorded value must be a finite number."
  where criterion is not blank and value is a finite number
  then
    record the trimmed criterion and value for item, replacing its previous value for that criterion if present
    returns

forgetValue(item: Item, criterion: String) : returns ()
  where true
  then
    remove the value for item and that normalized criterion if present
    returns

setCriterion(owner: Owner, criterion: String, minimum: Number) : returns ()
  where criterion is blank
  then
    refuses EMPTY_CRITERION "A criterion needs a name."
  where criterion is not blank and minimum is not a finite number
  then
    refuses INVALID_MINIMUM "A minimum must be a finite number."
  where criterion is not blank and minimum is a finite number
  then
    set the owner's minimum for that normalized criterion, replacing its previous minimum if present
    returns

removeCriterion(owner: Owner, criterion: String) : returns ()
  where the owner has no requirement for that normalized criterion
  then
    refuses CRITERION_NOT_FOUND "This owner has no requirement for this criterion."
  where the owner has a requirement for that normalized criterion
  then
    remove that requirement without changing another owner's requirements
    returns

clearCriteria(owner: Owner) : returns ()
  where true
  then
    remove all requirements owned by owner
    returns
```

## Queries

```queries
_criteria(owner: Owner) : many (criterion: String, minimum: Number)
  Answers the owner's requirements ordered by normalized criterion, or no rows if absent.

_matches(owner: Owner) : many (item: Item)
  Answers items with a recorded value at least the minimum for every requirement owned by
  owner. A missing required value fails the match. Answers no rows with no requirements.
  Orders by highest recorded value among the selected criteria, descending; ties are unspecified.

_value(item: Item, criterion: String) : optional (value: Number)
  Answers the recorded value for item and that normalized criterion, or no row if absent.

_criterionNames() : many (criterion: String)
  Answers distinct names with a recorded value, ordered by normalized name, or no rows if absent.
```
