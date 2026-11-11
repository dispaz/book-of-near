# Stage 4: Any Chain (Chain Abstraction)

## Stage card intro

Experience the frontier of multichain Web3. In about fifteen minutes you will derive a native Ethereum address directly from your NEAR account using decentralized Multi-Party Computation (Chain Signatures), sign a real Sepolia payload without holding an Ethereum private key, request a cross-chain swap via the 1Click intent API where solvers compete for best execution, and discover why intent settlement eliminates classic bridge honeypots.

## Learning arc

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **4.1 One account, every chain** | A single NEAR account can sign native transactions for a foreign chain (Ethereum here) via decentralized MPC threshold signatures (`v1.signer`). | Derives an Ethereum address from their NEAR name, signs a Sepolia transaction via MPC, and verifies the recovered signer. | "How do we swap assets across chains without signing separate manual transactions?" |
| **4.2 Swap across chains with an intent** | Intents invert trading: users state desired outcomes, and competing market makers (solvers) front cross-chain liquidity. | Requests a live dry-run cross-chain swap quote via 1Click, inspects solver execution parameters, and tracks settlement. | "How does this differ from traditional lock-and-mint bridges?" |
| **4.3 Old bridge vs the NEAR way** | Classic bridges lock billions in vulnerable contract honeypots; intent protocols deliver native assets with solver inventory risk. | Compares step-by-step security and time profiles between classic bridges and NEAR Intents, simulating a bridge vault exploit. | Stage 5 & Stage 7 (Capstone: tracing an intent end to end). |

## Notes for builders

- MPC Contract: `v1.signer-prod.testnet` (testnet) / `v1.signer` (mainnet).
- 1Click API: `https://1click.chaindefuser.com/v0/quote` (free dry quotes, CORS `*`).
- Gas realities: Derived foreign addresses start with 0 ETH/gas; signing burns ~8.5 Tgas and requires 1 yocto deposit.
