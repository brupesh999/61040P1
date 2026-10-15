# Fonts

Pixelify Sans, by the Pixelify Sans Project Authors, is used for the wordmark and
large headings. Small sans-serif text uses locally hosted Archivo.

Source: [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/pixelifysans).
The unmodified variable font is distributed locally as `PixelifySans.ttf` with
its [SIL Open Font License](OFL.txt), so loading the interface does not depend on
an external font service.

Geist Pixel Square replaces the Martian Mono trial for bold body text, game titles
(including the detail heading), section headings, labels, navigation, and buttons.
It uses the original regular face at its natural width. Game-detail titles and
header tabs allow synthesized bold at the user's request; other pixel text keeps
font synthesis disabled. All rating values and their /10 suffixes use Geist Pixel.

Source: [Vercel's Geist Pixel repository](https://github.com/vercel/geist-pixel-font/tree/bd5f6cca54c0b179115d8a3fd89385db607034c2).
The unmodified `fonts/webfonts/GeistPixel-Square.woff2` is distributed locally with
its [SIL Open Font License](GeistPixel-OFL.txt). The CSS variable `--font-emphasis`
controls this choice; setting it to `var(--font-body)` restores the system font.

The previous `MartianMono.ttf` and its [license](MartianMono-OFL.txt) remain available
for reverting the comparison, but the interface no longer loads that font.

Archivo, by the Archivo Project Authors / Omnibus-Type, is used for paragraphs,
metadata, reviews, inputs, and numeric count badges. The normal and italic variable
faces support weights 100–900 and are served at normal width.

Source: [Omnibus-Type/Archivo](https://github.com/Omnibus-Type/Archivo/tree/b5d63988ce19d044d3e10362de730af00526b672).
Original `fonts/variable/Archivo[wdth,wght].ttf` and
`fonts/variable/Archivo-Italic[wdth,wght].ttf` are distributed locally as
`Archivo.ttf` and `Archivo-Italic.ttf`, with their [Open Font License](Archivo-OFL.txt).
Visitors do not need to install any of these fonts.
