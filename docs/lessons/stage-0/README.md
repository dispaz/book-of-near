# Stage 0: Blank Page (Crypto foundations)

## Stage card intro

Start here if you have never used crypto. In about fifteen minutes you will build a toy blockchain, make a wallet in your browser and send a real (practice) transaction. You will see why a shared ledger is hard to fake, what a key pair really is, and what happens between pressing "Send" and seeing "Final". No money and no sign-up are needed. Everything works offline in demo mode.

## Learning arc

The three lessons build on each other. Each one adds one new idea and reuses the ones before it.

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| 0.1 How a blockchain and a transaction work | A blockchain is a shared list of blocks. Each block holds the hash of the one before, so changing old history is easy to spot. | Moves coins between Ana, Ben and Cora, watches blocks link, then tampers with an old block. | "Who is allowed to move Ana's coins?" leads to keys. |
| 0.2 Make a wallet | A wallet is a key pair. The private key signs; the public key lets anyone check the signature. An address is made from the public key. | Generates a throwaway key pair and seed phrase, sees the NEAR and Ethereum style addresses, signs, verifies, tampers. | "How does a signed message become a real transfer?" leads to transactions. |
| 0.3 Send a transaction and watch it | A transaction goes through build, sign, broadcast, included and final. An RPC node is the door into the network; an explorer is the public window onto it. | Sends a tiny transfer from the practice account and opens it in NearBlocks. | Stage 1 (named accounts, access keys) and Stage 2 (what happens inside the network). |

The thread through the stage: **ledger, then keys, then transactions**. 0.1 asks "how do we agree on history?", 0.2 answers "how do we prove who wrote a line?", and 0.3 joins the two: a signed message that becomes a line in the shared history.

## Notes for builders

- Every lesson is scripted in this folder: `0.1.md`, `0.2.md`, `0.3.md`. Each file has steps (caption, explain, action), a check, an Honest take, demo-mode data and sources.
- Stage 0 stays generic. Shards, receipts and access-key permissions are named at most once and deferred to Stages 1 and 2.
- Comparison chains in this stage: Bitcoin (block time, hash links) and Ethereum (address format, finality). Solana is not used, because its docs could not be fetched for verification during research.
- Open fact conflict: NEAR docs give block time as both "around 600ms" and "approximately every second". Lessons say "about one second or less" in learner copy and use 600 ms in demo timings. See 0.3 for details.
