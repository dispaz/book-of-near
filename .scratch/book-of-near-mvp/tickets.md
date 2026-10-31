# Ticket map

Tickets are in dependency order. A ticket can start when every ticket it is blocked by is done. Priority P0 is never cut; P2 tickets are cut first (first cut at day 7, second cut at day 10).

| # | Ticket | Priority | Blocked by |
| --- | --- | --- | --- |
| 01 | Walking skeleton on the live URL | P0 | - |
| 02 | Chain interface and demo chain | P0 | 01 |
| 03 | 3D scene kit v1 | P0 | 01 |
| 04 | First-day spikes | P0 | - |
| 05 | Opening quiz, routes, progress and table of contents | P0 | 01 |
| 06 | Lesson template and new-lesson command | P1 | 05 |
| 07 | Testnet chain, practice account and faucet | P0 | 02, 04 |
| 08 | Lesson 0.1: How a blockchain and a transaction work | P1 | 03, 05 |
| 09 | Lesson 0.2: Make a wallet | P0 | 03, 05 |
| 10 | Lesson 0.3: Send a transaction and watch it | P1 | 03, 05, 07 |
| 11 | Badge art system | P0 | 01 |
| 12 | Badge contract | P0 | 04 |
| 13 | Badge claims: signer, claim flow, My book and checker | P0 | 07, 10, 11, 12 |
| 14 | Lesson 1.1: Claim your name | P0 | 03, 05, 07 |
| 15 | Lesson 1.2: A key that can do only one thing | P0 | 03, 05, 07 |
| 16 | Lesson 1.3: Inside a NEAR transaction | P1 | 03, 05, 07 |
| 17 | Lesson 2.1: Follow your transaction across shards (3D) | P0 | 03, 05, 07, 04 |
| 18 | Lesson 2.2: A call that takes several blocks | P2 (first cut) | 03, 05, 07 |
| 19 | Lesson 3.1: Deploy a contract in one click | P1 | 03, 05, 07 |
| 20 | Lesson 3.2: Issue your own token | P2 (second cut) | 03, 05, 07 |
| 21 | Lesson 3.3: Race the RPC nodes | P2 (first cut) | 03, 05 |
| 22 | Lesson 4.1: One account, every chain (3D) | P0 | 03, 05, 07, 04 |
| 23 | Mainnet wallet connection and funds check | P0 | 07 |
| 24 | Lesson 4.2: Swap across chains with an intent | P0 | 03, 05, 23 |
| 25 | Lesson 4.3: Old bridge vs the NEAR way | P2 (second cut) | 03, 05, 24 |
| 26 | Capstone lesson: trace one intent end to end | P0 | 03, 05, 24 |
| 27 | Evidence checks and claims for stages 1 to 4 | P0 | 13, 14, 15, 16, 17, 19, 22, 24 |
| 28 | Final exam and badge gating | P0 | 27, 26 |
| 29 | Final badge: rarity, mainnet mint and testnet edition | P0 | 11, 12, 23, 28 |
| 30 | Backlog topics as locked cards | P1 | 05 |
| 31 | Full demo-mode verification suite | P0 | 29, 30, 27 |
| 32 | Polish: mobile, motion and fallbacks | P1 | 29 |
| 33 | README, demo video script and submission pack | P0 | 31, 32 |
