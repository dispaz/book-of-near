# Badge contract

`contracts/badge/` is the Book of NEAR badge collection: NEP-171 NFTs with NEP-177 metadata and NEP-297 events. Collection name "Book of NEAR Badges", symbol `BOOK`. It is written in Rust with `near-sdk` 5.11.

## Rules it enforces

- **Claim.** A badge is minted by the learner's own call (`claim_stage` or `claim_final`) with a claim from the Worker: an ed25519 signature by the project's claim key. The contract checks the signature and the expiry.
- **One per account per stage**, one final badge per account. Stage `n` needs stage `n - 1`. The final badge needs every stage its exam route requires.
- **Non-transferable.** Every badge the claim methods mint has `transferable: false`. `nft_transfer` refuses it. `nft_transfer_call` is not supported.
- **No deposit.** The contract pays storage from its own balance. A learner needs only gas. Keep the contract account funded (0.00001 NEAR per byte of state; a few hundred bytes, so roughly 0.003 NEAR per badge).
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

Events are `EVENT_JSON:` logs with `standard: "nep171"`, `version: "1.2.0"`, `event: "nft_mint"` (and `nft_transfer`).

## Build and test

Needs Rust (`rustup`). `contracts/badge/rust-toolchain.toml` pins Rust 1.86 and `Cargo.lock` pins `near-sys`, because newer Rust and newer `near-sdk` need a newer NEAR runtime than the local sandbox (2.6.5) knows.

```
npm run build:badge   # cargo build + wasm-opt (lowers sign-extension ops NEAR rejects) -> contracts/badge/target/badge.wasm
npm run test:badge    # build, then the sandbox tests
```

`contracts/badge/sandbox-tests/` is a separate crate (near-sdk will not build natively) that deploys the `.wasm` into a local NEAR sandbox with `near-workspaces`. The first run downloads the sandbox binary. It pins sandbox 2.6.5 because `near-workspaces` 0.20 cannot read the validator list of 2.9.0. The tests cover: valid claim (no deposit, event, `extra`), expired claim, replayed claim, claim for another account, wrong signer, skipped stage, second badge for a stage, transfer of a non-transferable token, adding a stage and changing a route as owner, the final badge with a signed rarity, the daily cap, and collection and image metadata.

## Deploy (testnet)

No secrets go in the repo. Keys live in your credentials store and in Worker secrets.

1. Make the contract account, a sub-account of an account you own, with enough NEAR for the code (about 2.6 NEAR for ~257 KB) plus a float for badge storage (say 5 NEAR more):
   `near account create-account fund-myself badges.<you>.testnet '8 NEAR' autogenerate-new-keypair save-to-keychain sign-as <you>.testnet network-config testnet sign-with-keychain send`
2. Make the claim key pair (keep the secret as a Worker secret, `CLAIM_SIGNING_KEY`). Any ed25519 key works; `node -e` with `@noble/curves` can print one. Only the public key goes on chain.
3. Deploy and initialise:
   `near contract deploy badges.<you>.testnet use-file contracts/badge/target/badge.wasm with-init-call new json-args '{"owner_id":"<you>.testnet","claim_key":"ed25519:<public key>","stage_count":5}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send`
4. Configure as the owner: `set_route` for each exam route, `set_base_uri` (the app's static host, for example `https://book-of-near.pages.dev/badges`), and `set_art` for `stage-0` to `stage-4` and `final-common`, `final-rare`, `final-epic`, `final-legendary` (the media path under `base_uri` and the base64 sha256 of the image).
5. Check: claim once from a funded learner account, then open the token on the testnet explorer. The image shows when `base_uri/media` is publicly reachable.

For mainnet repeat with a mainnet account and a different claim key.

## Not done here

- Testnet deployment, since it needs your accounts and funds (steps above).
- The badge images (separate art ticket) and the Worker's claim signer (uses the message format above).
- The Chain-interface and DemoChain side of claiming (demo-mode parity belongs with the badge flow tickets).
- The optional transferable collector twin of the final badge.
