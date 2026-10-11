/**
 * Rating: rating and un-rating one aspect, listing a user's own ratings, and keeping
 * AspectFiltering's aggregate scores in step with AspectRating.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating, GameCatalog, AspectManaging, AspectRating, AspectFiltering } = concepts;

/** The client names only the aspect; its game comes from AspectManaging, never the request. */
const Rate = endpoint(
  "/ratings/rate",
  ({ session, user, aspect, game, score, microNote }) =>
    receive({ session, aspect, score, microNote })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(
        where(AspectManaging._get({ aspect }).is({ game }))
          .then(AspectRating.rateAspect({ user, game, aspect, score, microNote }).responds({}))
          .then(respond({ aspect, game }))
          .named("aspect-exists"),
        where(no(AspectManaging._get({ aspect })))
          .then(respond({ error: "ASPECT_NOT_FOUND" }))
          .named("aspect-missing"),
      ),
  {
    input: { required: ["session", "aspect", "score", "microNote"] },
    validators: {
      input: shape({ session: "string", aspect: "string", score: "number", microNote: "string" }),
    },
  },
);

const Remove = endpoint(
  "/ratings/remove",
  ({ session, user, aspect, game }) =>
    receive({ session, aspect })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(
        where(AspectManaging._get({ aspect }).is({ game }))
          .then(AspectRating.removeRating({ user, game, aspect }).responds({}))
          .then(respond({ aspect, game }))
          .named("aspect-exists"),
        where(no(AspectManaging._get({ aspect })))
          .then(respond({ error: "ASPECT_NOT_FOUND" }))
          .named("aspect-missing"),
      ),
  {
    input: { required: ["session", "aspect"] },
    validators: { input: shape({ session: "string", aspect: "string" }) },
  },
);

const GameTitle = former("the title of (game)", ({ game }, { title }) =>
  where(GameCatalog._get({ game }).is({ title })).form({ title }),
).optional();

const AspectName = former("the name of (aspect)", ({ aspect }, { name }) =>
  where(AspectManaging._get({ aspect }).is({ name })).form({ name }),
).optional();

const MyRatings = former(
  "the ratings by (user)",
  ({ user }, { game, aspect, score, microNote }) =>
    form({
      ratings: each(AspectRating._getUserRatings({ user }).is({ game, aspect, score, microNote })).form({
        game,
        aspect,
        score,
        microNote,
        gameInfo: GameTitle({ game }),
        aspectInfo: AspectName({ aspect }),
      }),
    }),
);

const Mine = endpoint(
  "/ratings/mine",
  ({ session, user }) =>
    receive({ session })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(respond({ mine: MyRatings({ user }) })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

/**
 * Replaces P1's `_matchGames(ratings: AspectRating.Ratings)`, which reached into another
 * concept's state. After any rating changes, the new summary is pushed into AspectFiltering
 * under the aspect's *name*, so filters match across games that share a dimension name.
 */
const RecordScoreAfterRating = reaction(({ game, aspect, name, average, count }) =>
  when(AspectRating.rateAspect({ game, aspect }).responds({}))
    .where(
      AspectManaging._get({ aspect }).is({ name }),
      AspectRating._summary({ aspect }).is({ average, count }),
    )
    .then(AspectFiltering.recordScore({ game, aspectName: name, average, count })),
);

const RecordScoreAfterRemoval = reaction(({ game, aspect, name, average, count }) =>
  when(AspectRating.removeRating({ game, aspect }).responds({}))
    .where(
      AspectManaging._get({ aspect }).is({ name }),
      AspectRating._summary({ aspect }).is({ average, count }),
    )
    .then(AspectFiltering.recordScore({ game, aspectName: name, average, count })),
);

export const composition = {
  Rate,
  Remove,
  Mine,
  MyRatings,
  GameTitle,
  AspectName,
  RecordScoreAfterRating,
  RecordScoreAfterRemoval,
};
