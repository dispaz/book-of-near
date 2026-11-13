# Resume notes: issue #85, lesson 5.2 "An agent with no owner" (paused 13 Nov 2026)

Branch: `issue-85-lesson-5-2` (from origin/main at 57a858d). Worktree: this folder. e2e: `E2E_PORT=4225 E2E_WORKERS=2`.
Delete this file before the final commit.

## Done
- **Topic rewritten** against primary sources (`docs/lessons/stage-5/5.2-topic.md`): Shade Agent Framework docs and reference agent contract (NearDeFi/shade-agent-framework `docs/`), template's derivation from the agent contract id + `"ethereum-1"`, NEAR docs deprecation notice (framework "not maintained since April 19, 2026"). The old draft was wrong: addresses derive from the **agent contract**, not the enclave code hash; the refusal is the agent contract's `Agent not registered`, not an MPC error.
- **Script rewritten** (`docs/lessons/stage-5/5.2.md`) with steps, Reactions table, check, honest take, and a "what is real and what is a model" note.
- **Shared stage 5 enclave**: `src/content/stages/5-enclave/{EnclaveBox.tsx,SvgEnclave.tsx,enclave.css}`; lesson 5.1 now imports them (its own copies and CSS rules removed).
- **Lesson** `src/content/lessons/l-5-2-agent-with-no-owner/`: manifest, steps, agentContract.ts (in-browser model of the reference contract, real ed25519 implicit-account key, measurements from 5.1's recorded quote, example PPID), agent.ts (reactions/describe), useAgent.ts (one shared state; root key via `rootPublicKey(chain)` through the Chain interface, so DemoChain demo signer in demo mode), parts.tsx, Scene.tsx, Scene2D.tsx, Scene3D.tsx, layout.ts, tour.ts, scene.css. Unit tests: agentContract.test.ts, agent.test.ts, tour.test.ts.
- **Backlog**: `src/content/backlog/coverage.ts` maps 5.2 to "Shade Agents" (card gone); `e2e/backlog-cards.spec.ts` updated.
- **Badge stage 5**: `src/badges/rules.ts` stage 5 rule (lessons 5.1 + 5.2, evidence `[]`: nothing on chain); `DEMO_STAGE_COUNT` 5 -> 6 (`src/chain/demo/badges.ts`, test now uses stage 6 as unknown); `src/badges/config.ts` comment (testnet contract stage count 8, checked via RPC); Worker `worker/src/claim.ts` explicit `case 5: return;` + test in `worker/src/claim.test.ts` (signs stage 5 with no lookup, 6/7 -> 400); `src/badges/rules.test.ts` updated; `e2e/badges.spec.ts` counts "of 6", stage 5 shelf "Not claimed yet".
- **e2e** `e2e/lessons/l-5-2-agent-with-no-owner.spec.ts`: 2D/3D walks, reduced motion, `?webgl=0`, phone, render on demand, rule 10a reactions, 2D->3D state, stage 5 badge claim in demo mode (shows "Claim the stage 4 badge first.").

## Half-done
- Visual polish in `src/content/lessons/l-5-2-agent-with-no-owner/layout.ts` (request parcel `signer` spot moved to avoid overlapping the mailbox label) and `Scene2D.tsx` (signer label moved to +66, focus box height 108 -> 144). Edits applied but NOT rebuilt or re-screenshotted. Screenshot script: `/tmp/nao85/shots.mjs` (needs `npx vite preview --port 4226` after `npm run build`; may be gone after reboot).

## Next steps, in order
1. `npm run build`, re-screenshot 2D/3D step 5 (parcel vs labels), fix if needed.
2. Update `docs/lessons/stage-5/README.md` learning-arc row for 5.2 to match the new script (agent contract, refusal, deprecation).
3. Run `npm run lint`, `npm run typecheck`, `npm test`, `(cd worker && npx vitest run)`, then the full e2e once: `E2E_PORT=4225 E2E_WORKERS=2 npm run e2e`, and also `E2E_NO_3D=1 E2E_PORT=4225 E2E_WORKERS=2 npm run e2e`.
4. Tick acceptance boxes on #85 (`gh issue edit 85 --body-file ...`).
5. Append to `docs/progress.md`.
6. Delete RESUME-NOTES.md; `git fetch origin && git merge origin/main` (stage 6 PR #92 may touch coverage.ts, topicCards, badges e2e, rules: keep both sides; if stage 6 adds a rule, CLAIMABLE/DEMO_STAGE_COUNT and "of N" counts change); check `git diff --name-status origin/main...HEAD` for unintended deletions.
7. Commit with `Closes #85` + Co-Authored-By trailer, push, open a ready PR (body ends with the Claude Code line). Do not merge.

## Open questions (for the PR)
- Stage 5 badge has no on-chain evidence, so on testnet the Worker signs a stage 5 claim for any account; the contract's "stage 4 first" rule (which needs a real 4.1 chain signature) is the only on-chain proof. Alternative: require 5.1's `attestationHash` (client-reported, unverifiable).
- No real deployed Shade Agent contract was found on testnet to record, so the contract is a labelled in-browser model; the example name `agent.example.testnet` does not exist on chain.
- The framework is deprecated per NEAR docs; the lesson says so in the honest take.

## Last test results
- `npm test` (vitest): 110 files, 854 passed (before the last layout tweak; tweak touches no unit-tested values).
- Worker `vitest run src/claim.test.ts`: 15 passed.
- e2e (lesson 5.2 + badges + backlog-cards + 5.1 specs): 50 passed, before the last layout tweak.
- Full e2e suite and `E2E_NO_3D=1` run: not yet run.
- lint/typecheck: clean (2 pre-existing warnings in CameraRig.tsx).
