# Book of NEAR: project rules

Read `.scratch/book-of-near-mvp/spec.md` for the product, `GLOSSARY.md` for terms, and your GitHub issue (`gh issue view <n> --comments`) for the task. Tickets live in GitHub Issues on `dispaz/book-of-near`; issue number = ticket number. `.scratch/book-of-near-mvp/issues/` and `tickets.md` are a read-only backup from before the migration: don't read tickets from them or update them.

## Hard rules
- **No code before 1 Nov 2026 00:00 UTC.** Code must be written inside the hackathon window. Before that, only docs and tickets.
- **Everything on chain goes through the `Chain` interface** (TestnetChain and DemoChain). Lessons never call RPC, wallets or SDKs directly.
- **Demo-mode parity.** Every lesson, badge claim and the exam must work in demo mode with no wallet and no network. AI reviewers run the README first, so one install command must give a working app.
- **No secrets in the repo.** Keys live in Worker secrets and `.dev.vars` (ignored). Ship `.env.example` only.
- **Ink style.** Black outlines on paper-white, one accent colour per stage. 3D only in the two showpieces (shards, chain signatures); the rest is 2D SVG. Every scene has a text/SVG fallback and honours `prefers-reduced-motion`.
- **Every lesson ends with an "Honest take"** listing NEAR's strengths and weaknesses.
- **Learner copy:** plain English, short sentences, define a term the first time it appears, no hype.
- **Unverified facts** (see `docs/spikes-seed.md`) must not be coded as truth until issue #4 verifies them.

## Workflow
1. Pick an open, unassigned issue labelled `ready-for-agent` with no open blockers (`issue_dependencies_summary.blocked_by` is 0); highest priority first (`P0` before `P1` before `P2`), then lowest number. Claim it with `gh issue edit <n> --add-assignee @me`.
2. Build with TDD (`/tdd`). Test through the running app in demo mode first, then the Chain interface, the badge contract and the Worker endpoints.
3. Tick every acceptance box in the issue body (`gh issue edit <n> --body-file ...`). Run lint, typecheck, tests and e2e.
4. Append a short entry to `docs/progress.md`, commit with `Closes #<n>` in the message, push, and make sure the issue is closed (`gh issue close <n>` if it isn't).

## Definition of done
Acceptance boxes ticked, tests green, works in demo mode, fallback and reduced-motion checked, no secrets, progress logged.

## Commands
- `npm install && npm run dev`: install and run the app (demo mode, http://localhost:5173). `npm install` also points git at `.githooks` (secret scanner).
- `npm run typecheck`, `npm run lint` (ESLint + Prettier check; `npm run format` fixes formatting).
- `npm test`: Vitest unit tests (`src/**/*.test.ts(x)`, `scripts/**/*.test.ts`).
- `npm run e2e`: Playwright against a production build (`vite preview` on :4173). `BASE_URL=https://... npx playwright test --grep @smoke` runs the smoke test against a live URL.
- `npm run build`, `npm run deploy` (Cloudflare Pages, project `book-of-near`; needs `npx wrangler login` first).
- Lessons live in `src/content/lessons/<id>/manifest.ts` (+ lazy `Scene.tsx`); stages in `src/content/stages/<n>-<slug>/stage.ts`. Both are discovered automatically. Scene contract: `SceneProps` in `src/app/types.ts`; step actions go through `SceneAction`; gates via `setGate(true)`.
- Lesson scripts (researched copy, check questions, honest takes, demo data) are in `docs/lessons/stage-<n>/`.

## Verified facts (issue #4, 1 Nov 2026)
Full call shapes, tx hashes and numbers: `docs/spikes-seed.md` → "Result log". Don't rediscover these.
- **Versions:** `near-kit` 0.20.2 (ESM, browser-bundle OK, read `dist/*.d.ts`, no README), `chainsig.js` 1.1.16 (heavy, lazy-load), `@hot-labs/near-connect` 0.12.0, `viem` 2.x.
- **RPC:** testnet `rpc.testnet.fastnear.com` → `test.rpc.fastnear.com` → `rpc.testnet.near.org` (archival: `archival-rpc.testnet.fastnear.com`). Mainnet `rpc.mainnet.fastnear.com` → `free.rpc.fastnear.com` → `rpc.mainnet.near.org` → `near.drpc.org`. All CORS `*`. Lava/ankr/publicnode/pagoda are dead. FastNEAR has no rate-limit headers.
- **Top-level `.testnet` names:** `near.call("testnet", "create_account", { new_account_id, new_public_key }, { attachedDeposit, gas: "30 Tgas" })` from any funded account. Public fallback faucet: `POST https://helper.testnet.near.org/account {newAccountId, newAccountPublicKey}` (10 NEAR, CORS open, undocumented limits).
- **near-kit gotchas:** `getBalance()` returns the *available* balance as a 2-decimal string; use `getAccount()`/`view_account` for yocto. Import `fromNearConnect` from `"near-kit"` (no `near-kit/wallets` export). Gas strings need units (`"30 Tgas"`).
- **Shards:** tx status has no shard id. Shard of an account = `shard_ids[count(boundary_accounts <= id)]` from `EXPERIMENTAL_protocol_config.shard_layout.V3`; read at run time (testnet has 10 shards, non-contiguous ids). Chunk = the block's `chunks[]` entry with that `shard_id`.
- **Chain Signatures:** `v1.signer-prod.testnet` / `v1.signer`. Deposit 1 yocto (`experimental_signature_deposit` is gone), ~8.5 Tgas burnt, ~5 s. `ChainSignatureContract({ networkId, fallbackRpcUrls })` takes no key; `sign()` needs a `signerAccount { accountId, signAndSendTransactions }` adapter (see log). Derived Sepolia addresses start with 0 ETH, so broadcast needs funding.
- **1Click:** `/v0/tokens` and dry `/v0/quote` work without a key (1200 req/min unauth, CORS `*`). Returns one best quote, not competing solver bids. Unkeyed quotes carry `appFees` fee 20.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` (future `CONTEXT.md`) + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
