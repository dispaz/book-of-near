# 27: Evidence checks and claims for stages 1 to 4

**What to build:** Extend the claim path from stage 0 to stages 1 to 4. For each stage the Worker checks the evidence the lessons emitted (the account created, the key added and deleted, the transaction seen on chain, the contract deployed, the Sepolia transaction, the quote) and signs a claim. Stages whose optional lessons were cut still allow a claim from the lessons that exist.

**Blocked by:** 13 (Badge claims: signer, claim flow, My book and checker), 14 (Lesson 1.1: Claim your name), 15 (Lesson 1.2: A key that can do only one thing), 16 (Lesson 1.3: Inside a NEAR transaction), 17 (Lesson 2.1: Follow your transaction across shards (3D)), 19 (Lesson 3.1: Deploy a contract in one click), 22 (Lesson 4.1: One account, every chain (3D)), 24 (Lesson 4.2: Swap across chains with an intent)

**Status:** ready-for-agent

**Priority:** P0

- [ ] Each stage's badge can be claimed on testnet after finishing it and refused before
- [ ] A stage completed only in demo mode cannot claim a testnet badge, and the app explains why
- [ ] The previous-stage rule is enforced end to end
- [ ] Claims are covered by tests for each stage
