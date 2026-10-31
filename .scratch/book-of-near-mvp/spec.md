# Book of NEAR MVP

Status: ready-for-agent

Source of truth for the hackathon build. Written on 31 October 2026 from the research, the curriculum map and the implementation plan. Read `GLOSSARY.md` for the vocabulary and `docs/ARTIFACTS.md` for the background documents.

## Problem Statement

Someone with no crypto knowledge cannot realistically learn how NEAR works. Documentation assumes prior knowledge, explainers are static, and nothing lets a learner do the real thing (make a key, send a transaction, sign for another chain) and watch what happens underneath. Experienced crypto users and developers have the opposite problem: they want to skip the basics and see what is different about NEAR, and they have no honest comparison with other chains.

The NEAR hackathon (build window 1 to 14 November 2026) rewards working prototypes with real on-chain behaviour, a public repository with a README that humans and AI reviewers can follow, and originality.

## Solution

Book of NEAR is a web app that teaches NEAR from zero to expert through interactive lessons. Each lesson is a scene the learner can touch (a shared 3D scene kit, ink-outline style) and ends with a real action on testnet where money would otherwise be involved. Lessons are grouped in stages. Finishing a stage lets the learner claim a free NFT badge. Finishing the final exam unlocks a rare final badge on mainnet.

An opening quiz routes learners to a newcomer, crypto-veteran or developer path. Every lesson ends with an "honest take" that states what NEAR does well and badly compared with other chains. Everything works in a demo mode with no wallet and no network, so the app is runnable by AI reviewers and safe for the demo video.

The MVP contains five stages (0 to 4) with 15 lessons, a capstone and a final exam. Stages 5 and 6 are deferred or dropped but the app and the badge contract are built so more stages and lessons can be added later.

## User Stories

1. As a newcomer, I want an opening quiz that places me on the right path, so that I do not waste time on things I already know.
2. As a crypto veteran, I want to test out of the basics, so that I reach the NEAR-specific material quickly.
3. As a developer, I want a route that includes the builder lessons, so that I learn how contracts and tokens work on NEAR.
4. As a learner, I want a table of contents that shows every stage and lesson, including planned ones, so that I see the whole book and my progress.
5. As a learner, I want a persistent stage bar (menu, back, play, caption, dots, next) in every lesson, so that I always know how to move.
6. As a learner, I want my progress remembered in the browser, so that I can leave and return.
7. As a newcomer, I want to move coins on a toy ledger and see blocks link together, so that I understand what a blockchain is.
8. As a newcomer, I want to edit an old block and see the hashes break, so that I understand why history is hard to change.
9. As a newcomer, I want to generate a key pair and a seed phrase in the browser, so that I understand what a wallet really holds.
10. As a newcomer, I want to see how an address is derived from a public key, so that the idea of an address is concrete.
11. As a newcomer, I want to sign a message and verify it, then change one letter and see verification fail, so that I understand signatures.
12. As a newcomer, I want to be told never to enter a real seed phrase, so that I am protected from scams.
13. As a newcomer, I want to send a testnet transaction and watch each step (build, sign, broadcast, include, final), so that I understand the lifecycle of a transaction.
14. As a learner, I want the animated steps to be driven by real network responses when I am on testnet, so that I trust what I see.
15. As a learner, I want to pick a name and create my own testnet account, so that I experience NEAR's human-readable accounts.
16. As a learner, I want to compare my named account with a plain hex account, so that I understand the difference.
17. As a learner, I want to add a key limited to one contract and a small allowance, so that I understand function-call keys.
18. As a learner, I want to try to trick a scripted agent that holds a limited key and see the chain refuse, so that I understand why scoped keys protect me.
19. As a learner, I want to delete the key at the end, so that I know how to revoke access.
20. As a learner, I want to bundle several actions into one transaction and force one to fail, so that I see everything roll back together.
21. As a learner, I want to see the nonce and block hash of my transaction explained, so that I understand how NEAR prevents replays.
22. As a learner, I want to pick one of my earlier transactions and see which shard, chunk and block handled it in 3D, so that I understand sharding.
23. As a learner, I want to see how long my transaction took to become final, so that I understand NEAR's speed claims.
24. As a learner, I want to watch a call hop between blocks and shards as receipts, with gas burned and the share paid to the contract, so that I understand asynchronous execution.
25. As a developer, I want to deploy a ready-made contract to my own sub-account, call it and read its state, so that I understand deployment without a Rust toolchain.
26. As a developer, I want to trigger a failing callback, so that I see how cross-contract failure works.
27. As a developer, I want to create a fungible token and send it gaslessly through a relayer, so that I understand token standards and meta-transactions.
28. As a developer, I want to race several RPC providers and watch failover, so that I understand why wallets do not trust a single node.
29. As a learner, I want to derive an Ethereum address from my NEAR account in 3D, so that I understand chain signatures.
30. As a learner, I want to sign and send a Sepolia transaction from my NEAR account, so that I see it work for real.
31. As a learner, I want to request a live cross-chain swap quote and see solvers compete, so that I understand intents.
32. As a learner with a funded mainnet account, I want to optionally run a tiny real swap with a clear cap and confirmation, so that I can try it for real.
33. As a learner without funds, I want the swap lesson to stay on a dry-run quote, so that I am never blocked.
34. As a learner, I want to compare the old bridge flow with the NEAR flow side by side with live figures, so that I see what is different.
35. As a learner, I want a capstone that traces one real intent through account, key, receipt, shard, signature and settlement, so that all stages come together.
36. As a learner, I want an honest take at the end of every lesson, so that I get the weaknesses of NEAR as well as the strengths.
37. As a learner, I want to claim a free badge after each stage, paying only a tiny network fee, so that my progress is recorded on chain.
38. As a learner, I want my stage badges shown on a "My book" shelf, so that I can see what I earned.
39. As a learner, I want to take a final exam on the route that fits me, so that I can earn the final badge.
40. As a learner, I want the exam and final badge to unlock only when I own the required stage badges, so that the badge means something.
41. As a learner, I want the final badge to have a rarity based on what I did, so that effort is visible.
42. As a learner without mainnet funds, I want a testnet edition of the final badge that I can upgrade later, so that I am not blocked.
43. As anyone, I want to look up any account's badges on a public checker page, so that I can verify a claim.
44. As a project owner, I want every chain call behind one interface with a demo implementation, so that every lesson runs with no wallet and no network.
45. As a project owner, I want new lessons added by adding a folder and a manifest, so that I can extend the book after the hackathon.
46. As a project owner, I want backlog topics registered as locked cards, so that the book looks complete and later lessons slot in.
47. As a hackathon reviewer, I want to run the app from the README with one install command and no wallet, so that I can verify it works.
48. As a hackathon reviewer, I want secrets kept out of the repository, so that the public repo is safe.
49. As a learner on a phone or with reduced-motion settings, I want a flat or text version of each scene, so that the book works for me.
50. As a learner without WebGL, I want an SVG and text version of each step, so that I can still learn.

## Implementation Decisions

**Product shape**

- One single-page web app with a route per lesson. The menu and routes are generated from per-lesson manifests (id, stage, title, status of ready, card or planned, whether it needs the chain, scene entry point). Adding a lesson means adding a folder with a manifest.
- Stages 0 to 4 are in the MVP. Stage ids 5 (Enclave) and 6 (Citizen) are reserved. Backlog topics from the curriculum map are registered with status `planned` and shown as locked text cards.
- Every lesson follows one template: hook, concept, something to do, a check, an honest take.
- Learner-facing copy is plain and direct, marks any uncertain claim, and names the comparison chain (Ethereum, Solana, Cosmos or "not different") when it says NEAR differs.

**Lessons in the MVP**

- Stage 0: how a blockchain and a transaction work; make a wallet; send a transaction and watch it.
- Stage 1: claim your name; a key that can do only one thing; inside a NEAR transaction.
- Stage 2: follow your transaction across shards (3D); a call that takes several blocks.
- Stage 3: deploy a contract in one click; issue your own token; race the RPC nodes.
- Stage 4: one account, every chain (3D); swap across chains with an intent; old bridge vs the NEAR way.
- Capstone: trace one intent end to end, then the final exam.
- The authoritative per-lesson behaviour is in the tickets. The curriculum data is in `docs/curriculum/topics.json`.

**Scene kit**

- A shared Three.js kit provides ink-outline blocks (accounts, contracts, shards, chains), keys, coins and a travelling transaction object, with click picking, a camera rig with a preset view per step, button overlays and the caption bar. The look is defined by the existing prototype in `docs/prototype/ink-stage.html`; the jar objects in it are replaced by blocks.
- Every scene has a flat top-down camera mode, an SVG and text fallback for browsers without WebGL, and respects reduced-motion settings. The 3D code loads on demand.

**Chain access and demo mode**

- All chain access goes through one `Chain` interface with two implementations: a real testnet client and a deterministic in-browser fake chain (demo mode). Every lesson works in demo mode with no wallet and no network. Recorded fixtures cover live reads that cannot be faked, such as an intents quote.
- Learners use a practice account: a key generated in the browser and funded by a small faucet endpoint. If the faucet is unavailable the lesson falls back to demo mode.
- The NEAR client library is near-kit; wallet login for mainnet uses NEAR Connect; Chain Signatures use chainsig.js; viem reads Sepolia. Package details come from NEAR's docs and a third-party summary and must be verified in the spike ticket before other work builds on them.
- Public RPC: FastNEAR first with a fallback list. The RPC race lesson reuses the same list.

**Worker**

- A small Cloudflare Worker provides the faucet, the badge claim signer, the exam grader and a proxy that adds the intents API key. Secrets live only in Worker secrets. Requests are rate-limited per IP.

**Badges**

- One NEP-171 contract (with NEP-177 metadata and NEP-297 events) deployed on testnet and mainnet. Five stage badges (stages 0 to 4) and one final badge with four rarity tiers (common, rare, epic, legendary) held in the token's extra field.
- Each token has a transferable flag. Stage badges and the main final badge are non-transferable. A transferable collector twin of the final badge is optional, minted only on request, and has no use yet.
- The contract pays storage from its own balance, so learners pay only gas. The Worker signs a claim over account, stage and expiry after checking evidence; the contract verifies the signature, enforces one badge per account per stage and requires the previous stage's badge. The contract stores the stage count and the required stages per exam route as owner-set values, so stages can be added later without redeploying. A daily mint cap applies.
- A public view method reports whether an account holds a badge for a stage. The app uses it to gate the final exam and the rare badge.
- Stage badges mint on testnet by default; the final badge mints on mainnet. Before the final claim the app checks the connected mainnet account's balance; with too little it offers a testnet edition of the final badge that can be upgraded later.
- Collection name "Book of NEAR Badges", symbol BOOK. The contract account is a sub-account of the owner's own accounts, named when the build starts.
- Badge art is five parametric SVG icons plus final-badge variants, generated by code in the repository in the ink style. Images are served from the app's own static hosting with a hash stored on chain.
- Rarity tiers for the final badge are computed by the Worker from what it can verify: exam score, completing the optional real swap, finishing the key challenge without hints, and finishing inside the event window.

**Exam**

- The final exam has routes (a developer route and a non-developer route). Each route draws about 20 questions from its stages. Answers are graded server-side. Required stages differ per route.

**Intents**

- The intents quote API documents no testnet. The swap lesson shows a live dry-run quote for free. A tiny real swap on mainnet is optional, capped, and only offered when the connected mainnet account has enough funds.

**Hosting**

- Static site and Worker on Cloudflare Pages and Workers. Public GitHub repository.

## Testing Decisions

- A good test checks behaviour a learner or reviewer can observe, not internal structure.
- **Primary seam:** the running app in demo mode, tested with Playwright, one smoke test per lesson plus the opening quiz, progress and badge claim flow. This is the highest seam and the one reviewers will exercise.
- **Secondary seams:** (a) the `Chain` interface, with the same behavioural tests run against the demo implementation and, on demand, against testnet; (b) the badge contract's public methods, tested with a local NEAR sandbox; (c) the Worker's HTTP endpoints.
- Every lesson's completion record is checked at the primary seam, not by reading internal state.
- Prior art: the existing prototype has no tests; this is the first.
- The demo-mode suite must pass on every commit. The testnet suite runs before merging any ticket that touches the chain.

## Out of Scope

- Stage 5 (private AI, tutor, agent with no owner) and stage 6 (governance, live money map). They may return if time allows after the MVP.
- An AI tutor or any paid model usage.
- A dedicated achievements row in block explorers, and NEP-393 issuer registration. Both are post-hackathon pitches.
- A transferable collector twin, beyond keeping the transfer flag in the contract.
- Native mobile apps.

## Further Notes

- **Hackathon rules:** build window is 1 November 00:00 UTC to 14 November 23:59 UTC. Code must be written inside the window, so no code before 1 November. Submission needs a public repository with a README for humans and AI reviewers, a public X post saying it was built at NEAR HACKATHON, and the form with a mainnet NEAR address. Tracks to claim: Open Innovation (home), NFTs That Do Something, and AI Security & Defense as a bonus through the key challenge. Claude Code and Codex screen every project first by following the README.
- **Cut line:** never cut the wallet lesson, claim your name, the limited key lesson, the shard lesson, the chain signatures lesson, the intent swap lesson, the badge flow and the capstone. If behind at day 7, move "a call that takes several blocks" and "race the RPC nodes" to planned cards. If behind at day 10, also move "issue your own token" and "old bridge vs the NEAR way".
- **Unverified facts:** the 1Click API base URL and fields, the Chain Signatures contract names and library calls, near-kit browser support and how top-level testnet names are created all come from documentation summaries and must be verified in the spike ticket. The known facts and their caveats are listed in `docs/spikes-seed.md`.
- **Schedule:** 14 days with a stage added every one to two days; days 12 to 14 are polish, README, demo video and buffer.
