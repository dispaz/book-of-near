# Handoff: issue #19, Lesson 3.1 "Deploy a contract in one click" (NOT DONE)

Branch `issue-19-lesson-3-1` (from origin/main 5d30881). Paused on request to save budget. Delete this file
before the final commit.

## Done

- **Contract:** `contracts/counter/counter.wat` gains `reset()` (storage_remove of `num` and `last_result`,
  logs "State cleared"); `counter.wasm` rebuilt (2,134 bytes). `scripts/build-counter.mjs` now also writes
  `src/chain/counterWasm.ts` (base64 of the wasm) so the lesson bundles the real bytes with no fetch
  (Vite 8 / rolldown could not load `counter.wasm?inline`).
- **DemoChain:** `DemoContractContext.remove(key)`; demo `counterContract.reset`; `COUNTER_WASM_SHA256`
  in `src/chain/demo/contracts.ts`, and DemoChain installs the counter for the real wasm's hash, so demo
  mode deploys the same bytes as testnet and storage counts them. Tests in `DemoChain.test.ts` and
  `src/chain/testnet/counter.test.ts` (all green).
- **Docs:** `docs/lessons/stage-3/3.1-topic.md` (real 2 KB size, implicit accounts cannot have sub-accounts,
  callback facts, in-place upgrades vs Ethereum proxies, new sources) and `3.1.md` (rewritten: 8 steps, now
  including a failing-callback step, vars, check, honest take).
- **Lesson** `src/content/lessons/l-3-1-deploy-a-contract/`: `manifest.ts` (ready, 2d+3d, 8 steps, vars
  contract/codeBytes/storageDeposit/refund), `steps.ts`, `contract.ts` (+test: storage maths, contract id,
  parent name, wasm header), `useDeploy.ts` (one state: parent name, deploy batch CreateAccount+Transfer
  0.05+AddKey+DeployContract, increment, get_num read, call_other→fail callback, reset, vars, evidence
  `{txHash, contractId, callbackTxHash}`), `parts.tsx` (Facts panel, picks shared by 2D/3D, describe),
  `Scene.tsx` (actions, check, honest take), `Scene2D.tsx`, `Scene3D.tsx` (BookScene), `layout3d.ts`,
  `tour.ts` (+test), `scene.css`.
- **E2E** `e2e/lessons/l-3-1-deploy-a-contract.spec.ts` written (walk 2D/3D, outcome test, honest take,
  reduced motion, phone, no-WebGL, 2D↔3D switch, 3D picks, print/tour, phone docking).
- Typecheck and eslint were clean; unit tests for chain + lesson green (82 passed).

## In progress / known failing

- Last e2e run (before the latest edits): 6 passed, 7 failed. Causes found and already fixed in the spec
  but NOT re-run:
  1. Refund regex was `0.000…`; demo frees 101 bytes = 0.00101 NEAR → now `/0\.00\d+ NEAR/`.
  2. 3D walks hit the 30 s per-test timeout (5 realtime transactions + page turns). Added
     `test.describe.configure({ timeout: 90_000 })`. Unverified.
  3. `scene` locator now `getByTestId("deploy-scene")` (the first `[data-scene-state]` in 3D was another node).
- Not yet run: full `npm run lint` (prettier check), `npm test`, full e2e, screenshots.

## Left against the acceptance boxes

- [ ] Ready-made contract deployed to a learner sub-account on testnet: code path done (`useDeploy.deploy`);
  demo verified by e2e (2D). Not tried on real testnet (`npm run test:testnet` / manual testnet mode).
  Note: testnet `code_hash` should equal `COUNTER_WASM_SHA256` (used to resume a counter from an earlier visit).
- [ ] A call changes visible state and a second call reads it: done (Increment + "Read the count" view call), e2e 2D passes.
- [ ] A failing callback is shown with its effect: done (call_other→fail, receipts ✓✗✓, last_result "failed", count unchanged), e2e 2D passes.
- [ ] E2E covers demo mode: spec written; 3D cases need a green re-run.

## Next steps

1. `E2E_PORT=4182 npx playwright test e2e/lessons/l-3-1-deploy-a-contract.spec.ts --workers 3`; fix what
   remains (check the 3D pick test: pick buttons "Sub-mailbox: deploy…", "Scroll: increment…",
   "Balance gauge: read…" come from `picksOf` in parts.tsx).
2. Screenshots (1440×900, 1024×768, 390×844; 2D and 3D; `bon:cover=off`) and tune `layout3d.ts` / labels /
   panel height so nothing overlaps the printed page.
3. `npm run lint` (run `npm run format`), `npm run typecheck`, `npm test`, full e2e on port 4182.
4. Update `docs/book-scene.md` "Lessons on the standard" table (3.1 = yes), append to `docs/progress.md`,
   tick the issue boxes, delete this HANDOFF.md, commit with `Closes #19`, push, open the PR.
