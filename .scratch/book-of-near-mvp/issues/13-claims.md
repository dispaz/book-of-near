# 13: Badge claims: signer, claim flow, My book and checker

**What to build:** The end-to-end badge path for stage 0 on testnet. The Worker checks a stage's evidence (for stage 0, that the practice account made the expected transaction) and signs a short-lived claim. The app shows a claim button at the end of a stage, asks the learner to sign the claim transaction, and shows the result. A My book shelf shows the learner's badges and a public checker page looks up any account's badges. Claims are rate-limited and each carries a nonce.

**Blocked by:** 07 (Testnet chain, practice account and faucet), 10 (Lesson 0.3: Send a transaction and watch it), 11 (Badge art system), 12 (Badge contract)

**Status:** ready-for-agent

**Priority:** P0

- [ ] A learner who finished stage 0 can claim the badge on testnet and see it on My book
- [ ] The checker page shows the same badge for that account without logging in
- [ ] A claim for an unfinished stage is refused by the Worker
- [ ] An expired or reused claim is refused by the contract
- [ ] The flow also works in demo mode with a simulated contract
