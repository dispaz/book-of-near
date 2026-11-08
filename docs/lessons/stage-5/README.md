# Stage 5: Enclave (User-Owned AI and Privacy)

## Stage card intro

Explore the intersection of artificial intelligence and decentralized infrastructure on NEAR. In about fifteen minutes you will interact with an AI model running inside a hardware-isolated Trusted Execution Environment (TEE), cryptographically verify its remote attestation certificate, and examine how autonomous Shade Agents can control multichain accounts without human owners holding the keys.

## Learning arc

| Lesson | Big idea | What the learner does | Sets up |
| --- | --- | --- | --- |
| **5.1 Ask a private AI and verify it** | True privacy in AI requires confidential computing; a TEE cryptographically guarantees that nobody—not even the server host—can inspect your prompts or weights. | Chats with an educational AI tutor on NEAR AI Cloud, inspects the hardware quote, and validates its cryptographic attestation. | "How can an AI agent act independently in Web3 without a human backdoor?" |
| **5.2 An agent with no owner** | By combining TEEs with Chain Signatures, an autonomous agent can securely hold multichain keys and execute transactions without an owner. | Inspects an autonomous Shade Agent, simulates a cross-chain task, and verifies that the agent's keys remain locked inside the enclave. | Stage 6 (decentralized governance and collective coordination). |

## Notes for builders

- Hardware technologies: Intel TDX, NVIDIA Confidential Computing (H100/H200).
- Remote attestation: Verifying hardware-signed quotes via cryptographic public roots.
- Contrast with Web2 AI: OpenAI/Anthropic model hosts retain full plaintext access to prompts and completions; TEEs offer mathematical isolation.
