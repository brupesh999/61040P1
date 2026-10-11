# AspectRating

## Purpose

Allow users to submit quantitative scores and 1-2 sentence micro notes for specific aspects
of a game without requiring ratings on all aspects, so a reviewer never has to penalize a
dimension they do not care about.

## Principle

If a user submits a rating from 1 to 10 and an optional micro note for one aspect of a game,
that rating is stored and counted in the aspect's average; other aspects of the game stay
unrated. Rating the same aspect again replaces the earlier score and note rather than adding
a second rating. A score outside 1 to 10 is refused. After the user removes the rating, it
no longer counts, and removing it again is refused.

## Types

```types
external User
  The person who submits a rating.

external Game
  The game being rated.

external Aspect
  The dimension of the game being rated.
```

## State

```state
a set of Ratings with
  a user User
  a game Game
  an aspect Aspect
  a score Number
  a microNote String
  unique user and game and aspect
```

## Actions

```actions
rateAspect(user: User, game: Game, aspect: Aspect, score: Number, microNote: String) : returns ()
  where score is not a whole number from 1 to 10
  then
    refuses INVALID_SCORE "Score must be an integer between 1 and 10."
  where microNote is longer than 280 characters
  then
    refuses NOTE_TOO_LONG "A micro note must be at most 280 characters."
  where score is a whole number from 1 to 10 and microNote is at most 280 characters
  then
    if an entry in Ratings exists for user, game, and aspect, set its score and microNote
    otherwise add a new entry to Ratings with user, game, aspect, score, and microNote
    returns

removeRating(user: User, game: Game, aspect: Aspect) : returns ()
  where no entry in Ratings matches user, game, and aspect
  then
    refuses RATING_NOT_FOUND "No rating exists for this aspect by the user."
  where an entry in Ratings matches user, game, and aspect
  then
    remove the matching entry from Ratings
    returns
```

## Queries

```queries
_getRatingsForGame(game: Game) : many (user: User, aspect: Aspect, score: Number, microNote: String)
  Answers every rating submitted for game, most recently updated first, and no rows when
  there are none.

_getUserRatings(user: User) : many (game: Game, aspect: Aspect, score: Number, microNote: String)
  Answers every rating submitted by user, most recently updated first, and no rows when
  there are none.

_forAspect(aspect: Aspect) : many (user: User, score: Number, microNote: String)
  Answers every rating of aspect, most recently updated first, and no rows when there are
  none.

_summary(aspect: Aspect) : one (average: Number, count: Number)
  Answers the mean score of aspect rounded to one decimal place and the number of ratings.
  An aspect with no ratings answers average 0 and count 0.
```
