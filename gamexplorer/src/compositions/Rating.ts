/** Rating opaque dimension identities and projecting their averages into discovery. */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating, GameCatalog, GameDimensions, DimensionRatings, GameDiscovery } = concepts;

const Rate = endpoint("/ratings/rate", ({ session, user, aspect, score, microNote }) =>
  receive({ session, aspect, score, microNote })
    .then(UserAuthenticating.current({ session }).responds({ user }))
    .then(
      where(GameDimensions._get({ dimension: aspect }))
        .then(DimensionRatings.rate({ rater: user, target: aspect, score, note: microNote }).responds({}))
        .then(respond({ aspect })).named("aspect-exists"),
      where(no(GameDimensions._get({ dimension: aspect })))
        .then(respond({ error: "ASPECT_NOT_FOUND" })).named("aspect-missing"),
    ),
  { input: { required: ["session", "aspect", "score", "microNote"] },
    validators: { input: shape({ session: "string", aspect: "string", score: "number", microNote: "string" }) } },
);

const Remove = endpoint("/ratings/remove", ({ session, user, aspect }) =>
  receive({ session, aspect })
    .then(UserAuthenticating.current({ session }).responds({ user }))
    .then(
      where(GameDimensions._get({ dimension: aspect }))
        .then(DimensionRatings.remove({ rater: user, target: aspect }).responds({}))
        .then(respond({ aspect })).named("aspect-exists"),
      where(no(GameDimensions._get({ dimension: aspect })))
        .then(respond({ error: "ASPECT_NOT_FOUND" })).named("aspect-missing"),
    ),
  { input: { required: ["session", "aspect"] }, validators: { input: shape({ session: "string", aspect: "string" }) } },
);

const GameTitle = former("the title of (game)", ({ game }, { title }) =>
  where(GameCatalog._get({ game }).is({ title })).form({ title }),
).optional();

const MyRatings = former("the ratings by (user)", ({ user }, { game, aspect, name, score, microNote }) =>
  form({
    ratings: each(DimensionRatings._byRater({ rater: user }).is({ target: aspect, score, note: microNote }))
      .where(GameDimensions._get({ dimension: aspect }).is({ subject: game, name }))
      .form({ game, aspect, score, microNote, gameInfo: GameTitle({ game }), aspectInfo: form({ name }) }),
  }),
);

const Mine = endpoint("/ratings/mine", ({ session, user }) =>
  receive({ session }).then(UserAuthenticating.current({ session }).responds({ user }))
    .then(respond({ mine: MyRatings({ user }) })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

// Each rule is a single independent linkage. Reads condition the rule; only actions follow then.
const RecordValueAfterRating = reaction(({ target, subject, name, average }) =>
  when(DimensionRatings.rate({ target }).responds({}))
    .where(
      GameDimensions._get({ dimension: target }).is({ subject, name }),
      DimensionRatings._summary({ target }).is({ average }),
      no(DimensionRatings._summary({ target }).is({ count: 0 })),
    )
    .then(GameDiscovery.recordValue({ item: subject, criterion: name, value: average })),
);

const RecordValueAfterRemoval = reaction(({ target, subject, name, average }) =>
  when(DimensionRatings.remove({ target }).responds({}))
    .where(
      GameDimensions._get({ dimension: target }).is({ subject, name }),
      DimensionRatings._summary({ target }).is({ average }),
      no(DimensionRatings._summary({ target }).is({ count: 0 })),
    )
    .then(GameDiscovery.recordValue({ item: subject, criterion: name, value: average })),
);

const ForgetValueAfterRemoval = reaction(({ target, subject, name }) =>
  when(DimensionRatings.remove({ target }).responds({}))
    .where(
      GameDimensions._get({ dimension: target }).is({ subject, name }),
      DimensionRatings._summary({ target }).is({ count: 0 }),
    )
    .then(GameDiscovery.forgetValue({ item: subject, criterion: name })),
);

export const composition = { Rate, Remove, Mine, MyRatings, GameTitle,
  RecordValueAfterRating, RecordValueAfterRemoval, ForgetValueAfterRemoval };
