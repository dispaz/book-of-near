# Progress log

Agents append one entry per finished ticket: date, ticket, what changed, anything the next agent must know.


## 2026-11-01 · #1 Walking skeleton
- Vite 8 + React 19 + React Router 8 + TypeScript 6 (strict), Vitest 5, Playwright 1.64, ESLint 10 + typescript-eslint, Prettier 3. Fonts bundled with @fontsource (works offline).
- Manifests: `src/content/lessons/*/manifest.ts` and `src/content/stages/*/stage.ts`, discovered by `import.meta.glob` and checked by the pure `buildRegistry` (unit tested). Stages 0 to 4 and 7 exist.
- Lesson page: floating stage bar (menu, back, play, caption, dots, next), step in `?step=N`, keyboard arrows/space, gated steps (`action.gate` + `setGate`), action buttons through `SceneAction` (docked above the step card), error boundary + WebGL check with the text fallback, `?webgl=0` forces the fallback, "Read as text" on every lesson.
- Two placeholder lessons (`placeholder-hello`, `placeholder-blocks`) in stage 0; replace or hide them when real stage 0 lessons land.
- Secret scanner `scripts/check-secrets.mjs` runs from `.githooks/pre-commit` (set by `npm install`). Manual check: a throwaway repo commit with a fake `ed25519:` key was rejected ("a.ts:1 NEAR private key").
- `.claude/settings.json` runs typecheck + eslint after Edit/Write.
- **Not done:** deploy to Cloudflare Pages. The owner must create the account, run `npx wrangler login` and `npx wrangler pages project create book-of-near --production-branch main`, then `npm run deploy`.

## 2026-11-01: #4 First-day spikes
- All seven spikes run against the real services; results, call shapes, tx hashes and numbers are in `docs/spikes-seed.md` → "Result log". Short version promoted to CLAUDE.md → "Verified facts".
- Pass: 1 (create `.testnet` via `testnet.create_account`, also in headless Chrome), 3 (shard/chunk/block from RPC), 4 (cross-shard hops), 6 (1Click dry quote, no key). Partial: 2 (Worker faucet not built; transfers work), 5 (MPC sign works, Sepolia broadcast needs funds), 7 (NEAR Connect loads on mainnet; no human sign-in).
- Owner decisions needed: lesson 4.2 cannot show competing solver quotes from 1Click (one quote only); the Sepolia broadcast needs a drip or must stop at "signed and verified". Owner actions: faucet account + `FAUCET_ACCOUNT_ID`/`FAUCET_PRIVATE_KEY` Worker secrets; optional Sepolia key and 1Click API key.
## 2026-11-01 · #5 Opening quiz, routes, progress and table of contents
- `src/progress/` is the single stage-completion interface: `progress.recordCompletion / completions / isComplete / reportEvidence / recordPosition / resumeTarget / route / setRoute / subscribe`, React hook `useProgress()`. Stored in localStorage under `bon:v1` (try/catch, works in memory when storage is blocked). `CompletionRecord = { lessonId, stage, route, mode, completedAt, testedOut?, evidence? }`. One record per lesson (latest wins).
- E2E reads records through `window.__bookOfNear.progress` (read-only: `route()`, `completions()`, `isComplete(id)`, `resumeTarget()`).
- Routes: `newcomer | veteran | developer`. `/` redirects to the quiz at `/start` when no route is stored, else shows contents. `/test-out` is the stage 0 test-out (5 questions from the stage 0 checks, pass 4); passing records every non-hidden stage 0 lesson (planned ones included) with `testedOut: true`. Stage 3 is tagged optional unless the route is developer. E2E tests that open `/` must seed a route (see `seedRoute` in `e2e/progress.spec.ts`).
- Lesson page: the last step shows "Finish lesson" (disabled while that step's gate is closed); it records the completion with `mode` and the stored route, then offers the next lesson. Scenes may call the new optional `SceneProps.reportEvidence({ txHash })`; evidence is merged into that lesson's next record. Never pass keys or seed words. The current lesson and step are saved for "Continue where you left off".
- Planned manifests (status `planned`, no scene). Lesson agents: replace `manifest.ts` in place and keep the id.
  - #8 `l-0-1-blockchain-basics`, #9 `l-0-2-make-a-wallet`, #10 `l-0-3-send-a-transaction`
  - #14 `l-1-1-claim-your-name`, #15 `l-1-2-function-call-key`, #16 `l-1-3-inside-a-transaction`
  - #17 `l-2-1-follow-across-shards`, #18 `l-2-2-call-across-blocks`
  - #19 `l-3-1-deploy-a-contract`, #20 `l-3-2-issue-a-token`, #21 `l-3-3-race-the-rpc`
  - #22 `l-4-1-one-account-every-chain`, #24 `l-4-2-intent-swap`, #25 `l-4-3-old-bridge-vs-near`
  - #26 `l-7-1-trace-an-intent`
  - Backlog topics outside the MVP (order ≥ 10, for #30 to enrich with comparison notes and going-deeper tags): `backlog-0-cross-chain-is-hard`, `backlog-0-smart-contracts`, `backlog-0-tokens`, `backlog-2-stateless-validation`, `backlog-2-spice`, `backlog-2-post-quantum-keys`, `backlog-3-wallet-architecture`, `backlog-3-aurora`, `backlog-7-honest-scoreboard`. Topics covered by MVP lessons are not duplicated.
- When the real stage 0 lessons land, hide or delete the placeholders: the newcomer start is the first open (not planned, not hidden) lesson of stage 0.
## 2026-11-01 · #2 Chain interface and demo chain
- `src/chain/`: `Chain` interface (`types.ts`, types only), `ops.ts` helpers (transfer, sub-account, named account via `testnet` registrar, keys, deploy, call, `phases()` async iterator), units (`parseNear`, `tgas`), account id rules, `ChainError`, shard rule. `docs/chain.md` documents operations, result shapes, errors and how to add an operation.
- `DemoChain`: seeded and deterministic; 600 ms blocks starting at #200000000, 6 shards by boundary accounts (illustrative), gas fees approximating nearcore (transfer 0.45 Tgas), gas held then refunded, all-or-nothing receipts, cross-contract receipts with callbacks, function-call key checks (receiver, methods, allowance, no deposit), nonce and signature checks. Simulated contracts keyed by code hash (`demoContractCode("counter")`).
- `runChainContract(makeChain, { counterCode })` in `src/chain/contract.test-kit.ts` is the shared behavioural suite; #7 must run it against TestnetChain with a counter Wasm exposing the same methods. `recordScenario` drives the determinism test.
- `ChainProvider`/`useChain()` wrap the app in `main.tsx` (always DemoChain until #7 passes a `chain`). Hidden lesson `placeholder-transfer` sends 1 NEAR and shows hash, block, shard, gas and timings; e2e in `e2e/chain-transfer.spec.ts`.
- Unverified: the registrar call, broadcast 250 ms, shard boundaries, the fee table. Several agents run `vite preview` on :4173 at once and `reuseExistingServer` then tests someone else's build; run your own preview on another port and use `BASE_URL=http://localhost:<port> npx playwright test`.

## 2026-11-01 · #3 3D scene kit v1
- `src/scene-kit/`: three + @react-three/fiber 9 + drei 10. `InkStage` (canvas, paper ground, camera rig with a preset per step, flat top-down mode, clamped orbit without pan, overlay labels), ink hatching shader (`inkMaterial`), `Outline` (edges or hull), `AccountBlock`, `ContractBlock`, `ShardSlab`, `ChainBlock`, `Key`, `Coin`, `Traveller` (arc hop with glow trail, `onArrive`), `Label`, `Pickable` (click = move under 6 px). Every pickable also renders a focusable labelled button over the object, for keyboards, screen readers and Playwright.
- `src/scene-kit/svg/`: the same primitives as flat SVG for the WebGL fallback. No three.js there, so manifests may import it.
- Demo: `/lesson/scene-kit-demo` (hidden). E2E in `e2e/scene-kit.spec.ts`. Docs: `docs/scene-kit.md`.
- Next agent: import the 3D kit only from lazy `Scene.tsx` files. Assert on `[data-scene-state]`; wait for `.sk-stage[data-camera="still"]` before clicking canvas coordinates. The 3D chunk is about 260 kB gzipped and loads only when a 3D scene opens. R3F logs a `THREE.Clock` deprecation warning with three 0.187 (from the library, harmless).
- Shared files touched: `package.json` (deps), `playwright.config.ts` (`--enable-unsafe-swiftshader` so CI without a GPU gets WebGL), `src/ui/ink.css` (one `:has()` rule so the title leaves room for two pills on phones).
