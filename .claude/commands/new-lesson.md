---
description: Scaffold a lesson (manifest, 2D scene, demo-mode e2e test) from the lesson template
argument-hint: <id> <stage> "<title>" [--chain] [--book] [--order N]
allowed-tools: Bash(npm run new-lesson:*), Bash(node scripts/new-lesson.mjs:*)
---

Scaffold a Book of NEAR lesson with arguments: $ARGUMENTS

1. Read `docs/lesson-template.md` (the lesson shape and rules).
2. Run `npm run new-lesson -- $ARGUMENTS`. The id is kebab-case; pass `--chain` when the lesson does
   something on chain, and `--book` when it has a 3D view (almost always): that adds `Scene3D.tsx` as a
   book scene (`docs/book-scene.md`). If the script refuses (lesson already ready, wrong stage, unknown stage), report its
   message and stop. Do not delete or edit an existing ready lesson to get past it.
3. Report the files it created and whether it replaced a planned manifest.
4. Read BOTH the topic file (`<order>-topic.md`) and the lesson script (`<order>.md`) in `docs/lessons/stage-<n>/`.
   The topic file gives the protocol truth and technical constraints; the script gives the UI captions, scene objects, user actions, and check questions.
   Copy the steps, check and Honest take into `manifest.ts` and `Scene.tsx`, and turn the `test.fixme` in
   `e2e/lessons/<id>.spec.ts` into a real, failing assertion before building the scene.
