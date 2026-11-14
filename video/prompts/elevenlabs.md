# Prompt pack: turn the 2:14 Book of NEAR demo into a launch film

For an external pass (ElevenLabs for music and voice; any video generator or editor that takes video
input for picture) over the plain, direct 2:14 cut:

- **Source cut:** `~/Documents/book-of-near-demo-captions-only.mp4`. 134 s, 1920×1080, 25 fps,
  silent audio track. App footage sits inset on black with captions burned into a band underneath;
  sections change on hard cuts.
- **Its captions:** `video/prompts/book-of-near-demo-2m14.srt` (22 captions, exact timings).
- **Clean plates (no captions, no black band):** `~/Documents/book-of-near-clean-plates/01-title.mp4`
  … `09-badge.mp4`, one per section, the full take before it was sped up to fit. Use these as the
  picture source whenever the tool allows: the captions are then yours to restyle.
- **Inserts for the missing parts:** `~/Documents/book-of-near-clean-plates/inserts/` (from the 57 s
  cut: real footage and the animated scenes, in the same ink style):
  `A-intro-stage-ladder` (3.9 s), `B-testnet-claim` (8.7 s, a real claim on NEAR testnet),
  `C-checker-proof` (2.1 s), `D-badge-wall` (3.6 s), `E-wallet-concept` (3.7 s), `F-outro-near-coin`
  (3.9 s).

Sections: [1 Ground rules](#1-ground-rules) · [2 The source cut](#2-the-source-cut-as-it-is) ·
[3 The target edit (2:12)](#3-the-target-edit-212) · [4 Style and motion](#4-style-and-motion) ·
[5 Video prompts](#5-video-prompts) · [6 Captions](#6-captions) · [7 Voice-over](#7-voice-over-eleven-v3) ·
[8 Music](#8-music-eleven-music) · [9 Assembly](#9-assembly-and-checks)

## 1. Ground rules

These keep the film honest for the judges, who open the app and compare.

- **App footage stays real.** The tool may reframe, re-time, zoom, light, blur the surroundings and
  transition the plates, but must not redraw, restyle or invent any interface, text, number, account
  name or transaction hash. If a tool can only regenerate whole frames, use it only for the generated
  shots in [5b](#5b-generated-shots-new-picture) and for transitions.
- **Say what is real.** Demo mode is a simulation in the browser; testnet is the real NEAR test
  network; nothing here is mainnet. The intent quote is a recorded example, not a live price. Badges
  are soulbound: no trading, prices or selling anywhere. The wallet scene is a concept and keeps its
  CONCEPT stamp.
- **No brands but NEAR.** No real wallet's, exchange's or other chain's logo or layout (Ethereum is
  named, never shown as a logo).
- **Length: at most 2:20** (140 s, X's limit without Premium). The target edit is 2:12.
- **Muted first.** X autoplays without sound: captions carry every claim; voice and music add warmth.

## 2. The source cut, as it is

What the 2:14 shows now, and what each section needs. Times are the source cut's.

| # | Time | Plate | On screen now | Caption now | Weakness to fix |
|---|---|---|---|---|---|
| 1 | 0:00–0:08 | `01-title` | Contents page of the book (title page left, contents right), static, slow scroll | "Learning NEAR is hard." / "The docs assume you know crypto, and explainers are static." / "Book of NEAR lets you do the real thing." | No hook: the problem is told over a still page. Opens flat. |
| 2 | 0:08–0:17 | `02-quiz` | "Where should you start?" three-question quiz, then "Newcomer path" | "A first visit starts with three questions." / "They pick your path: newcomer, crypto veteran or developer." | Mostly empty page, small text, nothing moves. |
| 3 | 0:17–0:31 | `03-transaction` | Lesson 0.3 in 2D: pipeline Build → Sign → Broadcast → Included → Final; a coin cube, an RPC node, block row | "Demo mode simulates the chain…" / "Build, sign and send a transaction, and watch it reach Final." | Action is small in a big frame; the moment it reaches Final has no emphasis. |
| 4 | 0:31–0:45 | `04-limited-key` | Lesson 1.2: a counter app, a gold key, an attacker; three attacks refused with reasons | "Give an app a key that can do only one thing." / "Then the app is hacked: the chain refuses each attack and says why." | The refusals are tiny text; the payoff (refused!) is easy to miss. |
| 5 | 0:45–1:06 | `05-shards-3d` | Lesson 2.1 3D pop-up book on a desk: shard ribbons, a page turn, NEAR coins hopping receipt by receipt | "Every lesson has a flat view and a 3D pop-up book." / "Follow a recorded testnet transaction hop by hop across shards, chunks and blocks." | The best visual in the cut, shown wide and long (21 s) with no camera move. |
| 6 | 1:06–1:24 | `06-deploy` | Lesson 3.1 3D: a contract deployed, storage bar, a change call, a failed call and its callback | "Deploy a contract in one click, call it," / "then watch a cross-contract callback catch a failure." | 18 s of similar frames; the failure and callback moment is not singled out. |
| 7 | 1:24–1:44 | `07-chain-signatures` | Lesson 4.1 3D: NEAR account, signing nodes adding shares, an Ethereum (Sepolia) zone, "Delivered to Ethereum: who signed it" | "Chain Signatures: one NEAR account signs for Ethereum." / "Derive an address…" / "In demo mode the app plays the signing network; the math is real." | The showpiece, but small and busy; the "recovers to that address" check is a tiny green line. |
| 8 | 1:44–1:55 | `08-intent-quote` | Lesson 4.2 3D: an intent, solvers, "The winning quote" | "Ask for a cross-chain swap with an intent." / "In demo mode it is a recorded example quote, not a live price." / "No money moves." | Fine; needs a push-in on the quote card. |
| 9 | 1:55–2:08 | `09-badge` | Honest take panel; contents with "Claiming… Signing the claim"; "Your badges" shelf | "Every lesson ends with an honest take on NEAR." / "Finish a stage to claim its badge: an NFT on testnet, kept in your browser in demo mode." | The badge, the hook for the NFT track, is a demo claim on a flat shelf. No testnet proof, no wallet vision. |
| 10 | 2:08–2:14 | — | Plain end card: "Book of NEAR · Learn how NEAR works by doing it, in a pop-up book you can touch · book-of-near.pages.dev · github.com/dispaz/book-of-near · Built for the NEAR Hackathon 2026. Testnet only. Demo mode needs no wallet." | "Try it: book-of-near.pages.dev. Demo mode needs no wallet." | Static. No brand moment. |

## 3. The target edit (2:12)

The same story, tightened, with the missing parts in. Every section keeps its real footage; the new
parts are the inserts and two generated shots.

| # | New time | Picture | Notes |
|---|---|---|---|
| 1 | 0:00–0:10 | **Generated hook** (3 s, [5b-1](#5b-generated-shots-new-picture)) → insert `A-intro-stage-ladder` (4 s) → `01-title` last 3 s | The problem, then the book opens on eight stages with depth bars and stars. |
| 2 | 0:10–0:18 | `02-quiz` | Trim the idle start; push in on the three questions, then on "Newcomer path". |
| 3 | 0:18–0:31 | `03-transaction` | Push-ins follow the pipeline lights; hold on "Final". |
| 4 | 0:31–0:44 | `04-limited-key` | Push in on each refused attack. |
| 5 | 0:44–1:03 | `05-shards-3d` | Slow orbit-feel drift over the book; push in on the hopping coins. |
| 6 | 1:03–1:18 | `06-deploy` | Speed up the deploy (1.5×), normal speed for the failure and callback. |
| 7 | 1:18–1:36 | `07-chain-signatures` | Push in on the signing nodes, then on "Delivered to Ethereum: who signed it". |
| 8 | 1:36–1:46 | `08-intent-quote` | Push in on the winning quote card. |
| 9 | 1:46–2:04 | `09-badge` honest take (3 s) → `B-testnet-claim` (7 s, may run 1.25×) → `C-checker-proof` (2 s) → `D-badge-wall` (3.5 s) → `E-wallet-concept` (2.5 s) | The NFT story end to end: finish, claim on testnet, anyone can check, a badge per stage, the wallet idea. |
| 10 | 2:04–2:12 | `F-outro-near-coin` (4 s) → **generated end card** (4 s, [5b-2](#5b-generated-shots-new-picture)) | Brand moment, then the link to try it. |

## 4. Style and motion

The look the whole film keeps (it is the app's own look):

- **Hand-inked illustration.** Black ink outlines on warm paper-white `#f3efe4`, hard offset ink
  shadows, card white `#fffdf7`. A green cloth book (`#145c43`) on a warm wooden desk. Serif titles,
  handwritten notes.
- **One accent per stage:** 0 orange `#ff8a3d`, 1 blue `#5f7bff`, 2 pink `#ff5fa2`, 3 sky blue
  `#1e9bd7`, 4 violet `#9a70f7`. NEAR green `#00ec97` only for NEAR things: coins, badges.
- **Mood:** calm, warm, crafted, confident; a premium product launch, not crypto hype.
- **Motion language:**
  - Sections change with a **page turn**: heavy paper curls from the right, a soft shadow sweeps
    across, about 0.6 s, eased in slowly and settling softly (no hard cuts between sections).
  - Inside a section: slow camera drift and **push-ins** (up to about 1.4×) onto the moment that
    matters, eased in and out over about 1 s; never shaky, never a whip-pan.
  - Highlights: a hand-drawn ink circle or underline in the stage accent around the key element
    (drawn on over about 0.5 s, gone before the next push-in).
  - Light: soft daylight from the upper left, a faint warm tint, gentle vignette, subtle paper grain;
    shallow depth of field on the desk around the 3D book only.
- **Avoid:** glitch, neon, chrome, lens flares, particle explosions, coin rain, charts or rockets,
  fast zooms, any warped or invented text.

## 5. Video prompts

### 5a. Enhancement prompts (on the real plates)

Global prompt for the polish pass (use with each plate, motion strength low):

```
Enhance this real product screen recording into a premium launch-film shot without changing any
interface element, text, number or layout. Keep the content pixel-faithful. Add only: a slow, smooth
camera move (gentle drift plus eased push-ins as directed), soft daylight from the upper left with a
warm tint, faint paper grain and vignette, motion blur on fast page turns, shallow depth of field on
the wooden desk around the book in 3D shots. Hand-inked illustration look, calm and crafted.
Do not add new UI, logos, text, particles, glitches or neon. Do not warp text.
```

Per-section direction (append to the global prompt):

| # | Direction |
|---|---|
| 1 | `01-title`, last 3 s: start close on the "Book of NEAR" title page, glide right across the open book to the contents list. |
| 2 | Push in on the three quiz questions as each is answered (pause on each); then a page turn to "Newcomer path" and a gentle push-in on it. Draw an orange ink circle round the chosen answer. |
| 3 | Follow the pipeline: ease from Build → Sign → Broadcast → Included → Final at the top, each lighting up; then a push-in on the coin moving to the blue cube; hold 1 s on "Final" with an orange ink underline. |
| 4 | Push in on the gold key handed to the app; then on each refused attack in turn, a blue ink circle round the refusal reason, hold 0.7 s each. |
| 5 | Wide on the 3D pop-up book for 2 s, then a slow drift across the shard ribbons as the page turns; push in on the NEAR coins hopping from shard to shard; finish wide. Pink ink accents. |
| 6 | Deploy at 1.5× speed; normal speed from the failed call: push in on the failed call and its callback, sky-blue ink circle on "A failed call and its callback". |
| 7 | Start on the NEAR account, glide to the signing nodes as they add their shares, then cross into the violet Ethereum zone; push in on "Delivered to Ethereum: who signed it" and the green check line, hold 1.5 s. |
| 8 | Ease in on the intent ("what you give, what you want"), then on the winning quote card, violet ink underline. |
| 9 | Honest take: drift down the Strengths and Weaknesses list. Inserts B–E play as they are (already animated); only add the page-turn transitions between them. |
| 10 | `F-outro-near-coin` as is; page-turn into the end card. |

### 5b. Generated shots (new picture)

**1. The hook (3 s, opens the film).** Voice: "Learning NEAR is hard."

```
3 seconds, hand-inked illustration, black ink outlines on warm paper-white, gentle camera push-in.
A tall, wobbly stack of dense grey documentation pages and overlapping browser windows on a warm
wooden desk, slightly overwhelming, pages fluttering. A hand lays a deep green cloth-bound hardcover
book on top; the stack's pages fold away and flatten into the book, leaving a calm, tidy desk with the
closed green book centred. No readable text, no logos. Last frame: the closed green book centred on
warm paper, ready to open (it cuts into a book opening).
```

**2. The end card (4 s, closes the film).** Text is laid in by the editor, not generated:

```
4 seconds, hand-inked illustration, warm paper-white background with faint ruled lines. The deep
green cloth book closes softly on a wooden desk; the camera rises to a top-down view and the book
slides to the left third, leaving clean space on the right for text. A single NEAR-green coin with an
ink rim rests beside it. Calm, warm light, still final 2 seconds for text. No text, no logos.
```

End-card text to lay over it: **Book of NEAR** (serif) · *Learn NEAR by doing, in a pop-up book you can
touch.* (handwritten) · **book-of-near.pages.dev** · github.com/dispaz/book-of-near · *Built for the NEAR
Hackathon 2026. Testnet only. Demo mode needs no wallet.*

**3. Page-turn transition (0.6 s, reusable between sections).**

```
0.6 seconds, macro: a single sheet of thick warm off-white paper with a thin black ink border turns
from right to left like a page of a large hardcover pop-up book, soft curl, shadow sweeping across,
paper fibres catching warm light. Plain, no text. Starts and ends on a flat page.
```

## 6. Captions

Replace the black caption band with captions styled like the app's margin notes: a warm paper card
with a 3 px ink border and a hard ink shadow, lower-left third, handwritten font (Caveat or similar),
the current stage's accent as a short underline. At most 2 lines, about 42 characters a line. Each
caption writes on left to right in about 0.4 s and lifts off as the next arrives. Captions follow the
voice-over in [7](#7-voice-over-eleven-v3) word for word (most tools can caption from the voice
track). Keep "demo mode", "testnet", "recorded example" and "No money moves" exactly as written.

## 7. Voice-over (Eleven v3)

**Voice:** a warm, clear, friendly narrator, late 20s to 30s, natural, not an announcer; smiling
slightly, unhurried. A designed voice or an instant clone (professional clones are less tuned for v3).
Stability **Natural**. Generate each line separately and place it at its start time; regenerate a
line two or three times and keep the best. Say "NEAR" as the word "near". If a tag does nothing,
change a word or the punctuation rather than adding tags.

About 2.2 words a second, with room for the music to breathe:

| Start | Section | Line |
|---|---|---|
| 0:00.4 | 1 hook | `[thoughtful] Learning NEAR is hard. The docs assume you already know crypto.` |
| 0:05.2 | 1 book | `[warm] Book of NEAR lets you do the real thing.` |
| 0:10.3 | 2 quiz | `Your first visit starts with three questions. They pick your path: newcomer, crypto veteran, or developer.` |
| 0:18.3 | 3 transaction | `Demo mode runs the chain right in your browser, so you need no wallet. Build a transaction, sign it, send it... and watch it reach Final.` |
| 0:31.3 | 4 limited key | `Give an app a key that can do only one thing. [beat] Then the app gets hacked... [confident] and the chain refuses every attack, and tells you why.` |
| 0:44.3 | 5 shards | `Every lesson has a flat view, and a 3D pop-up book. [curious] Here, you follow a real testnet transaction, hop by hop, across shards, chunks and blocks.` |
| 1:03.3 | 6 deploy | `Deploy a contract in one click. Call it. [beat] Then watch a cross-contract callback catch a failure.` |
| 1:18.3 | 7 chain signatures | `[impressed] With Chain Signatures, one NEAR account signs for Ethereum. Derive an address, get a signature, and check it recovers to that same address. In demo mode the app plays the signing network... [softly] the math is real.` |
| 1:36.3 | 8 intent | `Ask for a cross-chain swap with an intent. In demo mode it's a recorded example quote, not a live price. No money moves.` |
| 1:46.3 | 9 honest take | `Every lesson ends with an honest take on NEAR.` |
| 1:49.5 | 9 claim | `[brighter] Finish a stage, and claim its badge: a real NFT on testnet... that anyone can check.` |
| 1:58.0 | 9 badges | `One badge for every stage. [warm] Next: your badges, right in your NEAR wallet.` |
| 2:04.5 | 10 end | `[warm] Book of NEAR. Try it at book of near dot pages dot dev. Demo mode needs no wallet.` |

## 8. Music (Eleven Music)

### Option A: score the finished edit (video-to-music)

Upload the edited picture (no voice yet), latest music model if offered, with:

```
Warm, hopeful instrumental for a 2-minute product launch film about an interactive pop-up book that
teaches the NEAR blockchain. Felt piano and soft nylon-string plucks over a gentle pulse; light
glockenspiel on page turns. Starts intimate and thoughtful, gains a soft groove when the lessons
begin, grows a little with each lesson, wonder for the 3D shard scene, a confident lift for Chain
Signatures, a bright arrival when the badges appear, then a warm resolve on the final title. Calm,
crafted, optimistic; never epic, aggressive or EDM. No vocals. Leave space for a spoken voice-over.
```

Nudge with one change at a time if needed ("softer drums", "more space under the voice", "brighter
from 1:46").

### Option B: text prompt (2:12)

```
Instrumental, 2 minutes 12 seconds, 84 BPM, D major. Modern acoustic indie-pop for a product launch
film: warm, hopeful, hand-made. Felt piano, nylon-string plucks, glockenspiel, brushed snare and soft
kick, warm round bass, airy string pad, light shaker. No vocals. Gentle mid-range so a voice-over sits
on top.

0:00–0:04  Intimate felt-piano motif over a soft paper-like texture, a little unresolved (the problem).
0:04–0:10  Warm resolve as the book opens; plucks enter.
0:10–0:31  Light groove: shaker and soft kick; curious and moving forward.
0:31–0:44  Same groove, a touch more tension (the hack), resolving on the refusal.
0:44–1:03  Wonder: string pad opens out, glockenspiel sparkles, kick drops back.
1:03–1:18  Groove returns with brushed snare; playful pizzicato.
1:18–1:36  Build: bass and pad grow, confident and bright.
1:36–1:46  Settle to piano and plucks, steady.
1:46–2:04  Arrival: fullest section, warm and celebratory, glockenspiel accents from 1:57.
2:04–2:12  The opening motif resolved on a full warm chord, natural ring-out to silence.
No risers, drops or hype.
```

## 9. Assembly and checks

1. Picture: the target edit ([3](#3-the-target-edit-212)), page turns between sections, enhancements
   from [5a](#5a-enhancement-prompts-on-the-real-plates).
2. Voice lines on their start times; captions from the voice, styled as in [6](#6-captions).
3. Music under everything: fade in 1 s, fade out over the last 3 s, about −18 LUFS, ducked 6–8 dB
   under the voice.
4. Export MP4, H.264 + AAC, 1920×1080, 25 or 30 fps, **at most 2:20** and under 512 MB, for the X post.
5. Before posting:
   - Watch once with the sound off: every claim is readable.
   - Pause on the app shots and compare a few with the app: nothing was redrawn.
   - Testnet is said only over testnet footage (insert B, C, and the shard recording); demo mode is
     named over the demo shots.
