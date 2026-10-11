# UserAuthenticating

## Purpose

Identify users and prevent unauthorized access to user accounts, so that every rating and
filter is attributed to the person who proved their password rather than to whoever claims
a name.

## Principle

Mira registers username `mira` with a password. A second registration of `mira` is
refused. Authenticating `mira` with the wrong password is refused; authenticating with the
exact credentials returns Mira's user together with a fresh session. While that session is
active, `current` resolves it to Mira's user. After Mira logs out, `current` refuses the
session because it is no longer active.

## Types

```types
```

## State

```state
a set of Users with
  a unique username String
  a salt String
  a passwordHash String

a set of Sessions with
  a user User
```

## Actions

```actions
register(username: String, password: String) : returns (user: User)
  where username or password is empty
  then
    refuses EMPTY_CREDENTIALS "Username and password must not be empty."
  where an entry in Users already has username equal to username
  then
    refuses USERNAME_TAKEN "The requested username is already registered."
  where username and password are non-empty and no entry in Users has username equal to username
  then
    add a new user with username, a fresh salt, and a hash of password with that salt
    returns user

authenticate(username: String, password: String) : returns (user: User, session: Session)
  where no user in Users has username, or password does not match that user's hash
  then
    refuses INVALID_CREDENTIALS "Invalid username or password."
  where a user in Users has username and password matches that user's hash
  then
    add a new session for that user
    returns user, session

current(session: Session) : returns (user: User)
  where session is not in Sessions
  then
    refuses UNKNOWN_SESSION "You must be signed in to do that."
  where session is in Sessions
  then
    bind user to the session's user
    returns user

logout(session: Session) : returns (user: User)
  where session is not in Sessions
  then
    refuses UNKNOWN_SESSION "You must be signed in to do that."
  where session is in Sessions
  then
    bind user to the session's user
    remove session
    returns user
```

## Queries

```queries
_getUser(username: String) : optional (user: User)
  Answers the user registered with username, and no row for an unknown username.

_username(user: User) : optional (username: String)
  Answers the username of user, and no row for an unknown user.
```
