# NEAR Hackathon 2026: rules and submission checklist

Source: https://nearhackathon.com/HACKATHON.md, read on 12 Nov 2026. The organizers say the file can change: **re-read it on the day you submit.**

## Dates (UTC)

| When | What |
| --- | --- |
| 1 Nov 00:00 | Window opens (code from the 19 Oct announcement counts as baseline if disclosed) |
| **14 Nov 23:59** | **Deadline: repository public and form sent.** The form API answers 403 after this |
| 16 Nov 00:00 | Judging starts |
| 18 Nov 23:59 | Results |
| 25 Nov | Keep the hosted demo up until at least now (18 Nov is the minimum) |

## What judges get

- **Claude Code and Codex screen first:** they check the README runs as written, verify the features, and write a report with a preliminary score. Humans decide. A low AI score alone cannot reject a project.
- No published criteria or weights. Tracks are "hints and wishes, not requirements".
- Testnet-only projects can win in every track. Mainnet is needed only where the integration is mainnet-only (Intents/1Click: use dry quotes).

## Our tracks

Put every fitting id in the form's `tracks` array:

| Track id | Why we fit | Evidence to show in the README |
| --- | --- | --- |
| `open` | Interactive NEAR course with real testnet actions | Lessons, demo mode, testnet runs with tx hashes |
| `nfts` | Badges are proof of learning, gated by on-chain evidence | Badge contract on testnet, claim flow, "My book" |
| `security` (bonus) | Lesson 1.2: a key that can do only one thing (limited-key challenge) | Lesson 1.2 walk-through |

Claim `nfts` only if the badge claim works. A track with no evidence hurts more than it helps.

## Required for submission

1. **Public repository** by 14 Nov 23:59, kept public through judging. Each repo can be submitted once.
2. **LICENSE** file: any license (MIT is fine).
3. **README** written for a machine reader as well as a human:
   - what it is, the problem, how NEAR fits in;
   - one install-and-run command (demo mode);
   - "do X, see Y" steps for each feature;
   - the tracks and where their evidence is;
   - **disclosure of AI-generated code and libraries used** (rule Q-005);
   - the baseline: commits before 1 Nov (docs only) and a link to the diff from `pre-hackathon` to `hackathon-submission`.
4. **Git tags:** `pre-hackathon` (last commit before 1 Nov) and `hackathon-submission`.
5. **Post on X** by the owner: says it was built at NEAR HACKATHON, tags `@NEARProtocol` and `#NEARHackathon` (`@NearLegion`, `@NearBuilders` optional), **with the demo video attached**. Screenshots alone are not enough when judges cannot open the demo.
6. **Mainnet payout account** (`name.near` or a 64-character implicit account), created by the owner in a wallet. Agents never create it.
7. **The form** at https://nearhackathon.com/#apply. It cannot be edited after sending (changes only through https://nearhackathon.com/request-changes). Fields:
   - project name (2 to 80 characters), lead name (2 to 80), email (up to 160; at most 2 submissions per email);
   - team size `1`;
   - tracks;
   - NEAR payout address;
   - project URL (the repo) and demo URL (the live site);
   - "what you built": 20 to 2,000 characters on the problem, the product and how NEAR fits in;
   - consent: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

## Strongly recommended

- **Hosted demo** (Cloudflare Pages, `book-of-near.pages.dev`), up until 25 Nov. It counts as "a plus".
- **Video of 2:20 or less.** X accounts without Premium upload at most 140 seconds of MP4 (H.264).
- No secrets anywhere in git history (scan before going public).

## Who does what

| Item | Claude | Owner |
| --- | --- | --- |
| LICENSE, README, AI disclosure, tags | writes | reviews, picks the license |
| Secret scan of history | runs | — |
| Release to Cloudflare Pages | prepares | runs `git push origin origin/main:refs/heads/release` |
| Demo video (recording, captions, voice-over, MP4) | records and renders (see below) | watches, approves, or records own voice |
| X post text | drafts | posts from own account |
| Form text (idea, 2,000 characters) | drafts | — |
| Mainnet payout account | — | creates in a wallet |
| Make the repo public | — | GitHub settings (or `gh repo edit --visibility public` with approval) |
| Send the form | fills a payload for review | checks and sends (consent is personal) |

## The demo video, made by Claude

A Playwright script drives the production build in demo mode and records it. Then ffmpeg joins the clips, burns in captions, adds a voice-over and writes an MP4 for X.

- **Recording:** `recordVideo` at 1920×1080 in headed Chromium on the Mac GPU (3D needs it). Fixed waits for the camera to settle so cuts land on still frames. `localStorage bon:cover=off` skips the cover.
- **Voice-over:** macOS `say` (download an Enhanced or Premium voice in System Settings → Accessibility → Spoken Content for a natural sound). Or captions only, or the owner records a voice track over the cut.
- **Needs:** `ffmpeg` (`brew install ffmpeg`, or the `ffmpeg-static` npm package as a dev dependency).
- **Output:** `video/book-of-near-demo.mp4`, H.264, AAC, at most 2:20, kept out of git if it is large (upload it to the GitHub Release instead).

Suggested shots (about 2:10): the title and the problem (10 s), the opening quiz (10 s), one transaction on paper (0.3, 15 s), the limited key (1.2, 15 s), following a transaction across shards in 3D (2.1, 25 s), deploying a contract (3.1, 15 s), one account signing for Ethereum (4.1, 25 s), claiming a badge and "My book" (10 s), the end card with the link (5 s).
