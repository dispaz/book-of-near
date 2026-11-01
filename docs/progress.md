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
