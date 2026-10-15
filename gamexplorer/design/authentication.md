# Commons integration

Reuse the Federating concept and CommonsProvider from
[ConceptBox](https://github.com/mit-sdg/conceptbox/tree/9374617263d0dce783f6ffc472b28092dc4ad96a).
Adapt its Commons composition, cookies, callback, and password hashing to the existing
Gamexplorer user/session concept. This preserves existing user IDs, ratings, and filters
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
