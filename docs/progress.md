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

## 2026-11-01 · #2 Chain interface and demo chain
- `src/chain/`: `Chain` interface (`types.ts`, types only), `ops.ts` helpers (transfer, sub-account, named account via `testnet` registrar, keys, deploy, call, `phases()` async iterator), units (`parseNear`, `tgas`), account id rules, `ChainError`, shard rule. `docs/chain.md` documents operations, result shapes, errors and how to add an operation.
- `DemoChain`: seeded and deterministic; 600 ms blocks starting at #200000000, 6 shards by boundary accounts (illustrative), gas fees approximating nearcore (transfer 0.45 Tgas), gas held then refunded, all-or-nothing receipts, cross-contract receipts with callbacks, function-call key checks (receiver, methods, allowance, no deposit), nonce and signature checks. Simulated contracts keyed by code hash (`demoContractCode("counter")`).
- `runChainContract(makeChain, { counterCode })` in `src/chain/contract.test-kit.ts` is the shared behavioural suite; #7 must run it against TestnetChain with a counter Wasm exposing the same methods. `recordScenario` drives the determinism test.
- `ChainProvider`/`useChain()` wrap the app in `main.tsx` (always DemoChain until #7 passes a `chain`). Hidden lesson `placeholder-transfer` sends 1 NEAR and shows hash, block, shard, gas and timings; e2e in `e2e/chain-transfer.spec.ts`.
- Unverified: the registrar call, broadcast 250 ms, shard boundaries, the fee table. Several agents run `vite preview` on :4173 at once and `reuseExistingServer` then tests someone else's build; run your own preview on another port and use `BASE_URL=http://localhost:<port> npx playwright test`.
