/**
 * Discovery: a signed-in user's aspect-threshold filters and the games that match them.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating, GameCatalog, GameDiscovery, GameDimensions, DimensionRatings } = concepts;

const SteamCover = former("the discovery cover of (game)", ({ game }, { steamAppId, coverUrl }) =>
  where(GameCatalog._steamCover({ game }).is({ steamAppId, coverUrl })).form({ steamAppId, coverUrl }),
);

const GameInfo = former("the catalog entry of (game)", ({ game }, { title, developer, releaseYear }) =>
  where(GameCatalog._get({ game }).is({ title, developer, releaseYear })).form({
    title,
    developer,
    releaseYear,
    cover: SteamCover({ game }),
  }),
).optional();

const MatchedScore = former(
  "the score of (game) on (aspectName)",
  ({ game, aspectName }, { target, average, count }) =>
    where(
      GameDimensions._named({ subject: game, name: aspectName }).is({ dimension: target }),
      DimensionRatings._summary({ target }).is({ average, count }),
    ).form({ average, count }),
).optional();

/** The owner's filters, the aspect names available to filter on, and every matching game. */
const DiscoveryResults = former(
  "the discovery results of (owner)",
  ({ owner }, { aspectName, minScore, available, game, filtered }) =>
    form({
      filters: each(GameDiscovery._criteria({ owner }).is({ criterion: aspectName, minimum: minScore })).form({
        aspectName,
        minScore,
      }),
      aspectNames: each(GameDiscovery._criterionNames({}).is({ criterion: available })).form({
        aspectName: available,
      }),
      matches: each(GameDiscovery._matches({ owner }).is({ item: game })).form({
        game,
        info: GameInfo({ game }),
        scores: each(GameDiscovery._criteria({ owner }).is({ criterion: filtered })).form({
          aspectName: filtered,
          score: MatchedScore({ game, aspectName: filtered }),
        }),
      }),
    }),
);

const Results = endpoint(
  "/discover/results",
  ({ session, user }) =>
    receive({ session })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(respond({ results: DiscoveryResults({ owner: user }) })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

const SetFilter = endpoint(
  "/discover/set",
  ({ session, user, aspectName, minScore }) =>
    receive({ session, aspectName, minScore })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(GameDiscovery.setCriterion({ owner: user, criterion: aspectName, minimum: minScore }).responds({}))
      .then(respond({ results: DiscoveryResults({ owner: user }) })),
  {
    input: { required: ["session", "aspectName", "minScore"] },
    validators: { input: shape({ session: "string", aspectName: "string", minScore: "number" }, { minScore: { min: 1, max: 10 } }) },
  },
);

const RemoveFilter = endpoint(
  "/discover/remove",
  ({ session, user, aspectName }) =>
    receive({ session, aspectName })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(GameDiscovery.removeCriterion({ owner: user, criterion: aspectName }).responds({}))
      .then(respond({ results: DiscoveryResults({ owner: user }) })),
  {
    input: { required: ["session", "aspectName"] },
    validators: { input: shape({ session: "string", aspectName: "string" }) },
  },
);

const ClearFilters = endpoint(
  "/discover/clear",
  ({ session, user }) =>
    receive({ session })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(GameDiscovery.clearCriteria({ owner: user }).responds({}))
      .then(respond({ results: DiscoveryResults({ owner: user }) })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

export const composition = {
  SteamCover,
  Results,
  SetFilter,
  RemoveFilter,
  ClearFilters,
  DiscoveryResults,
  GameInfo,
  MatchedScore,
};
