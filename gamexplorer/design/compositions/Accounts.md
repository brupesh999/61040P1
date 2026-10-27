# Accounts

Gamexplorer identifies people through `UserAuthenticating`. Protected content endpoints
resolve the cookie's session with `UserAuthenticating.current` before reading personal
data or changing state. That identity determines rating authorship and filter ownership;
catalog contributions require sign-in but remain publicly visible. An unknown or
logged-out session is refused with `UNKNOWN_SESSION` before the content action runs.

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
