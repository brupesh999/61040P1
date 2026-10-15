import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import userAuthenticatingSpec from "@design/concepts/UserAuthenticating.md" with { type: "text" };
import gameCatalogSpec from "@design/concepts/GameCatalog.md" with { type: "text" };
import aspectManagingSpec from "@design/concepts/AspectManaging.md" with { type: "text" };
import aspectRatingSpec from "@design/concepts/AspectRating.md" with { type: "text" };
import aspectFilteringSpec from "@design/concepts/AspectFiltering.md" with { type: "text" };
import {
  EmptyCredentials,
  InvalidCredentials,
  UnknownSession,
  UserAuthenticatingConcept,
  UsernameTaken,
  InvalidUsername,
  UnknownUser,
} from "./concepts/UserAuthenticating.ts";
import federatingSpec from "@design/concepts/Federating.md" with { type: "text" };
import { FederatingConcept, AlreadyLinked, NotConfirmed, SignInExpired, SignInRefused } from "./concepts/Federating/Federating.ts";
import { GameCatalogConcept, GameExists, InvalidGame, InvalidCover, GameNotFound } from "./concepts/GameCatalog.ts";
import { AspectExists, AspectManagingConcept, EmptyAspectName } from "./concepts/AspectManaging.ts";
import {
  AspectRatingConcept,
  InvalidScore,
  NoteTooLong,
  RatingNotFound,
} from "./concepts/AspectRating.ts";
import {
  AspectFilteringConcept,
  EmptyFilterAspect,
  FilterNotFound,
  InvalidThreshold,
} from "./concepts/AspectFiltering.ts";

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
  },
});

class CommonsFederating extends FederatingConcept<string> {}
const commonsFederating = registerConcept({
  class: CommonsFederating,
  spec: federatingSpec,
  refusals: { SIGN_IN_EXPIRED: SignInExpired, SIGN_IN_REFUSED: SignInRefused, NOT_CONFIRMED: NotConfirmed, ALREADY_LINKED: AlreadyLinked },
});

const gameCatalog = registerConcept({
  class: GameCatalogConcept,
  spec: gameCatalogSpec,
  refusals: { INVALID_GAME: InvalidGame, GAME_EXISTS: GameExists, INVALID_COVER: InvalidCover, GAME_NOT_FOUND: GameNotFound },
});

const aspectManaging = registerConcept({
  class: AspectManagingConcept,
  spec: aspectManagingSpec,
  refusals: { EMPTY_ASPECT_NAME: EmptyAspectName, ASPECT_EXISTS: AspectExists },
});

const aspectRating = registerConcept({
  class: AspectRatingConcept,
  spec: aspectRatingSpec,
  refusals: {
    INVALID_SCORE: InvalidScore,
    NOTE_TOO_LONG: NoteTooLong,
    RATING_NOT_FOUND: RatingNotFound,
  },
});

const aspectFiltering = registerConcept({
  class: AspectFilteringConcept,
  spec: aspectFilteringSpec,
  refusals: {
    EMPTY_FILTER_ASPECT: EmptyFilterAspect,
    INVALID_THRESHOLD: InvalidThreshold,
    FILTER_NOT_FOUND: FilterNotFound,
  },
});

export const applicationConceptSet = conceptSet({
  UserAuthenticating: userAuthenticating,
  CommonsFederating: commonsFederating,
  GameCatalog: gameCatalog,
  AspectManaging: aspectManaging,
  AspectRating: aspectRating,
  AspectFiltering: aspectFiltering,
});
export const { concepts } = applicationConceptSet;
