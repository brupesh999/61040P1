# UserAuthenticating

## Purpose

Identify users and prevent unauthorized access to user accounts, so that every rating and
filter is attributed to an authenticated user. Authentication can come from a local
password or an external identity confirmed by a composition.

Accounts may also have no local password. Compositions can register such a user and
start their session after an independent identity provider has confirmed them. This
concept never calls or reads Federating. Existing password accounts keep their identities.

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
  an optional salt String
  an optional passwordHash String

a set of Sessions with
  a user User
  an expiresAt DateTime

Rule: new password hashes use ConceptBox's Argon2id hashing. Existing PBKDF2 hashes are verified only for compatibility and replaced with Argon2id after successful login.
Rule: an account without a passwordHash cannot authenticate by password.
Rule: sessions expire 90 days after creation; existing sessions without an expiry no longer authorize requests.
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
    add a new user with username and an Argon2id passwordHash containing its generated salt
    returns user

authenticate(username: String, password: String) : returns (user: User, session: Session, expiresAt: DateTime)
  where no user in Users has username, or password does not match that user's hash
  then
    refuses INVALID_CREDENTIALS "Invalid username or password."
  where a user in Users has username and password matches that user's hash
  then
    add a new unguessable session for that user, expiring 90 days from now
    upgrade a legacy password hash to Argon2id after verifying it
    returns user, session, expiresAt

registerExternal(username: String) : returns (user: User)
  where trimmed username does not have 3 to 32 letters, digits, underscores, or hyphens
  then
    refuses INVALID_USERNAME "A username must have 3 to 32 letters, digits, underscores, or hyphens."
  where an entry in Users already has the trimmed username
  then
    refuses USERNAME_TAKEN "The requested username is already registered."
  where trimmed username is valid and unused
  then
    add a new user with that username and no password
    returns user

startSession(user: User) : returns (user: User, session: Session, expiresAt: DateTime)
  where user is not in Users
  then
    refuses UNKNOWN_USER "This user could not be found."
  where user is in Users
  then
    add a new unguessable session for user, expiring 90 days from now
    returns user, session, expiresAt

current(session: Session) : returns (user: User)
  where session is not in Sessions, has no expiry, or has expired
  then
    refuses UNKNOWN_SESSION "You must be signed in to do that."
  where session is in Sessions and has not expired
  then
    bind user to the session's user
    returns user

logout(session: Session) : returns (user: User)
  where session is not in Sessions, has no expiry, or has expired
  then
    refuses UNKNOWN_SESSION "You must be signed in to do that."
  where session is in Sessions and has not expired
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
