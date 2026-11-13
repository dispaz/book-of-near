# Board run handoff (13 Nov 2026)

An orchestrator session ran the issue board: max 3 tickets at once, each implemented by a subagent in its own worktree, then a reviewer subagent (`code-review` skill), fixes until LGTM, then merge to `main`. It stopped near its 300k context limit. To continue, start a session and say: **"Continue the board run from HANDOFF.md"**.

## Merged (16 PRs, #67 to #83)

| PR | Issue | What |
| --- | --- | --- |
| #67 | #66 docs | `docs/hackathon.md` rules + checklist |
| #69 | #23 (+#12 code) | platform branch: mainnet wallet + badge contract |
| #70 | #14 | 1.1 review notes (BookScene, 2D icons, shared `useBoxSize`) |
| #71 | #15 | 1.2 review notes (3D book scene deferred to #60) |
| #72 | #24 | Lesson 4.2 intent swap; Worker `/intents/quote` (rate-limited, EXACT_INPUT only, ≤0.25 NEAR) |
| #73 | #16 | 1.3 review notes (BookScene move deferred to #61) |
| #74 | #18 | Lesson 2.2 call across blocks |
| #75 | #26 | Capstone 7.1 |
| #76 | #25 | Lesson 4.3 old bridge vs NEAR |
| #77 | #21 | Lesson 3.3 race the RPC (`Chain.probeRpc`) |
| #78 | #20 | Lesson 3.2 token (demo NEP-141; `/relay` removed as an open relayer) |
| #79 | #54 kit | `Pickable` reactions: hover ring, press, hop, `disabledHint`, `detail`, `pickMotion` |
| #80 | #68 (+#12) | Badges end to end: testnet contract `badges.bon-badges-mwe57oab.testnet`, `/claim`, My book, checker, art |
| #81 | #56 | Lesson 0.1 reactions retrofit |
| #83 | #57 | Lesson 0.2 reactions retrofit |
| #82 | #58 | Lesson 0.3 reactions retrofit (`swell` moved to scene-kit) |

Also closed: #1 (live URL works).

## Not merged when this was written

Nothing. When this was written there were no open PRs and no running agents. Leftover agent worktrees under `.claude/worktrees/agent-*` can be removed with `git worktree prune` after deleting their folders.

## Remaining board, in order

1. Retrofits (one PR each, same prompt as #56): #59 1.1, #60 1.2 (+ move 3D to BookScene, deferred from #15), #61 1.3 (+ BookScene move, deferred from #16), #62 2.1, #63 3.1 (pass `pickMotion`; gauge grows), #64 4.1. Then tick #54's per-lesson boxes and close it.
2. Badge leftovers: #11, #13, #27 have a few unticked boxes (mostly the explorer image, which needs a Pages deploy). Read their last comments; close what is done.
3. #28 final exam and badge gating; #29 final badge (testnet edition only; mainnet mint cut; includes the `FundsNotice` link nit); #31 demo-mode verification suite; #32 polish (mobile, motion, fallbacks).
4. #33 README + submission pack (see `docs/hackathon.md`: AI disclosure, other chains, tags, LICENSE).
5. #65 demo video LAST (needs `brew install ffmpeg`).
6. #44: waiting for 3 green runs of the non-blocking `e2e-3d-software` CI job.

## Rules learned this run (put them in every implementer and reviewer prompt)

- Worktrees have no `node_modules`: run `npm ci` first.
- A PostToolUse hook typechecks the MAIN checkout, whose `node_modules` is stale ("Cannot find module 'viem'"). Ignore it, or run `npm install` in the main checkout once.
- Before pushing: merge `origin/main` and check that `git diff --name-status origin/main...HEAD` has no unintended deletions. One PR once deleted 8k lines of merged work.
- e2e: unique `E2E_PORT` per agent, `E2E_WORKERS=2`. Run the full suite once at the end; rerun timeouts in unrelated specs alone.
- When an implementer passes about 250k context, give review fixes to a fresh agent.
- `gh pr merge` works only after a reviewer LGTM (the auto-mode classifier blocks unreviewed merges).

## Owner actions

- **Deploy:** push `main` to `release` (`git push origin origin/main:refs/heads/release`). This also makes the badge images show on the explorer.
- **Worker:** in `worker/`, run `wrangler secret put CLAIM_SIGNING_KEY` (the value is in `worker/.dev.vars`), then `wrangler deploy`. Check the `FAUCET_LIMITS` KV binding, which `/intents/quote` and `/claim` use. Then build the app with `VITE_WORKER_URL`.
- **Art:** approve it from `docs/screenshots/68/`.
- **Decisions:**
  - Should learners who test out of stage 0 still have to send the 0.3 transaction for its badge?
  - Stage 3 is optional on some routes, but the contract requires the previous badge.
  - Should a real FT Wasm be built so 3.2 runs live on testnet?
  - Is it acceptable that the 4.2 real swap keeps the USDC in intents.near?
- **Not verified live:** the mainnet wallet sign-in (#23) and a real mainnet swap (4.2).
- **Submission (#66):** see `docs/hackathon.md`. The deadline is **14 Nov 23:59 UTC**.
