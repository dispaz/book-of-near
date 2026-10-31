# 04: First-day spikes

**What to build:** Prove, with throwaway scripts on testnet, the facts the plan depends on, and record each result with its fallback. This is a research ticket. Spikes: (1) create a top-level testnet account from the browser with the chosen NEAR client library; (2) fund a fresh account from a faucet account through a Worker; (3) read shard, chunk and block ids for a transaction over RPC; (4) find two helper accounts that live on different shards and show a cross-contract call hopping shards; (5) derive an Ethereum address from a NEAR account with the Chain Signatures library, then sign and broadcast a Sepolia transaction, and find the required deposit and gas; (6) request a dry-run swap quote from the intents API through a proxy; (7) confirm the wallet connector works for mainnet login and balance reads. Start from the known facts and caveats in the seed notes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Priority:** P0

- [ ] Each of the seven spikes has a recorded result: pass, fail or partial, with the working call shape or the reason it failed
- [ ] Each failure names the fallback chosen (as listed in the spec) and the lesson tickets affected
- [ ] Library names and versions that worked are recorded
- [ ] Open numbers (signing deposit, faucet amounts, Sepolia funding) are recorded or flagged as unknown
- [ ] The results are promoted into the project instructions so later work does not rediscover them
