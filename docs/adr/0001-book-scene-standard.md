# 1. Every lesson's 3D view is a book scene

Date: 2026-11-06. Status: accepted.

## Context

Lesson 0.1's 3D view was rebuilt on 3 Nov 2026 as a living pop-up book (prototype branch
`worktree-prototype-3d-scene-lesson-0-1`, merged to `main` at `c08a44e` and deployed). The figure stands on
the right page of an open book, wide screens print the step on the left page, each step turns the page,
and a play button runs a captioned camera tour. The user liked it and asked for this way of building a
scene to become the standard.

The book pieces (`BookBackdrop`, `PrintOnPage`, `PopUp`) were already in the scene kit, but the wiring
between them lived inside lesson 0.1's `Scene3D.tsx`: the tour state and controls, the print handshake with
the lesson page (`SpreadContext`, page-in-view), the reading shot, page numbers and the measurement of the
free canvas. About 200 lines a new lesson would have had to copy.

## Decision

- The 3D view of every lesson is a **book scene**: `<BookScene>` from `src/scene-kit`, with the figure on
  the right page. The rules are in `docs/book-scene.md`.
- The wiring moves into the kit: `BookScene.tsx` (component and hooks) and `bookLayout.ts` (pure,
  unit-tested maths). Lesson 0.1 uses it, with no change in behaviour (same e2e, same layout readings).
- `npm run new-lesson -- … --book` scaffolds a lesson whose 3D view is already a book scene.
- Lessons 0.2, 0.3, 1.1 and 1.2 move over one at a time; until then they keep plain `InkStage`.

## Consequences

- A new lesson writes only its figure, ground box, per-step framing and tour.
- Changes to print, tour or page-turn behaviour happen in one place and reach every lesson.
- The 3D view depends on the lesson page's chrome class names (`.lesson-title`, `.step-head`,
  `.lesson-dock`, `.stage-bar`, `.lesson-panel`, `.book-page`). Renaming them breaks the measurement.
- The desk and book colours are the setting, the same on every stage (an exception to "one accent per
  stage", which still holds for the figure).
