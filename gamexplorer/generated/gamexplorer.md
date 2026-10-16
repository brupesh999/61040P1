<!-- Generated from the Gamexplorer assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Gamexplorer — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### DimensionDefining

Defined in [DimensionDefining](../design/concepts/DimensionDefining.md), line 1.

#### Actions

- `define(subject: Subject, name: String, description: String) : returns (dimension: Dimension)`
  - Refuses `EMPTY_DIMENSION_NAME`: A dimension needs a name.
  - Refuses `DIMENSION_EXISTS`: This dimension name is already defined for this subject.

#### Queries

- `_forSubject(subject: Subject) : many (dimension: Dimension, name: String, description: String)`
- `_get(dimension: Dimension) : optional (subject: Subject, name: String, description: String)`
- `_named(subject: Subject, name: String) : optional (dimension: Dimension, description: String)`
- `_names() : many (name: String, description: String, aliases: String)`
- `_nameConflicts() : many (subject: Subject, name: String)`

#### Instances

- `GameDimensions` — instance of `DimensionDefining` — [Application types](../design/types.md), line 27.
  - `Subject` is `GameCatalog.Game` — [Application types](../design/types.md), line 28.

### Federating

Defined in [Federating](../design/concepts/Federating.md), line 1.

#### Actions

- `start() : returns (attempt: Attempt, expiresAt: DateTime, address: String)`
- `finish(attempt: Attempt, nonce: String, code: String) : returns (username: String)`
  - Refuses `SIGN_IN_EXPIRED`: This sign-in has expired. Start again.
  - Refuses `SIGN_IN_REFUSED`: The other site didn't confirm this sign-in. Start again.
- `link(attempt: Attempt, user: User) : returns (user: User)`
  - Refuses `NOT_CONFIRMED`: This sign-in hasn't been confirmed.
  - Refuses `ALREADY_LINKED`: This account on the other site is already linked.

#### Queries

- `_user(attempt: Attempt) : optional (user: User)`
- `_linkable(attempt: Attempt) : one (linkable: Flag)`

#### Instances

- `CommonsFederating` — instance of `Federating` — [Application types](../design/types.md), line 22.
  - `User` is `UserAuthenticating.User` — [Application types](../design/types.md), line 23.

### GameCatalog

Defined in [GameCatalog](../design/concepts/GameCatalog.md), line 1.

#### Actions

- `addGame(title: String, developer: String, releaseYear: Number) : returns (game: Game)`
  - Refuses `INVALID_GAME`: A game needs a title, a developer, and a release year from 1950 to 2100.
  - Refuses `GAME_EXISTS`: A game with this title already exists.
- `setSteamCover(game: Game, steamAppId: Number, coverUrl: String) : returns ()`
  - Refuses `INVALID_COVER`: A cover needs a positive Steam app ID and its HTTPS Steam store image URL.
  - Refuses `GAME_NOT_FOUND`: This game could not be found.

#### Queries

- `_getGame(title: String) : optional (game: Game)`
- `_get(game: Game) : optional (title: String, developer: String, releaseYear: Number)`
- `_searchGames(query: String) : many (game: Game, title: String, developer: String, releaseYear: Number)`
- `_steamCover(game: Game) : one (steamAppId: Number, coverUrl: String)`

#### Instances

- `GameCatalog` — instance of `GameCatalog` — [Application types](../design/types.md), line 25.

### Rating

Defined in [Rating](../design/concepts/Rating.md), line 1.

#### Actions

- `rate(rater: Rater, target: Target, score: Number, note: String) : returns ()`
  - Refuses `INVALID_SCORE`: Score must be an integer between 1 and 10.
  - Refuses `NOTE_TOO_LONG`: A review note must be at most 280 characters.
- `remove(rater: Rater, target: Target) : returns ()`
  - Refuses `RATING_NOT_FOUND`: This rater has no evaluation of this target.

#### Queries

- `_byRater(rater: Rater) : many (target: Target, score: Number, note: String)`
- `_forTarget(target: Target) : many (rater: Rater, score: Number, note: String)`
- `_summary(target: Target) : one (average: Number, count: Number)`

#### Instances

- `DimensionRatings` — instance of `Rating` — [Application types](../design/types.md), line 30.
  - `Rater` is `UserAuthenticating.User` — [Application types](../design/types.md), line 31.
  - `Target` is `GameDimensions.Dimension` — [Application types](../design/types.md), line 32.

### ThresholdFiltering

Defined in [ThresholdFiltering](../design/concepts/ThresholdFiltering.md), line 1.

#### Actions

- `recordValue(item: Item, criterion: String, value: Number) : returns ()`
  - Refuses `EMPTY_CRITERION`: A criterion needs a name.
  - Refuses `INVALID_VALUE`: A recorded value must be a finite number.
- `forgetValue(item: Item, criterion: String) : returns ()`
- `setCriterion(owner: Owner, criterion: String, minimum: Number) : returns ()`
  - Refuses `EMPTY_CRITERION`: A criterion needs a name.
  - Refuses `INVALID_MINIMUM`: A minimum must be a finite number.
- `removeCriterion(owner: Owner, criterion: String) : returns ()`
  - Refuses `CRITERION_NOT_FOUND`: This owner has no requirement for this criterion.
- `clearCriteria(owner: Owner) : returns ()`

#### Queries

- `_criteria(owner: Owner) : many (criterion: String, minimum: Number)`
- `_matches(owner: Owner) : many (item: Item)`
- `_value(item: Item, criterion: String) : optional (value: Number)`
- `_criterionNames() : many (criterion: String)`

#### Instances

- `GameDiscovery` — instance of `ThresholdFiltering` — [Application types](../design/types.md), line 34.
  - `Item` is `GameCatalog.Game` — [Application types](../design/types.md), line 36.
  - `Owner` is `UserAuthenticating.User` — [Application types](../design/types.md), line 35.

### UserAuthenticating

Defined in [UserAuthenticating](../design/concepts/UserAuthenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (user: User)`
  - Refuses `EMPTY_CREDENTIALS`: Username and password must not be empty.
  - Refuses `USERNAME_TAKEN`: The requested username is already registered.
- `authenticate(username: String, password: String) : returns (user: User, session: Session, expiresAt: DateTime)`
  - Refuses `INVALID_CREDENTIALS`: Invalid username or password.
- `registerExternal(username: String) : returns (user: User)`
  - Refuses `INVALID_USERNAME`: A username must have 3 to 32 letters, digits, underscores, or hyphens.
  - Refuses `USERNAME_TAKEN`: The requested username is already registered.
- `startSession(user: User) : returns (user: User, session: Session, expiresAt: DateTime)`
  - Refuses `UNKNOWN_USER`: This user could not be found.
- `current(session: Session) : returns (user: User)`
  - Refuses `UNKNOWN_SESSION`: You must be signed in to do that.
- `logout(session: Session) : returns (user: User)`
  - Refuses `UNKNOWN_SESSION`: You must be signed in to do that.

#### Queries

- `_getUser(username: String) : optional (user: User)`
- `_username(user: User) : optional (username: String)`

#### Instances

- `UserAuthenticating` — instance of `UserAuthenticating` — [Application types](../design/types.md), line 20.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the Steam cover of (game)

Authored path: `Catalog.SteamCover`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 6.
- Covered by [Catalog](../design/compositions/Catalog.md), line 46.

```former
Former "the Steam cover of (game)" — inputs (game); bindings (steamAppId, coverUrl); promises exactly one record — forms:
  a record of
    where GameCatalog._steamCover (game) has (coverUrl, steamAppId)
    coverUrl
    steamAppId
```

### the discovery cover of (game)

Authored path: `Discovery.SteamCover`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 34.

```former
Former "the discovery cover of (game)" — inputs (game); bindings (steamAppId, coverUrl); promises exactly one record — forms:
  a record of
    where GameCatalog._steamCover (game) has (coverUrl, steamAppId)
    coverUrl
    steamAppId
```

### the catalog entry of (game)

Authored path: `Discovery.GameInfo`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 32.

```former
Former "the catalog entry of (game)" — inputs (game); bindings (title, developer, releaseYear); promises at most one record — forms:
  a record of
    where GameCatalog._get (game) has (developer, releaseYear, title)
    cover: former "the discovery cover of (game)" with (game)
    developer
    releaseYear
    title
```

### the current user (user)

Authored path: `Accounts.CurrentUser`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 27.

```former
Former "the current user (user)" — inputs (user); bindings (username); promises exactly one record — forms:
  a record of
    where UserAuthenticating._username (user) has (username)
    user
    username
```

### the score of (game) on (aspectName)

Authored path: `Discovery.MatchedScore`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 33.

```former
Former "the score of (game) on (aspectName)" — inputs (game, aspectName); bindings (target, average, count); promises at most one record — forms:
  a record of
    where GameDimensions._named (name: aspectName, subject: game) has (dimension: target)
    where DimensionRatings._summary (target) has (average, count)
    average
    count
```

### the discovery results of (owner)

Authored path: `Discovery.DiscoveryResults`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 7.

```former
Former "the discovery results of (owner)" — inputs (owner); bindings (aspectName, minScore, available, game, filtered); promises exactly one record — forms:
  a record of
    aspectNames: each GameDiscovery._criterionNames () has (criterion: available)
      form a record of
        aspectName: available
    filters: each GameDiscovery._criteria (owner) has (criterion: aspectName, minimum: minScore)
      form a record of
        aspectName
        minScore
    matches: each GameDiscovery._matches (owner) has (item: game)
      form a record of
        game
        info: former "the catalog entry of (game)" with (game)
        scores: each GameDiscovery._criteria (owner) has (criterion: filtered)
          form a record of
            aspectName: filtered
            score: former "the score of (game) on (aspectName)" with (aspectName: filtered, game)
```

### the reviewer name of (user)

Authored path: `Catalog.ReviewerName`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 44.

```former
Former "the reviewer name of (user)" — inputs (user); bindings (username); promises at most one record — forms:
  a record of
    where UserAuthenticating._username (user) has (username)
    username
```

### the summary of (aspect)

Authored path: `Catalog.AspectSummary`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 23.

```former
Former "the summary of (aspect)" — inputs (aspect); bindings (average, count); promises exactly one record — forms:
  a record of
    where DimensionRatings._summary (target: aspect) has (average, count)
    average
    count
```

### the game page of (game)

Authored path: `Catalog.GamePage`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 20.

```former
Former "the game page of (game)" — inputs (game); bindings (title, developer, releaseYear, aspect, name, description, user, score, microNote); promises exactly one record — forms:
  a record of
    where GameCatalog._get (game) has (developer, releaseYear, title)
    aspects: each GameDimensions._forSubject (subject: game) has (description, dimension: aspect, name)
      form a record of
        aspect
        description
        name
        ratings: each DimensionRatings._forTarget (target: aspect) has (note: microNote, rater: user, score)
          form a record of
            microNote
            reviewer: former "the reviewer name of (user)" with (user)
            score
            user
        summary: former "the summary of (aspect)" with (aspect)
    cover: former "the Steam cover of (game)" with (game)
    developer
    game
    releaseYear
    title
```

### the title of (game)

Authored path: `Rating.GameTitle`.
- Covered by [Rating](../design/compositions/Rating.md), line 12.

```former
Former "the title of (game)" — inputs (game); bindings (title); promises at most one record — forms:
  a record of
    where GameCatalog._get (game) has (title)
    title
```

### the ratings by (user)

Authored path: `Rating.MyRatings`.
- Covered by [Rating](../design/compositions/Rating.md), line 10.

```former
Former "the ratings by (user)" — inputs (user); bindings (game, aspect, name, score, microNote); promises exactly one record — forms:
  a record of
    ratings: each DimensionRatings._byRater (rater: user) has (note: microNote, score, target: aspect)
      where GameDimensions._get (dimension: aspect) has (name, subject: game)
      form a record of
        aspect
        aspectInfo: a record of
          name
        game
        gameInfo: former "the title of (game)" with (game)
        microNote
        score
```

### the search results for (query)

Authored path: `Catalog.SearchResults`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 4.

```former
Former "the search results for (query)" — inputs (query); bindings (game, title, developer, releaseYear); promises exactly one record — forms:
  a record of
    games: each GameCatalog._searchGames (query) has (developer, game, releaseYear, title)
      form a record of
        cover: former "the Steam cover of (game)" with (game)
        developer
        game
        releaseYear
        title
```

### the shared aspect choices

Authored path: `Catalog.AspectChoices`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 54.

```former
Former "the shared aspect choices" — inputs (); bindings (name, description, aliases); promises exactly one record — forms:
  a record of
    options: each GameDimensions._names () has (aliases, description, name)
      form a record of
        aliases
        description
        name
```

## Reactions

### Accounts.Login

Authored path: `Accounts.Login`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 10.
- Covered by [Accounts](../design/compositions/Accounts.md), line 14.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  UserAuthenticating.authenticate (password, username)
```

### Accounts.Login#2

Authored path: `Accounts.Login`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 10.
- Covered by [Accounts](../design/compositions/Accounts.md), line 14.

```reaction
when UserAuthenticating.authenticate (password, username, expiresAt, session, user), asked by Accounts.Login
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Accounts.Logout

Authored path: `Accounts.Logout`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 19.
- Covered by [Accounts](../design/compositions/Accounts.md), line 24.

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  UserAuthenticating.logout (session)
```

### Accounts.Logout#2

Authored path: `Accounts.Logout`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 19.
- Covered by [Accounts](../design/compositions/Accounts.md), line 24.

```reaction
when UserAuthenticating.logout (session, user), asked by Accounts.Logout
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Accounts.Me

Authored path: `Accounts.Me`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 19.
- Covered by [Accounts](../design/compositions/Accounts.md), line 23.

```reaction
when RequestBoundary.request (path: "/auth/me", requestId, session)
then
  UserAuthenticating.current (session)
```

### Accounts.Me#2

Authored path: `Accounts.Me`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 19.
- Covered by [Accounts](../design/compositions/Accounts.md), line 23.

```reaction
when UserAuthenticating.current (session, user), asked by Accounts.Me
where
  earlier, RequestBoundary.request (path: "/auth/me", requestId, session)
then
  RequestBoundary.respond (me: former "the current user (user)" with (user), requestId)
```

### Accounts.Register

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 8.
- Covered by [Accounts](../design/compositions/Accounts.md), line 13.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  UserAuthenticating.register (password, username)
```

### Accounts.Register#2

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 8.
- Covered by [Accounts](../design/compositions/Accounts.md), line 13.

```reaction
when UserAuthenticating.register (password, username, user), asked by Accounts.Register
then
  UserAuthenticating.authenticate (password, username)
```

### Accounts.Register#3

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 8.
- Covered by [Accounts](../design/compositions/Accounts.md), line 13.

```reaction
when UserAuthenticating.authenticate (password, username, expiresAt, session, user), asked by Accounts.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Catalog.AddGame

Authored path: `Catalog.AddGame`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 12.
- Covered by [Catalog](../design/compositions/Catalog.md), line 16.

```reaction
when RequestBoundary.request (developer, path: "/games/add", releaseYear, requestId, session, title)
then
  UserAuthenticating.current (session)
```

### Catalog.AddGame#2

Authored path: `Catalog.AddGame`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 12.
- Covered by [Catalog](../design/compositions/Catalog.md), line 16.

```reaction
when UserAuthenticating.current (session, user), asked by Catalog.AddGame
where
  earlier, RequestBoundary.request (developer, path: "/games/add", releaseYear, requestId, session, title)
then
  GameCatalog.addGame (developer, releaseYear, title)
```

### Catalog.AddGame#3

Authored path: `Catalog.AddGame`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 12.
- Covered by [Catalog](../design/compositions/Catalog.md), line 16.

```reaction
when GameCatalog.addGame (developer, releaseYear, title, game), asked by Catalog.AddGame#2
where
  earlier, RequestBoundary.request (developer, path: "/games/add", releaseYear, requestId, session, title)
then
  RequestBoundary.respond (game, requestId)
```

### Catalog.AspectOptions

Authored path: `Catalog.AspectOptions`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 53.
- Covered by [Catalog](../design/compositions/Catalog.md), line 61.

```reaction
when RequestBoundary.request (path: "/aspects/options", requestId)
then
  RequestBoundary.respond (choices: former "the shared aspect choices", requestId)
```

### Catalog.CreateAspect

Authored path: `Catalog.CreateAspect`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 29.
- Covered by [Catalog](../design/compositions/Catalog.md), line 41.

```reaction
when RequestBoundary.request (description, game, name, path: "/aspects/create", requestId, session)
then
  UserAuthenticating.current (session)
```

### Catalog.CreateAspect:game-exists#2

Authored path: `Catalog.CreateAspect`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 29.
- Covered by [Catalog](../design/compositions/Catalog.md), line 41.

```reaction
when UserAuthenticating.current (session, user), asked by Catalog.CreateAspect
where
  earlier, RequestBoundary.request (description, game, name, path: "/aspects/create", requestId, session)
  GameCatalog._get (game)
then
  GameDimensions.define (description, name, subject: game)
```

### Catalog.CreateAspect:game-exists#3

Authored path: `Catalog.CreateAspect`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 29.
- Covered by [Catalog](../design/compositions/Catalog.md), line 41.

```reaction
when GameDimensions.define (description, name, subject: game, dimension: aspect), asked by Catalog.CreateAspect:game-exists#2
where
  earlier, RequestBoundary.request (description, game, name, path: "/aspects/create", requestId, session)
then
  RequestBoundary.respond (aspect, requestId)
```

### Catalog.CreateAspect:game-missing#2

Authored path: `Catalog.CreateAspect`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 29.
- Covered by [Catalog](../design/compositions/Catalog.md), line 41.

```reaction
when UserAuthenticating.current (session, user), asked by Catalog.CreateAspect
where
  earlier, RequestBoundary.request (description, game, name, path: "/aspects/create", requestId, session)
  no GameCatalog._get (game)
then
  RequestBoundary.respond (error: "GAME_NOT_FOUND", requestId)
```

### Catalog.GameDetail:found

Authored path: `Catalog.GameDetail`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 19.
- Covered by [Catalog](../design/compositions/Catalog.md), line 26.

```reaction
when RequestBoundary.request (game, path: "/games/detail", requestId)
where
  GameCatalog._get (game)
then
  RequestBoundary.respond (page: former "the game page of (game)" with (game), requestId)
```

### Catalog.GameDetail:missing

Authored path: `Catalog.GameDetail`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 19.
- Covered by [Catalog](../design/compositions/Catalog.md), line 26.

```reaction
when RequestBoundary.request (game, path: "/games/detail", requestId)
where
  no GameCatalog._get (game)
then
  RequestBoundary.respond (error: "GAME_NOT_FOUND", requestId)
```

### Catalog.Search

Authored path: `Catalog.Search`.
- Covered by [Catalog](../design/compositions/Catalog.md), line 3.
- Covered by [Catalog](../design/compositions/Catalog.md), line 9.

```reaction
when RequestBoundary.request (path: "/games/search", query, requestId)
then
  RequestBoundary.respond (requestId, results: former "the search results for (query)" with (query))
```

### Commons.ChooseUsername:expired

Authored path: `Commons.ChooseUsername`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 20.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 27.

```reaction
when RequestBoundary.request (attempt, path: "/auth/commons/choose", requestId, username)
where
  CommonsFederating._linkable (attempt) has (linkable: false)
then
  RequestBoundary.respond (error: "SIGN_IN_EXPIRED", requestId)
```

### Commons.ChooseUsername:linkable

Authored path: `Commons.ChooseUsername`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 20.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 27.

```reaction
when RequestBoundary.request (attempt, path: "/auth/commons/choose", requestId, username)
where
  CommonsFederating._linkable (attempt) has (linkable: true)
then
  UserAuthenticating.registerExternal (username)
```

### Commons.ChooseUsername:linkable#2

Authored path: `Commons.ChooseUsername`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 20.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 27.

```reaction
when UserAuthenticating.registerExternal (username, user), asked by Commons.ChooseUsername:linkable
where
  earlier, RequestBoundary.request (attempt, path: "/auth/commons/choose", requestId, username)
then
  CommonsFederating.link (attempt, user)
```

### Commons.ChooseUsername:linkable#3

Authored path: `Commons.ChooseUsername`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 20.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 27.

```reaction
when CommonsFederating.link (attempt, user), asked by Commons.ChooseUsername:linkable#2
then
  UserAuthenticating.startSession (user)
```

### Commons.ChooseUsername:linkable#4

Authored path: `Commons.ChooseUsername`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 20.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 27.

```reaction
when UserAuthenticating.startSession (user, expiresAt, session), asked by Commons.ChooseUsername:linkable#3
where
  earlier, RequestBoundary.request (attempt, path: "/auth/commons/choose", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Commons.FinishCommons

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when RequestBoundary.request (attempt, code, path: "/auth/commons/finish", requestId, state)
then
  CommonsFederating.finish (attempt, code, nonce: state)
```

### Commons.FinishCommons:new#2

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when CommonsFederating.finish (attempt, code, nonce: state, username), asked by Commons.FinishCommons
where
  no CommonsFederating._user (attempt)
then
  UserAuthenticating.registerExternal (username)
```

### Commons.FinishCommons:new#3

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when UserAuthenticating.registerExternal (username, user), asked by Commons.FinishCommons:new#2
where
  earlier, CommonsFederating.finish (attempt, code, nonce: state, username), asked by Commons.FinishCommons
then
  CommonsFederating.link (attempt, user)
```

### Commons.FinishCommons:new#4

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when CommonsFederating.link (attempt, user), asked by Commons.FinishCommons:new#3
then
  UserAuthenticating.startSession (user)
```

### Commons.FinishCommons:new#5

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when UserAuthenticating.startSession (user, expiresAt, session), asked by Commons.FinishCommons:new#4
where
  earlier, RequestBoundary.request (attempt, code, path: "/auth/commons/finish", requestId, state)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Commons.FinishCommons:returning#2

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when CommonsFederating.finish (attempt, code, nonce: state, username), asked by Commons.FinishCommons
where
  CommonsFederating._user (attempt) has (user)
then
  UserAuthenticating.startSession (user)
```

### Commons.FinishCommons:returning#3

Authored path: `Commons.FinishCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 16.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 26.

```reaction
when UserAuthenticating.startSession (user, expiresAt, session), asked by Commons.FinishCommons:returning#2
where
  earlier, RequestBoundary.request (attempt, code, path: "/auth/commons/finish", requestId, state)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Commons.StartCommons

Authored path: `Commons.StartCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 8.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 13.

```reaction
when RequestBoundary.request (path: "/auth/commons/start", requestId)
then
  CommonsFederating.start ()
```

### Commons.StartCommons#2

Authored path: `Commons.StartCommons`.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 8.
- Covered by [Commons sign-in](../design/compositions/Commons.md), line 13.

```reaction
when CommonsFederating.start (address, attempt, expiresAt), asked by Commons.StartCommons
where
  earlier, RequestBoundary.request (path: "/auth/commons/start", requestId)
then
  RequestBoundary.respond (address, attempt, expiresAt, requestId)
```

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Discovery.ClearFilters

Authored path: `Discovery.ClearFilters`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 18.
- Covered by [Discovery](../design/compositions/Discovery.md), line 24.

```reaction
when RequestBoundary.request (path: "/discover/clear", requestId, session)
then
  UserAuthenticating.current (session)
```

### Discovery.ClearFilters#2

Authored path: `Discovery.ClearFilters`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 18.
- Covered by [Discovery](../design/compositions/Discovery.md), line 24.

```reaction
when UserAuthenticating.current (session, user), asked by Discovery.ClearFilters
then
  GameDiscovery.clearCriteria (owner: user)
```

### Discovery.ClearFilters#3

Authored path: `Discovery.ClearFilters`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 18.
- Covered by [Discovery](../design/compositions/Discovery.md), line 24.

```reaction
when GameDiscovery.clearCriteria (owner: user), asked by Discovery.ClearFilters#2
where
  earlier, RequestBoundary.request (path: "/discover/clear", requestId, session)
then
  RequestBoundary.respond (requestId, results: former "the discovery results of (owner)" with (owner: user))
```

### Discovery.RemoveFilter

Authored path: `Discovery.RemoveFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 17.
- Covered by [Discovery](../design/compositions/Discovery.md), line 23.

```reaction
when RequestBoundary.request (aspectName, path: "/discover/remove", requestId, session)
then
  UserAuthenticating.current (session)
```

### Discovery.RemoveFilter#2

Authored path: `Discovery.RemoveFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 17.
- Covered by [Discovery](../design/compositions/Discovery.md), line 23.

```reaction
when UserAuthenticating.current (session, user), asked by Discovery.RemoveFilter
where
  earlier, RequestBoundary.request (aspectName, path: "/discover/remove", requestId, session)
then
  GameDiscovery.removeCriterion (criterion: aspectName, owner: user)
```

### Discovery.RemoveFilter#3

Authored path: `Discovery.RemoveFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 17.
- Covered by [Discovery](../design/compositions/Discovery.md), line 23.

```reaction
when GameDiscovery.removeCriterion (criterion: aspectName, owner: user), asked by Discovery.RemoveFilter#2
where
  earlier, RequestBoundary.request (aspectName, path: "/discover/remove", requestId, session)
then
  RequestBoundary.respond (requestId, results: former "the discovery results of (owner)" with (owner: user))
```

### Discovery.Results

Authored path: `Discovery.Results`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 6.
- Covered by [Discovery](../design/compositions/Discovery.md), line 13.

```reaction
when RequestBoundary.request (path: "/discover/results", requestId, session)
then
  UserAuthenticating.current (session)
```

### Discovery.Results#2

Authored path: `Discovery.Results`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 6.
- Covered by [Discovery](../design/compositions/Discovery.md), line 13.

```reaction
when UserAuthenticating.current (session, user), asked by Discovery.Results
where
  earlier, RequestBoundary.request (path: "/discover/results", requestId, session)
then
  RequestBoundary.respond (requestId, results: former "the discovery results of (owner)" with (owner: user))
```

### Discovery.SetFilter

Authored path: `Discovery.SetFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 16.
- Covered by [Discovery](../design/compositions/Discovery.md), line 22.

```reaction
when RequestBoundary.request (aspectName, minScore, path: "/discover/set", requestId, session)
then
  UserAuthenticating.current (session)
```

### Discovery.SetFilter#2

Authored path: `Discovery.SetFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 16.
- Covered by [Discovery](../design/compositions/Discovery.md), line 22.

```reaction
when UserAuthenticating.current (session, user), asked by Discovery.SetFilter
where
  earlier, RequestBoundary.request (aspectName, minScore, path: "/discover/set", requestId, session)
then
  GameDiscovery.setCriterion (criterion: aspectName, minimum: minScore, owner: user)
```

### Discovery.SetFilter#3

Authored path: `Discovery.SetFilter`.
- Covered by [Discovery](../design/compositions/Discovery.md), line 16.
- Covered by [Discovery](../design/compositions/Discovery.md), line 22.

```reaction
when GameDiscovery.setCriterion (criterion: aspectName, minimum: minScore, owner: user), asked by Discovery.SetFilter#2
where
  earlier, RequestBoundary.request (aspectName, minScore, path: "/discover/set", requestId, session)
then
  RequestBoundary.respond (requestId, results: former "the discovery results of (owner)" with (owner: user))
```

### Rating.ForgetValueAfterRemoval

Authored path: `Rating.ForgetValueAfterRemoval`.
- Covered by [Rating](../design/compositions/Rating.md), line 27.

```reaction
when DimensionRatings.remove (target)
where
  GameDimensions._get (dimension: target) has (name, subject)
  DimensionRatings._summary (target) has (count: 0)
then
  GameDiscovery.forgetValue (criterion: name, item: subject)
```

### Rating.Mine

Authored path: `Rating.Mine`.
- Covered by [Rating](../design/compositions/Rating.md), line 10.
- Covered by [Rating](../design/compositions/Rating.md), line 18.

```reaction
when RequestBoundary.request (path: "/ratings/mine", requestId, session)
then
  UserAuthenticating.current (session)
```

### Rating.Mine#2

Authored path: `Rating.Mine`.
- Covered by [Rating](../design/compositions/Rating.md), line 10.
- Covered by [Rating](../design/compositions/Rating.md), line 18.

```reaction
when UserAuthenticating.current (session, user), asked by Rating.Mine
where
  earlier, RequestBoundary.request (path: "/ratings/mine", requestId, session)
then
  RequestBoundary.respond (mine: former "the ratings by (user)" with (user), requestId)
```

### Rating.Rate

Authored path: `Rating.Rate`.
- Covered by [Rating](../design/compositions/Rating.md), line 3.
- Covered by [Rating](../design/compositions/Rating.md), line 16.

```reaction
when RequestBoundary.request (aspect, microNote, path: "/ratings/rate", requestId, score, session)
then
  UserAuthenticating.current (session)
```

### Rating.Rate:aspect-exists#2

Authored path: `Rating.Rate`.
- Covered by [Rating](../design/compositions/Rating.md), line 3.
- Covered by [Rating](../design/compositions/Rating.md), line 16.

```reaction
when UserAuthenticating.current (session, user), asked by Rating.Rate
where
  earlier, RequestBoundary.request (aspect, microNote, path: "/ratings/rate", requestId, score, session)
  GameDimensions._get (dimension: aspect)
then
  DimensionRatings.rate (note: microNote, rater: user, score, target: aspect)
```

### Rating.Rate:aspect-exists#3

Authored path: `Rating.Rate`.
- Covered by [Rating](../design/compositions/Rating.md), line 3.
- Covered by [Rating](../design/compositions/Rating.md), line 16.

```reaction
when DimensionRatings.rate (note: microNote, rater: user, score, target: aspect), asked by Rating.Rate:aspect-exists#2
where
  earlier, RequestBoundary.request (aspect, microNote, path: "/ratings/rate", requestId, score, session)
then
  RequestBoundary.respond (aspect, requestId)
```

### Rating.Rate:aspect-missing#2

Authored path: `Rating.Rate`.
- Covered by [Rating](../design/compositions/Rating.md), line 3.
- Covered by [Rating](../design/compositions/Rating.md), line 16.

```reaction
when UserAuthenticating.current (session, user), asked by Rating.Rate
where
  earlier, RequestBoundary.request (aspect, microNote, path: "/ratings/rate", requestId, score, session)
  no GameDimensions._get (dimension: aspect)
then
  RequestBoundary.respond (error: "ASPECT_NOT_FOUND", requestId)
```

### Rating.RecordValueAfterRating

Authored path: `Rating.RecordValueAfterRating`.
- Covered by [Rating](../design/compositions/Rating.md), line 23.

```reaction
when DimensionRatings.rate (target)
where
  GameDimensions._get (dimension: target) has (name, subject)
  DimensionRatings._summary (target) has (average)
  no DimensionRatings._summary (target) has (count: 0)
then
  GameDiscovery.recordValue (criterion: name, item: subject, value: average)
```

### Rating.RecordValueAfterRemoval

Authored path: `Rating.RecordValueAfterRemoval`.
- Covered by [Rating](../design/compositions/Rating.md), line 24.

```reaction
when DimensionRatings.remove (target)
where
  GameDimensions._get (dimension: target) has (name, subject)
  DimensionRatings._summary (target) has (average)
  no DimensionRatings._summary (target) has (count: 0)
then
  GameDiscovery.recordValue (criterion: name, item: subject, value: average)
```

### Rating.Remove

Authored path: `Rating.Remove`.
- Covered by [Rating](../design/compositions/Rating.md), line 9.
- Covered by [Rating](../design/compositions/Rating.md), line 17.

```reaction
when RequestBoundary.request (aspect, path: "/ratings/remove", requestId, session)
then
  UserAuthenticating.current (session)
```

### Rating.Remove:aspect-exists#2

Authored path: `Rating.Remove`.
- Covered by [Rating](../design/compositions/Rating.md), line 9.
- Covered by [Rating](../design/compositions/Rating.md), line 17.

```reaction
when UserAuthenticating.current (session, user), asked by Rating.Remove
where
  earlier, RequestBoundary.request (aspect, path: "/ratings/remove", requestId, session)
  GameDimensions._get (dimension: aspect)
then
  DimensionRatings.remove (rater: user, target: aspect)
```

### Rating.Remove:aspect-exists#3

Authored path: `Rating.Remove`.
- Covered by [Rating](../design/compositions/Rating.md), line 9.
- Covered by [Rating](../design/compositions/Rating.md), line 17.

```reaction
when DimensionRatings.remove (rater: user, target: aspect), asked by Rating.Remove:aspect-exists#2
where
  earlier, RequestBoundary.request (aspect, path: "/ratings/remove", requestId, session)
then
  RequestBoundary.respond (aspect, requestId)
```

### Rating.Remove:aspect-missing#2

Authored path: `Rating.Remove`.
- Covered by [Rating](../design/compositions/Rating.md), line 9.
- Covered by [Rating](../design/compositions/Rating.md), line 17.

```reaction
when UserAuthenticating.current (session, user), asked by Rating.Remove
where
  earlier, RequestBoundary.request (aspect, path: "/ratings/remove", requestId, session)
  no GameDimensions._get (dimension: aspect)
then
  RequestBoundary.respond (error: "ASPECT_NOT_FOUND", requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/aspects/create` — requires `session`, `game`, `name`, `description`
- `/auth/commons/choose` — requires `attempt`, `username`
- `/auth/commons/finish` — requires `attempt`, `state`, `code`
- `/auth/login` — requires `username`, `password`
- `/auth/logout` — requires `session`
- `/auth/me` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/discover/clear` — requires `session`
- `/discover/remove` — requires `session`, `aspectName`
- `/discover/results` — requires `session`
- `/discover/set` — requires `session`, `aspectName`, `minScore`
- `/games/add` — requires `session`, `title`, `developer`, `releaseYear`
- `/games/detail` — requires `game`
- `/games/search` — requires `query`
- `/ratings/mine` — requires `session`
- `/ratings/rate` — requires `session`, `aspect`, `score`, `microNote`
- `/ratings/remove` — requires `session`, `aspect`
