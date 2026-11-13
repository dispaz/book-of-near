# Badge contract

`contracts/badge/` is the Book of NEAR badge collection: NEP-171 NFTs with NEP-177 metadata and NEP-297 events. Collection name "Book of NEAR Badges", symbol `BOOK`. It is written in Rust with `near-sdk` 5.11.

## Rules it enforces

- **Claim.** A badge is minted by the learner's own call (`claim_stage` or `claim_final`) with a claim from the Worker: an ed25519 signature by the project's claim key. The contract checks the signature and the expiry.
- **One per account per stage**, one final badge per account. Stage `n` needs stage `n - 1`. The final badge needs every stage its exam route requires.
- **Non-transferable.** Every badge the claim methods mint has `transferable: false`. `nft_transfer` is a stub that always refuses. `nft_transfer_call` is not supported.
- **No deposit.** The contract pays storage from its own balance. A learner needs only gas. Keep the contract account funded (0.00001 NEAR per byte of state). Measured in the sandbox: the first stage badge for an account adds 405 bytes (about 0.004 NEAR); later badges are smaller. The `storage_status` view reports the contract's balance, storage use and what is left to spend, so watch `available`.
- **Owner settings** (no redeploy): `set_stage_count` (can only grow), `set_route`, `set_daily_cap`, `set_claim_key`, `set_base_uri`, `set_art`.
- **Daily cap.** At most `daily_cap` badges per UTC day (default 1000). `0` stops minting.

## The claim the Worker signs

The signature is over the UTF-8 bytes of one line. `<contract>` is the badge contract account, `<account>` the learner, times are milliseconds since 1970 (compared with the block time).

```
bon-badge-v1|<contract>|<account>|stage|<stage>|<expires_at_ms>
bon-badge-v1|<contract>|<account>|final|<route>|<rarity>|<expires_at_ms>
```

`rarity` is `common`, `rare`, `epic` or `legendary`. It is part of the signed text, so a learner cannot raise it. Because `<contract>` is in the text, a testnet claim does not work on mainnet. The views `stage_message` and `final_message` return these strings, so the Worker can check its own output against the contract.

Send the signature as base64 of the 64 raw bytes (`signature` argument). The claim key is set as `ed25519:<base58>`.

## Calls

| Method                                                       | Who     | What                                                                                          |
| ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------- |
| `claim_stage({ stage, expires_at_ms, signature })`           | learner | mints the stage badge; returns the token id. Attach no deposit.                               |
| `claim_final({ route, rarity, expires_at_ms, signature })`   | learner | mints the final badge                                                                         |
| `has_badge({ account_id, stage })`                           | anyone  | true when the account holds that stage badge (the app's gate)                                 |
| `has_final_badge({ account_id })`, `stages_of({ account_id })` | anyone  | final badge check; list of stages held                                                        |
| `get_stage_count`, `get_route({ route })`, `get_daily_cap`   | anyone  | settings                                                                                      |
| `nft_metadata`, `nft_token`, `nft_tokens`, `nft_tokens_for_owner`, `nft_supply_for_owner`, `nft_total_supply` | anyone  | NEP-171/177 views. `metadata.extra` is a JSON string: `{ kind, stage, route, rarity, transferable }` |

Events are `EVENT_JSON:` logs with `standard: "nep171"`, `version: "1.2.0"`, `event: "nft_mint"`. No `nft_transfer` event is emitted: nothing can be transferred.

## Build and test

Needs Rust (`rustup`). `contracts/badge/rust-toolchain.toml` pins Rust 1.86 and `Cargo.lock` pins `near-sys`, because newer Rust and newer `near-sdk` need a newer NEAR runtime than the local sandbox (2.6.5) knows.

```
npm run build:badge   # cargo build + wasm-opt (lowers sign-extension ops NEAR rejects) -> contracts/badge/target/badge.wasm
npm run test:badge    # build, then the sandbox tests
```

`contracts/badge/sandbox-tests/` is a separate crate (near-sdk will not build natively) that deploys the `.wasm` into a local NEAR sandbox with `near-workspaces`. The first run downloads the sandbox binary. It pins sandbox 2.6.5 because `near-workspaces` 0.20 cannot read the validator list of 2.9.0. The tests cover: valid claim (no deposit, event, `extra`), expired claim, replayed claim, claim for another account, wrong signer, skipped stage, second badge for a stage, transfer of a non-transferable token, adding a stage and changing a route as owner, the final badge with a signed rarity, the daily cap, and collection and image metadata.

## Worker requirements

The contract trusts whoever holds the claim key, so the Worker that signs must:

- **Rate-limit signing** per account and per IP. The global daily cap is a denial-of-service lever: anyone who can get claims signed can use up the day's mints.
- **Sign short expiries** (minutes, not days) and never accept an `expires_at_ms` from the client.
- **Check evidence first** (stage finished, exam score), then sign. Never sign a rarity the client chose.
  `worker/src/claim.ts` does this on testnet: each transaction must be sent by the learner (or the name they made in 1.1, or the fresh parent 3.1 made for an implicit account, proved by its `create_account` hash) and be the kind the lesson sends (0.3 and 2.1: one Transfer; 1.2: AddKey then DeleteKey; 3.1: DeployContract to a contract under the learner's account; 4.1: a call to the MPC signer). One hash may not stand for two pieces of evidence in one claim. The body is capped at 4 KB, and an RPC failure answers 502, never "not found".
- **Stage 5 is signed with no testnet lookup** (issue #85, a deliberate decision for a testnet learning badge). Lessons 5.1 and 5.2 send no transaction, so there is nothing on chain to check: `case 5` in `checkStage` returns at once. The only on-chain gate is the contract's "previous badge first" rule. Stage 4 needs a real lesson 4.1 call to `v1.signer-prod.testnet`, so in effect the Worker signs stage 5 for any account that already holds the stage 4 badge. Lesson 5.1's `attestationHash` is not used as evidence: the client reports it, and the Worker cannot verify it (it is a hash of a quote fetched in the browser, not a transaction it can look up), so checking it would add no real gate.
- **Stage 6 is signed with no testnet lookup** (issue #87). Lesson 6.1's vote is a practice vote and 6.2 reads recorded data, so nothing is sent on chain: `case 6` returns at once. The Worker still requires the rule's evidence keys (6.1's `voteCast`, 6.2's `pair`), which the client reports and which prove nothing on chain. As with stage 5, the real gate is the contract's "previous badge first" rule, back to 4.1's chain signature.
- **Stage 7 is signed with no testnet lookup** (issue #13). Lesson 7.1 replays an intent and 7.2 reads a recorded scoreboard, so nothing is sent on testnet: `case 7` returns at once. 7.1 does record a `txHash`, but it is the learner's 4.2 swap (NEAR Intents runs on mainnet), a demo-wallet hash or the recorded replay id `recorded-demo-intent`, never a testnet transaction the Worker could look up, so the rule does not ask for it. The Worker requires the rule's evidence keys (7.1's `capstoneComplete`, 7.2's `scoreboardReviewed`), which the client reports and which prove nothing on chain. The real gate is again the contract's "previous badge first" rule, back to 4.1's chain signature. Stage 8 and any other stage without a rule are refused with 400.
- Keep the claim secret key only in Worker secrets.

Operators must deploy with the single-step `with-init-call new` below. `new` has no access check of its own, so a deploy followed by a separate `new` call could be front-run.

## Testnet deployment (issue #68)

Deployed on 12 Nov 2026 with `scripts/deploy-badge.mjs`:

| What | Value |
| --- | --- |
| Contract | `badges.bon-badges-mwe57oab.testnet` |
| Owner | `bon-badges-mwe57oab.testnet` (made with NEAR's public testnet helper) |
| Create + deploy + `new` (one transaction) | `3WJ3Rgw2ca7wXpVxJF3jyu9pmx3DUL98pvRsqBHKbwwp` |
| `set_stage_count(5)` | `GWm7Q9sLuEra2x7mPWvdAAYae7tfTRjDRm5sCBF1GE13` |
| `set_daily_cap(200)` | `82AcSkp2M9PdthmjaSPKyNN7vy6WeZCZgRJKFSD23oVa` |
| `set_claim_key` | `634pxtxMFQSVfV7CVA4THzKiZMCbMTfM6zwHUPzCwH1h` |
| `set_base_uri(https://book-of-near.pages.dev/badges)` | `HdCxMF5q7QY6AhFQx9V1nPAzJMeCkKa4tzyjURjbSUca` |

`set_art` for `stage-0` to `stage-4` (13 Nov 2026, media `stage-<n>.svg`, hashes from `public/badges/art.json`): `5pogwK2r2bwrwzLNwk7HE4gz5qeMVqEDkaEoZd5bYtD6`, `FBvcFxFx256JSTDEzLj7UypiX2ymbGMX8Eve58C6gpSd`, `47Ve4RYK5iDCzYRqWqeXoTERAaQtoVY7Aoppo4TpHGd1`, `Ez2BPyJWeyWjCXa7E56VXMi4vWprYN7X2KraC2UrZPa`, `9kiUhZor8aEXdBuKDNYdPMyWKtjPGC5nMdrWbt6dhXN9`.

`set_art` again for `stage-0` to `stage-4` (13 Nov 2026, NEAR palette and the new stage 4 blockchain motif; every hash changed, `node scripts/deploy-badge.mjs art --keys stage-0,stage-1,stage-2,stage-3,stage-4`): `6o6yMNoBVfQ3RoAqafMtRCRjoBhugSCUocpzCTSP4qZs`, `57WcJHuBjbmWrhTAory2LySNxzSb1PXqhtttpt3MyiDa`, `6PehTDcFo7bteMC2HzYsWFvfRizX7nkVzPyeFFiifv2x`, `HJ9hCmsTi56gf5APkpUq14SnMvnQnR2j9zHfzaTgUfKi`, `CGsEVYecjiK3uEKBfJnZoqsNasc3CEy76T4Z4xojUoe`. Token `1` (stage 0) now reports `media_hash` `kHDPWZIgf5SYKNJgl/XJTaNRIET51eYAPABdDd+fqrg=`, the hash in `art.json`.

### Stages 5 to 7

The art for stages 5 (Enclave), 6 (Citizen) and 7 (Book of NEAR) is in `public/badges/` and `art.json`, and the app shows eight slots (`STAGE_BADGES = 8`). The owner has grown the contract to eight stages: on 13 Nov 2026 a `get_stage_count` view call on `badges.bon-badges-mwe57oab.testnet` (through `https://rpc.testnet.fastnear.com`) returned `8`. `STAGE_COUNT` in `scripts/deploy-badge.mjs` is 8 to match, so `settings` re-applies the same value (`set_stage_count` can only grow).

`set_stage_count(8)` (13 Nov 2026): `Ap9Wwx6tyAWVD4Kes77SS4L7ceD4oDqc1w9V7y8WDoYb`.

`set_art` for `stage-5` to `stage-7` (13 Nov 2026, media `stage-<n>.svg`, hashes from `public/badges/art.json`, `node scripts/deploy-badge.mjs art --keys stage-5,stage-6,stage-7`): `5hw7w5Tv62X6NjyCXueNpPd3G5DReUbVTa9Ep2mpGriU`, `GEp4x8Mb8wsrbDhfwrLdHLxNtzdeKydDovMrCwDy9YpU`, `9HAgiKVusSNeDhpViHG54eNSyJ9HVpwZpSEXaKvBQgXq`. All four were checked with the `tx` RPC method on 13 Nov 2026: sent by the owner to the contract, status `SuccessValue`.

The contract has eight stages, but the app opens a claim only for a stage with a rule in `src/badges/rules.ts`. Today that is all eight, stages 0 to 7 (stage 5 since issue #85, stage 6 since #87, stage 7 since #13). `CLAIMABLE_BADGES` (the stages with a rule) and `DEMO_STAGE_COUNT` are both 8, so the shelf counts "N of 8 claimed" in demo mode and on testnet. A stage with lessons but no rule would show "Badge not available yet", and one with no lessons "Not open yet"; none is left. The contract requires each previous stage's badge, so the stage 7 card says "Claim the stage 6 badge first." until stage 6 is held.

First real claim (stage 0, Worker run locally): learner `bon-learner-mwe61s8i.testnet`, evidence transfer `AQ63WVtJWPYtAzFka5XgRc5miHEuZkYZD3gtYrRpgyPY`, `claim_stage` `EAuadk9PtuXBfee1fMx32okJyo6t2xCMbwJkumk8XJ1o` → token `1`. The image shows on explorers once `https://book-of-near.pages.dev/badges/stage-0.svg` is deployed.

The contract id is config, not code: `src/badges/config.ts` reads `VITE_BADGE_CONTRACT_ID` and falls back to the id above; the Worker reads `BADGE_CONTRACT_ID` from `wrangler.toml`.

The owner key, the contract account's key and the claim key pair are in `worker/.dev.vars` (git-ignored) of the checkout that ran the script: `BADGE_OWNER_ID`, `BADGE_OWNER_PRIVATE_KEY`, `BADGE_CONTRACT_PRIVATE_KEY`, `CLAIM_SIGNING_KEY`, `CLAIM_PUBLIC_KEY`, `BADGE_CONTRACT_ID`.

### The script

```
npm run build:badge
node scripts/deploy-badge.mjs deploy     # owner account (helper, 10 NEAR) + badges.<owner> (8 NEAR) + deploy + new, then the settings
node scripts/deploy-badge.mjs settings   # re-apply stage count, daily cap, claim key, base URI
node scripts/deploy-badge.mjs art        # set_art for every entry of public/badges/art.json (npm run badges:art writes it)
```

`deploy` makes the sub-account, funds it, adds its key, deploys the wasm and calls `new` in ONE transaction, so `new` cannot be front-run. It refuses to run again once `BADGE_CONTRACT_ID` is in the vars file. Secrets go to the vars file only; the script prints account ids and transaction hashes.

### Owner steps (not run by the agent)

Production Worker secrets and the Worker deploy are the owner's:

```
cd worker
npx wrangler secret put CLAIM_SIGNING_KEY      # paste CLAIM_SIGNING_KEY from worker/.dev.vars (ed25519:<base58 64 bytes>)
npx wrangler deploy                            # BADGE_CONTRACT_ID and the claim limits are plain vars in wrangler.toml
```

For local dev, `worker/.dev.vars` already holds `CLAIM_SIGNING_KEY` and `BADGE_CONTRACT_ID`; add `ALLOW_LOCALHOST=1` and run `npm run dev` in `worker/`, with `VITE_WORKER_URL=http://localhost:8787` in `.env.local`.

To rotate the claim key: generate a pair, `set_claim_key` as the owner (old signatures stop working at once), then `wrangler secret put CLAIM_SIGNING_KEY`.

For mainnet repeat with a mainnet account and a different claim key (out of scope for the hackathon, #29).

## The app side (issue #68)

- **Rules in one place:** `src/badges/rules.ts` lists each stage's required lessons (only lessons that exist; a test keeps the list equal to the open lessons) and the evidence keys checked. Stage 0: 0.3's `txHash`. Stage 1: 1.1's `txHash` + `accountId` and 1.2's `addKeyTxHash` + `txHash`. Stage 2: 2.1's `txHash`. Stage 3: 3.1's `txHash` + `contractId`. Stage 4: 4.1's `mpcTxHash`. Stage 5: lessons 5.1 and 5.2, no evidence (see Worker requirements). Stage 6: 6.1's `voteCast` (a practice vote) and 6.2's `pair` (the recorded trade), both accepted in demo mode. Stage 7: 7.1's `capstoneComplete` (the trace settled) and 7.2's `scoreboardReviewed` (all four cards opened), no transaction hash (see Worker requirements). A tested-out lesson counts as finished, but an evidence lesson still needs its evidence.
- **Worker `POST /claim`** (`worker/src/claim.ts`): rate-limited per IP, per account and in total; checks the evidence on testnet with RPC `tx` (the transaction exists, succeeded and was sent by the learner, by the name the learner made in 1.1, or for 3.1 by the contract's parent; 1.1 must be the learner's own `create_account` for that name; 1.2 must add and delete a key; 3.1 must deploy to the named contract; 4.1 must call `v1.signer-prod.testnet`). Then it signs `stage_message` with a 5-minute expiry it chooses itself.
- **Chain interface:** `claimBadge`, `badgesOf`, `hasBadge`, `badgeContractId` (`docs/chain.md`). DemoChain runs a simulated badge contract with the same rules (one per stage, previous stage, signature, expiry against block time, no deposit). Demo claims are signed in the browser with a public demo key; demo badges are kept in localStorage (`bon:demo-badges:v1`) so a reload keeps them.
- **UI:** the claim card at the end of each stage on the contents page and under "Lesson done" on a stage's last lesson (not yet / ready / claiming / claimed / failed); `/my-book` (the shelf); `/check?account=...` (anyone's badges, no login).
- **Art:** `npm run badges:art` (`scripts/badges-art.mjs`) writes `public/badges/stage-<n>.svg` and `art.json` (base64 sha256 per file); `node scripts/deploy-badge.mjs art` sends `set_art`. Dev preview: `npm run dev`, then `/badges-preview`.
- **No nonce in the claim:** the contract's message has none. A replayed claim is refused because the stage is already claimed, and an unused claim dies after 5 minutes.

## Not done here

- Day rollover of the daily cap: the sandbox clock is wall-clock time, so a new UTC day cannot be reached in a test. The logic (`day != self.day` resets the counter) is covered only by reading.
- The optional transferable collector twin of the final badge.
- The final badge (exam route, rarity) in the app: #28, #29.
