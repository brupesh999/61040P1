# Application types

Gamexplorer binds every generic concept parameter to an identity owned by another concept,
so no concept needs a concrete application type.

- A user that rates aspects or owns discovery filters is a `UserAuthenticating` user, so a
  rating can only be attributed to someone who proved their password.
- Aspects, ratings, and recorded scores all refer to `GameCatalog` games.
- A rating refers to the `AspectManaging` aspect it scores.
- `AspectFiltering` deliberately does not refer to `AspectManaging` aspects. It matches by
  aspect *name*, so a filter on "Narrative Depth" applies across every game that defines an
  aspect with that name.

```instances
instantiate UserAuthenticating

instantiate GameCatalog

instantiate AspectManaging with
  Game is GameCatalog.Game

instantiate AspectRating with
  User is UserAuthenticating.User
  Game is GameCatalog.Game
  Aspect is AspectManaging.Aspect

instantiate AspectFiltering with
  User is UserAuthenticating.User
  Game is GameCatalog.Game
```
