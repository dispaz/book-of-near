# Stage 6: Citizen (Ecosystem, Governance and DeFi)

## Stage card intro

Become an active citizen of the NEAR ecosystem. In about fifteen minutes you will explore how decentralized governance coordinates protocol upgrades, see how token locking translates into voting power via the vote-escrow model (veNEAR and the House of Stake), and walk a map of NEAR's money: stablecoins, an exchange, a lending market and an oracle. The money map uses figures recorded on 13 Nov 2026, not live data.

## Learning arc

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **6.1 Read and vote on a proposal** | Governance on NEAR combines protocol delegation with vote-escrowed token locking (veNEAR) and on-chain DAOs (AstroDAO). | Inspects a live or recorded governance proposal, examines voting power formulas, and casts a simulated or testnet vote. | "Where does the economic activity governed by these proposals actually flow?" |
| **6.2 The live money map** | NEAR DeFi has four building blocks: stablecoins issued on NEAR itself (USDC, USDt), an exchange (Rhea Dex, formerly Ref Finance), a lending market (Rhea Lend, formerly Burrow) and oracles. All figures were recorded on 13 Nov 2026; nothing is live. | Compares native USDC with the bridged USDC.e, reads the NEAR price an oracle stored and sees that it has an age (Pyth Core no longer supports NEAR, so its last price is from August), tries one trade in a stable pool and a simple pool, and sees how much NEAR Intents trades settle on NEAR. | Stage 7 (the Capstone: tracing an intent end to end). |

## Notes for builders

- Governance models: Staking delegation, House of Stake, veNEAR, and Sputnik/AstroDAOs.
- DeFi components: Rhea Dex (was Ref Finance), Rhea Lend (was Burrow), native USDC and USDt, and an oracle's stored price (`pyth-oracle.near`, no longer supported on NEAR). Lesson 6.2 shows recorded data only (13 Nov 2026) and fetches nothing.
