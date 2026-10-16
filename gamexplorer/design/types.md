# Application types

Gamexplorer instantiates three reusable mechanisms. Their definitions contain no game or
aspect dependencies. The application gives their opaque identities these specific meanings:

- DimensionDefining's Subject is a GameCatalog game. Its Dimension is the application's aspect.
- Rating's Rater is an authenticated user; its Target is one defined Dimension. Rating itself
  does not know that target has a name or belongs to a game. Compositions obtain those facts.
- ThresholdFiltering's Item is a game and its Owner is a user. A criterion name is a string
  value, not a Dimension identity: matching the name across games is an application decision.
- CommonsFederating links a Commons subject to the same local user identity used by ratings
  and filter ownership. No identity object carries properties from another concept.

The application also supplies the same immutable string naming policy to GameDimensions
and GameDiscovery: preset spellings are canonical, and Combat Depth resolves to Combat.
Preset choices do not create a dimension on a game or any ratings. Custom names defined
for one game become suggestions elsewhere. Neither concept reads another's vocabulary.

```instances
instantiate UserAuthenticating

instantiate Federating as CommonsFederating with
  User is UserAuthenticating.User

instantiate GameCatalog

instantiate DimensionDefining as GameDimensions with
  Subject is GameCatalog.Game

instantiate Rating as DimensionRatings with
  Rater is UserAuthenticating.User
  Target is GameDimensions.Dimension

instantiate ThresholdFiltering as GameDiscovery with
  Owner is UserAuthenticating.User
  Item is GameCatalog.Game
```
