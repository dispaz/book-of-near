---
name: demo-video
description: Record, edit or render the Book of NEAR demo video (video/): re-capture app footage, change the storyboard's scenes, copy or timing, or add an animated scene.
---

# Demo video

The video is two halves joined by `video/public/clips/manifest.json`:

- **Capture** (`video/capture/record.ts`, Playwright): drives the real app and records one WebM per **shot**, writing each shot's `trimStart` (where the useful footage begins) and `duration` to the manifest.
- **Compose** (`video/src/`, Remotion): `storyboard.ts` is the single source of truth for scene order, seconds and copy. A `clip` scene plays its shot in an ink browser frame with a margin note; `intro`, `badges`, `wallet`, `outro` are pure animation. A shot id appears in both `storyboard.ts` (`clip`) and `record.ts` (`SHOTS`).

Commands live in `video/package.json`; the one-time setup and testnet recipe in `video/README.md`.

## Steps

1. **Read the ask against the storyboard.** Open `video/src/storyboard.ts`. Copy or timing change → edit there only. New footage → a new or changed shot in `record.ts` plus its scene in the storyboard.
2. **Capture what changed.** The app must be running (`npm run dev` at the repo root, or `vite --port <p>` in a worktree). Run `npm run capture -- --base <url> --only <ids>` from `video/`. Done when the run prints a duration for every requested shot and no `*.failed.png` appears in `public/clips/`. On a failure, read the screenshot: selectors come from the e2e specs (`e2e/lessons/*.spec.ts`, `e2e/badges.spec.ts`); reuse their role names.
3. **Fit takes to slots.** The frame plays a take at `duration / seconds`, clamped to 0.8–3x. Aim for 1–2x: shorten pauses in the shot or give the scene more seconds. The whole storyboard must stay under 60 s (`Root.tsx` throws otherwise).
4. **Look at it.** Render stills at the frames you touched (`npx remotion still src/index.ts DemoVideo out/x.png --frame=<n> --scale=0.5`) and read them. Scene start frames: cumulative `seconds * 30` minus 12 frames per earlier scene. Done when every changed scene is checked by eye.
5. **Render** with `npm run render` → `video/out/book-of-near-demo.mp4`. Then `npx tsc --noEmit` in `video/` and `npm run lint` at the root.

## Style rules

- Ink style, matching the app: 4–6px `INK` outlines, hard offset shadows (`8px 8px 0 INK`), paper ground (`<Paper>`), one stage accent per scene, Newsreader titles, Caveat notes, DM Sans labels.
- Colours come from `src/scene-kit/theme.ts` via `video/src/theme.ts`, never as hex. NEAR green marks NEAR things only (coins, the badges, underlines on the brand title); badge art is the real `public/badges/*.svg`, synced on every script run.
- Motion: `spring()` for things that pop up from the page, `interpolate` + `Easing` for writing and turning. Every scene enters with the `PageTurn` (12 frames, `TURN`).
- Copy follows CLAUDE.md "Learner copy": plain, short, no hype. Claims stay true: demo footage never says "testnet" unless it was captured with `--testnet`; the wallet scene is a concept, stamped CONCEPT, drawn as a generic phone (no real wallet's brand or layout).

## Gotchas

- Node strips types natively, so `capture/*.ts` must be erasable TypeScript: no constructor parameter properties, enums or namespaces, and imports carry `.ts`.
- Explorers (nearblocks) show a bot check to headless browsers; the `proof` shot uses the app's own `/check?mode=testnet` instead.
- Lessons lazy-load three.js: warm a lesson once before `d.mark()` so the take shows the pop-up, not a load.
- Remotion's general know-how: `npx skills add remotion-dev/skills` installs the official `remotion-best-practices` skill.
