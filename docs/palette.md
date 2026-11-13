# Palette

How colour works in Book of NEAR: three layers, one source of truth, and the rules that keep NEAR's own
colours meaning "NEAR".

## One source of truth

- `src/scene-kit/theme.ts` holds every value: `INK`, `PAGE`, `CARD`, `MUTE`, `NEAR`, `COLORS`,
  `STAGE_ACCENTS` and `CSS_TOKENS` (every colour custom property on `:root`). The constants are named after
  their CSS token (`PAGE` is `--page`, `CARD` is `--card`); `COLORS.paper` is the same value as `CARD`.
- `src/ui/ink.css` repeats `CSS_TOKENS` on `:root`, because CSS needs them before any script runs.
- `src/scene-kit/palette.test.ts` fails if the two drift apart, if `ink.css` grows a second `:root` block,
  if a token is hard-coded (as `#hex`, `rgb()` or `rgba()`) anywhere else in `src` or `scripts` (the
  lesson scaffolder's templates), if a stage accent comes within 30° of hue of NEAR green, or if text
  contrast drops below WCAG AA.

So: CSS uses `var(--…)`. A shade of a token uses `color-mix(in srgb, var(--ink) 20%, transparent)`, not
`#16141f33`. Scripts (3D materials, SVG props) import from `theme.ts`; canvas and three.js shades use
`withAlpha(INK, 0.4)`. `stage.ts` files take their accent
from `STAGE_ACCENTS`. To change a colour, change `theme.ts` and `ink.css` together.

Colours that belong to one object only (the room's wood, the sky, a key's brass) may stay local to that
object. Promote a colour to a token once a second file needs it.

## The layers

| Layer | Tokens | Use |
|---|---|---|
| Ink base | `--ink` `#16141f`, `--page` `#f3efe4` (`PAGE`), `--card` `#fffdf7` (`CARD`) | Outlines, text, the book's pages, slips and cards on the page. |
| App neutrals | `--paper` `#f2f1e9` (NEAR off-white), `--paper-2` `#f7f6f0`, `--mute` `#625f57` | App background, raised panels, secondary text. Warm, like NEAR's "blacks, whites and warm grays". |
| Stage accents | `STAGE_ACCENTS`: 0 orange `#ff8a3d`, 1 blue `#5f7bff`, 2 pink `#ff5fa2`, 3 cerulean `#1e9bd7`, 4 violet `#9a70f7`, 5 orchid `#c86bd6`, 7 ochre `#c9a227` | One per stage, set as `--accent` on the lesson. Meaning in figures, primary buttons, the step card's edge. |
| Meaning | `--green` `#2fa36b` (pass), `--red` `#d8433b` (fail), tints in `COLORS` | Verdicts and checks only. |
| NEAR brand | `--near-green` `#00ec97`, `--near-black` `#000000`, `--near-off-white` `#f2f1e9`, `--near-forest` `#145c43` | NEAR things: coins, the book's cloth and ribbon, the setting. |

## Rules

1. **NEAR green means NEAR.** Coins and the setting only (see `docs/book-scene.md` rule 8). No stage accent
   may sit near it in hue (the test keeps 30° clear), so a highlight never reads as a coin. This is why
   stage 3 is cerulean, not green.
   `--blue` is both stage 1's accent and the notebook-ruling blue in figures, so changing stage 1's accent
   moves those lines too.
2. **Ink text on accents.** Primary buttons put 14px bold ink text on the accent, so every accent keeps
   4.5:1 against `--ink`. Never put accent-coloured body text on paper: no accent passes 4.5:1 there.
3. **Restraint.** near.org is almost all black and white, with green on a couple of elements. Keep the app
   mostly ink on paper, one accent per stage, and green for NEAR things.
4. **Badge art is NEAR's own colours only.** A stage badge (`scripts/badges-art.mjs`, `public/badges/`) is
   NEAR-branded proof minted on NEAR, so it is a NEAR thing in the sense of rule 1, and it uses the NEAR
   brand layer and nothing else: `NEAR.black` outlines, `NEAR.offWhite` ground and paper, `NEAR.green` for
   the main figure and the ring, `NEAR.forest` for second parts. No stage accent appears on a badge: the
   motif and the "STAGE n" ribbon tell the stages apart (`scripts/badges-art.test.ts` checks every hex).
   This is the one place where green is used for a whole figure rather than a coin.
5. **Fonts** stay DM Sans (UI), Newsreader (serif) and Caveat (hand). NEAR's own typeface, FK Grotesk, is
   commercial; don't ship it in this public repo unless its licence allows it.

## Sources (checked 10 Nov 2026)

| NEAR colour | Value | Confidence |
|---|---|---|
| Green | `#00ec97` (PMS 7479 C) | High: the old official brand guidelines and live near.org agree. |
| Black | `#000000` | High. |
| Off-white | `#f2f1e9` (PMS Warm Gray 1) | Medium: the old guidelines only (`pages.near.org/?p=14330`, now a redirect; search snippets survive). |
| Warm greys | near.org uses `#757575` and `#acaba6` | Medium. `#757575` fails AA on our paper, so `--mute` is a darker warm grey. |
| Accents | near.org shows a purple (`#9797ff`), a teal (`#17d9d4`) and a mint tint (`#c7f5d8`) | **Unverified**: read off the live site, not from a published palette. Not used. |

NEAR Foundation's "NEAR Narrative and Brand Hub" (Notion) has logos, the font and slide templates but no
colour table. Ignore third-party values such as `#00C08B`: they contradict the official green.

## Known gaps

- `--green` ("pass") sits 7° of hue from NEAR green, the flaw that moved stage 3. It stays for now because it
  marks a verdict, never a NEAR thing; a non-green pass colour is a separate
  change.
- As small text on paper, `--green` (2.7:1) and `--red` (3.9:1) fail WCAG AA (lessons 0.1, 1.2, 1.3). Darker
  text shades, or bold text with a mark, are a separate fix.
