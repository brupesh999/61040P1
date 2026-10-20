/**
 * Catalog: searching games, adding games, opening a game's page, and creating aspects.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating, GameCatalog, GameDimensions, DimensionRatings } = concepts;

const SteamCover = former("the Steam cover of (game)", ({ game }, { steamAppId, coverUrl }) =>
  where(GameCatalog._steamCover({ game }).is({ steamAppId, coverUrl })).form({ steamAppId, coverUrl }),
);

const SearchResults = former(
  "the search results for (query)",
  ({ query }, { game, title, developer, releaseYear }) =>
    form({
      games: each(GameCatalog._searchGames({ query }).is({ game, title, developer, releaseYear })).form({
        game,
        title,
        developer,
        releaseYear,
        cover: SteamCover({ game }),
      }),
    }),
);

const AspectChoices = former("the shared aspect choices", (_, { name, description, aliases }) =>
  form({ options: each(GameDimensions._names({}).is({ name, description, aliases })).form({ name, description, aliases }) }),
);
const AspectOptions = endpoint("/aspects/options", () =>
  receive({}).then(respond({ choices: AspectChoices({}) })),
);

const Search = endpoint(
  "/games/search",
  ({ query }) => receive({ query }).then(respond({ results: SearchResults({ query }) })),
  { input: { required: ["query"] }, validators: { input: shape({ query: "string" }) } },
);

const ExistingSteamGame = former("the existing game for Steam app (steamAppId)", ({ steamAppId }, { game }) =>
  where(GameCatalog._fromSteam({ steamAppId }).is({ game })).form({ game }),
);

const SteamResults = former("the Steam results for (query)",
  ({ query }, { steamAppId, title, developer, releaseYear, coverUrl }) => form({
    games: each(GameCatalog._searchSteam({ query }).is({ steamAppId, title, developer, releaseYear, coverUrl })).form({
      steamAppId, title, developer, releaseYear, coverUrl, existing: ExistingSteamGame({ steamAppId }),
    }),
  }),
);

const SearchSteam = endpoint("/games/steam/search", ({ session, user, query }) =>
  receive({ session, query })
    .then(UserAuthenticating.current({ session }).responds({ user }))
    .then(respond({ results: SteamResults({ query }) })),
  { input: { required: ["session", "query"] }, validators: { input: value => {
    const checked = shape({ session: "string", query: "string" })(value);
    if (!checked.ok) return checked;
    const length = (value as { query: string }).query.trim().length;
    return length >= 2 && length <= 100 ? { ok: true } : { ok: false, detail: "Enter 2–100 characters to search Steam." };
  } } },
);

const AddGame = endpoint(
  "/games/add",
  ({ session, user, steamAppId, game }) =>
    receive({ session, steamAppId })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(GameCatalog.addSteamGame({ steamAppId }).responds({ game }))
      .then(respond({ game })),
  {
    input: { required: ["session", "steamAppId"] },
    validators: {
      input: shape({ session: "string", steamAppId: "number" }),
    },
  },
);

const AspectSummary = former("the summary of (aspect)", ({ aspect }, { average, count }) =>
  where(DimensionRatings._summary({ target: aspect }).is({ average, count })).form({ average, count }),
);

const ReviewerName = former("the reviewer name of (user)", ({ user }, { username }) =>
  where(UserAuthenticating._username({ user }).is({ username })).form({ username }),
).optional();

/** A game's metadata, each of its aspects with their summary, and every reviewer's note. */
const GamePage = former(
  "the game page of (game)",
  ({ game }, { title, developer, releaseYear, aspect, name, description, user, score, microNote }) =>
    where(GameCatalog._get({ game }).is({ title, developer, releaseYear })).form({
      game,
      title,
      developer,
      releaseYear,
      cover: SteamCover({ game }),
      aspects: each(GameDimensions._forSubject({ subject: game }).is({ dimension: aspect, name, description })).form({
        aspect,
        name,
        description,
        summary: AspectSummary({ aspect }),
        ratings: each(DimensionRatings._forTarget({ target: aspect }).is({ rater: user, score, note: microNote })).form({
          user,
          score,
          microNote,
          reviewer: ReviewerName({ user }),
        }),
      }),
    }),
);

/** Looking up a game that does not exist answers GAME_NOT_FOUND rather than nothing. */
const GameDetail = endpoint(
  "/games/detail",
  ({ game }) =>
    receive({ game }).then(
      where(GameCatalog._get({ game }))
        .then(respond({ page: GamePage({ game }) }))
        .named("found"),
      where(no(GameCatalog._get({ game })))
        .then(respond({ error: "GAME_NOT_FOUND" }))
        .named("missing"),
    ),
  { input: { required: ["game"] }, validators: { input: shape({ game: "string" }) } },
);

/**
 * GameDimensions accepts any game identity by design. Requiring the game to exist in the
 * catalog is this application's decision, so it is a sibling split here.
 */
const CreateAspect = endpoint(
  "/aspects/create",
  ({ session, user, game, name, description, aspect }) =>
    receive({ session, game, name, description })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(
        where(GameCatalog._get({ game }))
          .then(GameDimensions.define({ subject: game, name, description }).responds({ dimension: aspect }))
          .then(respond({ aspect }))
          .named("game-exists"),
        where(no(GameCatalog._get({ game })))
          .then(respond({ error: "GAME_NOT_FOUND" }))
          .named("game-missing"),
      ),
  {
    input: { required: ["session", "game", "name", "description"] },
    validators: {
      input: shape({ session: "string", game: "string", name: "string", description: "string" }),
    },
  },
);

export const composition = {
  SteamCover,
  AspectChoices,
  AspectOptions,
  Search,
  SearchResults,
  ExistingSteamGame,
  SteamResults,
  SearchSteam,
  AddGame,
  GameDetail,
  GamePage,
  AspectSummary,
  ReviewerName,
  CreateAspect,
};
