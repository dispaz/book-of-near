# Stage 1: Named (First steps on NEAR)

## Stage card intro

Welcome to NEAR-specific foundations. In about fifteen minutes you will create your own human-readable account name, attach an access key restricted to a single application with a gas budget, and pack multiple operations into an atomic multi-action transaction. You will experience how NEAR separates accounts from cryptographic keys, and why scoped permissions protect you from hacks.

## Learning arc

The three lessons explore the core primitives of NEAR identity and transactions:

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **1.1 Claim your name** | On NEAR, your account address is a readable name, not a hex string or an external DNS alias. | Checks availability, creates a named testnet account via the registrar, and compares it with its implicit hex counterpart. | "Now that I own a named account, how do I grant permissions safely?" |
| **1.2 A key that can do only one thing** | Accounts hold multiple access keys; function-call keys can only call one contract and cannot move funds. | Deploys a counter, attaches an app key with a gas allowance, verifies the chain refuses attacks, and revokes the key. | "Can one transaction do multiple tasks at once?" |
| **1.3 Inside a NEAR transaction** | A transaction is an atomic batch of ordered actions for one receiver; failures roll back completely, and nonces prevent replay. | Builds a multi-action batch, intentionally triggers an execution failure to watch rollback, and replays a used nonce. | Stage 2 (how transactions and receipts traverse shards and blocks). |

## Notes for builders

- Topic files: `1.1-topic.md`, `1.2-topic.md`, `1.3-topic.md`.
- Researched scripts: `1.1.md`, `1.2.md`, `1.3.md`.
- Scene objects used: Mailbox (account), Stamped Parcel (transaction), Scroll with gear (contract), Tagged Key with gauge (function-call key), App Screen (app).
