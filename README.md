# Book of NEAR

An interactive course that teaches NEAR from zero, as a pop-up book you can touch. Each lesson is a scene in black ink on paper, in 2D and 3D. You make a key, send a transaction, give an app a key that can do only one thing, follow a transaction across shards and sign an Ethereum transaction from a NEAR account. Every lesson ends with an "Honest take": what NEAR does well and what it does badly. Finishing a stage lets you claim a non-transferable NFT badge on NEAR testnet.

Built solo for the NEAR Hackathon 2026 (build window 1 Nov 00:00 UTC to 14 Nov 23:59 UTC). **This submission is testnet only:** the default build has every mainnet wallet and signing path switched off (build flag `VITE_ENABLE_MAINNET`, off unless set to `true`).

- **Live demo:** https://book-of-near.pages.dev (demo mode by default; no wallet needed)
- **Repository:** https://github.com/dispaz/book-of-near
- **License:** MIT (`LICENSE`)

## The problem, and how NEAR fits in

Someone with no crypto knowledge cannot easily learn how NEAR works. The docs assume prior knowledge, explainers are static, and nothing lets a learner do the real thing and watch what happens underneath. Experienced users have the opposite problem: they want to skip the basics and see what is different about NEAR, with an honest comparison to other chains.

Book of NEAR teaches by doing. In demo mode everything runs in the browser against a simulated chain, so anyone can try it. In testnet mode the same lessons send real NEAR testnet transactions: named accounts, function-call keys, batched actions, contract deploys and cross-contract calls, and a Chain Signatures request to the MPC signer `v1.signer-prod.testnet`. The badges are NEP-171 NFTs on a contract of ours on testnet, minted only when the learner's own testnet transactions prove they did the stage.

## Run it (one command, demo mode)

Needs Node 22 or newer and npm.

```sh
npm install && npm run dev
```

Open http://localhost:5173. Demo mode is the default: no wallet, no keys, no network calls to a chain. Nothing to configure. (`npm install` also points git at `.githooks`, a pre-commit secret scanner.)

A production build: `npm run build` (output in `dist/`), then `npm run preview` (http://localhost:4173).

## Walkthrough: do X, see Y

A first visit opens a three-question quiz at `/start` that picks a path (newcomer, crypto veteran or developer). After it, `/` shows the contents: a book spread with every stage and lesson, your progress, locked "planned" cards for future topics, and a badge card at the end of each stage. Each lesson opens as a closed book; open the cover, then move with **Next step** and **Previous** in the bar at the bottom. Some steps keep **Next step** disabled until you do the step's action.

### On every lesson page

| Do | See |
| --- | --- |
| Press **2D** or **3D** (or open `?view=2d` / `?view=3d`) | The same lesson drawn as a flat ink diagram or as a 3D pop-up book on a desk. Both draw one shared state, so your progress stays when you switch. The 3D view loads only when you ask for it. |
| In 3D, click an object on the right-hand page (or Tab to it and press Enter) | It lifts and gets an outline on hover, does the step's action when picked, shakes with a hint if it is too early, and shows a detail if the step is already done. |
| Look at the mode pill on the lesson page | **Demo mode** (default). Press **Use testnet** to switch to NEAR testnet (see "Testnet mode" below); **Use demo** switches back. `?mode=testnet` / `?mode=demo` does the same. |
| Turn on "reduce motion" in your OS, or open `?webgl=0` | Animations stop (outline and colour changes only). Without WebGL the lesson stays in 2D, and every scene has a text version. |
| Reach the last step | The **Honest take**: NEAR's strengths and weaknesses for that topic. Then **Finish lesson**. |

### The lessons (20, all on `main`)

Stage 0, Blank Page (crypto foundations)

- **0.1 How a blockchain and a transaction work.** Press **Send** to move coins on a toy ledger, see blocks link by hash, edit an old block and see every later hash break (**Repair next block**, **Undo my edit**).
- **0.2 Make a wallet.** Press **Generate** for a practice key pair and seed phrase, **Turn it into an address**, **Sign** a message and **Verify** it; change one letter and the check fails. A warning says never to type a real seed phrase. Keys stay in memory only.
- **0.3 Send a transaction and watch it.** **Build the transaction**, **Sign with your private key**, **Send to the RPC node**, and watch Build, Sign, Broadcast, Included and Final light up one by one, with the fee and the time to finality.

Stage 1, Named (first steps on NEAR)

- **1.1 Claim your name.** Type a name, see if it is free, and **Ask the registrar to create your name**: a `name.testnet` account, compared with a 64-character hex account.
- **1.2 A key that can do only one thing.** Set an allowance and press **Give the app a key**: a function-call key that may only call your counter. **Count** works. Then the app is "hacked": **Send NEAR to the attacker**, **Call another contract** and **Add a full-access key for the attacker** are each refused by the chain, with the reason. **Delete the app's key**, then **Count again** fails.
- **1.3 Inside a NEAR transaction.** Build a batch (create account, send NEAR, add a key), order it, **Send the batch**, then break one action and see every action roll back with only the fee paid. **Re-send the batch that worked** is refused because its nonce is used.

Stage 2, Nightshade (under the hood)

- **2.1 Follow your transaction across shards.** Load your 0.3 transaction (or a recorded one) and follow it hop by hop (**Next hop**, **Follow next receipt**) across shards, chunks and blocks, then see where the time went.
- **2.2 A call that takes several blocks.** **Send cross-contract order** and watch one call split into receipts over several blocks. **Inspect gas** shows the gas each contract burnt, and that all of it is burned; none goes to the contract. **Simulate out-of-stock failure** shows the callback.

Stage 3, Wasm (builder)

- **3.1 Deploy a contract in one click.** **Deploy counter contract** to your own sub-account, **Increment**, **Read the count**, **Call fail with a callback** (the receipts show which part failed), then **Reset and clear state** and see the storage refund.
- **3.2 Issue your own token.** Mint a practice token, see a transfer refused until you **Pay storage deposit for friend**, then send a gasless transfer through a relayer (NEP-366 meta-transaction). This lesson always runs on the simulated chain.
- **3.3 Race the RPC nodes.** **Race the nodes**, **Disable FastNEAR** and **Send query via failover**, then **Query historical block** to see that only the archival node keeps old blocks.

Stage 4, Any Chain (chain abstraction)

- **4.1 One account, every chain.** **Derive Ethereum address** from your NEAR account and a path (**Try another path** gives another address), **Prepare payload** for a Sepolia transfer, **Request signature (MPC)** from the signing network, and **Verify signer**: the signature recovers to your derived address. The signed transaction is not broadcast (the derived address has no Sepolia ETH).
- **4.2 Swap across chains with an intent.** **Fetch live intent quote**: a dry, read-only quote for NEAR to USDC on Arbitrum from the mainnet 1Click API (Intents has no testnet; recorded in demo mode, fetched live in testnet mode; no money moves). **Inspect quote breakdown**, **Simulate solver execution**, then **Finish on verified quote**.
- **4.3 Old bridge vs the NEAR way.** **Compare workflow steps** side by side, **Inspect asset backing** of a wrapped token, **Trigger simulated vault exploit**, then **Inspect confidential shield**.

Stage 5, Enclave (user-owned AI and privacy)

- **5.1 Ask a private AI and verify it.** **Read the memory as root** on a normal server and in an enclave, **Send prompt** (the tutor's answers are pre-written), **Fetch attestation quote** from NEAR AI Cloud (recorded in demo mode, fresh in testnet mode) and **Verify in my browser**; **Change one byte and verify again** fails.
- **5.2 An agent with no owner.** **Open the .env file** to see a bot whose key anyone with the file can use. **Start the agent**: it makes its own key (made in your browser, standing in for the enclave). **Register the agent** with the agent contract (its checks run in the browser, written from the reference contract, with measurements recorded from 5.1's quote). **Sign as the developer** is refused ("Agent not registered"), and **Register a changed copy** fails ("Attestation verification failed"). **Run the agent**: the contract model builds the `sign` call it would send to `v1.signer-prod.testnet` (1 yoctoNEAR) and shows the Ethereum address it would sign for, derived in your browser. Nothing is sent or signed.

Stage 6, Citizen (ecosystem and governance)

- **6.1 Read and vote on a proposal.** Lock NEAR for veNEAR voting power with a slider, **Review proposal** and **Vote YES** or no. A practice vote: nothing is sent to a chain.
- **6.2 The live money map.** **Compare the two USDCs** (native USDC 79.3 million, bridged USDC.e 14.6 million), **Read the oracle** (its stored NEAR price is from August, and `get_price` refuses it as too old), then **Trade 100,000 USDC** in a stable pool (about 1:1) and a simple pool (10.9% over the starting price), and **Show the flows** of NEAR Intents. Every figure was recorded on 13 Nov 2026 and is labelled "Not live data"; nothing is sent.

Stage 7, Book of NEAR (capstone)

- **7.1 Trace one intent end to end.** **Authorize intent**, follow it through your shard, the contract and settlement, then **Verify foreign settlement**. It replays your own 4.2 quote, or a recorded intent.
- **7.2 The honest scoreboard.** Open the Accounts, Scalability, Speed and Liquidity cards and weigh NEAR against Ethereum, Solana and Cosmos, weak spots included.

In progress at submission time, not part of this submission: the stage 7 badge (its shelf slot says "Badge not available yet").

### Badges, "My book" and `/check`

| Do | See |
| --- | --- |
| Finish lessons 0.1 to 0.3 in demo mode, then open the contents (`/`) | The stage 0 card says "Your badge is ready". |
| Press **Claim the stage 0 badge** | "Stage 0 badge claimed" with the badge art. In demo mode the claim is signed in the browser and checked by a simulated copy of the contract's rules. |
| Open **My book** (`/my-book`) | A shelf of eight slots, counted "of 7": claimed badges, "Not claimed yet" for the rest of stages 0 to 6, "Badge not available yet" for stage 7. Badges survive a reload. |
| Open **Open in the badge checker**, or `/check` | Look up any account's badges, no login. In testnet mode it reads the contract on testnet. |
| Open the contents before a stage is finished | The stage's card has no claim button yet; it lists what is missing. |

Stage badges 0 to 6 can be claimed. Each needs the stage's lessons finished and the previous stage's badge. Stages 0 to 4 also need evidence from the learner's own transactions: 0.3's transfer, 1.1's account and 1.2's key, 2.1's transfer, 3.1's deploy, 4.1's Chain Signatures request. Stage 5 (lessons 5.1 and 5.2) sends nothing on chain, so it needs no transaction evidence; the contract still requires the stage 4 badge first (`src/badges/rules.ts`). Stage 6 (lessons 6.1 and 6.2) works the same way: a practice vote and recorded data, no transaction evidence, and the stage 5 badge first. A stage done in demo mode cannot claim a testnet badge; the card says why.

### Final exam (`/exam`)

Two routes, 15 fixed questions each, all taken from the lessons' own checks. The **general route** needs the stage 0, 1 and 2 badges; the **developer route** needs stages 0 to 4 (the contract mints stage n only to a holder of stage n - 1, so stage 4 is reachable only through the optional builder stage 3). The pass mark is 80%: 12 of 15.

| Do | See |
| --- | --- |
| On the contents page, press the **Final exam** pill without the stage 2 badge | "The exam is locked", with each required badge marked "held" or "not yet", and a link back to claim them. |
| Claim the missing badge, then open **Final exam** again | The 15 questions of the general route. |
| Pick **Developer route** | The address gains `?route=developer`; it stays locked until you also hold the stage 3 and 4 badges. |
| Press **Hand in my answers** with questions blank | "Answer every question first. 15 are still blank." Nothing is graded. |
| Answer and hand in with 11 right | "Not passed yet", "You need 12 of 15", and every answer marked right or wrong with the right option and why it is right. |
| Press **Take the exam again**, answer 12 or more right | "You passed the final exam". The result and its signed receipt are saved in this browser; the page shows your kept result and attempt count after a reload. A later fail never replaces a pass. |
| Pass with 14 of 15 right | Under the result: "Your final badge is ready: epic". 14 of 15 is rare, and a pass during the hackathon raises it one tier (demo time is inside the hackathon). |
| Press **Claim the final badge** | "Final badge claimed: epic" with the badge art. **My book** shows it under the stage shelf ("Final badge: epic, Passed the general route"), and `/check` adds "and the final badge (epic)". It survives a reload; one final badge per account. |

Retakes are unlimited in the app (the Worker allows 10 graded attempts per account per day). In demo mode the exam is graded in the browser and the receipt is signed with the public demo key, so it counts only in that browser. In testnet mode the Worker grades it (`POST /exam`): it re-reads the route's badges on testnet, grades, and signs a receipt for a pass with the claim key. Results are kept per route, mode and account, so a demo pass never stands in for a testnet one.

The answer key is not secret. It is in this public repo, demo mode downloads it (as a separate chunk, only when it grades), and every graded attempt shows the right answers. A testnet pass is worth something because the Worker signs the receipt after checking the badges, not because the answers are hidden.

**Final badge rarity.** It comes only from what the signed receipt proves: the score sets the tier (12 of 15 common, 13 or 14 rare, 15 epic), and a pass during the hackathon (1 to 14 Nov 2026 UTC, by the Worker's clock) raises it one tier, so legendary is 15 of 15 during the hackathon. The spec's other two inputs (the optional real swap and "the key challenge without hints") are not used: nothing on testnet proves them. In testnet mode the Worker (`POST /final`) checks the receipt's signature with its own key, its contract, account and route, then signs the claim; the practice account sends `claim_final`. The contract checks the claim against the account that sends it, so a receipt for someone else's account cannot mint to you. The final badge is minted on testnet only (no mainnet edition in this submission).

### Testnet mode

Press **Use testnet** on any lesson page (or open a lesson with `?mode=testnet`). The app makes a practice account in your browser: a throwaway key in `localStorage`, funded by our Worker faucet if `VITE_WORKER_URL` is set, otherwise by NEAR's public testnet helper (which limits accounts per IP address). If no faucet answers, the app says so and offers to stay in demo mode. Testnet NEAR has no value. Lessons that need no chain (0.1, 0.2, 4.3 except its quote, 6.1, 6.2, 7.1, 7.2) behave the same in both modes; 2.2 opens a recorded real testnet call; 3.2 always runs on the simulated chain. In testnet mode, 4.2 and 4.3 fetch a dry, read-only quote from the mainnet 1Click API (Intents has no testnet); nothing is signed or sent on mainnet.

Claiming a testnet badge also needs the Worker's `/claim` route deployed with its signing key (see "Honest limitations"). The testnet final badge also needs the Worker's `/final` route, and the owner's one-time `set_route` call for both exam routes (`docs/badge-contract.md`).

## Hackathon tracks and evidence

Tracks entered: `["open", "nfts", "security"]`. Explorer links use https://testnet.nearblocks.io.

### `open`: an interactive NEAR course with real testnet actions

- 20 lessons, each in 2D and 3D, all runnable in demo mode (one e2e spec per lesson in `e2e/lessons/`).
- Real testnet runs through the same code (`TestnetChain`), with these transactions (from `docs/progress.md` and `docs/spikes-seed.md`):

| Lesson | What happened | Transaction |
| --- | --- | --- |
| 0.3 | A 0.01 NEAR transfer from a practice account to itself (an opt-in `@testnet` e2e run of the app), followed to final in about 2.5 to 3 s | [`695B3sz…JjRo`](https://testnet.nearblocks.io/txns/695B3szeohzeJujekYRNnuEcog5wHctX13LLHDB5JjRo) |
| Faucet | Our Worker funded a fresh practice account | [`FYDGYXs…K1Mh`](https://testnet.nearblocks.io/txns/FYDGYXsSxBMyMH7RiFvcBNCuYUGrs2Yum77NgXndK1Mh) |
| 3.1 | Create account + transfer + add key + deploy, in one transaction, from the app | [`AoWApW2…m64R`](https://testnet.nearblocks.io/txns/AoWApW2aUJuffasnFxtVS17MB5wAXH7MU7jFpo16m64R) |
| 3.1 | A call whose cross-contract callback sees the failure | [`2gxK7E8…wBMm`](https://testnet.nearblocks.io/txns/2gxK7E8KUBjGh11fbgH4uacEHvcyJsbexq1UDRTxwBMm) |
| 4.1 | A Chain Signatures `sign` request to `v1.signer-prod.testnet`, from the app | [`Ebo9AS3…gxAx`](https://testnet.nearblocks.io/txns/Ebo9AS3zMcU9gMD2wGfZiD4Ewr8J7peCa9fAxfWLgwAx) |

- The chain contract suite (`npm run test:testnet`, opt-in, needs a funded testnet key) passed 11 of 11 checks on real testnet on 1 Nov 2026: transfers, shards, named accounts, batch rollback, a function-call key, deploy and call, cross-contract callbacks, invalid transactions refused, RPC timing.

### `nfts`: badges that gate on proof of learning

- Contract: [`badges.bon-badges-mwe57oab.testnet`](https://testnet.nearblocks.io/address/badges.bon-badges-mwe57oab.testnet) (Rust, near-sdk 5.11, `contracts/badge/`). NEP-171 with NEP-177 metadata and NEP-297 events. Badges are non-transferable, one per account per stage, need the previous stage, and are minted only with an ed25519 claim signed by our Worker after it checked the learner's own testnet transactions (stages 0 to 4; stages 5 and 6 have none to check). The contract pays storage, so the learner pays only gas. Details: `docs/badge-contract.md`.
- Deploy transaction: [`3WJ3Rgw…bwwp`](https://testnet.nearblocks.io/txns/3WJ3Rgw2ca7wXpVxJF3jyu9pmx3DUL98pvRsqBHKbwwp).
- A real claim: practice account `bon-learner-mwe61s8i.testnet` sent a transfer, the Worker checked it and signed a claim, and [`claim_stage` `EAuadk9…XJ1o`](https://testnet.nearblocks.io/txns/EAuadk9PtuXBfee1fMx32okJyo6t2xCMbwJkumk8XJ1o) minted token `1` ("Book of NEAR: Stage 0"). A claim with no evidence was refused, and the same claim again was refused ("already claimed").
- In the app: the claim card, "My book" (`/my-book`) and the public checker (`/check`), covered by `e2e/badges.spec.ts` in demo mode. 19 sandbox tests for the contract (`npm run test:badge`, needs Rust).

### `security` (bonus): a key that can do only one thing

- Lesson 1.2 (`/lesson/l-1-2-function-call-key`). The learner gives an "app" a function-call key limited to one contract and a NEAR allowance. A scripted agent holding that key then tries to send NEAR, call another contract and add a full-access key. The chain refuses each one, and the lesson shows the reason (`RequiresFullAccess`, `ReceiverMismatch`). The learner then deletes the key and sees the app's next call fail.
- Walked in demo mode by `e2e/lessons/l-1-2-function-call-key.spec.ts` (2D and 3D). On real testnet, the chain contract suite's check "adds a function-call key that can only call one contract, then deletes it" passed on 1 Nov 2026.

## Architecture in brief

- **One `Chain` interface** (`src/chain/types.ts`) for everything on chain. Lessons never call RPC, wallets or SDKs directly; they call `useChain()`. Two implementations: `DemoChain` (deterministic, in the browser, no network; the default) and `TestnetChain` (`src/chain/testnet/`, near-kit for keys and signing, its own Borsh encoder, an RPC fallback list led by FastNEAR). A unit test (`src/chain/noNetworkImports.test.ts`) checks that the Chain interface files (`types.ts`, `errors.ts`, `shards.ts`, `units.ts`, `accountId.ts`, `ops.ts`) import no network code.
- **Lessons are folders**: `src/content/lessons/<id>/manifest.ts` (steps, captions, check questions, honest take) plus lazy `Scene.tsx` / `Scene3D.tsx`. Stages are `src/content/stages/<n>-<slug>/stage.ts`. Both are found automatically. The researched copy is in `docs/lessons/stage-<n>/`.
- **Scene kit** (`src/scene-kit/`): the ink style (black outlines, paper white, one accent per stage), SVG objects for 2D, and the 3D pop-up book (`BookScene`, react-three-fiber): objects rise from the right-hand page, step text is printed on the left page on wide screens, canvases draw only when something moves. See `docs/book-scene.md`.
- **Cloudflare Worker** (`worker/`): `POST /faucet` (funds a practice account, rate-limited per IP and per day), `POST /intents/quote` (proxy to NEAR Intents 1Click, dry quotes, NEAR to USDC only), `POST /claim` (checks a learner's testnet evidence, then signs a 5-minute badge claim), `POST /exam` (checks the route's badges on testnet, grades the final exam and signs a receipt for a pass), `POST /final` (checks a pass's signed receipt, works out the rarity and signs the final badge claim), `GET /health`. Keys live only in Worker secrets.
- **Badge contract** (`contracts/badge/`): Rust, see above.

## Tests

```sh
npm test               # Vitest unit tests (src/**/*.test.ts(x), scripts/**/*.test.ts)
npm run lint           # ESLint + Prettier check
npm run typecheck
npm run e2e            # Playwright against a production build, demo mode (installs Chromium first)
E2E_NO_3D=1 npm run e2e   # WebGL off, 3D tests left out (what the blocking release CI runs)
cd worker && npm install && npm test   # Worker routes, limits, claim checks (no network)
npm run test:badge     # badge contract sandbox tests (needs Rust 1.86 and cargo)
```

On macOS the e2e browser draws 3D on the GPU; elsewhere it uses software WebGL with fewer workers (`E2E_GL=swiftshader`, `E2E_WORKERS` override). Opt-in live tests: `npm run test:testnet` and `npm run test:testnet:lessons` (need a funded testnet key in a file outside the repo; see `docs/chain.md`).

## AI disclosure and libraries (rule Q-005)

The code in this repository was written with **Claude Code (Anthropic) agents**, under the owner's direction: the owner wrote and triaged the spec and tickets, made the product decisions, and reviewed and merged the pull requests. A separate reviewer agent reviewed every PR before merge. Facts in the lesson copy were researched by agents from primary sources and are listed per lesson in `docs/lessons/`.

Main libraries (versions from `package.json` / the lockfile):

| Library | Version | Used for |
| --- | --- | --- |
| near-kit | 0.20.2 | NEAR keys, signing, RPC (TestnetChain, Worker) |
| @hot-labs/near-connect | 0.12.0 | Wallet connector (not part of this submission, see below) |
| viem | 2.57.10 | Ethereum transaction encoding and signer recovery (lesson 4.1) |
| @noble/curves, @noble/hashes | 2.4.0 | ed25519 / secp256k1 maths, hashing |
| @scure/bip39, @scure/base | 2.4.0 | Seed phrases, base58 |
| react, react-dom | 19.3.1 | UI |
| react-router | 8.5.1 | Routes |
| three | 0.187.0 | 3D |
| @react-three/fiber, @react-three/drei | 9.8.2, 10.7.9 | 3D scenes in React |
| @fontsource (Newsreader, DM Sans, Caveat) | 5.3.0 | Fonts |
| vite, typescript | 8.3.5, 6.0.3 | Build |
| vitest, @playwright/test | 5.0.5, 1.64.1 | Tests |
| eslint, prettier | 10.14.0, 3.9.10 | Lint and format |
| wabt, binaryen | 1.0.39, 123.0.0 | Build the counter contract and post-process the badge wasm |
| wrangler (Worker) | 4.149.0 | Cloudflare Worker |
| near-sdk (Rust, badge contract) | 5.11.0 | Badge contract |

External services: NEAR testnet RPC (FastNEAR, NEAR Foundation), NEAR's public testnet helper (faucet fallback), NEAR Intents 1Click (dry quotes, no key), NEAR AI Cloud (public attestation report, lesson 5.1), Cloudflare Pages and Workers.

## Baseline: what existed before the hackathon

Commits before 1 Nov 2026 00:00 UTC are docs only: the spec, the tickets, the curriculum map (`docs/curriculum/book-of-near-map.html`, an HTML page with a small inline script) and a design prototype (`docs/prototype/ink-stage.html`, a single HTML file with inline JavaScript, not used by the app). No app code. The tag `pre-hackathon` marks the last of them (`ab3a53e`, 31 Oct 2026). All app, Worker and contract code was written from 1 Nov.

Diff of everything built during the hackathon: https://github.com/dispaz/book-of-near/compare/pre-hackathon...hackathon-submission

## Other chains and other projects

- **Other chains (rule Q-002):** lesson 4.1 derives an **Ethereum Sepolia** address from a NEAR account and has NEAR's Chain Signatures sign a Sepolia transfer (signed and verified, not broadcast). Lessons 4.2 and 4.3 show a dry, read-only quote for NEAR to **USDC on Arbitrum** from the mainnet 1Click API (Intents has no testnet; nothing is sent to Arbitrum or mainnet), and 7.1 replays such a quote. There is no existing product on another chain; everything here was built for NEAR during the window.
- **Other hackathon projects (rule Q-015):** none.

## Honest limitations

- **Testnet only.** Badges, accounts and transactions are on NEAR testnet; testnet tokens have no value.
- **Demo mode uses recorded or simulated data.** DemoChain is deterministic; RPC timings (3.3), the 1Click quote (4.2), the attestation report (5.1) and some example transactions are recorded from real runs and labelled as such. Demo badges are kept in your browser only.
- **Testnet badge claims need our Worker.** The live site's testnet claim works only once the Worker is deployed with its claim signing key. The real claim above was made with the Worker running locally.
- **Not every lesson was walked on live testnet.** 0.3, 3.1 and 4.1 were run end to end on testnet in the app; the chain calls of the other lessons are covered by the testnet contract suite, and their UI by demo-mode e2e tests.
- **4.1 does not broadcast to Sepolia**: a derived address starts with 0 ETH. **4.2 shows one best quote**, not competing solver bids (1Click returns one). **3.2 runs on the simulated chain** in both modes. **5.1's tutor answers are pre-written** (NEAR AI chat needs an API key); the attestation check is real. **6.1's vote is a practice vote.** **6.2's figures are recorded** (13 Nov 2026), not live.
- **No stage 7 badge yet.** The final badge works in demo mode; on testnet it needs the Worker's `/final` route and the owner's `set_route` call. Its rarity uses only the score and the pass time, not the real swap or hint use (nothing on testnet proves them).
- The public testnet faucet fallback limits accounts per IP address, so a reviewer may hit it; demo mode always works.

### Not part of this submission (present in the code, not verified live)

- **Mainnet wallet sign-in** (`@hot-labs/near-connect`, page `/wallet`) and the **optional tiny real mainnet swap** at the end of lesson 4.2 ("Use my own wallet"). Both are switched off in the default build behind `VITE_ENABLE_MAINNET` (off unless set to `true`). A real mainnet sign-in and signature were never tested.
- **Mainnet badge minting**: not built. The final badge has a testnet edition only (owner decision for the hackathon).

## More documents

- `docs/submission.md`: submission pack (form text, X post, video script, owner checklist)
- `docs/hackathon.md`: hackathon rules digest
- `.scratch/book-of-near-mvp/spec.md`: product spec; `GLOSSARY.md`: vocabulary
- `docs/progress.md`: build log; `docs/release.md`: releases; `docs/chain.md`: the Chain interface
- `CLAUDE.md`: rules the agents followed
