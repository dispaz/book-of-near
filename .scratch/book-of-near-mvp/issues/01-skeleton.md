# 01: Walking skeleton on the live URL

**What to build:** A learner can open the deployed site and walk through one placeholder lesson using the stage bar (menu, back, play, caption, dots, next), in demo mode. Lessons and stages are discovered from manifests, so the menu and routes need no manual edits when a lesson folder is added. The repository has install, dev, typecheck, lint, unit-test and end-to-end commands, a hook that runs typecheck and lint after edits, and a hook that blocks commits containing key or token patterns. The site is deployed to Cloudflare Pages from the first working version.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Priority:** P0

- [ ] The live URL shows a placeholder lesson with a working stage bar and a caption per step
- [ ] Adding a second placeholder lesson folder with a manifest makes it appear in the menu with no other edit
- [ ] One command installs and runs the app locally; one command runs the end-to-end tests, and a smoke test for the placeholder lesson passes
- [ ] The secret-blocking hook rejects a test commit containing a fake key
- [ ] The look matches the ink style of the existing prototype (pale paper, ink outlines, floating bottom bar)
