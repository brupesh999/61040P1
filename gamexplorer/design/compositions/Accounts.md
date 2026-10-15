# Accounts

Gamexplorer identifies people through `UserAuthenticating`. Every endpoint that changes
state on someone's behalf resolves the presented session with `UserAuthenticating.current`
first, so a caller can never choose which user a rating, game, or filter belongs to. An
unknown or logged-out session is refused with `UNKNOWN_SESSION` and nothing changes.

[Registering](reaction:Accounts.Register) creates the account and immediately authenticates
with the same credentials, so a new user is signed in without a second step.
[Logging in](reaction:Accounts.Login) proves existing credentials and starts a new session.

```endpoints
Accounts.Register at /auth/register
Accounts.Login at /auth/login
```

The HTTP boundary keeps the session in an HttpOnly cookie and supplies it to the
existing compositions. The frontend asks who it belongs to with
[the current user](reaction:Accounts.Me). [Logging out](reaction:Accounts.Logout) ends the
session, after which it no longer authorizes anything.

```endpoints
Accounts.Me at /auth/me
Accounts.Logout at /auth/logout
```

The current user is shown with [their username](former:Accounts.CurrentUser).
Register and Login return the session expiry to the HTTP boundary, which removes
the credential and expiry from JSON responses. Body-supplied session values never
override cookies. Browser requests using credentials must match PUBLIC_ORIGIN.
