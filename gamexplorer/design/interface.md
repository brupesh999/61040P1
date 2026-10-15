# Beta interface

## Visual direction

The user's typography study pairs pixel lettering in games and interfaces with
conventional text for readability. Keep locally hosted Pixelify Sans for the
wordmark and page names such as Catalog and Discover.

Replace the Martian Mono trial with locally hosted Geist Pixel Square for game
titles, bold body text, section headings, navigation, labels, and buttons. This uses
the user's preferred font from the typography slide. Keep ordinary paragraphs,
metadata, reviews, input text, and numeric count badges in locally hosted Archivo.
Use Archivo at its natural width, with its real variable weights and italic face.
Geist Pixel has one regular weight. Allow synthesized bold only for game-detail
titles and the header navigation tabs, as requested by the user; keep other pixel
text at its existing weight and do not stretch the glyphs. Distribute the original
font and Open Font License with attribution. One CSS variable controls the
emphasis family so this choice can be revised without changing components.

Game detail titles and header navigation tabs use bold Geist Pixel Square.
Every rating value, including the /10 denominator, uses Geist Pixel Square: aspect
averages, individual reviews, your-rating badges, rating/filter slider outputs,
range endpoint numbers, discovery criteria/matches, and My Ratings score tiles.
Counts and years use Archivo.

Game detail titles also use Geist Pixel Square. Inspect the numeral 5 in "Devil May
Cry 5" and longer titles at desktop and phone widths; Pixelify Sans numerals were
previously hard to read in game titles. Check that headings and controls remain
legible, with no clipped text or horizontal overflow.

The color study supplies #0E1116, #131D2B, #253B55, #56739F, and #9B082D.
The darkest colors form the page and surfaces; blue separates groups and borders;
ruby identifies primary actions and selected states. Lighter text and accent variants
provide contrast. Success and error messages include words and symbols as well as
color. Focus indicators remain visible, and motion respects reduced-motion settings.

Select controls place their dropdown indicator inside a padded right edge. Numeric
count badges use Archivo and center the digit with equal horizontal padding,
including beside pixel-font page headings.

## Interface copy

Use short, literal labels. The homepage opens directly on a pixel-font "Catalog"
heading, search, and game cards. There is no hero, promotional tagline, decorative
section caption, or footer slogan. Other pages are titled "Discover" and "My Ratings".
Game detail goes directly from metadata to aspects, with sections labelled "Reviews:"
and "Write a Review". Sign-in and registration dialogs use their action names.
Keep instructions only when needed to use a control, understand a result, or recover
from an error. Success messages state the completed action without extra commentary.

## Pages and state ownership

The app shell owns navigation, account controls, and global feedback. Account state
resolves the stored session before rendering private controls. Catalog, game detail,
discovery, and My Ratings components own their data, drafts, loading states, and
requests. Shared request handling prevents repeated submissions, catches transport
failures, and ignores replies after a component unmounts or an account changes.
All state changes remain reactive, without full-page reloads.

Signing in uses a labelled native dialog with a primary Sign in with Commons button
and a disclosure for local username/password accounts. The callback has separate
loading, cancellation, failure, and username-choice states. Sign-in credentials stay
in HttpOnly cookies and never in localStorage. Signing out clears private state and rating
drafts. Signing into another account creates fresh page state rather than retaining
the preceding user's filters, drafts, or ratings. Account failures offer actionable
messages without discarding unrelated form input.

## Catalog and game detail

Catalog provides public title search and keyboard-operable game cards. Empty catalog,
no search results, loading, and failed requests have distinct explanations. Adding a
game remains an authenticated action and opens in a disclosure to keep browsing clear.
Fields retain their values on refusal. Successfully adding a game opens its detail.
Cards and game detail show the portrait Steam library cover when a URL is stored in MongoDB.
Images load directly from Steam; missing or failed images use the title tile. The
import manifest is not read by the frontend. Detail pages link to the Steam source.
The catalog uses a compact cover grid, with two columns on small phone screens.

Game detail shows the title, developer, release year, and per-aspect averages with
rating counts. Unrated aspects say "Not rated yet" rather than presenting a score of
zero. Aspect headings are larger than their descriptions: 1.18rem on desktop and
1.12rem on narrow screens, compared with 0.9rem description text. Reviewer names
use 0.98rem so they are slightly larger than the review body and easy to identify.
Expandable aspect sections use buttons with expanded state. Each expanded
section distinguishes community reviews from the user's rating editor. Reviewers can
rate only the aspects they choose, edit a previous score/note, or remove it through
an explicit confirmation. Inputs are labelled, notes show their 280-character limit,
and errors preserve drafts. Removing a rating restores the editor's initial state.

## Discovery and personal ratings

Discovery pairs an editable criteria panel with matching games. The interface explains
that all selected thresholds must be met, thresholds are inclusive, and aspects with
no ratings cannot meet a criterion. Each match displays its aggregate scores and counts.
With no criteria the page asks the user to add one; with no matches it suggests lowering
a threshold or removing a criterion. Existing criteria can be edited using the same
form, removed individually, or cleared. An aspect with no remaining scores can still
be removed from saved criteria. Filters remain owned by the authenticated user.

My Ratings lists the current user's scores and notes, with an action to open the exact
aspect for editing. Empty and failed states offer a route back to browsing or retry.

## Validation

Check catalog, sparse rating creation/update/removal, multi-criterion discovery,
refusals, sign-out/account switching, persistence after a deliberate reload, keyboard
operation, and narrow layouts through the browser. Backend authorization and aggregate
coordination stay in the existing compositions and are covered by automated tests.
Record browser findings separately from automated and deployed-platform results.
