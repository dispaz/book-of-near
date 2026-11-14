# Prompt pack: music, voice-over and video polish for the Book of NEAR demo

For an external pass (ElevenLabs, or any generator that accepts a reference video) over the video
this repo renders: `video/out/book-of-near-demo.mp4` (57.2 s, 1920×1080, 30 fps). Four parts:

1. [Ground rules](#1-ground-rules) — read first, they keep the video honest for the judges.
2. [Music](#2-music-eleven-music) — Eleven Music, two ways: video-to-music or text prompt.
3. [Voice-over](#3-voice-over-eleven-v3) — a timed script with Eleven v3 audio tags.
4. [Video polish and the missing parts](#4-video-generation-polish-and-new-shots) — prompts for a
   video generator.

Then [assembly](#5-assembly).

## The timeline

The video as rendered now. Times are when each scene is fully on screen; each scene turns in like a
page over the last 0.7 s of the one before.

| # | Time | Scene | On screen |
|---|---|---|---|
| 1 | 0:00–0:04 | Intro | A green cloth book drops onto paper and opens. Left page: "Book of NEAR — Learn NEAR by doing, one page at a time." Right page: the eight stages fold up as rows, each with a depth bar and 1–5 stars. |
| 2 | 0:04–0:12 | Contents | The real contents page. The pointer runs down stages 0 to 4 and picks lesson 0.1; the book turns its pages and the 3D pop-up page grows. |
| 3 | 0:12–0:22 | Learn | A lesson in 3D on a desk: the lesson menu opens and closes, ledgers lift under the pointer, block #1 opens and the camera pushes in on "Inside block #1: Ana→Ben 3". |
| 4 | 0:22–0:32 | Quick check | Three questions answered wrong; each shows why. Then right ("All right"), the Honest take, Finish lesson. |
| 5 | 0:32–0:41 | Claim | Stage 0 done, "Your badge is ready". Claim → "Claiming… checks your work on testnet" (sped-up 3×, tagged) → "Stage 0 badge claimed", the testnet explorer link. |
| 6 | 0:41–0:44 | Proof | The badge checker reads the account's badge straight from NEAR testnet. |
| 7 | 0:44–0:48 | Badge wall | Eight round badges stamp onto the page: "One badge for every stage you finish". |
| 8 | 0:48–0:53 | Wallet concept | The badges fly into a phone's Collectibles tab, stamped CONCEPT. |
| 9 | 0:53–0:57 | Outro | "Book of NEAR — Open the book. Learn by doing. Keep the proof." Links; a NEAR coin drops in. |

The look, for every prompt below: **hand-inked illustration**. Black ink outlines on warm paper-white
(`#f3efe4`), hard offset ink shadows, one bright accent per stage (orange `#ff8a3d`, blue `#5f7bff`,
pink `#ff5fa2`, sky blue `#1e9bd7`, violet `#9a70f7`), NEAR green `#00ec97` only for NEAR things (coins,
badges), a deep green cloth book cover (`#145c43`). Serif titles, handwritten notes. Calm, warm, crafted;
a pop-up book on a wooden desk, not a sci-fi crypto look.

## 1. Ground rules

- **The product shots stay real.** Scenes 2–6 are recordings of the working app; judges open the app
  and compare. A generator may re-time, frame, light and transition them, but must not redraw, restyle
  or invent any UI, text, number, account name or transaction hash. If a tool can only regenerate whole
  frames, use it for the intro, the transitions, the badge wall, the wallet concept and new b-roll only.
- **No invented features.** The wallet scene is a concept and keeps its CONCEPT stamp. Say "testnet",
  never "mainnet". Badges are soulbound: never show trading, prices or selling.
- **No brands but NEAR.** No real wallet's, exchange's or other chain's logos or layouts.
- **Silent-friendly.** X autoplays muted: the on-screen notes already tell the story, and the voice
  repeats them in fewer words, never contradicting them.
- **Length.** Keep it under 1:30 with the new parts (X allows 2:20 without Premium).

## 2. Music (Eleven Music)

### Option A — score the video (video-to-music)

Upload `book-of-near-demo.mp4` (or the polished cut) to Eleven Music's video-to-music, with the
latest music model if offered, and this description:

```
Warm, hopeful instrumental for a product launch film about an interactive pop-up book that teaches
blockchain. Felt piano and soft plucked strings over a gentle pulse, light glockenspiel sparkles on the
page turns. Starts intimate and curious, gains a soft beat when the lessons begin, lifts with warm pads
and a confident groove when the badge is claimed, a bright stamping moment for the badge wall, then
resolves gently on the final title. Calm, crafted, optimistic, never epic or aggressive. No vocals.
Leave room for a spoken voice-over.
```

If the first take misses, keep the video and nudge with one change at a time, e.g. "more ambient, less
melodic", "softer drums", "brighter at 0:44".

### Option B — text prompt (57 s; 66 s if you add the new parts in section 4)

```
Instrumental, 57 seconds, 84 BPM, D major. Genre: modern acoustic indie-pop for a product launch film,
warm and hopeful, hand-made feel. Instruments: felt piano, soft nylon-string plucks, light glockenspiel,
brushed snare and soft kick, warm round bass, airy string pad. No vocals.

0:00–0:04  Intro: solo felt piano motif, intimate, a soft page-flutter shimmer at 0:01 as a book opens.
0:04–0:12  Add nylon plucks and a light shaker pulse; curious, moving forward.
0:12–0:22  Soft kick and brushed snare enter; gentle groove, piano carries the motif.
0:22–0:32  Same groove, a small playful lift (pizzicato) around 0:27.
0:32–0:41  Build: bass and string pad swell, groove becomes confident; small rise into 0:41.
0:41–0:48  Arrival: brightest section, glockenspiel accents on each beat from 0:44 (badges stamping).
0:48–0:53  Pull back to piano and pad, dreamy and forward-looking.
0:53–0:57  Resolve: the opening motif once more, full warm chord, natural ring-out to silence.

Mix: gentle, uncluttered mid-range so a voice-over sits on top. No risers, no drops, no hype.
```

Keep the generated track around −18 LUFS and duck it 6–8 dB under the voice.

## 3. Voice-over (Eleven v3)

**Voice:** a warm, clear, friendly narrator in their late 20s to 30s, natural not "announcer",
smiling slightly, unhurried. A designed voice or an instant clone works best with v3 (professional
clones are less tuned for it). Stability: **Natural**. Speed: normal.

**How it's written:** about 120 words for 57 s, so the music breathes. One line per scene, a few
audio tags, short sentences. Each line starts at the time shown; generate line by line (or as one take
and cut at the gaps) and place each on its timestamp. "NEAR" is said as the word "near".

| Start | Line (paste as-is) |
|---|---|
| 0:00.5 | `[warm] This is Book of NEAR.` |
| 0:02.5 | `A course you don't just read... [softly] you do.` |
| 0:05.0 | `Eight stages, from your very first transaction... to chain abstraction.` |
| 0:09.0 | `Pick a lesson, and the book turns to it.` |
| 0:12.5 | `[curious] Every page is a little world you can touch.` |
| 0:16.5 | `Open a block... and see the transaction inside.` |
| 0:22.5 | `Then, a quick check.` |
| 0:24.5 | `[gently] Get it wrong, and it tells you why.` |
| 0:28.0 | `Get it right, and you finish the lesson.` |
| 0:32.5 | `[brighter] Finish a stage... and your badge is ready.` |
| 0:35.5 | `One click. The app checks your work on NEAR testnet...` |
| 0:39.0 | `[pleased] and the badge is minted to your own account.` |
| 0:41.5 | `Anyone can check it.` |
| 0:44.5 | `One badge for every stage you finish.` |
| 0:48.5 | `[warm] Next: your badges, right in your NEAR wallet.` |
| 0:53.0 | `Book of NEAR. [beat] Open the book. Learn by doing. Keep the proof.` |

Tips: if a tag does nothing, change a word or the punctuation rather than adding tags. Generate two or
three takes of the opening and closing lines and pick the best. If "NEAR" ever comes out as "N-E-A-R",
write it as "Near" in that line.

## 4. Video generation: polish and new shots

### 4a. Polish pass over the existing cut (reference video)

Use the rendered video as the reference/source, motion-strength low, and ask only for camera and
light, so the app footage stays pixel-faithful:

```
Polish this product demo into a premium launch film without changing any on-screen interface, text or
numbers. Keep every frame's content, layout and timing. Add: gentle cinematic camera drift (slow
dolly-in of 2–4% on each scene, never shaky); soft natural light from the upper left with a warm
afternoon tint; subtle paper grain and a faint vignette; light depth of field on the desk around the
book in the 3D lesson shots; smooth motion blur on fast page turns. Transitions stay as page turns:
make them feel like real heavy paper, with a curl, a soft shadow sweeping across and a short flutter
of the page edge. Style: hand-inked illustration, black outlines on warm paper, calm and crafted.
Avoid: new UI, warped text, extra logos, neon, glitch effects, 3D chrome, crypto clichés (coins raining,
charts, rockets).
```

### 4b. Transition inserts (0.6–1 s each, between scenes)

Generate one and reuse it, or one per scene change; overlay at each scene boundary:

```
Macro shot, 1 second: a single sheet of thick warm off-white paper with a printed black ink border
turns over from right to left like a page of a large hardcover pop-up book, soft curl, shadow sweeping
across, tiny paper fibres catching warm light. Plain background, no text, no logos. Seamless start and
end on a flat page. Hand-made, tactile, calm.
```

### 4c. Missing part 1 — the problem, before the intro (3 s)

The organisers advise: lead with the user problem. A new opener, 0:00–0:03, with the voice line
`[thoughtful] Most people learn crypto from walls of docs.`

```
3 seconds, hand-inked illustration style, black ink outlines on warm paper-white, one muted orange
accent. A tall, wobbly stack of dense grey documentation pages and browser tabs on a wooden desk,
slightly overwhelming. A hand lays a deep green cloth-bound book on top; the stack's pages fold away
and flatten into the book's cover, leaving a calm, tidy desk with the closed green book centred, ready
to open. Gentle camera push-in. No readable text, no logos. Ends on the closed green book, matching
the first frame of the existing intro.
```

### 4d. Missing part 2 — "Only on NEAR" (6–8 s, after the Learn scene)

This shows NEAR's own features (the organisers ask for NEAR's role, concretely). **It must be real
footage of the app**, not generated: four 1.5–2 s clips, recorded the same way as the rest
(`video/capture/record.ts`, one new shot). Generated video may only frame them, e.g. as four
pop-up cards on a desk:

| Lesson | Clip | Note on screen | Voice |
|---|---|---|---|
| 1.1 | Claiming a readable name, e.g. `ana.testnet` | Names, not hex | `Readable account names.` |
| 1.2 | A key that may call one method only | A key that can do one thing | `Keys that can do just one thing.` |
| 2.1 | A transaction travelling across shards, in 3D | Follow it across shards | `Transactions that cross shards.` |
| 4.1 | One NEAR account signing for Ethereum Sepolia | One account, every chain | `[impressed] And one account that signs on other chains.` |

Optional frame prompt (around real clips placed as plates):

```
Four small pop-up cards stand up one after another from the right-hand page of an open green
hardcover book on a wooden desk, each card a flat screen showing a provided video plate (do not alter
the plates). Ink-outlined paper cards with hard ink shadows, each with a coloured tab (blue, blue, pink,
violet). Camera glides left to right past them, 1.5 seconds per card, warm soft light. No extra text.
```

Adding 4c and 4d takes the video to about 1:07. Shift every later voice line and music section by the
added time (3 s after 4c; 3 s + the strip after 4d).

## 5. Assembly

1. Music under picture: start at 0:00, fade in 1 s, fade out over the last 2.5 s; duck under voice.
2. Voice on its timestamps; keep the page-turn sounds from the render (`public/audio/page.wav`) at
   about −20 dB.
3. Export MP4, H.264 + AAC, 1920×1080, 30 fps, under 2:20 and under 512 MB, for the X post.
4. Before posting, watch it once with sound off: every claim must be readable on screen.

Or hand the voice and music files back to this repo: put them in `video/public/audio/`, point
`MUSIC.src` (and a voice track) at them in `video/src/storyboard.ts`, and `npm run render`.
