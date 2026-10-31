# 23: Mainnet wallet connection and funds check

**What to build:** A shared capability to connect a real wallet for mainnet, read the account's balance and decide whether the account has enough for a transaction fee or a capped swap. Used by the swap lesson and the final badge. With no wallet or too little balance it reports that clearly and offers the fallback. Nothing is ever signed without an explicit confirmation showing the amount.

**Blocked by:** 07 (Testnet chain, practice account and faucet)

**Status:** ready-for-agent

**Priority:** P0

- [ ] A learner can connect a wallet and see the mainnet balance
- [ ] The funds check returns enough, not enough or no wallet, and each state is covered by a test
- [ ] Every signing request shows what it will do and its amount before the wallet is asked
- [ ] Demo mode provides a simulated connected account
