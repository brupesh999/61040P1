# Beta browser validation — October 15, 2026

These checks exercised the current source in a real browser against a local
`NODE_ENV=production` server on port 3011 and a separate MongoDB test database.
Test accounts, games, aspects, filters, and ratings were created through the interface.
No application database records were inserted or edited directly.

| Check | Observed result |
| --- | --- |
| Empty public catalog | Explains the empty library and offers sign-in to contribute. |
| Registration | Reviewer account was created, signed in, and shown in the header. |
| Add game | Devil May Cry 5 was added and its detail page opened automatically. |
| Create aspects | Combat Depth and Narrative Depth appeared as separate dimensions. |
| Sparse rating | Combat Depth was saved at 10; Narrative Depth remained unrated. |
| Duplicate aspect | Case-insensitive duplicate was refused, with the name and description draft preserved. |
| Discovery | Combat Depth ≥ 8 matched the game and displayed average 10.0 across one rating. |
| Sign-out | Private controls disappeared; community data remained readable. |
| Account switching | An unsaved reviewer note disappeared; the buyer's editors were empty with default score 7. |
| Wrong credentials | Dialog showed a useful error and retained the username for correction. |
| Filter ownership | The buyer began with no criteria even though the reviewer had a saved filter. |
| Two reviewers | Buyer rated Combat Depth at 8; community average became 9.0 across two ratings. |
| Multiple criteria | Adding Narrative Depth ≥ 8 produced no matches while its average was 5.0. |
| Threshold editing | Editing Narrative Depth to ≥ 5 restored the game; equality was included. |
| My Ratings | Listed the buyer's scores and tiny reviews, with links to edit the exact aspect. |
| Reload and deep link | Reloading an aspect URL restored the session, score 5, saved note, and expanded target aspect. |
| Rating update | Changing Narrative Depth from 5 to 6 replaced the existing rating; count stayed one. |
| Cancel removal | Keep rating preserved the score and note. |
| Remove final rating | Confirmation removed Narrative Depth's rating and its discovery contribution. |
| Recover after removal | The saved narrative criterion could still be removed; the combat-only match returned. |
| Clear criteria | Cleared the buyer's filters and returned to the first-criterion guidance. |
| Cross-game matching | Hades was added and rated through the UI; Combat Depth ≥ 8 matched both games. |
| Empty search | An unmatched title showed a distinct explanation; Clear search restored the catalog. |
| Connection failure | Stopping the test server produced a retry message while preserving the search term. |
| Connection recovery | Restarting the server and choosing Try again completed the original search. |
| Responsive layout | Catalog, discovery, and game/rating controls were inspected at 390 × 844; document width remained 390 pixels. |
| Keyboard controls | Labelled range controls accepted keyboard changes; navigation, cards, disclosures, and forms use native controls. |
| Browser diagnostics | No unexpected warnings/errors during normal journeys; the deliberate stopped-server request produced the expected connection failure. |

The dialog was refined during validation so the header's Sign in button consistently
opens sign-in mode. Success feedback now expires after eight seconds, and its dismiss
control stays beside the message at narrow widths. Those refinements are part of the
current source; the dialog was rechecked after restarting the preview.

## Captured interface

After the copy revision, Catalog opens directly on the game list. Discover and My
Ratings use their page names; game detail uses "Reviews:" and "Write a Review".
The hero, introductory slogans, and footer were removed. The four screenshots below
were refreshed, and the catalog was rechecked at 390 pixels with no horizontal overflow.

- [Catalog, desktop](screenshots/catalog-desktop.jpg)
- [Discovery, desktop](screenshots/discovery-desktop.jpg)
- [Game detail and rating editor, desktop](screenshots/game-desktop.jpg)
- [Catalog, 390-pixel viewport](screenshots/catalog-mobile.jpg)

Screenshots contain actual data created during the isolated browser journey.

## Steam covers

The catalog importer added 50 games through GameCatalog actions, without creating
accounts, aspects, ratings, reviews, or discovery scores. Rerunning it added zero
duplicates. Game metadata, Steam IDs, and cover URLs are stored in MongoDB; the app
does not read the import manifest. The two existing browser-demo games received covers
without changing their ratings or discovery matches.

The portrait revision uses official Steam library artwork. HTTP HEAD checks found
working portrait URLs for 50 of the 52 preview entries. The two Grimrock titles use
title placeholders because portrait artwork was unavailable at the checked locations.
No cover image files were downloaded or saved by the import tools.

Browser checks confirmed portrait artwork on Catalog, the imported Bastion detail
page (with no aspects or reviews), and the existing discovery matches. Screenshots
were refreshed after switching from horizontal banners. [Imported game](screenshots/imported-game.jpg).
That imported-game capture predates the subsequent typography trial.
The two-column portrait grid was checked at 390 × 844; document and viewport widths
were both 390 pixels, with no horizontal overflow.

Integration tests initially exposed a missing-cover former problem: a nested optional
cover could omit an entire catalog result or fail an unrated game's detail request.
The cover query now always returns a result, using an empty URL and app ID zero for
missing artwork. Existing games without covers remain covered by the endpoint tests.
The final suite passes 45 tests, including import idempotence and preservation of
existing reviews and discovery results.

Browser verification also caught a Vue template syntax error in a new image-load
handler. Moving the check into a typed component method fixed rendering; the catalog
and detail pages were rechecked afterward.

## Typography trial

Martian Mono at 87.5% width replaces the system font for emphasized text and game
titles, including the detail heading. The user found Pixelify Sans numerals hard to
read in "Devil May Cry 5"; the whole title now uses the mono font. Catalog/Discover
page headings and the wordmark retain Pixelify Sans. The emphasis family is one CSS
variable so the trial can be reverted without changing components.

Catalog, Discover, and the Devil May Cry 5 detail page were inspected at the normal
viewport and at 390 × 844. All three pages measured 390 pixels wide on mobile without
horizontal overflow. The title's computed font was Martian Mono, and the numeral 5
was visibly distinct. Saved catalog, discovery, and game-detail captures were refreshed.
Design checks, artifact generation, and code checks passed. Domain tests were not
rerun for this font-only change; the previous functional run passed 45 tests.

## Requested catalog additions

Ten requested games were imported through GameCatalog actions into both the configured
application database and the isolated preview database. The selection includes the
five Final Fantasy games, Phoenix Wright: Ace Attorney Trilogy, Resident Evil HD
Remaster, the 2019 Resident Evil 2 and 2023 Resident Evil 4 remakes, and Resident Evil
Requiem. Existing entries and contributions were preserved.

The live search/detail endpoints returned exactly one entry for each requested title,
the expected Steam ID and cover URL, and zero aspects or reviews. The saved
[endpoint report](catalog-additions.json) records those assertions. Browser searches
returned five Final Fantasy games, four Resident Evil games, and one Phoenix Wright
entry; all ten images loaded at 300 × 450. Screenshots:

- [Final Fantasy games](screenshots/final-fantasy-games.jpg)
- [Resident Evil games](screenshots/resident-evil-games.jpg)
- [Phoenix Wright](screenshots/phoenix-wright.jpg)

The metadata refresh tool now resolves versioned portrait paths through Steam's
store-browse asset metadata when the legacy path is unavailable. This was exercised
for the current original Final Fantasy VII listing and Resident Evil Requiem.
Design/code checks passed. No concept or endpoint behavior changed, so the domain
test suite was not rerun for this catalog-data addition. Non-Steam cover support remains
deferred.

## Commons authentication

The updated production preview uses the real CommonsProvider and the isolated browser
journey database. An existing local account signed in through the local-account
disclosure, loaded its saved rating in My Ratings, and retained access after a full
browser reload. Sign-out removed the account controls.

A cancelled Commons callback showed a cancellation message, removed the query from
the address bar, and returned to the catalog without losing the existing session.
The real Commons redirect accepted the `http://127.0.0.1:3011` origin and displayed
Commons' approval page. The user approved it and returned to Gamexplorer as their
Commons username. The account remained signed in after restarting the preview and
reloading. Discover loaded that account's empty criteria, and My Ratings showed its
empty ratings list. No review or filter was created under the user's account during
this check; no consent was submitted by the agent.

[Sign-in dialog](screenshots/commons-sign-in.jpg).

The saved automated run now passes 66 tests (447 assertions), including cookie/origin
checks, cross-browser attempt rejection, PKCE, replay, username conflict recovery,
identity ownership, 90-day session expiry, legacy password migration, and callback
privacy/asset headers. Tests populate state through actions/endpoints; the legacy
fixture uses the archived P2 concept's actions. Raw collection reads only inspect
stored hashes. Throwaway database names were shortened to stay within MongoDB's
63-character limit while retaining a random UUID.

`check:design` passes for 12 files; generation and code/type/artifact checks pass.
The code check reports 21 advisories. The live local approval/return was checked separately as described above. These
results do not establish that a deployed app works.

## Geist Pixel revision

The user preferred Geist Pixel from their visual-study slide over the Martian Mono
trial. Geist Pixel Square now replaces the emphasis font in navigation, controls,
labels, headings, and game titles. Ordinary paragraphs and input text remain in the
system font. Pixelify Sans remains on the wordmark and page names. The original WOFF2
and Open Font License come from Vercel's Geist Pixel repository; visitors do not need
to install the font.

The browser reported the font loaded successfully. Catalog, Devil May Cry 5 detail,
and Discover were checked; detail and discovery remained 390 pixels wide at a
390-pixel viewport. The numeral 5 was readable in the title. Captures:

- [Catalog](screenshots/geist-catalog.jpg)
- [Game title](screenshots/geist-game.jpg)
- [Game detail on phone](screenshots/geist-game-mobile.jpg)

Design, generation, code/type/artifact checks, and whitespace checks passed. The
66-test functional suite was not repeated for this font-only change.

## Archivo, bold titles, and rating numerals

At the user's request, small sans-serif copy now uses locally hosted Archivo,
including metadata, reviews, input text, and count badges. The original normal and
italic variable files and Open Font License are included. Game-detail titles and
Catalog / Discover / My ratings header tabs use bold Geist Pixel. Because Geist
Pixel provides one regular face, only those titles/tabs permit synthesized bold.

Every rating value explicitly keeps Geist Pixel, including its /10 suffix: averages,
individual reviews, personal badges/score tiles, score and threshold controls,
range endpoint numbers, and discovery criteria/matches. Count badges remain Archivo.

Browser checks confirmed both fonts loaded, the title and all three tabs reported
weight 700, metadata and inputs used Archivo, and displayed scores/denominators
used Geist Pixel. Detail and Discover remained 390 pixels wide at a 390-pixel viewport.
No ratings or filters were saved during these checks. Captures:

- [Game detail](screenshots/archivo-bold-game.jpg)
- [Game detail on phone](screenshots/archivo-bold-game-mobile.jpg)

Design, generation, code/type/artifact, and whitespace checks passed. The existing
66 passing functional tests were not repeated for these CSS/font changes.

## Aspect and reviewer hierarchy

Aspect headings increased from 1.03rem to 1.18rem (0.96rem to 1.12rem on narrow
screens). Reviewer names increased from 0.85rem to 0.98rem. Description and review
body sizes remain 0.9rem and 0.86rem, respectively. At the current 512-pixel browser
width, the computed sizes were 16.8px for the aspect heading, 13.5px for its
description, 14.7px for reviewer names, and 12.9px for review text. The 390-pixel
layout had no horizontal overflow. [Capture](screenshots/aspect-type-hierarchy.jpg).
Design, generation, code/type/artifact, and whitespace checks passed; domain tests
were not repeated for the CSS size change.

## Hosted deployment

The app is now deployed at https://gamexplorer.mit-sdg.dev from commit
`272b540c2731dde141fb5d73265e3f71feed8662`. The class platform reports Healthy.
Hosted checks are recorded separately in [deployment evidence](deployment.md) and
[the programmatic report](deployed-checks.json). Commons sign-in and session
persistence were also verified in the browser after the user approved the live domain.
These hosted checks did not create reviews or aspects; the full write journey remains
to be rehearsed on the public app before recording.

## Limits and remaining evidence

- Earlier sections describe local preview checks. The hosted deployment section records separate live evidence.
- This pass used the Codex in-app browser. Other browser engines, assistive technology,
  and a full accessibility audit have not been tested.
- Titles without available portrait artwork use a title tile. New games added manually
  do not automatically fetch a cover yet.
- The visual-study export, full hosted write journey, and narrated beta recording
  remain to be added. The design notebook stays in the private individual repository.
- Saved outputs must be refreshed if subsequent source changes affect their checks.

## P1 concept feedback refinement

The backend now instantiates DimensionDefining, Rating, and ThresholdFiltering under
application aliases. No Vue components, styles, or navigation changed in this refinement.
After restarting the same isolated preview database, the existing Commons session and
Devil May Cry 5 deep link still worked. Combat Depth retained its identity, description,
both reviews, and average 9.0 across two ratings; Narrative Depth remained unrated.

The existing beta-reviewer test account signed in through the local-account dialog.
Its saved score 10 and review populated the editor. Updating to 9 changed the visible
average to 8.5 while the count stayed two, without a page refresh. Restoring 10 returned
the average to 9.0. My Ratings displayed the correct game, dimension, review, and edit
link, and that link opened the populated editor. Discover retained Combat Depth ≥ 8
and showed Hades and Devil May Cry 5 with their correct averages and counts.
The user's Commons preview account was restored afterward using its existing approval.

[Reviewer interface after refinement](screenshots/reviewer-refinement.jpg) shows the
implemented reviewer affordances omitted from P1's sketches. Only test-account reviews
in the isolated preview database were edited. The public deployment was not used for
these writes. Temporary viewport settings were reset.

The saved suite now passes **70 tests, 518 assertions**, including actual P2-action
fixtures read and edited through current HTTP endpoints, independent book/restaurant/room
uses, and concurrent reviewer replacement/removal. Design, generation, artifact, and
TypeScript checks pass. The concurrency test covers one running process and is not a
claim of cross-process ordering or crash recovery. The design check still reports 12
files and the code check still reports 21 advisories.

The refinement was then deployed as commit `8fa803a1d` on the existing production
database. The hosted read-only regression report passed all 60 catalog/detail requests
and the HTTP security checks. Reloading retained the existing Commons session and the
checked game link; My Ratings and Discover loaded successfully. The full hosted write
journey remains separate work before recording. See [deployment evidence](deployment.md).


## Shared aspect presets and explicit aliases

The preview was restarted against the same isolated database. Combat Depth now displays
as Combat with the same dimension ID, two saved reviews, and average 9.0. Searching the
new picker for combat depth finds Combat and marks it already added. Selecting Music
and adding it immediately created an unrated card with its suggested description; no
review or score was created. The Add a new aspect disclosure sits below the list.
Submitting Combat Depth through that custom form was refused as a duplicate while
preserving its draft. Error feedback appears in the form used for the request. Filtering the list so a prior
selection is hidden disables Add aspect, preventing submission of an invisible choice.

The list and custom form were checked at 390 × 844; page width remained 390px.
Temporary viewport overrides were reset. Captures:
[full page](screenshots/shared-aspects.jpg), [picker](screenshots/shared-aspect-picker.jpg).
These writes were confined to the isolated preview database.

The saved suite passes 76 tests with 554 assertions. The new HTTP journey covers a
legacy Combat Depth review and new Combat review matching one criterion, shared custom
suggestions, server-side duplicate enforcement, stricter legacy requirements, alias-aware
removal, and preservation of conflicting old reviews when startup is refused. Design,
generation, artifact, and TypeScript checks pass. The check now has 22 advisories: the
additional ORDER_SENSITIVE_FORMER describes the deliberately ordered aspect choices.

The change was deployed as `e003487f1`. Hosted checks confirm the 32 public choices,
canonical Combat alias, catalog/detail integrity, and existing HTTP security behavior.
After reload, the Commons session remained signed in. The production picker found Combat
when searching combat depth and kept Add a new aspect below the shared list. No production
write was made. See [hosted evidence](deployment.md#shared-aspect-deployment).


## Voice Acting and picker labels

Added Voice Acting as the 33rd shared preset. In the isolated preview, searching voice
shows that choice and its description without creating a dimension or review. The panel
is now Choose an aspect; the selection button is Add to this game; the lower disclosure
is Create a custom aspect, whose submit button is Create and add aspect.

Computed text sizes at the 15px root are 16.5px for the panel title, 15.75px for Search
aspects and Aspect labels, and 15px for the custom disclosure. At 390 × 844, document
width stays 390px. The temporary viewport override was reset.
[Preview capture](screenshots/voice-acting-picker.jpg).

Design, generation, artifact, and TypeScript checks pass; the existing 22 advisories
remain. The saved full suite passes 76 tests with 555 assertions, including the new
preset's exact label and description.

The same labels and sizes were verified on production commit `441d0c1b2`, with the
Commons session retained. Voice Acting was selected for inspection without submitting
a contribution. [Live capture](screenshots/live-voice-acting-picker.jpg) and
[focused hosted checks](voice-acting-deployed-checks.json) record this update.


## Bold catalog game titles

Catalog card titles now use Geist Pixel Square at weight 700 with weight synthesis
enabled, matching the existing game-detail headings. The interface spec was updated
before the CSS. Design, artifact generation, source, and TypeScript checks pass with
the same 22 advisories. The existing 76-test result covers unchanged application logic;
no new test was added for this CSS-only change.

In the isolated preview, all 62 catalog titles report the specified font and weight.
At 390px width, no title overflows its container and document width remains 390px.
Long titles and Devil May Cry 5 were included. Temporary viewport overrides were reset.

The deployed catalog was checked at commit `9112e59d2`: all 60 titles use the requested
font, weight, and synthesis setting without overflowing their containers. The Commons
session remains signed in. [Live capture](screenshots/live-bold-catalog.jpg).


## Rubric audit — October 16, 2026

Scope: completed implementation, automated tests, interface, and public technical
writing. This does not assess the unfinished visual-study export, beta recording,
private notebook, or full hosted write journey. This is a code/evidence review, not
an instructor grade.

| Rubric quality | Evidence reviewed | Finding |
| --- | --- | --- |
| Faithfulness | Six concept definitions, composition specs/source, generated gateway and HTTP contracts | No behavioral mismatch found in the reviewed paths. Added Rating.updatedAt to logical state/action effects to specify the existing review ordering; linked the generated contracts and explained HTTP cookie/error projection in the README. |
| Modularity | Concept implementations, assembly, rating projection reactions, Vue pages/state | No peer-concept imports/calls in concepts. Opaque identities are joined in compositions; authentication/ownership comes from the server session. Shared string helpers contain no concept state. Vue separates catalog, detail, discovery, personal ratings, and shared requests. |
| Behavioral coverage/effective checks | Concept tests, Naming, Compatibility, HTTP journeys, Commons/provider tests | All 19 specified actions execute in tests. Principle, refusal, replacement/removal, owner isolation, legacy data, and alias cases use assertions. Fixtures use actions/endpoints; direct DB reads inspect password encoding, and DB drops isolate tests. |
| Integration | Real HTTP handler and MongoDB journeys; saved local browser writes; hosted read-only report | Fresh suite passes 76 tests and 555 assertions. Fresh hosted reads pass all 60 detail pages, persisted covers, 33 shared choices, health, unauthenticated/forged-session/origin refusals, and callback privacy. These do not claim authenticated production-write coverage. |
| Interaction | Rating/edit/removal, My Ratings, discovery controls, shared picker, account switching, error/empty/loading states | The reviewed flows support clear tasks, immediate feedback, retained refused drafts, explicit unrated states, and confirmed removal without forced refreshes. Saved browser checks include phone-width layouts. |
| Visual design | Current catalog and reviewer captures, interface spec, CSS/font sources | Consistent navy/ruby palette and typography, readable hierarchy, coherent cover grid, separate primary actions, and no recorded phone-width overflow. Sampled text contrast ratios range from 6.21:1 to 16.56:1; this samples key token pairs rather than claiming a full accessibility audit. |
| Intentional development/technical writing | Git increments, current specifications, READMEs and saved validation | Public records explain the generic concepts, preservation of P2 data, explicit aliases, and interface revisions. Records distinguish historical/current and local/hosted checks. Personal review and reflection belong to the private notebook and are not inferred from agent checks. |

The 22 checker advisories remain visible: 17 MISSING_ENDPOINT_FALLBACK diagnostics
and five ORDER_SENSITIVE_FORMER diagnostics. The affected endpoint action/refusal and
complementary query branches were inspected and their success/refusal tests pass;
no timeout was reproduced. The formers intentionally preserve query order. These
advisories are not suppressed or represented as resolved.

The strongest evidence beyond routine happy paths is the legacy alias conflict case:
startup refuses an unsafe policy instead of silently combining competing reviews,
and a test verifies both reviews survive. Other regression tests verify final-rating
withdrawal removes old discovery values and invalid updates preserve saved data.
Concurrent HTTP tests cover one process; crash recovery and distributed ordering remain
explicitly outside the demonstrated guarantees.

References: [fresh automated output](tests.txt), [fresh hosted report](rubric-deployed-checks.json),
[current concept design](../../p1.md#3-conceptual-design), [HTTP API guide](../README.md#http-api-and-generated-contracts).

## Focus and copy refinement — October 16

The latest local suite passes **84 tests, 625 assertions**, with no failures; see
[saved output](tests.txt). Design, generation, source/artifact, and TypeScript checks
pass. The same 22 framework advisories remain, as explained in the audit above.
These changes do not add or modify concepts, endpoint contracts, or database state.

In an isolated preview at port 3013, a link to Devil May Cry 5's second aspect
(Music) opened that card and focused its score slider. At 390 × 844 the slider was
visible, about 408px from the viewport top; the document stayed 390px wide.
Editing an existing Combat filter focused the minimum slider and displayed
"Editing Combat". Cancel editing returned focus to the aspect selector and left
the saved requirement intact. No review or criterion was submitted during these checks.
The shared focus function is also used after aspect creation, but that new focus path
was not separately exercised with a browser write in this pass.

The requested introductory sentence was absent from the rendered page. With a
saved minimum of 9.5 and no matches, the rendered explanation used "Games without
ratings for a selected aspect will not match." Temporary viewport overrides were
reset. [Filter edit capture](screenshots/filter-edit-focus.jpg),
[direct rating link](screenshots/rating-link-focus.jpg),
[final discovery copy](screenshots/discovery-copy-final.jpg).

This pass strengthens navigation and keeps documentation consistent with the health
rollout and current test results. It does not establish an Expert grade or replace the
remaining beta video, visual-study export, private reflection, or hosted write journey.
At the time of these browser checks, the interface changes were local; this section
records local validation rather than claiming hosted verification of the refinement.


## Personal validation — October 18

The project author reported completing the personal validation journey on the deployed
app and said it worked properly.


## Submission check — October 19

- Fresh suite: 84 passing tests, 625 assertions; saved in tests.txt.
- Design, generation, source, artifact, and TypeScript checks pass; 22 advisories remain.
- All 19 specified concept actions have direct test calls.
- The two-page visual-study PDF, updated user journey, and test/database instructions are linked from the main README.
- Live public health/frontend checks pass on c804f74; 70 catalog games and 33 aspect choices are available. Private reads refuse missing sessions.
- The October 18 personal journey result is author-reported. The private journal has not been inspected in this check.
- The [beta video](https://youtu.be/m5XII5H1tfU) is linked from the main README. The author described Commons sign-in, a Crisis Core Narrative Depth rating of 9, discovery minimums of 8 and 10, and updating the rating to 10 with a reload to confirm persistence. This description is author-reported, not an independent review of the recording.
