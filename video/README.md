# Demo video

A video of Book of NEAR, under a minute, in the app's ink style: real footage of the app recorded with
Playwright, composed with animated scenes in [Remotion](https://www.remotion.dev).

| # | Scene | What it shows |
|---|---|---|
| 1 | intro | The cloth-bound book opens; title and the eight stage accents pop up from the page |
| 2 | home | The contents: eight stages, scrolled |
| 3 | book-open | A lesson's closed cover opens, the page grows into the 3D pop-up book |
| 4 | learn | Lesson 0.1: open a notebook, send coins, open a block, switch 2D ↔ 3D |
| 5 | stages | Hopping stages 1 → 4 from the Contents menu, stage tabs stepping along |
| 6 | check | The quick check |
| 7 | claim | Claiming the stage 0 badge, then the shelf in My book |
| 8 | proof | The badge checker reading a real badge from NEAR testnet |
| 9 | badges | All eight badges stamped onto the page |
| 10 | wallet | Concept: the badges in a wallet's collectibles tab |
| 11 | outro | Name, links, "works in demo mode or on testnet" |

Order, seconds and every line of copy live in `src/storyboard.ts`.

## Make the video

```bash
cd video
npm install                 # once
# in another terminal, at the repo root: npm run dev   (http://localhost:5173)
npm run capture             # records every shot into public/clips (about 2 minutes)
npm run studio              # preview and scrub in the browser
npm run render              # → out/book-of-near-demo.mp4 (1920×1080, 30 fps, H.264)
```

`npm run capture -- --only learn,claim` re-records some shots; `--headed` shows the browser while it
records; `--base <url>` points at another server (a worktree's dev port, `npm run preview`, the live site).
A scene whose shot is not recorded yet renders a labelled placeholder, so the video always builds.

## The claim on real testnet

By default the claim shot runs in demo mode (same UI, no network). For the submission, record it on
testnet with an account that really finished stage 0:

1. Run the Worker (`cd worker && npx wrangler dev`, with `CLAIM_SIGNING_KEY` in `worker/.dev.vars`) and
   the app with `VITE_WORKER_URL=http://localhost:8787`.
2. In a normal browser, open the app with `?mode=testnet` and do lessons 0.1 to 0.3 (0.3 sends a real
   transaction). Don't claim yet.
3. In that browser's devtools, save the progress and the practice key to files outside the repo:
   `copy(localStorage["bon:v1"])` → `~/bon-progress.json`,
   `copy(localStorage["bon:testnet-practice-account:v1"])` → `~/bon-practice.json`.
4. `TESTNET_PROGRESS=~/bon-progress.json TESTNET_STORE=~/bon-practice.json npm run capture -- --testnet --only claim`

Or record it by hand: `npm run capture -- --testnet --manual claim` opens a recording window; do the
claim, close the window, then set `trimStart` for `claim` in `public/clips/manifest.json`.

The `proof` shot reads `bon-learner-mwe61s8i.testnet` (the first real badge holder); set
`PROOF_ACCOUNT=<you>.testnet` to show your own.

Claude Code: the `demo-video` skill (`.claude/skills/demo-video/SKILL.md`) knows this pipeline.
