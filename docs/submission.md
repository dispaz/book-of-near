# Submission pack

Everything the owner needs to submit Book of NEAR to the NEAR Hackathon 2026. Rules digest: `docs/hackathon.md`. Deadline: **14 Nov 2026 23:59 UTC** (repository public and form sent).

**Owner's decision (13 Nov 2026): testnet only.** The README, the tracks, the form text and the post claim testnet features and demo mode only. Mainnet wallet sign-in, the optional real mainnet swap in lesson 4.2 and a mainnet badge are not claimed.

## Form fields

| Field | Value | Limit |
| --- | --- | --- |
| Project name | `Book of NEAR` (12 characters) | 2 to 80 |
| Lead name | owner fills in | 2 to 80 |
| Email | owner fills in | up to 160 |
| Team size | `1` | — |
| Tracks | `["open", "nfts", "security"]` | one or more |
| NEAR payout address | owner's mainnet account (`name.near` or 64-character implicit) | — |
| Project URL | `https://github.com/dispaz/book-of-near` (38 characters) | up to 300, unique |
| Demo URL | the **X post** URL (not the live site) | up to 300 |
| What you built | the text below | 20 to 2,000 |
| Consent | owner ticks it personally | — |

The live site, https://book-of-near.pages.dev, goes in the README and in the X post, not in the demo URL field.

### "What you built" (1,741 characters)

Count it again after any edit: copy the text between the markers into a file and run `wc -m`.

<!-- form-text:start -->

Book of NEAR is an interactive course that teaches NEAR from zero, as a pop-up book you can touch. Each lesson is an ink-style scene in 2D and 3D, and ends with an "Honest take" on what NEAR does well and badly compared with other chains.

The problem: newcomers cannot realistically learn how NEAR works. Docs assume prior knowledge, explainers are static, and nothing lets you do the real thing and watch what happens underneath. Veterans want to skip the basics and see what is different about NEAR.

The product: 20 lessons in 8 stages. You make a key pair and its 12 recovery words, send a transaction and watch it reach finality, claim a name.testnet account, give an app a function-call key that can call one contract and watch the chain refuse its misuse, batch actions and see them roll back, follow a transaction across shards, deploy a contract and see a cross-contract callback fail, and sign an Ethereum Sepolia transaction from your NEAR account with Chain Signatures. A dry NEAR Intents quote shows a cross-chain swap.

How NEAR fits in: in testnet mode the lessons run on real NEAR testnet through one Chain interface. Finishing a stage lets you claim a non-transferable NFT badge on our testnet contract (badges.bon-badges-mwe57oab.testnet). A Cloudflare Worker checks your own testnet transactions before signing the claim for stages 0 to 4. "My book" shows your badges and /check verifies anyone's. The badges open a 15-question final exam; on testnet the Worker grades it and signs a receipt for a pass.

Demo mode needs no wallet and no network, so judges can run it with one command: npm install && npm run dev. Live: https://book-of-near.pages.dev. Testnet only. Built with Claude Code agents, disclosed in the README.

<!-- form-text:end -->

## X post draft

The owner posts it from their own account, **with the demo video attached** (MP4, H.264, at most 2:20). Its URL is the form's demo URL. 267 characters by X's count (the link counts as 23; the limit is 280).

> Book of NEAR: a pop-up book that teaches NEAR from zero. Make a key, send a testnet transaction, give an app a one-job key, follow a tx across shards, sign for Ethereum, claim a badge NFT.
>
> Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
>
> https://book-of-near.pages.dev

Optional tags: `@NearLegion`, `@NearBuilders`. Add the repo link in a reply if wanted.

## Demo video script (2:10, under the 2:20 limit)

Recorded in demo mode on the production build (`localStorage bon:cover=off` skips the cover), 1920×1080, captions burned in. Plan and tooling: `docs/hackathon.md` → "The demo video, made by Claude" (issue #65).

| # | Time | Length | Shot | What is on screen | Caption / voice-over |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00 | 10 s | Title and problem | Contents spread, then the book cover | "Learning NEAR is hard: docs assume you know crypto, explainers are static. Book of NEAR lets you do the real thing." |
| 2 | 0:10 | 10 s | Opening quiz | `/start`: three questions, the path appears | "Three questions pick your path: newcomer, veteran or developer." |
| 3 | 0:20 | 15 s | A transaction on paper (0.3) | Build, Sign, Send; the five lights reach Final | "Build, sign and send a transaction, and watch it become final in a couple of seconds." |
| 4 | 0:35 | 15 s | The limited key (1.2) | Give the app a key; the three attacks refused with reasons | "Give an app a key that can do only one thing. When it is hacked, the chain refuses everything else." |
| 5 | 0:50 | 20 s | Across shards in 3D (2.1) | Switch 2D to 3D; follow the receipts hop by hop | "Switch to 3D and follow your transaction across shards, chunks and blocks." |
| 6 | 1:10 | 15 s | Deploy a contract (3.1) | Deploy, Increment, the failing callback's receipts | "Deploy a contract in one click, call it, and watch a cross-contract callback catch a failure." |
| 7 | 1:25 | 20 s | One account signs for Ethereum (4.1) | Derive the address, request the MPC signature, the signer recovers | "Your NEAR account signs an Ethereum transaction with Chain Signatures. The signature recovers to your derived address." |
| 8 | 1:45 | 10 s | An intent quote (4.2) | Fetch the quote; amount in, amount out, fees, time estimate | "Ask for a cross-chain swap with an intent: a signed quote from NEAR Intents (recorded from the live API), with no money moved." |
| 9 | 1:55 | 10 s | Badge and "My book" | Claim the stage 0 badge, the shelf | "Finish a stage and claim a badge NFT on NEAR testnet. Every lesson ends with an honest take." |
| 10 | 2:05 | 5 s | End card | `book-of-near.pages.dev`, "Built at NEAR HACKATHON" | "Try it: book-of-near.pages.dev. Demo mode needs no wallet." |

Total: 2:10. If the cut runs long, shorten shot 1 or 2 first (to 8 s).

## Owner checklist

Do these in order. Re-read https://nearhackathon.com/HACKATHON.md before sending the form.

- [ ] **Merge the open PRs** you want in the submission. The final exam PR (#102) already updates the README and the form text; the final badge (#29) and the stage 7 badge are still in progress, so if either merges, update the README's "in progress" line and "Honest limitations".
- [ ] **Release** the final `main` to Cloudflare Pages: `git push origin origin/main:refs/heads/release`. Then check https://book-of-near.pages.dev/version.json shows the new version. (On 13 Nov the live site was v0.2.2 from 12 Nov, without badges and lessons 5.1, 6.1 and 7.2.)
- [ ] **Worker for testnet badge claims and exams** (optional, otherwise testnet claims and testnet exam grading fail on the live site; demo mode always works; `/exam` uses the same key): `cd worker && npx wrangler secret put CLAIM_SIGNING_KEY && npx wrangler deploy`, then set the repo variable `VITE_WORKER_URL` and release again. Steps: `docs/badge-contract.md`.
- [ ] **Tag the submission** on the commit you submit: `git tag -a hackathon-submission <commit> -m "Hackathon submission" && git push origin hackathon-submission`. The `pre-hackathon` tag is already pushed (`ab3a53e`). Check the README's compare link opens: https://github.com/dispaz/book-of-near/compare/pre-hackathon...hackathon-submission
- [ ] **Make the repository public** (GitHub → Settings → Danger zone, or `gh repo edit dispaz/book-of-near --visibility public --accept-visibility-change-consequences`) and keep it public through judging.
- [ ] **Mainnet payout account**: create `name.near` (or use a 64-character implicit account) in your own wallet. Agents never create it.
- [ ] **Demo video**: watch and approve the MP4 from issue #65 (at most 2:20).
- [ ] **Post on X** from your account with the text above and the video attached. Copy the post URL.
- [ ] **Send the form** at https://nearhackathon.com/#apply before **14 Nov 23:59 UTC**: name, lead, email, team `1`, tracks `open`, `nfts`, `security`, payout address, repo URL, the X post URL, the text above, and tick the consent yourself. The form cannot be edited after sending (changes only through https://nearhackathon.com/request-changes).
- [ ] **Keep the hosted demo up** until at least 18 Nov, ideally 25 Nov.
