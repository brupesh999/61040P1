import type { HttpCookieBinding } from "@mit-sdg/sync-engine-http/policy";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating } = concepts;

const StartCommons = endpoint(
  "/auth/commons/start",
  ({ attempt, expiresAt, address }) =>
    receive({})
      .then(UserAuthenticating.startExternal({}).responds({ attempt, expiresAt, address }))
      .then(respond({ attempt, expiresAt, address })),
  { validators: { input: shape({}) } },
);

const FinishCommons = endpoint(
  "/auth/commons/finish",
  ({ attempt, state, code, username, user, session, expiresAt }) =>
    receive({ attempt, state, code })
      .then(UserAuthenticating.finishExternal({ attempt, nonce: state, code }).responds({ username }))
      .then(
        where(UserAuthenticating._externalUser({ attempt }).is({ user }))
          .then(UserAuthenticating.startSession({ user }).responds({ session, expiresAt }))
          .then(respond({ user, session, expiresAt }))
          .named("returning"),
        where(no(UserAuthenticating._externalUser({ attempt })))
          .then(UserAuthenticating.registerExternal({ username }).responds({ user }))
          .then(UserAuthenticating.linkExternal({ attempt, user }).responds({}))
          .then(UserAuthenticating.startSession({ user }).responds({ session, expiresAt }))
          .then(respond({ user, session, expiresAt }))
          .named("new"),
      ),
  { input: { required: ["attempt", "state", "code"] }, validators: { input: shape({ attempt: "string", state: "string", code: "string" }) } },
);

const ChooseUsername = endpoint(
  "/auth/commons/choose",
  ({ attempt, username, user, session, expiresAt }) =>
    receive({ attempt, username }).then(
      where(UserAuthenticating._externalLinkable({ attempt }).is({ linkable: true }))
        .then(UserAuthenticating.registerExternal({ username }).responds({ user }))
        .then(UserAuthenticating.linkExternal({ attempt, user }).responds({}))
        .then(UserAuthenticating.startSession({ user }).responds({ session, expiresAt }))
        .then(respond({ user, session, expiresAt }))
        .named("linkable"),
      where(UserAuthenticating._externalLinkable({ attempt }).is({ linkable: false }))
        .then(respond({ error: "SIGN_IN_EXPIRED" }))
        .named("expired"),
    ),
  { input: { required: ["attempt", "username"] }, validators: { input: shape({ attempt: "string", username: "string" }) } },
);

/**
 * The HTTP settings for these endpoints: the category for each refusal, the endpoints that
 * start a session, and the sign-in cookie, which holds the attempt. Every external sign-in refusal from UserAuthenticating
 * is FORBIDDEN, which, unlike UNAUTHORIZED, leaves the sign-in cookie in place.
 */
export const commonsHttp = {
  publicErrors: {
    SIGN_IN_EXPIRED: "FORBIDDEN",
    SIGN_IN_REFUSED: "FORBIDDEN",
    NOT_CONFIRMED: "FORBIDDEN",
    ALREADY_LINKED: "FORBIDDEN",
  },
  startingSessions: ["/auth/commons/finish", "/auth/commons/choose"],
  signInCookie: (name: string): HttpCookieBinding => ({
    name,
    input: "attempt",
    issue: [{ path: "/auth/commons/start", value: "attempt", expires: "expiresAt" }],
    clear: ["/auth/commons/finish", "/auth/commons/choose"],
  }),
} as const;

export const composition = { StartCommons, FinishCommons, ChooseUsername };
