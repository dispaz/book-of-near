# 07: Testnet chain, practice account and faucet

**What to build:** A real testnet implementation of the `Chain` interface, plus a practice account flow: the app generates a key in the browser, asks a faucet endpoint on the Worker to fund it, and uses it for lesson actions. The faucet is rate-limited per IP and has a daily cap. If the faucet or testnet is unavailable, the app falls back to demo mode and says so. Where the spike chose a fallback for account creation, use that fallback.

**Blocked by:** 02 (Chain interface and demo chain), 04 (First-day spikes)

**Status:** ready-for-agent

**Priority:** P0

- [ ] A fresh visitor on testnet gets a funded practice account and can send a transfer
- [ ] The same behavioural checks pass against the demo chain and against testnet
- [ ] With the faucet disabled, the lesson runs in demo mode and a visible notice explains why
- [ ] The Worker has no secrets in the repository and the faucet cannot be drained by repeated calls from one address
