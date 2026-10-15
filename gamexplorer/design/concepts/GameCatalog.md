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
  an optional steamAppId Number
  an optional coverUrl String
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

setSteamCover(game: Game, steamAppId: Number, coverUrl: String) : returns ()
  where steamAppId is not a positive whole number, or coverUrl is not an HTTPS image URL on an approved Steam static host under the store-assets path for that steamAppId
  then
    refuses INVALID_COVER "A cover needs a positive Steam app ID and its HTTPS Steam store image URL."
  where no entry in Games has identity game
  then
    refuses GAME_NOT_FOUND "This game could not be found."
  where the cover is valid and an entry in Games has identity game
  then
    set that game's steamAppId and coverUrl, replacing its previous cover if present
    returns
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

_steamCover(game: Game) : one (steamAppId: Number, coverUrl: String)
  Answers the stored Steam app identity and cover URL. For an unknown game or a game
  without a cover, answers steamAppId 0 and coverUrl "". This total query lets a former
  include cover metadata without dropping a game that has no artwork. Metadata queries
  retain their existing return shapes.
```
