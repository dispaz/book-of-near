# Palette

How colour works in Book of NEAR: three layers, one source of truth, and the rules that keep NEAR's own
colours meaning "NEAR".

## One source of truth

- `src/scene-kit/theme.ts` holds every value: `INK`, `GROUND`, `PAPER`, `NEAR`, `COLORS`, `STAGE_ACCENTS`
  and `CSS_TOKENS` (every colour custom property on `:root`).
- `src/ui/ink.css` repeats `CSS_TOKENS` on `:root`, because CSS needs them before any script runs.
- `src/scene-kit/palette.test.ts` fails if the two drift apart, if a token's hex is hard-coded anywhere else
  in `src`, if a stage accent comes within 30° of hue of NEAR green, or if text contrast drops below WCAG AA.

So: CSS uses `var(--…)`. A shade of a token uses `color-mix(in srgb, var(--ink) 20%, transparent)`, not
`#16141f33`. Scripts (3D materials, SVG props) import from `theme.ts`. `stage.ts` files take their accent
from `STAGE_ACCENTS`. To change a colour, change `theme.ts` and `ink.css` together.

Colours that belong to one object only (the room's wood, the sky, a key's brass) may stay local to that
object. Promote a colour to a token once a second file needs it.

## The layers

| Layer | Tokens | Use |
|---|---|---|
| Ink base | `--ink` `#16141f`, `--page` `#f3efe4` (`GROUND`), `--card` `#fffdf7` (`PAPER`) | Outlines, text, the book's pages, slips and cards on the page. |
| App neutrals | `--paper` `#f2f1e9` (NEAR off-white), `--paper-2` `#f7f6f0`, `--mute` `#625f57` | App background, raised panels, secondary text. Warm, like NEAR's "blacks, whites and warm grays". |
| Stage accents | `STAGE_ACCENTS`: 0 orange `#ff8a3d`, 1 blue `#5f7bff`, 2 pink `#ff5fa2`, 3 cerulean `#1e9bd7`, 4 violet `#9a70f7`, 7 ochre `#c9a227` | One per stage, set as `--accent` on the lesson. Meaning in figures, primary buttons, the step card's edge. |
| Meaning | `--green` `#2fa36b` (pass), `--red` `#d8433b` (fail), tints in `COLORS` | Verdicts and checks only. |
| NEAR brand | `--near-green` `#00ec97`, `--near-black` `#000000`, `--near-off-white` `#f2f1e9`, `--near-forest` `#145c43` | NEAR things: coins, the book's cloth and ribbon, the setting. |

## Rules

1. **NEAR green means NEAR.** Coins and the setting only (see `docs/book-scene.md` rule 8). No stage accent
   may sit near it in hue (the test keeps 30° clear), so a highlight never reads as a coin. This is why
   stage 3 is cerulean, not green.
2. **Ink text on accents.** Primary buttons put 14px bold ink text on the accent, so every accent keeps
   4.5:1 against `--ink`. Never put accent-coloured body text on paper: no accent passes 4.5:1 there.
3. **Restraint.** near.org is almost all black and white, with green on a couple of elements. Keep the app
   mostly ink on paper, one accent per stage, and green for NEAR things.
4. **Fonts** stay DM Sans (UI), Newsreader (serif) and Caveat (hand). NEAR's own typeface, FK Grotesk, is
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
