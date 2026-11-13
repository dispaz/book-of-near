---
name: demo-video
description: Record, edit or render the Book of NEAR demo video (video/): re-capture app footage, change the storyboard's scenes, copy, timing or music, or add an animated scene.
---

# Demo video

The video is two halves joined by `video/public/clips/manifest.json`:

- **Capture** (`video/capture/record.ts`, Playwright): drives the real app and records one WebM per **shot**. Each shot writes its `trimStart`, `duration` and **beats** (named moments, seconds into the take) to the manifest.
- **Compose** (`video/src/`, Remotion): `storyboard.ts` is the single source of truth for scene order, seconds, notes, push-ins and ramps, all timed to beats. `timing.ts` fits a take into its scene. `intro`, `badges`, `wallet`, `outro` are pure animation. A shot id appears in both `storyboard.ts` (`clip`) and `record.ts` (`SHOTS`).

Commands, the testnet recipe and the sound live in `video/README.md`.

## Steps

1. **Read the ask against the storyboard.** Copy, timing, notes, push-ins → `storyboard.ts` only. New or changed footage → the shot in `record.ts` (mark `d.beat()` wherever the storyboard should react) plus its scene.
2. **Capture what changed** against a running app: `npm run capture -- --base <url> --only <ids>` from `video/`. Done when every requested shot prints a duration and its beats, and no `*.failed.png` sits in `public/clips/`. On a failure, read the screenshot; take selectors from the e2e specs (`e2e/lessons/*.spec.ts`, `e2e/badges.spec.ts`).
3. **Fit takes to scenes.** A take's base rate is clamped to 0.8–1.6x; dead time (a chain wait) gets a `ramp` with a label saying it is sped up. Aim for a base rate near 1. The whole storyboard stays under 60 s (`Root.tsx` throws otherwise).
4. **Look at it.** Stills at the frames you touched (`npx remotion still src/index.ts DemoVideo out/x.png --frame=<n> --scale=0.5`), then read them. Scene starts come from `sceneStarts()` in `storyboard.ts`. Done when every changed scene is checked by eye.
5. **Render** with `npm run render` → `video/out/book-of-near-demo.mp4`, then `npx tsc --noEmit` in `video/` and `npm run lint` at the root.

## Style rules

- Ink style, matching the app: 4–6px `INK` outlines, hard offset shadows (`8px 8px 0 INK`), paper ground (`<Paper>`), one stage accent per scene, Newsreader titles, Caveat notes, DM Sans labels.
- Colours come from `src/scene-kit/theme.ts` via `video/src/theme.ts`, never as hex; the NEAR mark from `src/scene-kit/nearMark.ts`. NEAR green marks NEAR things only (coins, badges, the brand title's underline); badge art is the real `public/badges/*.svg`, synced on every run.
- Motion: every scene enters with `PageTurn` (`TURN` frames, eased swing about the spine, the old page sinking back). `spring()` for things that pop up from the page, `interpolate` + `Easing` for writing and camera moves. Scrolling in a take goes through `d.reveal()`: one eased, clamped scroll, so footage never jitters against a page end.
- Copy follows CLAUDE.md "Learner copy": plain, short, no hype. Claims stay true: "testnet" only on footage captured with `--testnet` (the manifest's `network` says which); a sped-up part says so on screen; the wallet scene is a concept, stamped CONCEPT, drawn as a generic phone (no real wallet's brand or layout).

## Gotchas

- Node strips types natively, so `capture/*.ts` must be erasable TypeScript: no constructor parameter properties, enums or namespaces, and imports carry `.ts`. Functions passed to `page.evaluate` can't close over outer functions.
- A lesson opened from the contents turns its pages and skips the cover; `?step=N` opens a later step with its state already built (lesson 0.1 step 3 has block #1).
- Explorers (nearblocks) show a bot check to headless browsers; proof shots use the app's own `/check?mode=testnet`.
- `.capture-profile/testnet.json` holds a throwaway testnet key: gitignored, never commit or print it.
- Remotion's bundled ffmpeg is minimal (no `tile`, no raw formats): extract single frames with `-ss` and audio as `pcm_s16le` WAV.
- Remotion's general know-how: `npx skills add remotion-dev/skills` installs the official `remotion-best-practices` skill.
