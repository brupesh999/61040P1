# UserAuthenticating

## Purpose

Prevent impersonation of registered accounts by recognizing accepted credentials and
issuing sessions that expire or can be ended. Local passwords and externally verified
identities are alternative credentials for this one purpose.

The concept owns users, sessions, external sign-in attempts, and subject-to-user links.
The provider is an external service adapter, not another concept. Authorization for
application content belongs in compositions.

## Principle

Mira *registers* with a username and password, then *authenticates* with those credentials
to obtain a session. While it is active, *current* identifies Mira's account. After Mira
*logs out*, that session can no longer identify her.

Alternatively, Sam *starts an external attempt* and approves it at the provider.
*Finishing* the attempt verifies that identity. *Registering* an account and *linking*
the confirmed identity let Sam *start a session*. A later verified sign-in reaches the
same account even if the provider's username changes.

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

a set of Attempts with
  a nonce String
  a verifier String
  an expiresAt DateTime

a set of Confirmed Attempts with
  a subject String

a set of Links with
  a unique subject String
  a User

Rule: an attempt, its nonce, and its verifier are unguessable. startExternal returns the attempt and its nonce only to its caller, and finishExternal refuses an attempt without its nonce. The verifier is sent only to the other site, with the code.
Rule: UserAuthenticating may delete an attempt once it has expired.

Rule: each external link refers to a user in Users.
Rule: usernames are trimmed before registration and lookup; comparison is case-sensitive. Passwords are not trimmed.
Rule: new password hashes use ConceptBox's Argon2id hashing. Existing PBKDF2 hashes are verified only for compatibility and replaced with Argon2id after successful login.
Rule: an account without a passwordHash cannot authenticate by password.
Rule: sessions expire 90 days after creation; existing sessions without an expiry no longer authorize requests.
```

## Actions

```actions
register(username: String, password: String) : returns (user: User)
  where trimmed username or password is empty
  then
    refuses EMPTY_CREDENTIALS "Username and password must not be empty."
  where trimmed username and password are non-empty and an entry in Users already has that username
  then
    refuses USERNAME_TAKEN "The requested username is already registered."
  where trimmed username and password are non-empty and no entry in Users has that username
  then
    add a new user with trimmed username and an Argon2id passwordHash containing its generated salt
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

startExternal() : returns (attempt: Attempt, expiresAt: DateTime, address: String)
  where true
  then
    add a new attempt with a fresh nonce and a fresh verifier that expires 10 minutes from now
    set address to the other site's sign-in address, carrying the nonce and a hash of the verifier
    returns attempt, expiresAt, address

finishExternal(attempt: Attempt, nonce: String, code: String) : returns (username: String)
  where attempt is initially unknown, expired, or confirmed, or nonce does not match; also refuse if the provider confirms but attempt expired or another finish confirmed it while waiting
  then
    refuses SIGN_IN_EXPIRED "This sign-in has expired. Start again."
  where the initial attempt and nonce checks passed, and the other site refuses the code with the attempt's verifier or doesn't answer
  then
    refuses SIGN_IN_REFUSED "The other site didn't confirm this sign-in. Start again."
  where nonce matches, the other site confirms the code for its user subject whose username is username, and attempt is still unconfirmed and unexpired
  then
    add attempt to Confirmed Attempts with subject
    returns username

linkExternal(attempt: Attempt, user: User) : returns (user: User)
  where attempt is not in Confirmed Attempts or has expired
  then
    refuses NOT_CONFIRMED "This sign-in hasn't been confirmed."
  where user is not in Users
  then
    refuses UNKNOWN_USER "This user could not be found."
  where a link has the attempt's subject
  then
    refuses ALREADY_LINKED "This account on the other site is already linked."
  where attempt is confirmed and unexpired, user is in Users, and no link has its subject
  then
    add a new link with the attempt's subject and user
    returns user

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
_externalUser(attempt: Attempt) : optional (user: User)
  Returns the user linked to a confirmed attempt's subject, or no row when the attempt is unconfirmed or its subject is unlinked.

_externalLinkable(attempt: Attempt) : one (linkable: Flag)
  Returns true when the attempt is confirmed, unexpired, and its subject unlinked, and false otherwise.

_getUser(username: String) : optional (user: User)
  Answers the user registered with username, and no row for an unknown username.

_username(user: User) : optional (username: String)
  Answers the username of user, and no row for an unknown user.
```
