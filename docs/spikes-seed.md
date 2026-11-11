# Spike seed: unverified facts

Everything here came from reading docs and is **unverified**. Ticket 04 must test each against the real service and record the result here.

## 1Click / NEAR Intents
- Base URL `https://1click.chaindefuser.com`; endpoints `GET /v0/tokens`, `POST /v0/quote`, `POST /v0/deposit/submit`, `GET /v0/status`.
- `X-API-Key` header recommended; a key or JWT avoids a 0.1% fee.
- No documented testnet. Plan: dry-run quote in the lesson; tiny capped real mainnet swap only if the account has funds.

## Chain Signatures
- Contracts: `v1.signer` (mainnet), `v1.signer-prod.testnet` (testnet).
- chainsig.js calls: `deriveAddressAndPublicKey`, `prepareTransactionForSigning`, `sign`, `finalizeTransactionSigning`, `broadcastTx`.
- Target: derive an address and sign a Sepolia transaction with viem.

## near-kit and wallet
- Check near-kit API for account creation, function calls and access keys, and NEAR Connect (`@hot-labs/near-connect`) wallet flow on testnet.
- Check FastNEAR RPC limits and fallback endpoints.

## Result log

Run on 1 Nov 2026 (issue #4) with throwaway scripts outside the repo. Keys generated during the spike stayed outside the repo. Status per spike: **pass**, **partial** or **fail**.

### Versions that worked
| Package | Version | Notes |
|---|---|---|
| `near-kit` | 0.20.2 | ESM only. Bundles for the browser with esbuild (no Node built-ins, ~600 KB min, ~145 KB gzip). Ran in headless Chrome. No README in the npm tarball; read `dist/**/*.d.ts` (repo `github.com/r-near/near-kit`). |
| `chainsig.js` | 1.1.16 | Has separate `browser` and `node` builds via `exports`. Depends on `@near-js/*` 2.x, viem, cosmjs, solana, aptos, sui (heavy; lazy-load it). README example is stale (see spike 5). |
| `@hot-labs/near-connect` | 0.12.0 | NEAR Connect. Repo `github.com/hot-dao/near-selector`. |
| `viem` | 2.57.14 | Used for Sepolia. Pin a version at least two weeks old in the app. |

### Spike 1: create a top-level testnet account from the browser: **pass**
- A top-level `name.testnet` is created by a function call on the `testnet` account: `testnet.create_account({ new_account_id, new_public_key })`, signed by any funded account. 30 Tgas was enough. The attached deposit becomes the new account's balance.
- A **zero deposit works** (the new account uses 182 bytes, under the zero-balance-account allowance), but then the account has no NEAR for gas. So the funder should attach the starter amount in the same call.
- near-kit call shape (ran in headless Chrome from an esbuild browser bundle, tx `8gYcuaJwmk5qk8j9dfyZoYDxLHRfv1p2358Egb2WLXid`; Node run tx `FWRTbHc6ggsPAYSBW4gL3ye4ezpvEUeG1ZPN288qMLwq`):
  ```ts
  const near = new Near({ network: "testnet", privateKey, defaultSignerId: funderId });
  const k = generateKey(); // k.publicKey.toString(), k.secretKey
  await near.call("testnet", "create_account",
    { new_account_id: "name.testnet", new_public_key: k.publicKey.toString() },
    { attachedDeposit: "0.05 NEAR", gas: "30 Tgas" });
  ```
- **Public helper faucet (not in the spec, works today):** `POST https://helper.testnet.near.org/account` with JSON `{ "newAccountId": "name.testnet", "newAccountPublicKey": "<ed25519 public key>" }` creates the account (signed by `testnet`) with **10 NEAR** and returns the final execution outcome. CORS reflects any origin, so it works straight from the browser (verified in headless Chrome). Tx: `FT9CyFHZQhri9PeMFaCRDnMS4zdVVr3rsQLtCk1Q5nsR`. Its rate limits and lifetime are undocumented; treat it as a fallback, not the main path.
- Lessons: #14 (Claim your name), #7 (practice account), #9.

### Spike 2: fund a fresh account from a faucet account through a Worker: **partial**
- What passed: a transfer from a funded account to a fresh **implicit** account (64-hex of the public key) works from the browser (`near.send(implicitId, "0.05 NEAR")`, tx `82P9dNbKdxxdb8m5Tbct3jGYpXUyMx5nQZGcEqXyK59e`), and `testnet.create_account` with a deposit creates and funds a named account in one call (spike 1). The faucet key came from the public helper above (10 NEAR, no human needed).
- Not verified: running near-kit inside a Cloudflare Worker (no Cloudflare credentials here). It bundles with no Node built-ins, so it should work, but #7 must prove it.
- Gotcha: `near.getBalance(id)` returns a **formatted string of the available balance rounded to 2 decimals** (`"0.04"` after receiving 0.05 NEAR). Use `getAccount()` or a raw `view_account` for exact yocto.
- Numbers (measured from `tokens_burnt`): testnet `gas_price` is 100,000,000 yocto per gas (0.0001 NEAR per Tgas). A function call (`wrap.testnet.near_deposit`) burnt 0.0002 NEAR; an MPC sign 0.0008 NEAR; but creating an account (`testnet.create_account` 0.0075 NEAR, transfer to a new implicit account 0.0071 NEAR) burnt far more than gas × gas_price would predict (receipts show a higher price; reason **unverified**). The faucet pays that, not the learner, if the Worker creates the account. **Suggested faucet amount: 0.5 NEAR per learner** (plenty for gas through stage 4), **plus contract storage if lesson 3.1 deploys into the learner's account** (storage is 0.01 NEAR per KB, so a 100 KB wasm needs about 1 NEAR). Not measured end to end.
- Fallback (spec): if the faucet is unavailable the lesson runs in demo mode. Second fallback: the public helper.
- Owner must: create a faucet account (for example `curl -X POST https://helper.testnet.near.org/account -H 'content-type: application/json' -d '{"newAccountId":"bon-faucet.testnet","newAccountPublicKey":"<pubkey from near-cli or near-kit generateKey>"}'`, or a wallet), top it up from near-faucet.io if needed, then `wrangler secret put FAUCET_ACCOUNT_ID` and `wrangler secret put FAUCET_PRIVATE_KEY`. 10 NEAR covers about 20 learners at 0.5 NEAR.
- Lessons: #7, #14, all testnet actions.

### Spike 3: shard, chunk and block ids for a transaction over RPC: **pass**
- Call `EXPERIMENTAL_tx_status` with `{ tx_hash, sender_account_id, wait_until: "NONE" }` (or `"FINAL"` to wait). Result fields: `final_execution_status`, `status`, `transaction`, `transaction_outcome`, `receipts_outcome[]`, `receipts[]`.
  - `transaction_outcome.block_hash`: block that included the transaction. Each `receipts_outcome[i]` has `id`, `block_hash`, `outcome.{executor_id, gas_burnt, tokens_burnt, logs, receipt_ids, status, metadata}`.
  - `receipts[i]`: `receipt_id`, `predecessor_id`, `receiver_id`, `receipt` (actions, deposit, gas).
- **No shard id or chunk hash is in the tx status.** Get them like this:
  - `block` with `{ block_id: <block_hash> }` gives `header.height` and `chunks[]` (each with `chunk_hash`, `shard_id`, `tx_root`, `gas_used`, `height_included` ...).
  - The shard of any account comes from `EXPERIMENTAL_protocol_config` (`{ finality: "final" }`) → `shard_layout.V3.{ boundary_accounts, shard_ids }`: `shard = shard_ids[count of boundary_accounts <= accountId]` (plain string compare). The transaction executes on the signer's shard; each receipt on its `executor_id`'s shard.
  - The chunk is the one in that block's `chunks[]` with that `shard_id`. `chunk` with `{ chunk_id }` returns `header`, `transactions[]` (`hash, signer_id, receiver_id, actions, nonce, public_key, signature, priority_fee`) and `receipts[]` (outgoing receipts).
- Example (found in a recent block): tx `HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp` from `fjord.loca-swarm-mvwu8dfo.testnet`, block 275719637 `4Q2yMdd2PSKAucxpcj3ssv9tYAbYiw52VoqF9jEpHGPs`, chunk `2nq8jS6q1hnzNupWeUUbNmCrg3BXy7msqkd34rHUu7ga`, shard 9 (chunk `shard_id` matched the computed shard). Old txs may need an archival node.
- Testnet layout today: **10 shards** with non-contiguous ids `[10, 11, 1, 12, 13, 9, 6, 7, 4, 5]`, 9 boundary accounts. The layout changes on resharding, so always read it at run time; never hard-code shard ids.
- Gas paid to the contract (lesson 2.2) is not a field in the outcome. Only `gas_burnt` / `tokens_burnt` per receipt. **Unverified** how to show the contract's share; compute it from the protocol's reward rule or drop it.
- RPC (all with `access-control-allow-origin: *`):
  - Testnet up: `https://rpc.testnet.fastnear.com`, `https://test.rpc.fastnear.com`, `https://rpc.testnet.near.org`, `https://archival-rpc.testnet.near.org`, `https://archival-rpc.testnet.fastnear.com`.
  - Mainnet up: `https://rpc.mainnet.fastnear.com`, `https://free.rpc.fastnear.com`, `https://rpc.mainnet.near.org`, `https://near.drpc.org`.
  - Dead or blocked: lava (`near-testnet.lava.build`, `neart.lava.build`, `near.lava.build` → 410), `testnet.drpc.org` (404), `rpc.testnet.pagoda.co` (403), ankr (403), publicnode NEAR (404), `beta.rpc.testnet.near.org` (no answer).
  - FastNEAR sends **no rate-limit headers**; 150 parallel `block` calls all returned 200 (3.2 s). `rpc.testnet.near.org` dropped 8 of 60 parallel calls. Published limits: unknown.
- Lessons: #17, #16, #18, #21 (RPC race list).

### Spike 4: helper accounts on different shards and a call hopping shards: **pass**
- Existing deployed contracts and their shards today: `testnet` (4), `wrap.testnet` (5), `v1.signer-prod.testnet` (5), `guest-book.testnet` (7), `hello.near-examples.testnet` (7). Our own helper contracts must be named so they land on different shards (check with the boundary rule; the first letters of the full id decide).
- Own call: `bon-spike-mvxj55ov.testnet` (shard 12) → `wrap.testnet.near_deposit` (shard 5), tx `35Vf3BZDC9rU1RoMXyHPWxAD3SM4KmBzYy9Wm2rCHc3s`: tx in block 275720062 on shard 12, receipt on `wrap.testnet` in block 275720063 on shard 5, refund receipt back on shard 12 in block 275720064.
- Real cross-contract chain: tx `HhRTH4KQ9n8WtsGv1VZ7S7UytSZHQxEdTCmyTCa38ULp`: shard 9 (fjord) → `market...` shard 4 (block +1) → `usdc...` shard 5 (block +2) → callbacks back on shards 9 and 4 (blocks +3, +4). Good fixture for the demo chain.
- Lessons: #17, #18, #26.

### Spike 5: Chain Signatures: **partial** (derive and MPC sign pass; Sepolia broadcast not done)
- Contracts confirmed by view calls: testnet `v1.signer-prod.testnet` (`version` 3.18.0), mainnet `v1.signer` (`version` 3.17.0). Views that work: `public_key`, `version`, `state`, `derived_public_key({ path, predecessor, domain_id })`. Domains: 0 = secp256k1 (ECDSA), 1 = ed25519, 2 = CKD, 3 = ForeignTx.
- `experimental_signature_deposit` **no longer exists** (MethodNotFound). The deposit is a flat **1 yoctoNEAR**. chainsig.js attaches **300 Tgas**; real sign txs on testnet attach 20 Tgas and burn about 8.5 Tgas (0.0008 NEAR), e.g. tx `8qT2BhJ921k8jABC8uuqZWaiBRZrtGSeVjjB4R2Rffue`. Signing took about 5.5 s.
- Derivation is offline in chainsig.js (it has the root keys built in) and matched the contract's `derived_public_key`. Example: predecessor `testnet`, path `ethereum-1` → `0x2F9e1556Ae1F8Fa558C6cDC25257dE8253511280`.
- Working call shape (README is stale: the constructor takes no keypair; `sign` needs a `signerAccount` object):
  ```ts
  import { chainAdapters, contracts } from "chainsig.js";
  const contract = new contracts.ChainSignatureContract({ networkId: "testnet", fallbackRpcUrls: ["https://rpc.testnet.fastnear.com"] }); // default RPC is rpc.testnet.near.org
  const evm = new chainAdapters.evm.EVM({ publicClient /* viem, sepolia */, contract });
  const { address } = await evm.deriveAddressAndPublicKey(nearAccountId, "ethereum-1");
  const { transaction, hashesToSign } = await evm.prepareTransactionForSigning({ from: address, to, value, gas: 21000n, maxFeePerGas, maxPriorityFeePerGas }); // pass gas + fees, or viem estimateGas throws on an empty address
  const rsv = await contract.sign({ payloads: hashesToSign, path: "ethereum-1", keyType: "Ecdsa", signerAccount: {
    accountId: nearAccountId,
    signAndSendTransactions: async ({ transactions }) => Promise.all(transactions.map((tx) => {
      const fc = tx.actions[0].functionCall; // { methodName: "sign", args, gas: 300 Tgas, deposit: 1n }
      return near.transaction(nearAccountId).functionCall(tx.receiverId, fc.methodName, fc.args,
        { gas: `${Number(fc.gas) / 1e12} Tgas`, attachedDeposit: `${fc.deposit} yocto` }).send();
    })) } });
  const signed = evm.finalizeTransactionSigning({ transaction, rsvSignatures: rsv }); // 0x02...
  await evm.broadcastTx(signed);
  ```
  Raw contract args: `sign({ request: { payload_v2: { Ecdsa: "<32-byte hex>" }, path, domain_id: 0 } })`.
- Verified: the MPC-signed Sepolia tx recovers (viem `recoverTransactionAddress`) to the derived address `0xbE82f67a1033407Fe2dFE5Bee234c5bEEa618148`.
- Broadcast failed as expected: `insufficient funds for gas * price + value: have 0`. **Every learner's derived address starts with 0 Sepolia ETH**, so the lesson cannot broadcast without someone funding it.
- Fallback: sign for real, then show the signed tx and the address recovered from it (proves the NEAR account controls the Ethereum address); broadcast only when the derived address has Sepolia ETH (viem balance read). Optional: a Worker drip of a tiny Sepolia amount from an owner key.
- Open numbers: signing deposit 1 yocto (done); NEAR cost ≈0.001 NEAR per sign; Sepolia: a 21,000-gas transfer needs well under 0.0001 ETH at today's fees, so **0.05 Sepolia ETH** from a public faucet would cover hundreds of learners if a drip is built. Not measured on chain.
- Sepolia RPC that worked: `https://ethereum-sepolia-rpc.publicnode.com`.
- Lessons: #22, #26.

### Live check of lessons 3.1 and 4.1 on testnet (11 Nov 2026): **pass**
Run through TestnetChain with the lessons' own helpers (`TESTNET_VERIFY=1 npx vitest run scripts/verify-lessons.testnet.test.ts`) and through the real app in testnet mode (`TESTNET=1 TESTNET_STORE=… npx playwright test --grep @testnet`, specs `l-3-1-…` and `l-4-1-…`). Practice account `bon-izbxkv888i.testnet` (public helper faucet, 10 NEAR).
- **3.1, script run** (parent made like the hex-account path): parent `bon-lnstducw.testnet` tx `2mf5ATV6TdY9xtL7TYhgwzivJu4TEwT21ACUXN4o3n4B`; deploy batch (CreateAccount + Transfer 0.05 + AddKey + DeployContract) to `counter.bon-lnstducw.testnet` tx `GUXcEim7ywsaoQzg2NoXtYb8UWZ5uuESoQA3Z4Q8r4ha`; increment tx `HMx9AMaTGNg9h9CtjQ73L7b7dFASKxwjnS3Bn2ey39Ma` (returned 1, `get_num` 1); `call_other` → `fail` tx `4PwoAveFRswUhRz7nh78DQ7jV6gGDdAMNr3vVfc9D3ux`; reset tx `A6DoD9Kp5BbW6wMJJxAPtgszRAz9frgXF4YnLPoWHKHo`.
- **3.1, app run** (named practice account, contract `counter.bon-izbxkv888i.testnet`): deploy tx `AoWApW2aUJuffasnFxtVS17MB5wAXH7MU7jFpo16m64R`, callback tx `2gxK7E8KUBjGh11fbgH4uacEHvcyJsbexq1UDRTxwBMm`; the page showed 3 receipts, `last_result` "failed", the refund and count 0. A second visit (counter already there, found by its code hash) walked on with callback tx `5rAxrQaXc2xfUgJ7Wa3tFrPffhVX2bXctQt5TE6psBmW`; it showed that the completion record lost its evidence without a deploy hash in that visit (fixed: `evidenceOf`).
- **Storage numbers:** code 2,134 bytes; the account uses **2,316 bytes** after deploy (code + account record + key), so **0.02316 NEAR** locked (copy: "about 0.02 NEAR", matches). Increment adds 51 bytes; the failed callback's `last_result` adds 59; reset frees 110 bytes = **0.0011 NEAR** back. The contract was funded 0.05 NEAR; `locked` (validator stake) stays 0.
- **Receipts of the failing call** (match the lesson): `call_other` ✓ 1.67 Tgas ("Calling fail on …") → `fail` ✗ 0.9 Tgas ("Smart contract panicked: This method always fails"), next block → `on_other_done` ✓ 1.06 Tgas ("The other call failed, so nothing changed there"), next block; plus 3 refund receipts. Tx status is SuccessValue (the callback handled it); `get_num` unchanged.
- **4.1:** root key `public_key` view needs **no** `domain_id` (with `{ domain_id: 0 }` it returns the same key). `derived_public_key({ path, predecessor })` works with or without `domain_id: 0` and equals the browser's derivation: `bon-izbxkv888i.testnet` + `ethereum-1` → `0x4363B849a6D65dCe5bF322941388057cE3C7ad25`.
- **Sign answer shape** (SuccessValue of the tx): `{ "scheme": "Secp256k1", "big_r": { "affine_point": "02cd75…eb5d" }, "s": { "scalar": "63a3…3950" }, "recovery_id": 1 }`. `parseSignResponse` reads it as is (the extra `scheme` is ignored); the signed EIP-1559 tx recovers to the derived address every time.
- **Sign txs:** `9r7oaHtyWkSFJ938PxZiR1deYwxVkqsAyfjRuXZYV3AM`, `GiKvW7KfWkfS6gPPKNBBo7BzMpVFX8Q8V7qoCqm3XCCu`, `CvzMyxrNnPcykVszVACCsw6kAz6Z2fG3e3GefC4whAaW`, `rKsG2W2LJ3NLLMDcpnHHUCnTyfxqHHW6H2fzGrD2Rz9` (script), `Ebo9AS3zMcU9gMD2wGfZiD4Ewr8J7peCa9fAxfWLgwAx`, `6DM47HpUYXonhF6rm56DeuDiy3DU5N5HETH2inaEhNAD` and 5 more (app). Two of about 12 app runs failed once: one ran 3.1 and 4.1 in parallel on the same practice key (nonces can clash; run the `@testnet` tests with `--workers=1`), one unexplained (probably a slow answer past the old 60 s test wait). Cost **0.00087 NEAR** each (gas 0.31 + 4.62 + 0.22 + 3.8 + 0.22 Tgas) plus 1 yocto.
- **Timing differs from spike 5:** send → final took **9.0, 11.3, 6.7, 13.9 s** (answer 9, 14, 7, 17 blocks after the request; `executed` at 5.1 to 12.6 s), not about 5.5 s. The lesson now counts down from about 10 s on testnet (5.5 s stays for the demo signer) and the honest take says 7 to 14 s.
- Nothing was sent to Sepolia.

### Spike 6: intents 1Click dry-run quote: **pass** (direct; proxy not built)
- `GET https://1click.chaindefuser.com/v0/tokens` works **without a key**: 210 tokens, each `{ assetId, decimals, blockchain, symbol, price, priceUpdatedAt, contractAddress, coingeckoId }` (e.g. `nep141:wrap.near`, USDC on Ethereum `nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near`).
- `POST /v0/quote` with `dry: true` works **without a key** (HTTP 201). Required fields (from the 400 message): `dry`, `swapType` (`EXACT_INPUT | EXACT_OUTPUT | FLEX_INPUT | ANY_INPUT`), `slippageTolerance` (integer bps 0..10000), `originAsset`, `depositType` (`ORIGIN_CHAIN | INTENTS | CONFIDENTIAL_INTENTS`), `destinationAsset`, `amount` (base-unit integer string), `refundTo`, `refundType`, `recipient`, `recipientType` (`DESTINATION_CHAIN | INTENTS | CONFIDENTIAL_INTENTS`), `deadline` (ISO 8601).
- Response: `quote.{ amountIn, amountInFormatted, amountInUsd, minAmountIn, amountOut, amountOutFormatted, amountOutUsd, minAmountOut, timeEstimate (s), refundFee, withdrawFee }`, the echoed `quoteRequest` (adds `depositMode`, `confidentiality`, `insured`, `appFees`), `signature`, `timestamp`, `correlationId`. A dry quote has no deposit address. 1 wNEAR → 4.054999 USDC, ~27 s estimate.
- Without a key the echoed request carries `appFees: [{ recipient: <hex account>, fee: 20 }]` (probably bps, i.e. 0.2%, not the 0.1% in the seed notes: **unverified unit**).
- Rate limit headers: `x-ratelimit-limit-unauth: 1200` per `x-ratelimit-reset-unauth: 60` s. CORS `*`, preflight allows `x-api-key`. `GET /v0/status?depositAddress=` returns 404 JSON for unknown addresses.
- **The API returns one best quote, not a list of competing solver quotes.** A lesson can show amount in/out, USD values, min out (slippage), time estimate, fees, deadline and the signature, but not "solvers compete" from live data.
- Lessons: #24, #26.

### Spike 7: wallet connector, mainnet login and balance: **partial** (no human login)
- Package `@hot-labs/near-connect` 0.12.0, class `NearConnector`. In headless Chrome `new NearConnector({ network: "mainnet" })` loaded manifest 1.1.0 with 12 wallets: hot-wallet, meteor-wallet, intear-wallet, ledger, mynearwallet, okx-wallet, near-mobile, trezu-wallet, nightly-wallet, hana-wallet, ethereum-wallets, near-cli. The manifest is fetched at run time from jsDelivr / GitHub raw (`hot-dao/near-selector`). Pass `walletConnect` (a WalletConnect project id) to add WalletConnect-only wallets.
- API: `await connector.connect()` opens the picker; `connector.on("wallet:signIn", t => t.accounts[0].accountId)`, `on("wallet:signOut")`; `await connector.getConnectedWallet()` → `{ wallet, accounts }` (throws "No wallet selected" when nobody is signed in); `connector.disconnect()`; `connector.switchNetwork("testnet")`; option `signIn: { contractId, methodNames }` for a limited key.
- near-kit glue: `new Near({ network: "mainnet", wallet: fromNearConnect(connector) })`. **Import `fromNearConnect` from `"near-kit"`**: the `near-kit/wallets` path in its doc comments is not in the package `exports`.
- Balance reads need no wallet: `near.getBalance("near")` on mainnet returned `"69252.69"` (formatted string, see spike 2 gotcha).
- Not verified: a real sign-in (needs a human with a mainnet wallet). Fallback (spec): with no or too little mainnet balance, offer the testnet edition of the final badge.
- Lessons: #23, #29.

### Contradictions with the spec (owner decision needed)
1. **Lesson 4.2 "see solvers compete":** 1Click returns one winning quote, not competing solver quotes. Either show the single live quote and illustrate competition with recorded or simulated bids, or reword the story.
2. **Chain signatures "sign and broadcast a Sepolia transaction":** each learner's derived address has no Sepolia ETH. Broadcast needs a Sepolia drip (new Worker secret and an owner-funded Sepolia key) or the lesson stops at "signed and verified".
3. **Faucet:** not a contradiction, but a public helper (`helper.testnet.near.org/account`) already gives 10 NEAR per new `.testnet` account from the browser. The Worker faucet stays primary (rate-limited, ours); the helper is a fallback before demo mode.
