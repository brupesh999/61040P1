# GameCatalog

## Purpose

Maintain a canonical repository of video game entries and their basic metadata, so every
other part of the application can refer to one game by one identity.

## Principle

When a game is *added* with a title, developer, and release year, it receives a unique
identifier that can be used to reference the game across the system, and searching the
catalog for part of its title finds it. Adding a second game with the same title, ignoring
case, surrounding spaces, and repeated internal whitespace, is refused.

A caller may also search the configured Steam catalog source and *add* a selected
Steam app ID. The catalog verifies the source metadata and stores it with the
official cover URL. Repeating that addition returns the existing identity, even
if the source title has changed. An existing entry with the same title and no
Steam identity is linked in place, preserving references and reviews. Manual
addition remains available to administrative imports and concept-level callers;
the application's public add endpoint requires a Steam selection.

The Steam provider is an external metadata source, not another application concept.
It receives search terms and app IDs, never users, sessions, dimensions, or ratings.

## Types

```types
```

## State

```state
a set of Games with
  a unique title String
  a developer String
  a releaseYear Number
  an optional unique steamAppId Number
  an optional coverUrl String
Rule: Title uniqueness compares lowercase titles with surrounding whitespace removed and internal whitespace runs replaced by one space.
```

## Actions

```actions
addGame(title: String, developer: String, releaseYear: Number) : returns (game: Game)
  where title or developer is blank, or releaseYear is not a whole number from 1950 to 2100
  then
    refuses INVALID_GAME "A game needs a title, a developer, and a release year from 1950 to 2100."
  where an entry in Games already has the same normalized title
  then
    refuses GAME_EXISTS "A game with this title already exists."
  where the game is valid and no entry in Games has the same normalized title
  then
    add a new game with the trimmed title, developer, and releaseYear
    returns game

addSteamGame(steamAppId: Number) : returns (game: Game)
  where an entry already has steamAppId
  then
    set game to that entry's identity without contacting Steam or changing its metadata
    returns game
  where Steam cannot be reached or returns an unavailable response
  then
    refuses STEAM_UNAVAILABLE "Steam is unavailable. Try again shortly."
  where steamAppId is not a positive whole unsigned 32-bit app ID, or Steam does not identify a base game with a title, developer, and release year from 1950 to 2100
  then
    refuses INVALID_STEAM_GAME "Choose a Steam game with published developer and release-year information."
  where Steam identifies a valid game but its title is already attached to a different Steam app ID
  then
    refuses GAME_EXISTS "A game with this title already exists."
  where Steam identifies a valid game and the same title exists without a Steam app ID
  then
    attach the verified Steam identity and cover and update the metadata on that existing game
    set game to its existing identity
    returns game
  where Steam identifies a valid game with no existing title or Steam app ID
  then
    create a game with its verified title, developer, releaseYear, steamAppId, and official portrait cover URL together
    returns game

setSteamCover(game: Game, steamAppId: Number, coverUrl: String) : returns ()
  where steamAppId is not a positive whole number, or coverUrl is not an HTTPS image URL on an approved Steam static host under the store-assets path for that steamAppId
  then
    refuses INVALID_COVER "A cover needs a positive Steam app ID and its HTTPS Steam store image URL."
  where no entry in Games has identity game
  then
    refuses GAME_NOT_FOUND "This game could not be found."
  where another entry already has steamAppId
  then
    refuses STEAM_GAME_EXISTS "This Steam game is already in the catalog."
  where the cover is valid and an entry in Games has identity game
  then
    set that game's steamAppId and coverUrl, replacing its previous cover if present
    returns
```

## Queries

```queries
_getGame(title: String) : optional (game: Game)
  Answers the game with the same normalized title, and no
  row when there is none.

_fromSteam(steamAppId: Number) : one (game: String)
  Answers the existing game's identity as game, or an empty string for an unknown
  or invalid ID. This total lookup lets search results include games that have not
  been added yet; an absent match must not remove a Steam result from its former.

_searchSteam(query: String) : many (steamAppId: Number, title: String, developer: String, releaseYear: Number, coverUrl: String)
  Reads matching base games from the external Steam provider, preserving source order.
  Each row has verified metadata and an official portrait cover URL. Searches shorter
  than two or longer than 100 trimmed characters and searches with no matches return
  no rows. An unavailable source fails the request rather than reporting no matches.
  This query never adds games or changes stored catalog state.

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
