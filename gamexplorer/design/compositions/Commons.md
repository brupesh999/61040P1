# Commons sign-in

This adapts ConceptBox's Commons protocol to UserAuthenticating. That single concept
owns accounts, sessions, attempts, and verified subject links. This composition exposes
the browser flow and coordinates its actions. No account is merged by matching a username.

[Start](reaction:Commons.StartCommons) creates a ten-minute sign-in attempt. The HTTP
boundary moves the attempt into an HttpOnly sign-in cookie and returns only the
Commons address. A server-held PKCE verifier binds the returned code to that attempt.

```endpoints
Commons.StartCommons at /auth/commons/start
```

[Finish](reaction:Commons.FinishCommons) reads the browser's attempt cookie and checks
state before redeeming a code server-side. A returning Commons subject starts a session
for its linked Gamexplorer user. A new subject registers a passwordless account, links
it, then starts a session. A taken or invalid username leaves the confirmed attempt
available for [choosing a different username](reaction:Commons.ChooseUsername).
An expired or already linked choice answers SIGN_IN_EXPIRED. Provider refusals map
to FORBIDDEN, preserving the attempt cookie for legitimate recovery. Success clears
the attempt cookie and issues the session cookie, without exposing either in JSON.

```endpoints
Commons.FinishCommons at /auth/commons/finish
Commons.ChooseUsername at /auth/commons/choose
```

The callback is served at /auth/commons/callback. Its page removes code and state
from the current address before posting them. Denied consent, expired attempts,
provider failures, and username conflicts have recovery controls. Every HTML page
uses Referrer-Policy: no-referrer. Sign-in codes and verifiers are redacted from
engine diagnostics. PUBLIC_ORIGIN is the exact address opened by the browser; Commons
supports loopback development addresses and deployed class apps without an API key.

The protocol is adapted from ConceptBox commit 9374617263d0dce783f6ffc472b28092dc4ad96a.
As in that reference, concurrent first sign-ins for the same subject can leave an
unused registered username if linking loses a race; no session is issued to the
unlinked account. A subsequent sign-in resolves the winning linked identity.
