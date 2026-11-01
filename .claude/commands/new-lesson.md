---
description: Scaffold a lesson (manifest, 2D scene, demo-mode e2e test) from the lesson template
argument-hint: <id> <stage> "<title>" [--chain] [--order N]
allowed-tools: Bash(npm run new-lesson:*), Bash(node scripts/new-lesson.mjs:*)
---

Scaffold a Book of NEAR lesson with arguments: $ARGUMENTS

1. Read `docs/lesson-template.md` (the lesson shape and rules).
2. Run `npm run new-lesson -- $ARGUMENTS`. The id is kebab-case; pass `--chain` when the lesson does
   something on chain. If the script refuses (lesson already ready, wrong stage, unknown stage), report its
   message and stop. Do not delete or edit an existing ready lesson to get past it.
3. Report the files it created and whether it replaced a planned manifest.
4. If the lesson script exists at the path printed by the script (`docs/lessons/stage-<n>/...`), say so;
   the next step is to copy its steps, check and Honest take into `manifest.ts` and `Scene.tsx`, and to turn
   the `test.fixme` in `e2e/lessons/<id>.spec.ts` into a real, failing assertion before building the scene.
