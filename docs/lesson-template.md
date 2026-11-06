# Lesson template

Every lesson has the same five-part shape. Scaffold one with `/new-lesson` or
`npm run new-lesson -- <id> --stage N --title "Title" [--chain] [--order N]`, then fill it in.

## Where things live

| What | Where |
| --- | --- |
| Researched script (steps, check, Honest take, demo data, sources) | `docs/lessons/stage-<n>/<n>.<order>.md` (for example `stage-0/0.1.md`); unnumbered lessons use `<id>.md` |
| Manifest (steps, captions, gates) | `src/content/lessons/<id>/manifest.ts` |
| Scene (one state, a 2D SVG view and a lazy 3D view) | `src/content/lessons/<id>/Scene.tsx` |
| End-to-end test (demo mode) | `e2e/lessons/<id>.spec.ts`, helpers in `e2e/lessons/helpers.ts` |
| Shared building blocks | `src/lesson-kit/`: `<Check>`, `<HonestTake>` |

Write the script first. The code copies from it; it does not invent facts.

## The shape

| Part | Manifest step(s) | What happens |
| --- | --- | --- |
| **Hook** | first step | A question, a surprise or a problem that makes the lesson worth a few minutes. |
| **Concept** | one or more steps | The one idea, in plain words, shown in the scene. Define each term the first time it appears. |
| **Do** | one or more steps with `action: { label, gate: true }` | The learner does the real thing (sends, signs, clicks, edits). Next stays locked until the scene calls `setGate(true)`. Put the button in `<SceneAction>` so it docks in the same spot in every lesson. |
| **Check** | one gated step with `page: "summary"` | `<Check questions={...} onPass={() => setGate(true)} />`. The quiz opens as a window in the middle; behind it the page lists every step's caption and `explain` (the summary). The learner can minimise the quiz to read it. |
| **Honest take** | last step | `<HonestTake ... />`. The last step shows "Finish lesson", which writes the completion record. |

Each step has a `caption` (the step heading at the top of the page, at most about 160 characters) and an
optional `explain` (the note, at most about 60 words). Keep the step numbers in `Scene.tsx` in sync with
the manifest.

Point the note at the thing it explains with `explainAt: "<name>"`, and mark that thing in the scene:
`data-explain="<name>"` on any 2D element or HTML tag, or `<Anchor name="<name>" position={...} />` from the
scene kit in 3D. On wide screens the note then sits in the left margin, level with the element, with an
arrow to it (the learner can fold it away). On phones, or when the element is not drawn, it stays in the
dock under the step's buttons. Give both views the same names. An element hidden by CSS (no size) counts as
not drawn. A scene that has no room for a margin note at the current size (a side panel leaves too little
page beside the note, as in 0.2 on tablets) puts `data-notes="dock"` on its root, and the note stays docked.

For 3D, fit the camera instead of hand-tuning presets: name the box of the world each step must show and
pass it to the scene kit's `frameCamera` with the free part of the canvas, plus `<ViewOffset>` to centre it
there (0.1 `shotFor`, 0.2 `wallet3d.ts`, 0.3 `layout3d.ts`). Build the box with the kit's `focusOf` from `Box`es. Use `{ nearFit: true }` for a small window
looking at a deep box. Draw only the objects the step frames, so nothing hangs out under the panels.

## The check

- Multiple choice, two to four options, exactly one correct (`correct: true`).
- Every wrong option has a `why`: one sentence on why it is wrong. The learner sees it after "Check answers".
- The gate opens only when **every** answer is right. Wrong answers can be changed and checked again.
- Test the idea, not the wording. One to three questions.
- Pass `passed` when the learner comes back to an opened step, so the check does not reset.

## Honest take (required)

Every lesson ends with one. It lists NEAR's **strengths and weaknesses** for this topic, never only strengths.

- Name the chain you compare with: `comparedWith="Ethereum" | "Solana" | "Cosmos" | "Bitcoin"`, an array of
  them, or `"not different"` when NEAR works like most chains here. Say so plainly; that is a fine answer.
- At least one real weakness. "Slower than a database", "fewer apps", "a rule that is easy to get wrong"
  all count. Each claim has a source in the script.
- No hype. No "revolutionary", "blazing", "best".

## Uncertain claims

- Facts listed in `docs/spikes-seed.md` are not truth until they are verified there (issue #4 result log).
- If a claim is still uncertain, mark it. In the Honest take use `{ text: "...", unverified: true }`, which
  renders "(unverified)". In captions and explains write "(unverified)" after the claim, or leave it out.
- When sources disagree (for example block time "about 600 ms" vs "about a second"), say the safer
  version ("about one second or less") and note the conflict in the script.

## The book

Every lesson is a page of a book. Opened at its start, a lesson shows a closed cover (stage, lesson
number, title and the manifest's `summary`, so write a good one); the learner opens it. The 2D page shows
first; if the learner's view is 3D, the 3D scene then grows out of the page (the scene kit's `InkStage`
does this by itself, through `IntroContext`). Switching from 2D to 3D grows it the same way. Opening a
later step by URL skips the cover. `localStorage["bon:cover"] = "off"` turns the cover off (the e2e config
does this; `e2e/book.spec.ts` tests the cover).

## Two views: 2D and 3D

Almost every lesson offers both views (`views: ["2d", "3d"]` in the manifest). The lesson page shows a 2D / 3D switch, remembers the choice and passes `view` to the scene. Rules:
- Keep the lesson state in ONE place (a hook or reducer in `Scene.tsx`) and render `view === "3d" ? <Scene3D …/> : <Scene2D …/>` from it, so switching mid-lesson keeps every gate, value and result.
- Load the 3D view with `React.lazy(() => import("./Scene3D"))`, so 2D never downloads three.js.
- The 3D view is a book scene (`<BookScene>`, rules in `docs/book-scene.md`): the figure on the right page, the step printed on the left page on wide screens, a page turn per step and a camera tour. Scaffold with `--book`.
- Both views show the same facts and offer the same actions (the shared `SceneAction` buttons and forms live outside the views, or are reused by both). Tests must pass in both: run the lesson walk with `?view=2d` and `?view=3d`.
- Without WebGL the page forces 2D. Under reduced motion the 3D view jumps to end states.
- 2D-only is allowed for lessons that are mostly text or forms; note why in the manifest.

## The learner's own values

When the learner can change a value (an amount, a message, a name), every later text must use what they chose, never the default. Write it as a placeholder in the manifest (`caption: "Ana sent you {tamper} coins, not {sent}."`), give defaults in `vars: { sent: "3", tamper: "9" }`, and report the real values from the scene with `setVars({ sent: "5" })`. LessonPage fills placeholders in the caption, explain, action label, "Read as text" and the text fallback. Scene-drawn hints must read the same state. Add an e2e that changes the value and checks a later step's text.

## Copy rules

Plain English. Short sentences. Define a term the first time it appears (in bold in the script). One idea
per step. Talk to the learner ("you"). No hype, no jargon without a definition, no exclamation marks.

## Demo-mode parity

Every lesson must work in demo mode with no wallet and no network: that is what reviewers and the e2e
tests run. Lessons that touch the chain set `needsChain: true` and go through `useChain()` only
(`docs/chain.md`). DemoChain answers in demo mode, TestnetChain in testnet mode. Never call RPC, wallets or
SDKs from a lesson. Use `pace: reducedMotion ? "instant" : "realtime"` for chain calls.

## Fallback and reduced motion

- `reducedMotion` is a scene prop: jump to end states, no tweening. The global CSS already cuts transitions.
- The page shows a text fallback (the captions) when the scene fails or WebGL is missing. If your gated
  steps cannot be passed from the captions alone, give the manifest a `fallback` component.
- Every SVG has `role="img"` and an `aria-label` that says what it shows.

## Evidence

When the learner does something on chain, call `reportEvidence?.({ txHash })`. It is merged into the
lesson's completion record. Never pass keys or seed words.

## Tests: failing, then passing

The generated spec has two tests:

1. **Walk** (passes straight away): opens the lesson from the contents in demo mode, does the action,
   answers the check, reaches the Honest take, presses Finish and asserts the completion record through
   `window.__bookOfNear.progress`. When you change the steps, the action label or the check answers,
   update this test.
2. **Lesson outcome** (`test.fixme`): a stub for the lesson-specific assertion. Turn `test.fixme` into
   `test`, write the assertion on your scene's real state (for example `data-scene-state`, a balance or a
   hash), watch it fail, then build the scene until it passes. Never ship a `test.fixme`.

Run one lesson: `npx playwright test e2e/lessons/<id>.spec.ts` (set `E2E_PORT` when other previews run).

## Scaffold rules

- A new id gets the next number in its stage (orders 10+ are backlog cards and placeholders).
- A **planned** manifest with the same id is replaced in place: same stage, order and summary.
- A **ready** (or card) lesson is never overwritten. Existing `Scene.tsx` or spec files are not touched.
