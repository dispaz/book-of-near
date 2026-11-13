# Stage 5: Enclave (User-Owned AI and Privacy)

## Stage card intro

Explore the intersection of artificial intelligence and decentralized infrastructure on NEAR. In about fifteen minutes you will interact with an AI model running inside a hardware-isolated Trusted Execution Environment (TEE), cryptographically verify its remote attestation certificate, and see how a Shade Agent signs through an agent contract while its developer holds no key that can move its funds.

## Learning arc

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **5.1 Ask a private AI and verify it** | True privacy in AI requires confidential computing; a TEE cryptographically guarantees that nobody—not even the server host—can inspect your prompts or weights. | Chats with an educational AI tutor on NEAR AI Cloud, inspects the hardware quote, and validates its cryptographic attestation. | "How can an AI agent act independently in Web3 without a human backdoor?" |
| **5.2 An agent with no owner** | A Shade Agent makes its own key inside a TEE; an agent contract only lets attested, approved code ask for chain signatures, and the assets belong to that contract, so the developer holds no key that moves them. | Opens a bot's `.env`, starts an agent, registers it with a model of the reference agent contract, is refused twice as the developer ("Agent not registered", changed code), then has the agent request a signature for the contract's derived Ethereum address. | Stage 6 (governance: who approves an agent's new code). |

## Notes for builders

- Hardware technologies: Intel TDX, NVIDIA Confidential Computing (H100/H200).
- Remote attestation: Verifying hardware-signed quotes via cryptographic public roots.
- Contrast with Web2 AI: OpenAI/Anthropic model hosts retain full plaintext access to prompts and completions; TEEs offer mathematical isolation.
