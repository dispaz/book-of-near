# Demo video

A video of Book of NEAR, under a minute, in the app's ink style: real footage of the app recorded with
Playwright, composed with animated scenes in [Remotion](https://www.remotion.dev), over a calm
soundtrack.

| # | Scene | What it shows |
|---|---|---|
| 1 | intro | The cloth-bound book opens: the title on the left, the eight stages fold up on the right, each with its topic, a depth bar and 1–5 stars |
| 2 | contents | The contents page: a finger runs down stages 0 to 4, picks lesson 0.1, the book turns to it and the 3D page grows |
| 3 | learn | The lesson menu, ledgers reacting to the pointer, block #1 opened for a close look at its transaction |
| 4 | check | The quick check answered wrong (each answer explains why), then right, the Honest take, Finish |
| 5 | claim | Stage 0 done, the badge claimed on NEAR testnet (the wait sped up, and labelled so), then minted |
| 6 | proof | The badge checker reading that badge straight from testnet |
| 7 | badges | All eight badges stamped onto the page |
| 8 | wallet | Concept: the badges in a wallet's collectibles tab |
| 9 | outro | Name, links, a NEAR coin |

Order, seconds, every line of copy, push-ins and speed ramps live in `src/storyboard.ts`.

## Make the video

```bash
cd video
npm install                 # once
# in another terminal, at the repo root: npm run dev   (http://localhost:5173)
npm run capture             # records every shot into public/clips
npm run studio              # preview and scrub in the browser
npm run render              # → out/book-of-near-demo.mp4 (1920×1080, 30 fps, H.264 + AAC)
```

`npm run capture -- --only learn,check` re-records some shots; `--headed` shows the browser while it
records; `--base <url>` points at another server. Each take records named **beats** (e.g. `wrong`,
`claimed`) into `public/clips/manifest.json`; notes, push-ins and ramps in the storyboard are timed to
them, so a re-recorded shot stays in sync. A scene with no recording renders a labelled placeholder.

## The claim on real testnet

Without this, the claim shot runs in demo mode (same screens, nothing sent). With it, the badge is a
real NFT minted to a fresh practice account.

1. Run the Worker with its keys (`worker/.dev.vars`, see `docs/badge-contract.md`), allowing localhost:
   `cd worker && npx wrangler dev --port 8787 --var ALLOW_LOCALHOST:1`
2. Run the app against it: `VITE_WORKER_URL=http://localhost:8787 npm run dev` (repo root).
3. `npm run capture -- --prep-testnet` — the app makes a practice account and sends lesson 0.3's real
   transfer. The throwaway key, account and evidence go to `.capture-profile/testnet.json` (gitignored).
4. `npm run capture -- --testnet --only claim,proof` — the claim shot claims for that account on testnet;
   the proof shot reads its badge with the checker.

Each prepared account can claim its stage 0 badge once: run `--prep-testnet` again for another take.
`npm run capture -- --testnet --manual claim` records a take done by hand instead.

## Sound

`scripts/make-audio.mjs` synthesises the soundtrack (soft pads, a felt-piano arpeggio, a low bass, at 72
BPM) and the page-turn swish, so there is no licence to clear. It runs with every `studio`/`render`. To
use another track, drop it in `public/audio` and point `MUSIC.src` in `src/storyboard.ts` at it.

Claude Code: the `demo-video` skill (`.claude/skills/demo-video/SKILL.md`) knows this pipeline.
