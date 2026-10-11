# GameCatalog

## Purpose

Maintain a canonical repository of video game entries and their basic metadata, so every
other part of the application can refer to one game by one identity.

## Principle

When a game is added with a title, developer, and release year, it receives a unique
identifier that can be used to reference the game across the system, and searching the
catalog for part of its title finds it. Adding a second game with the same title, ignoring
case and surrounding spaces, is refused.

## Types

```types
```

## State

```state
a set of Games with
  a unique title String
  a developer String
  a releaseYear Number
```

## Actions

```actions
addGame(title: String, developer: String, releaseYear: Number) : returns (game: Game)
  where title or developer is blank, or releaseYear is not a whole number from 1950 to 2100
  then
    refuses INVALID_GAME "A game needs a title, a developer, and a release year from 1950 to 2100."
  where an entry in Games already has title equal to title, ignoring case and surrounding spaces
  then
    refuses GAME_EXISTS "A game with this title already exists."
  where the game is valid and no entry in Games has title equal to title
  then
    add a new game with the trimmed title, developer, and releaseYear
    returns game
```

## Queries

```queries
_getGame(title: String) : optional (game: Game)
  Answers the game whose title equals title, ignoring case and surrounding spaces, and no
  row when there is none.

_get(game: Game) : optional (title: String, developer: String, releaseYear: Number)
  Answers the metadata of game, and no row for an unknown game.

_searchGames(query: String) : many (game: Game, title: String, developer: String, releaseYear: Number)
  Answers every game whose title contains query, ignoring case, ordered by title. An empty
  query answers every game. Answers no rows when nothing matches.
```
