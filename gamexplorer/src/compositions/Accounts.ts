/**
 * Accounts: registering, logging in and out, and resolving the current user.
 *
 * The HTTP boundary supplies the session from its cookie. Other compositions resolve it with
 * UserAuthenticating.current before acting, so no request chooses its own user.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { form, former, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { shape } from "./validators.ts";

const { UserAuthenticating } = concepts;

const credentials = shape({ username: "string", password: "string" });

/** Registering signs the new user in immediately by authenticating the same credentials. */
const Register = endpoint(
  "/auth/register",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password })
      .then(UserAuthenticating.register({ username, password }).responds({ user }))
      .then(UserAuthenticating.authenticate({ username, password }).responds({ user, session, expiresAt }))
      .then(respond({ session, user, expiresAt })),
  { input: { required: ["username", "password"] }, validators: { input: credentials } },
);

const Login = endpoint(
  "/auth/login",
  ({ username, password, user, session, expiresAt }) =>
    receive({ username, password })
      .then(UserAuthenticating.authenticate({ username, password }).responds({ user, session, expiresAt }))
      .then(respond({ session, user, expiresAt })),
  { input: { required: ["username", "password"] }, validators: { input: credentials } },
);

const CurrentUser = former("the current user (user)", ({ user }, { username }) =>
  where(UserAuthenticating._username({ user }).is({ username })).form({ user, username }),
);

const Me = endpoint(
  "/auth/me",
  ({ session, user }) =>
    receive({ session })
      .then(UserAuthenticating.current({ session }).responds({ user }))
      .then(respond({ me: CurrentUser({ user }) })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

const Logout = endpoint(
  "/auth/logout",
  ({ session, user }) =>
    receive({ session })
      .then(UserAuthenticating.logout({ session }).responds({ user }))
      .then(respond({ user })),
  { input: { required: ["session"] }, validators: { input: shape({ session: "string" }) } },
);

export const composition = { Register, Login, Me, Logout, CurrentUser };
