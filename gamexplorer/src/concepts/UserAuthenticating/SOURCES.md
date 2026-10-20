# ConceptBox attribution

Source: [mit-sdg/conceptbox](https://github.com/mit-sdg/conceptbox/tree/9374617263d0dce783f6ffc472b28092dc4ad96a),
commit `9374617263d0dce783f6ffc472b28092dc4ad96a`, MIT license (retained in `LICENSE`).

`provider.ts` comes from that reference. Its Federating protocol is adapted directly
inside UserAuthenticating, covering local and external credentials as one concept.
The archived `fixtures/FederatingP3.ts` creates old links for compatibility tests only.
The external sign-in and CommonsProvider tests are adapted to this app's
Bun/MongoDB test helper. `src/compositions/Commons.ts` and the Vue callback adapt the
reference's Commons flow to Gamexplorer's existing account identities and navigation.
Local password hashing uses the reference Authenticating concept's Bun Argon2id calls;
legacy P2 hash verification remains for existing accounts.

No file storage, sharing, agent, or other ConceptBox features are included.
