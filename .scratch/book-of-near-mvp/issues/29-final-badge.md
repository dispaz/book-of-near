# 29: Final badge: rarity, mainnet mint and testnet edition

**What to build:** After a passed exam the Worker computes the rarity tier from verifiable facts (exam score, completing the real swap, finishing the key challenge without hints, finishing inside the event window) and signs a final claim. The badge is minted on mainnet through the connected wallet; the learner pays only the network fee. If the funds check fails, the learner can claim a testnet edition and later upgrade to the mainnet edition. The contract is deployed to mainnet with the sponsor balance funded. A transferable collector twin is not built, but the contract keeps the flag.

**Blocked by:** 11 (Badge art system), 12 (Badge contract), 23 (Mainnet wallet connection and funds check), 28 (Final exam and badge gating)

**Status:** ready-for-agent

**Priority:** P0

- [ ] A learner with funds mints the final badge on mainnet and it appears on the explorer with the right rarity art
- [ ] A learner without funds can claim a testnet edition and later upgrade
- [ ] Rarity inputs are verified by the Worker, not trusted from the browser
- [ ] The mainnet deployment and sponsor funding steps are documented without secrets
- [ ] A claim above the daily cap is refused
