# Catalog covers and initial games

Covers come from publisher-supplied Steam store assets. SteamGridDB community grids
are not used because its cover API has no official-only filter. No image generation,
AI upscaling, or replacement artwork is used by this app. Source provenance does not
prove an image's production history; the initial list uses established games and their
recognizable store artwork rather than automatically trusting community tags.

A checked-in manifest records 68 selected games, their metadata, Steam app IDs, exact
official portrait library-cover URLs, source pages, and retrieval date. Steam's public
store metadata is consulted when preparing the manifest, not on every catalog view.
The importer replays this manifest through GameCatalog actions. It appends missing
games, matches Steam IDs before titles, and can be rerun without duplicating games.
Additional cover references for existing demo titles update those titles only; they
do not create more catalog entries. At runtime, MongoDB is the source of game metadata
and cover URLs. The manifest is import input, not a frontend data source.
For deployment, IMPORT_STEAM_CATALOG=1 runs the same idempotent import before
the HTTP server starts, so a fresh hosted database gets the selected games. The
standalone seed:catalog command remains available for manual imports.
It creates no users, aspects, ratings, reviews, or discovery scores, and never resets
the database. Existing contributions remain intact.

GameCatalog stores optional Steam cover metadata independently of the other concepts.
Its cover action validates a positive integral Steam app ID and an HTTPS URL on an
approved Steam static host with a matching app-specific store-assets path. Unknown
games and invalid covers are refused without changing state. Approved hosts are
shared.fastly.steamstatic.com, shared.akamai.steamstatic.com,
shared.cloudflare.steamstatic.com, cdn.akamai.steamstatic.com, and
cdn.cloudflare.steamstatic.com. User-uploaded Steam community assets are excluded.

Catalog and Discovery formers expose the optional cover. Frontend cards and game detail
render it with a fallback to the existing title tile if absent or unavailable. Covers
use Steam's 600 × 900 portrait library capsules, preserving their original colors
and proportions. The catalog presents a compact grid, including two columns on narrow
screens. A game with a cover links to its Steam
store source from the detail page. Image URLs are loaded directly from Steam; no
external API key is used. The runtime may load `.env` as usual, but this work does not
read, display, or need the SteamGridDB key.

Steam's store metadata supplies titles and release information. Portrait covers use
the official Steam static library-capsule URL for each app ID, checked with an HTTP
HEAD request before inclusion. Image bodies are not downloaded by the import tools.
When a game uses a versioned asset path, Steam's store-browse metadata supplies the
exact library-capsule filename and URL format instead of assuming the legacy path.
The [Steamworks asset guide](https://partner.steamgames.com/doc/store/assets) documents
the portrait library capsule dimensions. Steam's static URL convention is not a
versioned API contract; unavailable images fall back to the title tile.
The two Grimrock titles have no portrait image at the checked locations. Their
existing store-header references remain recorded, but the interface rejects landscape
images for the portrait slot and shows a title tile rather than cropping or stretching.

The cover query always answers one result, using app ID 0 and an empty URL when no
cover exists. This avoids propagating an absent nested former into its parent and
accidentally hiding catalog entries or failing game-detail requests without artwork.

The initial import is a small selection. Importing the full Steam catalog would also
need incremental metadata synchronization, server-side pagination, and indexed search.
The current unpaginated catalog search is not intended for that volume.

The selection includes the requested Final Fantasy VII (original PC edition), VII
Remake Intergrade, VII Rebirth, XIV Online, XVI, Phoenix Wright: Ace Attorney Trilogy,
Resident Evil HD Remaster, Resident Evil 2 (2019 remake), Resident Evil 4 (2023 remake),
and Resident Evil Requiem. The original VII uses its current Steam PC listing; years
in this import refer to the Steam edition's release. These are imported as games with covers only, without
aspects or reviews. Store metadata and artwork are checked against the specific
Steam app IDs to distinguish remakes from the originals.

The additional selection includes Devil May Cry HD Collection (the combined Steam
release of 1–3), Devil May Cry 4 Special Edition, Crisis Core Reunion, NieR:Automata,
NieR Replicant ver.1.22474487139..., Final Fantasy X/X-2 HD Remaster, XIII, and XV
Windows Edition. These use the specific Steam edition's title, developer, release
year, and verified portrait URL. The original PSP Crisis Core and Dirge of Cerberus
are not part of this import. Rerunning the import attaches covers to matching games
already added through the interface without replacing their identities or contributions.

## Adding games in P4

Signed-in users search Steam and select a game. GameCatalog's provider reads Steam's
public store-search and app-details JSON, checks the app type and required metadata,
and supplies the official portrait URL. These storefront endpoints are not a stable,
versioned Steamworks API; timeouts and unavailable responses produce retry feedback.
No API key is needed. Search checks at most ten listings, with three detail requests
at a time and a bounded five-minute cache. Metadata is stored only after selection;
catalog views read MongoDB. Missing portrait artwork uses the existing title fallback.

An existing Steam ID opens the same game without another provider request. A matching
manual title can receive Steam metadata without changing its identity or reviews.
GameCatalog identities remain independent of Steam IDs, so older non-Steam entries
remain valid. Adding new non-Steam games through the public interface, including Zelda,
is deferred until another verified source is supported.
