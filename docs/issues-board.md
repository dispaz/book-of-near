# Book of NEAR: issue board

Snapshot of every GitHub issue on `dispaz/book-of-near`, taken 8 Nov 2026. It is generated from `gh issue list --state all` and goes stale; GitHub is the source of truth.

## At a glance

**35 issues** · ✅ Done: **10** · 🟡 In progress: **4** · 🔧 Needs fixes: **4** · ⛔ Blocked: **10** · ⚪ Ready: **7**

| Status | Meaning |
|---|---|
| ✅ Done | Closed |
| 🟡 In progress | Open and assigned |
| 🔧 Needs fixes | Open, labelled `to-fix` (built, review found problems) |
| ⛔ Blocked | Open, unassigned, waiting on another open issue |
| ⚪ Ready | Open, unassigned, nothing blocking it |

**Priority:** P0 = must ship · P1 = should ship · P2 · first/second cut = dropped first if time runs short.

## Pick up next

Open, unassigned and not blocked, highest priority first:

- **[#22](https://github.com/dispaz/book-of-near/issues/22) Lesson 4.1: One account, every chain (3D)** (P0)
- **[#19](https://github.com/dispaz/book-of-near/issues/19) Lesson 3.1: Deploy a contract in one click** (P1)
- **[#30](https://github.com/dispaz/book-of-near/issues/30) Backlog topics as locked cards** (P1)
- **[#36](https://github.com/dispaz/book-of-near/issues/36) Flaky e2e: 3D specs fail under default parallel workers** (P1)
- **[#18](https://github.com/dispaz/book-of-near/issues/18) Lesson 2.2: A call that takes several blocks** (P2 · first cut)
- **[#21](https://github.com/dispaz/book-of-near/issues/21) Lesson 3.3: Race the RPC nodes** (P2 · first cut)
- **[#20](https://github.com/dispaz/book-of-near/issues/20) Lesson 3.2: Issue your own token** (P2 · second cut)

## Needs attention

- 🔧 [#14](https://github.com/dispaz/book-of-near/issues/14) Lesson 1.1: Claim your name: built, but labelled `to-fix`
- 🔧 [#15](https://github.com/dispaz/book-of-near/issues/15) Lesson 1.2: A key that can do only one thing: built, but labelled `to-fix`
- 🔧 [#16](https://github.com/dispaz/book-of-near/issues/16) Lesson 1.3: Inside a NEAR transaction: built, but labelled `to-fix`
- 🔧 [#27](https://github.com/dispaz/book-of-near/issues/27) Evidence checks and claims for stages 1 to 4: built, but labelled `to-fix`
- ⚠️ [#1](https://github.com/dispaz/book-of-near/issues/1) Walking skeleton on the live URL is still open, yet #2, #3 and #5, which it blocks, are already closed. Close it or say what is left.

## 🧱 Foundations (6/8 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#1](https://github.com/dispaz/book-of-near/issues/1) | **Walking skeleton on the live URL**<br>A learner can open the deployed site and walk through one placeholder lesson using the stage bar (menu, back, play, caption, dots, next), in demo mode. | P0 | 🟡 In progress | 4/5 | — |
| [#2](https://github.com/dispaz/book-of-near/issues/2) | **Chain interface and demo chain**<br>All chain access goes through one `Chain` interface. | P0 | ✅ Done | 4/4 | #1 |
| [#3](https://github.com/dispaz/book-of-near/issues/3) | **3D scene kit v1**<br>A shared kit for interactive scenes in the ink-outline style. | P0 | ✅ Done | 5/5 | #1 |
| [#4](https://github.com/dispaz/book-of-near/issues/4) | **First-day spikes**<br>Prove, with throwaway scripts on testnet, the facts the plan depends on, and record each result with its fallback. | P0 | ✅ Done | 5/5 | — |
| [#5](https://github.com/dispaz/book-of-near/issues/5) | **Opening quiz, routes, progress and table of contents**<br>The first screen is a short opening quiz that places the learner on the newcomer, veteran or developer route. | P0 | ✅ Done | 5/5 | #1 |
| [#6](https://github.com/dispaz/book-of-near/issues/6) | **Lesson template and new-lesson command**<br>A documented lesson template (hook, concept, do, check, honest take) and a Claude Code command that scaffolds a new lesson from it: folder, manifest, spec stub, demo-mode behaviour and an end-to-end test. | P1 | ✅ Done | 3/3 | — |
| [#7](https://github.com/dispaz/book-of-near/issues/7) | **Testnet chain, practice account and faucet**<br>A real testnet implementation of the `Chain` interface, plus a practice account flow: the app generates a key in the browser, asks a faucet endpoint on the Worker to fund it, and uses it for lesson actions. | P0 | ✅ Done | 4/4 | — |
| [#36](https://github.com/dispaz/book-of-near/issues/36) | **Flaky e2e: 3D specs fail under default parallel workers**<br>`npm run e2e` fails at random on 3D specs under default workers, likely because software WebGL is slow under CPU load. | P1 | ⚪ Ready | 0/5 | — |

## 📘 Stage 0: Blockchain basics (4/4 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#8](https://github.com/dispaz/book-of-near/issues/8) | **Lesson 0.1: How a blockchain and a transaction work**<br>A short interactive lesson (under five minutes). | P1 | ✅ Done | 5/5 | — |
| [#9](https://github.com/dispaz/book-of-near/issues/9) | **Lesson 0.2: Make a wallet**<br>The learner generates a key pair and a seed phrase in the browser, sees how an address is derived from a public key, signs a message, verifies it, then changes one letter and sees verification fail. | P0 | ✅ Done | 5/5 | — |
| [#10](https://github.com/dispaz/book-of-near/issues/10) | **Lesson 0.3: Send a transaction and watch it**<br>The learner sends a transfer from the practice account. | P1 | ✅ Done | 5/5 | — |
| [#34](https://github.com/dispaz/book-of-near/issues/34) | **2D and 3D views for the Stage 0 lessons**<br>Add a 3D view to the three Stage 0 lessons, next to their existing 2D view, so the learner can switch between 2D and 3D at any step (owner decision, 2 Nov 2026: almost every lesson gets both views). | P1 | ✅ Done | 4/4 | — |

## 🪪 Stage 1: Accounts and keys (0/3 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#14](https://github.com/dispaz/book-of-near/issues/14) | **Lesson 1.1: Claim your name**<br>The learner types a name, sees live availability, and creates it as their own testnet account, then compares it with a plain hex account. | P0 | 🔧 Needs fixes | 5/5 | — |
| [#15](https://github.com/dispaz/book-of-near/issues/15) | **Lesson 1.2: A key that can do only one thing**<br>The learner adds a key limited to one contract with a small allowance and hands it to a scripted agent (no AI model calls). | P0 | 🔧 Needs fixes | 5/5 | — |
| [#16](https://github.com/dispaz/book-of-near/issues/16) | **Lesson 1.3: Inside a NEAR transaction**<br>The learner stacks several actions (create a sub-account, send NEAR, add a key) into one transaction, forces one action to fail and sees everything roll back together. | P1 | 🔧 Needs fixes | 5/5 | — |

## 🧩 Stage 2: Sharding (0/2 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#17](https://github.com/dispaz/book-of-near/issues/17) | **Lesson 2.1: Follow your transaction across shards (3D)**<br>A large 3D showpiece. | P0 | 🟡 In progress | 5/5 | — |
| [#18](https://github.com/dispaz/book-of-near/issues/18) | **Lesson 2.2: A call that takes several blocks**<br>The learner calls a contract that calls another contract on a different shard and watches the receipts hop between blocks, with gas burned and the 30% paid to the called contract shown. | P2 · first cut | ⚪ Ready | 0/4 | — |

## 📜 Stage 3: Contracts (0/3 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#19](https://github.com/dispaz/book-of-near/issues/19) | **Lesson 3.1: Deploy a contract in one click**<br>The learner deploys a ready-made contract to their own sub-account, calls it, reads its state and triggers a failing callback. | P1 | ⚪ Ready | 0/4 | — |
| [#20](https://github.com/dispaz/book-of-near/issues/20) | **Lesson 3.2: Issue your own token**<br>The learner creates a fungible token, registers storage, sends it, and sends it again gaslessly through a relayer on the Worker. | P2 · second cut | ⚪ Ready | 0/4 | — |
| [#21](https://github.com/dispaz/book-of-near/issues/21) | **Lesson 3.3: Race the RPC nodes**<br>The learner sends one query to several RPC providers, compares latency bars, then blocks one provider and watches failover. | P2 · first cut | ⚪ Ready | 0/4 | — |

## 🌐 Stage 4: Chain abstraction (0/4 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#22](https://github.com/dispaz/book-of-near/issues/22) | **Lesson 4.1: One account, every chain (3D)**<br>A large 3D showpiece. | P0 | ⚪ Ready | 0/5 | — |
| [#23](https://github.com/dispaz/book-of-near/issues/23) | **Mainnet wallet connection and funds check**<br>A shared capability to connect a real wallet for mainnet, read the account's balance and decide whether the account has enough for a transaction fee or a capped swap. | P0 | 🟡 In progress | 4/4 | — |
| [#24](https://github.com/dispaz/book-of-near/issues/24) | **Lesson 4.2: Swap across chains with an intent**<br>The learner sees live tokens and a dry-run quote with solvers competing. | P0 | ⛔ Blocked | 0/5 | #23 |
| [#25](https://github.com/dispaz/book-of-near/issues/25) | **Lesson 4.3: Old bridge vs the NEAR way**<br>Two timelines side by side: a classic lock-and-mint bridge and an intent, with steps, time and fees from live quote data where available and labelled estimates otherwise. | P2 · second cut | ⛔ Blocked | 0/4 | #24 |

## 🏅 Badges (0/5 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#11](https://github.com/dispaz/book-of-near/issues/11) | **Badge art system**<br>Generate the badge art in code: five distinct stage icons (stages 0 to 4) and a final badge with four rarity tiers (common, rare, epic, legendary), all in the ink style of the book. | P0 | ⛔ Blocked | 0/4 | #1 |
| [#12](https://github.com/dispaz/book-of-near/issues/12) | **Badge contract**<br>A badge contract following the NEAR NFT standard with metadata and events. | P0 | 🟡 In progress | 4/5 | — |
| [#13](https://github.com/dispaz/book-of-near/issues/13) | **Badge claims: signer, claim flow, My book and checker**<br>The end-to-end badge path for stage 0 on testnet. | P0 | ⛔ Blocked | 0/5 | #11, #12 |
| [#27](https://github.com/dispaz/book-of-near/issues/27) | **Evidence checks and claims for stages 1 to 4**<br>Extend the claim path from stage 0 to stages 1 to 4. | P0 | 🔧 Needs fixes | 0/4 | #13, #14, #15, #16, #17, #19, #22, #24 |
| [#29](https://github.com/dispaz/book-of-near/issues/29) | **Final badge: rarity, mainnet mint and testnet edition**<br>After a passed exam the Worker computes the rarity tier from verifiable facts (exam score, completing the real swap, finishing the key challenge without hints, finishing inside the event window) and signs a final claim. | P0 | ⛔ Blocked | 0/5 | #11, #12, #23, #28 |

## 🎓 Capstone and exam (0/2 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#26](https://github.com/dispaz/book-of-near/issues/26) | **Capstone lesson: trace one intent end to end**<br>A real, completed intent (the learner's own swap if they made one, otherwise a recorded one) is replayed step by step through account, key, receipt, shard, signature and settlement, tying the stages together. | P0 | ⛔ Blocked | 0/4 | #24 |
| [#28](https://github.com/dispaz/book-of-near/issues/28) | **Final exam and badge gating**<br>A final exam with a developer route and a non-developer route. | P0 | ⛔ Blocked | 0/5 | #27, #26 |

## 🚀 Polish and ship (0/4 done)

| # | Issue | Priority | Status | Checklist | Waiting on |
|---|---|---|---|---|---|
| [#30](https://github.com/dispaz/book-of-near/issues/30) | **Backlog topics as locked cards**<br>Register every topic of the curriculum map that has no lesson as a locked text card with its stage, a two-line summary and its comparison note, taken from the curriculum data. | P1 | ⚪ Ready | 0/4 | — |
| [#31](https://github.com/dispaz/book-of-near/issues/31) | **Full demo-mode verification suite**<br>A single command runs the opening quiz, every lesson and the badge claim flow in demo mode and reports pass or fail per lesson. | P0 | ⛔ Blocked | 0/3 | #29, #30, #27 |
| [#32](https://github.com/dispaz/book-of-near/issues/32) | **Polish: mobile, motion and fallbacks**<br>A pass over the whole book for phone widths, reduced motion, the flat camera, the SVG and text fallbacks, loading time, and readability of every caption and honest take. | P1 | ⛔ Blocked | 0/4 | #29 |
| [#33](https://github.com/dispaz/book-of-near/issues/33) | **README, demo video script and submission pack**<br>A README that a human and an AI can follow: what the project is, one install-and-run command, how demo mode works, how to try testnet, which hackathon tracks it enters and the evidence for each (the limited-key challenge, the badges that gate the exam). | P0 | ⛔ Blocked | 0/5 | #31, #32 |

## Critical path to submission

```
#11 Badge art ──────┐
#12 Badge contract ─┴─► #13 Badge claims ──┐
Lessons #14 #15 #16 #17 #19 #22 #24 ───────┴─► #27 Evidence checks ─┐
#23 Mainnet wallet ─► #24 Intent swap ─► #26 Capstone ──────────────┴─► #28 Final exam
#28 + #11 + #12 + #23 ─► #29 Final badge ─┬─► #31 Demo-mode suite ─┐
                     #30 Locked cards ────┘   #32 Polish ──────────┴─► #33 README & submission
```
