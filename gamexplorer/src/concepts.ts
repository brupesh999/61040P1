import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import userAuthenticatingSpec from "@design/concepts/UserAuthenticating.md" with { type: "text" };
import gameCatalogSpec from "@design/concepts/GameCatalog.md" with { type: "text" };
import dimensionSpec from "@design/concepts/DimensionDefining.md" with { type: "text" };
import ratingSpec from "@design/concepts/Rating.md" with { type: "text" };
import filteringSpec from "@design/concepts/ThresholdFiltering.md" with { type: "text" };
import {
  EmptyCredentials,
  InvalidCredentials,
  UnknownSession,
  UserAuthenticatingConcept,
  UsernameTaken,
  InvalidUsername,
  UnknownUser,
  SignInExpired, SignInRefused, NotConfirmed, AlreadyLinked,
} from "./concepts/UserAuthenticating.ts";
import { GameCatalogConcept, GameExists, InvalidGame, InvalidCover, GameNotFound, InvalidSteamGame, SteamGameExists, SteamUnavailable } from "./concepts/GameCatalog.ts";
import { DimensionExists, DimensionDefiningConcept, EmptyDimensionName } from "./concepts/DimensionDefining.ts";
import {
  RatingConcept,
  InvalidScore,
  NoteTooLong,
  RatingNotFound,
} from "./concepts/Rating.ts";
import { ThresholdFilteringConcept, EmptyCriterion, InvalidValue, InvalidMinimum, CriterionNotFound } from "./concepts/ThresholdFiltering.ts";

const userAuthenticating = registerConcept({
  class: UserAuthenticatingConcept,
  spec: userAuthenticatingSpec,
  refusals: {
    EMPTY_CREDENTIALS: EmptyCredentials,
    USERNAME_TAKEN: UsernameTaken,
    INVALID_CREDENTIALS: InvalidCredentials,
    UNKNOWN_SESSION: UnknownSession,
    INVALID_USERNAME: InvalidUsername,
    UNKNOWN_USER: UnknownUser,
    SIGN_IN_EXPIRED: SignInExpired, SIGN_IN_REFUSED: SignInRefused, NOT_CONFIRMED: NotConfirmed, ALREADY_LINKED: AlreadyLinked,
  },
});

const gameCatalog = registerConcept({
  class: GameCatalogConcept,
  spec: gameCatalogSpec,
  refusals: { INVALID_GAME: InvalidGame, GAME_EXISTS: GameExists, INVALID_COVER: InvalidCover, GAME_NOT_FOUND: GameNotFound,
    INVALID_STEAM_GAME: InvalidSteamGame, STEAM_GAME_EXISTS: SteamGameExists, STEAM_UNAVAILABLE: SteamUnavailable },
});

class GameDimensions extends DimensionDefiningConcept<string> {}
const dimensions = registerConcept({
  class: GameDimensions,
  spec: dimensionSpec,
  refusals: { EMPTY_DIMENSION_NAME: EmptyDimensionName, DIMENSION_EXISTS: DimensionExists },
});

class DimensionRatings extends RatingConcept<string, string> {}
const ratings = registerConcept({
  class: DimensionRatings,
  spec: ratingSpec,
  refusals: { INVALID_SCORE: InvalidScore, NOTE_TOO_LONG: NoteTooLong, RATING_NOT_FOUND: RatingNotFound },
});

class GameDiscovery extends ThresholdFilteringConcept<string, string> {}
const filtering = registerConcept({
  class: GameDiscovery,
  spec: filteringSpec,
  refusals: { EMPTY_CRITERION: EmptyCriterion, INVALID_VALUE: InvalidValue,
    INVALID_MINIMUM: InvalidMinimum, CRITERION_NOT_FOUND: CriterionNotFound },
});

export const applicationConceptSet = conceptSet({
  UserAuthenticating: userAuthenticating,
  GameCatalog: gameCatalog,
  GameDimensions: dimensions,
  DimensionRatings: ratings,
  GameDiscovery: filtering,
});
export const { concepts } = applicationConceptSet;
