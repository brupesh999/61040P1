# Rating

A signed-in user can [rate one aspect](reaction:Rating.Rate) with a score and an optional
micro note. The client names only the aspect. The application looks up which game the aspect
belongs to, so a rating can never pair an aspect with the wrong game. Rating an aspect that
does not exist answers `ASPECT_NOT_FOUND`. Because ratings are sparse, rating one aspect says
nothing about the game's other aspects.

A user can also [remove their rating](reaction:Rating.Remove) of an aspect, and can
[list their own ratings](reaction:Rating.Mine) through the
[my-ratings former](former:Rating.MyRatings), which names each rated game and aspect.

```endpoints
Rating.Rate at /ratings/rate
Rating.Remove at /ratings/remove
Rating.Mine at /ratings/mine
```

This fixes a problem in the P1 design. There, `AspectFiltering._matchGames` took
`AspectRating`'s ratings as an argument, which crossed a concept boundary. Now, whenever a
rating is [submitted](reaction:Rating.RecordScoreAfterRating) or
[removed](reaction:Rating.RecordScoreAfterRemoval), these reactions read the aspect's new
summary from `AspectRating` and its name from `AspectManaging`, then record the aggregate in
`AspectFiltering` with `recordScore`. `AspectFiltering` matches only against scores it was
given, and never reads another concept's state.

Each of a user's ratings is shown with [the game's title](former:Rating.GameTitle) and
[the aspect's name](former:Rating.AspectName).
