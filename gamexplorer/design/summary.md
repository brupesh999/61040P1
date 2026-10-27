# Gamexplorer design summary

Gamexplorer retains P1's goal: review individual aspects of games and discover games by their scores. This summary compares the [original P1 design](https://github.com/brupesh999/61040P1/blob/f3ca725ffbd049133d5337e839c0cb8608bdb7a0/p1.md) with the [P4 specifications](https://github.com/brupesh999/61040P1/tree/66b0a2aab40398ed92eb866ff1a3f06ea2958825/gamexplorer/design). The final app uses five concepts.

## Concepts and reactions

- **Redesigned concepts** Originally in P1 I had AspectManaging, AspectRating, and AspectFiltering, but they are now DimensionDefining, Rating, and ThresholdFiltering to be less specific to video games. Their purposes are to define dimensions for any subject, evaluate opaque targets, and filter supplied numbers. So, rating no longer stores a redundant parent game.
- **Independent filtering** P1 passed Rating's records into filtering and placed queries in reaction consequences. P4 reads summaries in `where` and invokes actions in `then`. Reactions record the current average after rating changes and remove it after the final rating is withdrawn, and I have it so aspects or games with no ratings do not get filtered at all.
- **Personal criteria and shared names** P1's criteria had no owner and P4 keeps each user's filters separate and requires every selected minimum. I added a list of presets so that people wouldn't get confused by Combat and Combat Depth becasue they are basically aliases. Users can still define custom aspects. I considered having automatic semantic grouping with LLMS but seems outside scope.

## Accounts and catalog

- New and updated UserAuthenticating (compared to P1) supports both Commons and local accounts within one concept. HttpOnly cookies carry credentials and I made sure matching usernames will not automatically merge accounts.
- P1 accepted manually entered game metadata, but I thought it would be cool to have it be connected to Steam itself. So in P4's GameCatalog I added the ability to serach Steam selections, and this allows it to store metadata and official cover URLs. However, adding games outside Steam is not supported. It seems better to not have nintendo artwork on my website at all to not even take that risk.

## Interface and visual design

- My design hasn't changed too much since I started the visual studies. My final product ended up a bit different than the original slide I made in P1 for the sketch, but the idea is very much the same. P4 has the [P3 visual study's](visual-study.pdf) same palette, portrait covers, and pixel typography.

## Validation and reproducibility

- I made some updates based on the feedback I got from P1 and P2 regarding the concepts and testing an integration suites. They have real compositions and disposable MongoDB databases, with fixtures created through actions or endpoints. The checks cover multiple criteria, missing ratings, updates/removals, ownership, and persistence across application reassembly. Currently [102 tests pass](../validation/tests.txt); [hosted checks](../validation/p4-deployed-checks.json) cover deployed persistence, access control, and errors.
