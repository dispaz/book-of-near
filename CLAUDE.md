# Book of NEAR: project rules

Read `.scratch/book-of-near-mvp/spec.md` for the product, `GLOSSARY.md` for terms, and your GitHub issue (`gh issue view <n> --comments`) for the task. Tickets live in GitHub Issues on `dispaz/book-of-near`; issue number = ticket number. `.scratch/book-of-near-mvp/issues/` and `tickets.md` are a read-only backup from before the migration: don't read tickets from them or update them.

**Deadline: 14 Nov 2026 23:59 UTC** (repo public, form sent). Submission rules and checklist: `docs/hackathon.md`. Re-read https://nearhackathon.com/HACKATHON.md before submitting.

## Hard rules
- **No code before 1 Nov 2026 00:00 UTC.** Code must be written inside the hackathon window. Before that, only docs and tickets.
- **Everything on chain goes through the `Chain` interface** (TestnetChain and DemoChain). Lessons never call RPC, wallets or SDKs directly.
- **Demo-mode parity.** Every lesson, badge claim and the exam must work in demo mode with no wallet and no network. AI reviewers run the README first, so one install command must give a working app.
- **No secrets in the repo.** Keys live in Worker secrets and `.dev.vars` (ignored). Ship `.env.example` only.
- **Ink style, 2D and 3D.** Black outlines on paper-white, one accent colour per stage. Almost every lesson has both a 2D SVG view and a 3D view (`views: ["2d", "3d"]`) the learner switches between; both draw ONE shared lesson state, so switching keeps progress. 2D-only is fine for steps that are mostly text or forms (say why in the manifest). The two showpieces (shards, chain signatures) are 3D-first. Every scene has a text/SVG fallback and honours `prefers-reduced-motion`. Canvases render on demand (`frameloop="demand"`): anything that moves uses `useAnimatedFrame` (scene-kit `frames.ts`) and returns `true` until it settles, so an idle scene draws nothing. The 3D view loads lazily and is a living pop-up book scene (`<BookScene>`, see `docs/book-scene.md`; scaffold with `npm run new-lesson -- … --book`).
- **3D Pop-Up Book Standard:** Every lesson's 3D view is an interactable scene set on an open book lying on a desk. 3D objects stand on the right-hand page and literally rise and "grow" from the paper page when the book opens or turns a page. Objects are fully interactable throughout the lesson (`Pickable` click targets, keyboard focusable, executing step actions and displaying reactive states). Clickable objects react, never just a cursor change: hover/focus lift and accent outline, press squash, an object-specific pick animation, a "not yet" shake with a hint, and a detail when picked after the step is done; reduced motion keeps the outline and colour change only (`docs/book-scene.md` rule 10a). On desktop (≥1100px), step copy is physically printed on the left page (`PrintOnPage`).
- **Every lesson ends with an "Honest take"** listing NEAR's strengths and weaknesses.
- **Both topic and script files required:** Always consider both `docs/lessons/stage-<n>/<order>-topic.md` (the technical source of truth, protocol mechanics, and constraints) and `<order>.md` (the interactive script, scene objects, copy, and gates) when working on a lesson. Code copies from the script; the script only teaches what the topic proves.
- **Learner copy:** plain English, short sentences, define a term the first time it appears, no hype.
- **Unverified facts** (see `docs/spikes-seed.md`) must not be coded as truth until issue #4 verifies them.

## Workflow
1. Pick an open, unassigned issue labelled `ready-for-agent` with no open blockers (`issue_dependencies_summary.blocked_by` is 0); highest priority first (`P0` before `P1` before `P2`), then lowest number. Claim it with `gh issue edit <n> --add-assignee @me`.
2. Read both `docs/lessons/stage-<n>/<order>-topic.md` and `<order>.md` before touching code. Build with TDD (`/tdd`). Test through the running app in demo mode first, then the Chain interface, the badge contract and the Worker endpoints.
3. Tick every acceptance box in the issue body (`gh issue edit <n> --body-file ...`). Run lint, typecheck, tests and e2e.
4. Append a short entry to `docs/progress.md`, commit with `Closes #<n>` in the message, push, and make sure the issue is closed (`gh issue close <n>` if it isn't).

## Definition of done
Acceptance boxes ticked, tests green, works in demo mode, fallback and reduced-motion checked, no secrets, progress logged.

## Commands
- `npm install && npm run dev`: install and run the app (demo mode, http://localhost:5173). `npm install` also points git at `.githooks` (secret scanner).
- `npm run typecheck`, `npm run lint` (ESLint + Prettier check; `npm run format` fixes formatting).
- `npm test`: Vitest unit tests (`src/**/*.test.ts(x)`, `scripts/**/*.test.ts`).
- `npm run e2e`: Playwright against a production build (`vite preview` on :4173, or a free port if 4173 is busy; `E2E_PORT` pins one; a process that grabs the probed port before vite binds it stops the run with "already used": rerun or pin `E2E_PORT`). On macOS the browser draws WebGL on the GPU (Metal) with the default workers; elsewhere software WebGL with one worker per 4 cores (`E2E_GL=swiftshader` forces software, `E2E_WORKERS` overrides). Traces are recorded only on a retry: debug with `npx playwright test --trace on <spec>`. `BASE_URL=https://... npx playwright test --grep @smoke` runs the smoke test against a live URL. `E2E_NO_3D=1` switches WebGL off and leaves out 3D tests (titles with `3d`, tag `@3d`, `book-camera.spec.ts`): the blocking release CI e2e uses it. Release CI also runs the full suite in software WebGL (`E2E_WORKERS=2`) in the non-blocking job `e2e-3d-software`; the full 3D suite on a Mac (GPU) stays the local gate. A test that needs 3D without saying so in its title gets `{ tag: "@3d" }`.
- `npm run build`, `npm run deploy` (Cloudflare Pages, project `book-of-near`; needs `npx wrangler login` first).
- Releases: merging to `release` runs all checks, deploys to Cloudflare Pages and tags `vX.Y.Z` (`.github/workflows/release.yml`, `docs/release.md`).
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
