# Stage 3: Wasm (Builder Track)

## Stage card intro

Step into the builder's shoes. In about fifteen minutes you will deploy a pre-compiled WebAssembly smart contract to your own custom sub-account, master NEAR's refundable storage staking model, issue a fungible token (NEP-141) with storage registration, execute gasless meta-transactions via a relayer, and race public RPC nodes to see how decentralized applications stay resilient.

## Learning arc

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **3.1 Deploy a contract in one click** | NEAR runs standard WebAssembly (Wasm) on sub-accounts; storage is paid by locking refundable NEAR (1 NEAR per 100 KB). | Creates a sub-account, deploys a counter Wasm contract, calls methods, and watches locked storage balances shift. | "How do tokens and user balances manage storage safely?" |
| **3.2 Issue your own token** | Fungible tokens (NEP-141) use storage deposits (NEP-145) to prevent state attacks, and support gasless transfers (NEP-366) via relayers. | Deploys a token, registers an account via storage deposit, and sends a gasless transfer where a relayer pays fees. | "How do applications connect to the network reliably?" |
| **3.3 Race the RPC nodes** | DApps maintain uptime and censorship resistance by querying multiple RPC providers and failing over automatically. | Races FastNEAR and NEAR Foundation RPCs simultaneously, measures latency, and simulates an outage to test failover. | Stage 4 (Chain Abstraction and multichain signatures). |

## Notes for builders

- Code artifacts: WebAssembly binaries (`counter.wasm`).
- Storage formula: 1 NEAR per 100 KB (0.00001 NEAR per byte).
- Relayer protocol: Protocol-native `SignedDelegateAction` (NEP-366).
