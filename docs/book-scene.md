# Book scene: the standard 3D lesson view

Every lesson's 3D view is a living pop-up book. Lesson 0.1 (`l-0-1-blockchain-basics`) was built this way
first (Nov 2026, prototype branch `worktree-prototype-3d-scene-lesson-0-1`, three commits from `6c3aa68`
to `c08a44e`). This page is the standard extracted from it. Decision record: `docs/adr/0001-book-scene-standard.md`.

Start a new lesson as a book scene with `npm run new-lesson -- <id> --stage N --title "…" --book`.

## What the learner sees

| Part | Where | Who draws it |
| --- | --- | --- |
| Cover → open book → 2D page → 3D grows out of the page | Lesson start and 2D → 3D switch | App (`LessonPage`, `IntroContext`), automatic |
| Desk, open book, cloth cover, ribbon, page edges | Under the scene | `BookBackdrop` (via `BookScene`) |
| The step's figure, standing on the **right page** | Pages at y = 0 | The lesson (children of `BookScene`) |
| The step's heading, note and action, **printed on the left page** | Wide screens (≥ 1100 px), not at the quiz / honest take | `PrintOnPage` + `SpreadContext` (via `BookScene`); the lesson page lays its `.book-page` out as print |
| Page numbers at the foot, "Fig. n  …" caption under the figure | Right page foot | `BookBackdrop` (`folios(sheet)`, `caption`) |
| Running heads (`Stage n`, lesson title) | Page heads, only when the words are docked | `BookBackdrop` (`heads`) |
| Page turn: the figure folds flat, the page curls over, outlines rise, hatching fills in | Every new step (`page`) | `InkStage` + `PopUp` (via `BookScene`) |
| Play / pause + caption: a camera tour of the figure | Stage bar (`BarSlot`) | `useTour` + `TourControls` (via `BookScene`) |
| Status note and the scene's own panel (forms, results) | Bottom of the free area, over the right page | `.book-scene .sk-status`, `.book-scene-panel` (scene-kit.css), placed by `useFreeFrame` |

**The words are never lost.** They go back to their docked place (`data-spread` off) when the screen is
narrower than 1100 px, at the quiz and the honest take, during a tour close-up, and when the learner orbits
the page off screen.

## Building one

The lesson supplies only what is its own: the figure, its ground box, the framing of each step and the
tour. `BookScene` does the rest. Minimal shape (what `--book` generates):

```tsx
const FIGURE = { minX: -2, maxX: 2, minZ: -1.6, maxZ: 1.6 };   // every step's objects + labels
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
const TEXT = textBlock(SPREAD.print);                            // the left page's text block

export default function Scene3D({ m, reducedMotion, flat, mode }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const summary = m.step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(m.step, CHECK);
  return (
    <div ref={root} className={`book-scene${summary ? " summary" : ""}`} data-view="3d">
      <BookScene
        page={m.step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={focusFor(m.step)}
        frame={inset(frame, reserveFor(m.step))}
        size={size}
        shots={tourFor(m.step)}
        shotFocus={(t) => shotFocus(t, m.step)}
        flat={flat} reducedMotion={reducedMotion}
        state={m.state} description={DESCRIPTION[m.step]} status={m.status}
      >
        {summary && !wide ? null : <Figure m={m} />}
      </BookScene>
      <div className="book-scene-panel" ref={panel}>{/* forms, results */}</div>
    </div>
  );
}
```

### Rules

1. **One state, two views.** The lesson state lives in one hook in `Scene.tsx`, as before. `Scene3D` only
   draws it. The 2D view is unchanged: the book is 3D only.
2. **The figure goes on the right page.** Size the spreads from ONE ground box that holds every step's
   objects and labels: `spreadBeside(box, margin)` when printing (the spine sits left of the box),
   `spreadFor(box)` when docked (spine in the middle). Add page margin where tags or cards stick out
   (lesson 0.1 adds `front: 2.4` for its block cards).
3. **Frame the figure, not the words.** `focus` is what the camera keeps in view for the step. `BookScene`
   adds the printed text block itself (`readingShot`, elevation 52° so the type reads). Inset the frame by
   the pixels your labels need (`inset(frame, reserve)`).
4. **Sheets, not steps, for the backdrop.** `sheet = Math.min(step, CHECK)`: the quiz and the honest take
   share the last spread. One `FIGURES` caption per sheet, written as `Fig. n  <what the figure shows>`.
   Captions are decoration and repeat the step, so put nothing in them that is not elsewhere.
5. **The tour only moves the camera.** `tourFor(step)` returns two or three `Shot<Target>`s
   (`{ caption, target }`): first the whole figure, then close-ups. Captions start with "Close up:" and
   follow the copy rules. No tour at the quiz / honest take (return `[]`). `shotFocus(target)` gives a low,
   close `Focus` (elevation about 24–30°, azimuth about −10 to −18°). Keep `tourFor` pure and unit test it.
6. **Phones hide the figure at the quiz and honest take** (`summary && !wide`), as in 2D.
7. **Screen readers.** `description` says in one sentence what the figure shows at this step. Anything
   printed only on a 3D object (a balance on a page, a hash on a block) is also in visually hidden text or
   a labelled HTML tag.
8. **Colours.** Figures follow the ink rule (paper white, black outlines, the stage accent for meaning).
   The desk and book colours are the setting and stay the same on every stage.
9. **Reduced motion.** No page turn, no pop-up, no tour easing: the camera jumps. Nothing extra to do if
   you use `BookScene`, `Traveller` and the kit primitives.

### Tests every book lesson needs

- E2E at 1440 × 900, 3D: `main.lesson` has `data-spread`, `.book-page` has a `matrix3d` transform, and
  the printed action still works.
- E2E tour: "Play the tour" changes `tour-caption`; while a close-up plays `data-spread` is off; a new
  step ends the tour and prints the words again.
- E2E at 390 × 760, 3D: no `data-spread`; `.book-page` is `display: contents` (docked).
- Unit: `tourFor` (every step but the quiz has shots; targets exist at that step).
- The lesson's normal walk, reduced-motion and `?webgl=0` tests, in 2D and 3D.

Lesson 0.1's spec (`e2e/lessons/l-0-1-blockchain-basics.spec.ts`, "wide screens print the step…" and
"phones keep the step's words docked…") is the reference.

## Kit API

From `src/scene-kit` (3D half, lazy only):

| Export | What |
| --- | --- |
| `<BookScene>` | `InkStage` + `BookBackdrop` + `PrintOnPage` + `ViewOffset` + tour, wired together. Props above. |
| `useFreeFrame(root, panel, { summary, printMinWidth? })` | Measures the free part of the canvas between the lesson chrome; returns `{ frame, size, wide, print }`; sets `--book-t/l/r/b/sh` on `root`. |
| `useTour(shots, page)`, `<TourControls tour idle>` | The tour on its own, if a scene needs it without `BookScene`. |
| `readingShot(focus, text, elevation?)`, `folios(sheet, first?)`, `freeFrame(chrome, opts)` | Pure helpers (`bookLayout.ts`, unit tested). |
| `PRINT_MIN_WIDTH` (1100), `READING_ELEVATION` (52), `SHOT_SECONDS` (3.4) | Shared constants. |
| `spreadBeside`, `spreadFor`, `textBlock` | Spread sizing (`book.ts`). |

Lower-level pieces (`BookBackdrop`, `PrintOnPage`, `PopUp`, `homography`) are described in `docs/scene-kit.md`.

## Lessons on the standard

| Lesson | Book scene |
| --- | --- |
| 0.1 How a blockchain works | Yes (the reference) |
| 0.2, 0.3, 1.1, 1.2 | Not yet: plain `InkStage` on paper. Move them over one by one. |
