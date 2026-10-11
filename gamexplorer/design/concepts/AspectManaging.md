# AspectManaging

## Purpose

Define and maintain named evaluation dimensions (aspects) for games, so reviewers can rate
only the dimensions that matter for that game instead of a fixed form.

## Principle

After an aspect such as "Combat Depth" is created for a game, it is listed among that
game's aspects and can be referenced by reviewers to rate that specific dimension. Creating
"combat depth" again for the same game is refused, but the same name can be created for a
different game.

## Types

```types
external Game
  The game an aspect evaluates.
```

## State

```state
a set of Aspects with
  a game Game
  a name String
  a description String
  unique game and name
```

## Actions

```actions
createAspect(game: Game, name: String, description: String) : returns (aspect: Aspect)
  where name is blank
  then
    refuses EMPTY_ASPECT_NAME "An aspect needs a name."
  where an entry in Aspects already exists for game with name equal to name, ignoring case and surrounding spaces
  then
    refuses ASPECT_EXISTS "This aspect already exists for the specified game."
  where name is not blank and no entry in Aspects exists for game with that name
  then
    add a new aspect with game, the trimmed name, and description
    returns aspect
```

## Queries

```queries
_getAspects(game: Game) : many (aspect: Aspect, name: String, description: String)
  Answers every aspect defined for game, ordered by name, and no rows when there are none.

_get(aspect: Aspect) : optional (game: Game, name: String, description: String)
  Answers the game, name, and description of aspect, and no row for an unknown aspect.
```
