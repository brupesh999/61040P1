# DimensionDefining

## Purpose

Prevent ambiguous evaluation categories by giving each named dimension a stable identity
within its subject. A name identifies one dimension for that subject, while another subject
can define its own dimension with the same name.

Subject identities have no properties within this concept until supplied to define.
The concept does not authenticate callers, validate subjects against a catalog, or rate
anything. The instantiation may supply an immutable vocabulary of suggested names and explicit
aliases. Unknown names remain valid and become shared suggestions once defined. These
string values are configuration, not state obtained from another concept. Renaming and deletion are outside this increment: a defined dimension remains
available so existing references do not silently change meaning.

## Principle

After someone *defines* a dimension named "Clarity" for subject `s`, they can find that
same dimension by its name and list it among `s`'s dimensions. Defining "Clarity" for
another subject creates a different dimension, so the two subjects can be evaluated separately.

## Types

```types
external Subject
  An opaque identity whose evaluation dimensions are being defined.
```

## State

```state
a set of Dimensions with
  a subject Subject
  a name String
  a description String
  unique subject and name

Rule: dimension names are compared after trimming, lowercasing, collapsing internal whitespace, and resolving configured aliases.
Rule: aliases supply canonical displayed names; existing dimension identities and descriptions are preserved.
Rule: new definitions reuse the displayed name of a known suggestion. An empty description uses its suggested description when available.
Rule: displayed names and descriptions are trimmed; their internal text is preserved.
```

## Actions

```actions
define(subject: Subject, name: String, description: String) : returns (dimension: Dimension)
  where name is blank
  then
    refuses EMPTY_DIMENSION_NAME "A dimension needs a name."
  where name is not blank and that normalized name is already defined for subject
  then
    refuses DIMENSION_EXISTS "This dimension name is already defined for this subject."
  where name is not blank and that normalized name is not defined for subject
  then
    create a new dimension associated with subject, its canonical or shared displayed name, and the trimmed description (or suggested description when blank)
    returns dimension
```

## Queries

```queries
_forSubject(subject: Subject) : many (dimension: Dimension, name: String, description: String)
  Answers the dimensions associated with subject, ordered by normalized name. An unknown
  subject answers no rows. Names resolve configured aliases without changing identities.

_get(dimension: Dimension) : optional (subject: Subject, name: String, description: String)
  Answers the associations recorded for dimension, with its canonical displayed name, or no row for an unknown dimension.

_named(subject: Subject, name: String) : optional (dimension: Dimension, description: String)
  Answers the dimension with that normalized name for subject, or no row if absent.

_names() : many (name: String, description: String, aliases: String)
  Answers configured suggestions first, then names defined for any subject in normalized
  name order. Each name appears once. aliases is its configured alternate names joined
  by spaces for searching; an unknown custom name has an empty aliases string.

_nameConflicts() : many (subject: Subject, name: String)
  Answers legacy subjects containing multiple dimension identities that now resolve to
  one configured canonical name. Empty for consistent data. This diagnostic never merges
  dimensions or modifies reviews; startup refuses such a naming policy for manual review.
```
