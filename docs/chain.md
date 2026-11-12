# The Chain interface

All chain access goes through one interface, `Chain` in `src/chain/types.ts`. There are two implementations: **DemoChain** (`src/chain/DemoChain.ts`, in the browser, no network) and **TestnetChain** (`src/chain/testnet/`, real NEAR testnet). Lessons get the current one from `useChain()` and never call RPC, wallets or SDKs directly.

```tsx
import { useChain } from "../../../chain/ChainContext";
import { transfer, totalGasBurnt } from "../../../chain/ops";
import { parseNear, formatTgas } from "../../../chain/units";

const chain = useChain();
const out = await transfer(chain, "book-of-near.testnet", parseNear("1"), {
  pace: reducedMotion ? "instant" : "realtime",
  onPhase: (e) => light(e.phase), // built, signed, broadcast, included, executed, final
});
formatTgas(totalGasBurnt(out)); // "0.45"
```

`src/content/lessons/l-0-3-send-a-transaction/` is a working example (lesson 0.3).

## Files

| File | What it holds |
| --- | --- |
| `types.ts` | The interface and every result shape. Types only, no imports of network code (a test enforces this). |
| `ops.ts` | Helpers built on the interface: action builders (`actions.transfer(...)`), one-call operations, `phases()` async iterator, result readers. Work with any Chain. |
| `units.ts` | `parseNear`, `formatNear`, `tgas`, `formatTgas`. |
| `accountId.ts` | Account id rules (`isValidAccountId`, `accountIdProblem` for live feedback), implicit ids, parents. |
| `errors.ts` | `ChainError` with a `kind` and, for refused transactions, a `reason`. |
| `shards.ts` | `shardForAccount(layout, id)`: NEAR's boundary-account rule. |
| `DemoChain.ts`, `demo/` | The demo implementation, its fee table and its simulated contracts. |
| `ChainContext.tsx` | `ChainProvider` (wrapped around the app in `main.tsx`) and `useChain()`. |
| `contract.test-kit.ts` | `runChainContract(makeChain, { counterCode })`: the behavioural suite every implementation must pass. |

## Units

- **Amounts** are `bigint` yoctoNEAR. 1 NEAR = 10^24 yoctoNEAR. Use `parseNear("0.01")` and `formatNear(x, decimals)`; never use floats for money.
- **Gas** is `bigint` gas units. 1 Tgas = 10^12. Use `tgas(30)` and `formatTgas(gas)`.
- **Hashes** (transaction ids, receipt ids, block hashes) are base58 strings of 32 bytes, like on NEAR.
- **Public keys** are `ed25519:<base58>`.

## Operations

| Method | Returns | Notes |
| --- | --- | --- |
| `practiceAccount()` | `{ accountId, publicKey }` | Demo: the fixed key from `docs/lessons/stage-0/0.3.md`, an implicit (64-hex) account with 5 NEAR. |
| `returnAccount()` | `AccountId` | Where lessons send practice transfers. Demo: `book-of-near.testnet`. Testnet: `VITE_RETURN_ACCOUNT_ID`, or the practice account itself while that is unset. Lessons must use this, never read env or chain constants. |
| `viewAccount(id)` | `AccountView` | `amount`, `locked`, `codeHash`, `storageUsage`, block. Rejects `AccountDoesNotExist`. |
| `accountExists(id)` | `boolean` | For live name availability. |
| `listKeys(id)` | `AccessKeyInfo[]` | `publicKey`, `nonce`, `permission` (`FullAccess` or `FunctionCall` with `receiverId`, `methodNames`, `allowance`). |
| `viewCall(contract, method, args)` | `{ result, logs, blockHeight, blockHash }` | Read-only. Rejects `ViewFailed` on a panic or missing method. |
| `newKeyPair()` | public key | The secret stays in the chain's key store; sign by passing `publicKey` in a request. |
| `buildTransaction(request)` | `UnsignedTransaction` | Fills `nonce` (key nonce + 1), `blockHash` (recent block) and the key. |
| `signTransaction(tx)` | `SignedTransaction` | Adds `hash` (the transaction id) and `signature`. Local, no network. |
| `sendSignedTransaction(tx, options)` | `TxOutcome` | Waits for FINAL. |
| `sendTransaction(request, options)` | `TxOutcome` | Build + sign + send, reporting all phases. |
| `getTransaction(hash, senderId)` | `TxOutcome` | Like RPC `tx`. Rejects `UnknownTransaction`. |
| `block(ref)` | `BlockView` | `ref`: `"final"`, `"optimistic"`, `{ height }` or `{ hash }`. Includes one chunk header per shard. |
| `chunk(ref, shardId)` | `ChunkView` | The transactions and receipts in one shard's chunk. |
| `shardLayout()` | `{ shardIds, boundaryAccounts }` | Use `shardForAccount` to place an account. |
| `signDelegate(request)` | `SignedDelegate` | A meta-transaction (NEP-366), signed off-chain: `senderId`, `receiverId`, `actions`, `nonce` (key nonce + 1), `maxBlockHeight`, `publicKey`, `signature`, and `payload` (base64 borsh `SignedDelegateAction`, what a relayer receives). No NEAR spent. TestnetChain's bytes and digest are checked against near-kit in `borsh.test.ts`. |
| `relayDelegate(signed, options)` | `{ relayerId, outcome, remaining, cap }` | Hands it to the app's relayer, which sends a transaction with a `Delegate` action and pays the gas. Rejects with `ChainError` kind `RelayRefused` past the relayer's per-learner cap (3 a day) or when no relayer is set up. Demo: `relayer.bon.testnet` (`DEMO_RELAYER`, option `relayCap`). Testnet: the Worker's `POST /relay` (`VITE_WORKER_URL`; not yet run against testnet). |
| `probeRpc(endpointId, ref?, { pace })` | `RpcProbe` | One timed `block` request to ONE endpoint of `RPC_ENDPOINTS` (`rpcEndpoints.ts`), no fallback (lesson 3.3). Resolves `ok: false` with `UnknownBlock` or `Unavailable` (5xx, 429, no answer) instead of rejecting. Demo: answers after `RECORDED_LATENCY_MS` (recorded 12 Nov 2026); only the archival endpoint knows `HISTORICAL_BLOCK` (#100,000,000). Testnet: real fetch, timed with `performance.now()`. |

`ops.ts` wraps the common cases: `transfer`, `createSubAccount` (CreateAccount + Transfer + AddKey in one transaction), `createNamedAccount` (top-level `.testnet` name through the `testnet` registrar; verified on testnet by #4 and #7), `createImplicitAccount`, `addKey`, `deleteKey`, `deployContract`, `callMethod`. For a batch, pass several actions to `chain.sendTransaction`.

### Lifecycle and timings

`SendOptions.onPhase` is called for each phase in order: `built`, `signed`, `broadcast`, `included`, `executed`, `final`. Each event has `atMs` (since build), `txHash`, the matching RPC status (`NONE`, `INCLUDED`, `EXECUTED_OPTIMISTIC`, `FINAL`) and, from `included` on, the block. `phases(chain, request)` gives the same events as an async iterator. `TxOutcome.timings` holds the same numbers.

`pace: "realtime"` (the app default) waits between phases; `pace: "instant"` fires them at once. Use instant for tests and when `reducedMotion` is true. TestnetChain ignores `pace` and follows the network.

### Result shape (`TxOutcome`)

Mirrors RPC `EXPERIMENTAL_tx_status`, camelCased, so TestnetChain can map it field by field.

- `status`: `{ type: "SuccessValue", value }` (base64; read with `decodeSuccessValue`) or `{ type: "Failure", error }`.
- `transaction`: signer, receiver, `nonce`, `blockHash`, `actions`, `hash`, `signature`.
- `transactionOutcome`: the conversion step. Its `blockHeight`/`blockHash` is the inclusion block, `shardId` the signer's shard.
- `receipts[]`, in execution order: `id`, `predecessorId`, `receiverId`, `actions`, `shardId`, `blockHash`, `blockHeight`, `gasBurnt`, `tokensBurnt`, `logs`, `receiptIds` (receipts it created), `status`, `isRefund` (gas or deposit refunds from `system`).
- `timings`, `gasPrice` (yoctoNEAR per gas).

Helpers: `totalGasBurnt`, `totalTokensBurnt` (the fee), `inclusionBlock`, `explorerTxUrl`.

### Errors

- A transaction the network **refuses** rejects with `ChainError` `kind: "InvalidTransaction"` and a `reason`: `InvalidReceiverId`, `InvalidSignerId`, `SignerDoesNotExist`, `AccessKeyNotFound`, `ReceiverMismatch`, `MethodNameMismatch`, `RequiresFullAccess`, `NotEnoughAllowance`, `DepositWithFunctionCall`, `InvalidNonce`, `Expired`, `NotEnoughBalance`, `LackBalanceForState`, `InvalidSignature`. Nothing is charged. Lesson 1.2's refused attacks come from here.
- A transaction that is included but **fails** resolves with `status.type === "Failure"` and `error: { type: "ActionError", index, kind, message }`. `index` is the failing action; `kind.type` is one of `AccountAlreadyExists`, `AccountDoesNotExist`, `CreateAccountNotAllowed`, `ActorNoPermission`, `AddKeyAlreadyExists`, `DeleteKeyDoesNotExist`, `LackBalanceForState`, `NotEnoughBalance`, `FunctionCallError`. All actions of that receipt roll back; the fee is still paid and deposits come back in a refund receipt (lesson 1.3).
- `message` is always plain English, safe to show.

## DemoChain

- **Deterministic.** No clock, no randomness. Hashes are `base58(sha256(seed | label))`; a transaction hash covers the serialised transaction. Same seed and same calls give identical results; `DemoChain.test.ts` runs a scenario twice and compares. Options: `seed`, `pace`, `slowdown` (2 = busy network), `practiceBalance`, `accounts`, `contracts`, `sleep`.
- **Blocks and timing.** Starts at height 200,000,000. Broadcast at 250 ms (pacing; a real round trip to a testnet RPC measured about 150 ms and real inclusion about 1 s, see 0.3.md), then one block per 600 ms (NEAR docs). A receipt to another account runs one block later; final is two blocks after the last receipt. A transfer gives 0 / 0 / 250 / 850 / 1450 / 3250 ms, the numbers in `docs/lessons/stage-0/0.3.md`.
- **Shards.** Six shards, split by boundary accounts. The boundaries are illustrative (modelled on an older mainnet layout), not testnet's real layout.
- **Gas.** Per-action fees from `demo/fees.ts`, approximations of nearcore's fee table. A transfer burns 0.45 Tgas, matching the docs. Gas price 0.0001 NEAR/Tgas (the floor). Gas is held up front at 0.001 NEAR/Tgas and the difference is refunded in a `system` receipt a block after the work ends. Contract code gas is illustrative (`DemoMethod.gas`, default 2 Tgas).
- **Storage.** Accounts must keep 10^19 yoctoNEAR per byte used (rough byte counts). Below that, the receipt fails with `LackBalanceForState`.
- **Accounts at start:** the practice account, `testnet` (registrar contract) and `book-of-near.testnet` (the app's placeholder return account, `DEMO_RETURN_ACCOUNT`), `v1.signer-prod.testnet` (the demo chain-signature signer, below), and lesson 2.2's `buyer.demo.testnet` (demo shard 2) and `shop.demo.testnet` (demo shard 4): a buyer contract whose `order` reserves an item and calls the shop's `buy` with an `on_order_completed` callback; `buy` panics when `out_of_stock` is set (`src/chain/demo/shop.ts`).
- **Contracts.** Wasm cannot run in demo mode. A simulated contract is a set of JS methods keyed by the sha256 of its code bytes. `demoContractCode("counter")` gives code bytes for the built-in counter (`increment`, `get_num`, `fail`, `call_other` with an `on_other_done` callback, `last_result`). Pass `contracts: [{ code: realWasmBytes, contract }]` to make a real contract's bytes behave in demo mode. A method can log, read and write state, panic (throw), and return `ctx.functionCall(...)` or `ctx.batch(...)` to make cross-contract receipts, optionally with a `then` callback that gets `ctx.promiseResult`. `ctx.functionCall(..., { delay: n })` runs the call `n` blocks later than usual: it models a contract that pauses and resumes (NEAR's yield and resume).
- **Built-in `ft` token (lesson 3.2).** `demoContractCode("ft")` (`src/chain/demo/token.ts`): a NEP-141 token with NEP-145 storage registration, as near-contract-standards behaves. `new({ owner_id, total_supply, metadata })` mints to the owner; `ft_transfer` needs exactly 1 yoctoNEAR and panics with `The account <id> is not registered` for an unregistered receiver; `storage_deposit` takes 0.00125 NEAR (`FT_STORAGE_DEPOSIT`) and refunds the rest; views `ft_balance_of`, `ft_total_supply`, `ft_metadata`, `storage_balance_of`, `storage_balance_bounds`. There is no token Wasm in the repo yet, so testnet mode does not run it (lesson 3.2 says so and runs on its own DemoChain).
- **Meta-transactions.** A `Delegate` action is checked on the sender's account (sender matches, not expired, key exists, signature matches, nonce unused), then its actions run in a new receipt from the sender one block later. The relayer pays the gas and any attached deposit.
- **Built-in `mpc-signer` (lesson 4.1).** `demoContractCode("mpc-signer")`, deployed at genesis on `v1.signer-prod.testnet` (`SIGNER_CONTRACT`). It mirrors the real chain-signature signer (spike 5): views `public_key` and `derived_public_key({ predecessor, path })`, and `sign({ request: { payload_v2: { Ecdsa }, path, domain_id: 0 } })` with at least 1 yoctoNEAR. The answer `{ big_r, s, recovery_id }` comes 3 blocks later (`delay`), about 5.5 s in all. It uses real secp256k1 math with ONE fixed demo root key (`src/chain/demo/mpcSigner.ts`, `mpcMath.ts`), so its signatures recover to the derived address. The real network has no such key: its nodes hold key shares. The derivation (`chainSigMath.ts`) has no viem, so DemoChain stays light; the Ethereum side (`chainSignatures.ts`, viem) is reached only from lesson code.
- In realtime pace, state changes apply as soon as the transaction is sent; only the phase events are delayed.

## Adding an operation

1. If it is a new **transaction shape**, it needs no interface change: add a helper to `ops.ts` that builds actions and calls `chain.sendTransaction`.
2. If it needs a new **read** (a new RPC method), add the method and result type to `types.ts`, mirroring the RPC result in camelCase with bigint amounts.
3. Implement it in `DemoChain` (deterministic, no `Date.now` or `Math.random`).
4. Add a check to `runChainContract` in `contract.test-kit.ts` using only the interface, so TestnetChain must pass it too.
5. Document it in the tables above.

A new **simulated contract** for a lesson needs no interface change: write a `DemoContract` in the lesson folder and pass it via `contracts` (or add it to `demo/contracts.ts` if several lessons share it).


## TestnetChain and modes (#7)

- **Modes.** `ChainProvider` starts in demo mode. Testnet mode comes from `?mode=testnet`, the saved choice (`localStorage["bon:chain-mode"]`, set by the lesson page's "Use testnet / Use demo" button) or `VITE_CHAIN_MODE=testnet`. `useChainMode()` gives `{ requested, active, status: "ready" | "connecting" | "fallback", notice, setMode }`; `ModeSwitch` (in the lesson tools) shows it. `src/chain/testnet/` and near-kit are loaded only in testnet mode (separate chunks).
- **Practice account.** A throwaway ed25519 key made in the browser, stored in `localStorage["bon:testnet-practice-account:v1"]` with a "TESTNET only" warning. Only the public key leaves the browser. Funding order: Worker `POST $VITE_WORKER_URL/faucet` (implicit account, 0.5 NEAR) → NEAR's public helper `helper.testnet.near.org/account` (`bon-<random>.testnet`, 10 NEAR; rate-limited, it answered 429 after a few calls) → demo mode with a visible notice that says why. While it connects, calls on `useChain()` wait.
- **Transactions.** Borsh-encoded in `testnet/borsh.ts` (checked byte for byte against near-kit's schema) and signed with near-kit, so the nonce and block hash shown at build time are exactly what is signed. The reference block hash is the `view_access_key` block.
- **Phases follow the network.** Each event from `broadcast` on carries `node` (the RPC host). `broadcast` when `send_tx` goes out, `included` when it returns at `wait_until: "INCLUDED"` (block filled in from the tx outcome), `executed` at `EXECUTED_OPTIMISTIC`, `final` at `FINAL`. `atMs` are real milliseconds.
- **RPC.** `testnet/rpc.ts` tries `rpc.testnet.fastnear.com` → `test.rpc.fastnear.com` → `rpc.testnet.near.org` on network errors and 5xx/429; unknown blocks, chunks and transactions retry once on `archival-rpc.testnet.fastnear.com`. Reads use `finality: "final"`.
- **Mapping notes (real testnet behaviour, 1 Nov 2026):**
  - `EXPERIMENTAL_tx_status.receipts` leaves out the first receipt; the mapper rebuilds it from the transaction. Receipts are sorted by block height.
  - Shard ids come from `shardForAccount` with the live layout (10 shards). `chunk().receipts` lists the receipts a chunk *sends*, not the ones it applies (RPC has no cheap way to list those).
  - A receipt that creates an implicit account burns more than gas × price (about 0.0063 NEAR extra; reason unverified). A transfer receipt to an implicit account burns about 7.5 Tgas.
  - Nodes answer a re-sent signed transaction with its old result. `sendSignedTransaction` checks the key's nonce first and refuses with `InvalidNonce`, which is what really happens: it never runs twice.
  - A malformed account id cannot be decoded by the node; TestnetChain refuses it locally with `InvalidReceiverId`/`InvalidSignerId`.
  - The network checks the balance before a function-call key's permission, so `RequiresFullAccess` only shows when the sender can afford the transfer.
  - `getTransaction` timings come from block timestamps (only `executed` and `final` are non-zero).
- **Counter contract.** `contracts/counter/counter.wat` (hand-written WebAssembly, ~2 KB), built to `counter.wasm` with `npm run build:counter` (wabt; no Rust). Same methods as the demo counter. `counter.test.ts` runs it in Node with a fake NEAR host.
- **Tests.** `npm run test:testnet` runs `runChainContract` against real testnet (11/11 pass). Set `TESTNET_STORE=/path/outside/repo.json` to reuse a throwaway practice key when the public helper is rate-limited. E2E: `TESTNET=1 npx playwright test --grep @testnet`.


## Mainnet wallet and funds check (#23)

Separate from `Chain` on purpose: `Chain` is the practice network (demo or testnet); this is the learner's **own wallet on mainnet**, used only for the final badge claim and the optional capped swap. No `Chain` method was added. Code is in `src/chain/mainnet/`; import from `src/chain/mainnet`.

| Piece | What it does |
| --- | --- |
| `MainnetWallet` (`types.ts`) | `kind` (`demo` or `mainnet`), `state()`, `subscribe`, `connect`, `disconnect`, `refresh`, `signAndSend`. `WalletState` is `disconnected`, `connecting`, `connected { accountId, balance }` or `error { message }`. `balance` is spendable yoctoNEAR (amount minus 10^19 per storage byte). |
| `DemoWallet` | Demo mode's wallet: `demo-learner.near` with 25 NEAR, no network, deterministic hashes (`demo-0001`). Options `balance`, `accountId` (use a small balance to show "not enough"). |
| `NearConnectWallet` | The real one: `@hot-labs/near-connect` 0.12.0 for login and signing, mainnet RPC `view_account` for the balance (fallback list in `MAINNET_RPC_URLS`). Lazy chunk, loaded only after "Use my own wallet". The connector is injected, so tests use a fake. |
| `checkFunds(state, { amount, feeReserve? })` | Pure. Returns `enough`, `not-enough` (with `shortfall`) or `no-wallet`; the last two carry `fallback: "testnet"` and plain-English `message`. Default fee reserve 0.01 NEAR. |
| `signWithConfirmation(wallet, request, confirm)` | The only signing path. Never throws. One signing at a time per wallet (a second call resolves `busy`, including while the wallet is answering). Refuses (`no-wallet`, `invalid-request`, `not-enough`: amount plus fee reserve, the same rule as `checkFunds`) before any dialog; shows `describeSigning` (summary, receiver, total with unit, never "0 NEAR" for a tiny deposit, per-action lines with call arguments, fee note, warning) through `confirm`; re-reads the balance after "Confirm"; asks the wallet only if `confirm` resolved true (`declined` otherwise). A wallet that rejects (popup closed, RPC down, transaction `Failure`, no tx id) gives `{ ok: false, reason: "failed", message }`. |
| React | `MainnetWalletProvider` (in `main.tsx`), `useMainnetWallet()` (`state`, `waiting`, `connect`, `disconnect`, `sign(request)`, `usingReal`; the raw wallet is not exposed), `WalletPanel`, `FundsNotice amount=...`. `sign` renders the confirmation dialog itself, then a "Waiting for your wallet" overlay until the wallet answers. Page at `/wallet`. |

Demo parity: the provider starts on `DemoWallet`; nothing from near-connect loads and no request is made until the learner opts in. If the real wallet fails to load, the demo wallet stays with a notice.

Not verified (needs a human with a mainnet wallet, see spike 7): a real sign-in and a real `signAndSendTransaction`. The call shapes follow the package's `.d.ts`. Run it by hand once before the final badge depends on it.
