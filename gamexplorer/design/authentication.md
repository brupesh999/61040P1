# Commons integration

Adapt the external sign-in protocol and CommonsProvider from
[ConceptBox](https://github.com/mit-sdg/conceptbox/tree/9374617263d0dce783f6ffc472b28092dc4ad96a).
UserAuthenticating owns the local and external credential paths, their attempts and
links, and account/session state. CommonsProvider is a service adapter; no independent
Federating concept is registered. The application has five concepts.
Adapt the Commons composition, cookies, callback, and password hashing to that concept. This preserves existing user IDs, ratings, and filters
and avoids a database-wide account migration. All cross-concept rules stay in compositions.
The reference's MIT license is retained beside the copied concept source.

Commons is the primary sign-in option. Local password accounts remain available for
existing users and later outside-class testers. New local hashes use ConceptBox's
Argon2id calls; successful old-password logins upgrade the prior hash. A Commons account
with a local account's username must choose another name; matching names never prove
that two accounts belong to the same person. Automatic account linking is out of scope.

Sessions and sign-in attempts move from browser localStorage to HttpOnly cookies,
using sync-engine-http's cookie projection and origin protection. Existing localStorage
tokens are removed, so users sign in again once; existing contributions remain intact.
The real provider runs only in the host. Artifact generation and isolated tests inject
ConceptBox's MemoryProvider; HTTP tests still exercise the real cookie boundary,
concepts, compositions, authorization, MongoDB state, and PKCE behavior.

No deployment is needed to implement or test the flow locally. The user completed the human sign-in check on Commons from the localhost preview;
the returned session also survived a reload. Deployment later sets PUBLIC_ORIGIN
to https://<name>.mit-sdg.dev; no Commons client secret or additional storage is required.

## Five-concept refinement

P3 registered Federating separately from UserAuthenticating, exceeding the project's
five-concept limit. P4 consolidates both credential paths under one purpose: preventing
account impersonation. The protocol methods and state are implemented directly in
UserAuthenticating, without importing another concept or hiding one behind a wrapper.
The four game/evaluation concepts retain their responsibilities.

Existing MongoDB collection names are retained, including `commonsfederating.attempts`
and `commonsfederating.links`, so the refinement reads existing external links and keeps
user IDs, active sessions, review ownership, and saved criteria. These names are storage
compatibility details, not additional concept instances. Password/Commons sign-in and
cookie endpoints retain their wire contracts. A legacy fixture creates P3 links through
the original actions for compatibility tests.
