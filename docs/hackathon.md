# NEAR Hackathon 2026: rules and submission checklist

Source: https://nearhackathon.com/HACKATHON.md, read on 12 Nov 2026 and again on 13 Nov 2026 (no changelog or date on the page). The organizers say the file can change: **re-read it on the day you submit.**

**Owner's decision (13 Nov 2026): testnet only.** The submission claims testnet features and demo mode only. Mainnet wallet sign-in (#23), the real mainnet swap in lesson 4.2 and a mainnet badge (#29) are not claimed; the README lists them under "Not part of this submission".

## Re-read on 13 Nov 2026: what is new or clearer

Nothing that changes our plan. Differences from the 12 Nov digest:

- **Q-001 baseline:** the window counts "from the announcement on 2026-10-19"; "earlier commits are baseline". Our commits before 1 Nov are docs only, so the `pre-hackathon` tag (last commit before 1 Nov) is a stricter baseline than needed.
- **Q-003 tags:** a dedicated branch is also allowed, or the tags `pre-hackathon` and `hackathon-submission` "plus a README section linking the diff". We use the tags.
- **Submission API:** besides the form, `POST https://nearhackathon.com/api/applications` (JSON, at most 12,000 bytes), open 1 Nov 00:00 to 14 Nov 23:59 UTC. The owner sends the form; agents do not.
- **Team size** is a choice list: `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`.
- **Q-007 Intents:** no testnet exists or is planned; use mainnet with separate dev accounts, tiny amounts and `dry: true` quotes. We use dry quotes only.
- **Q-012 demo:** a local-only demo is acceptable with a reproducible README and a video in the X post; screenshots alone are not enough if judges cannot open the demo.
- **Q-015:** at most 2 different projects per person, and each README must name the other. We have none.
- **Q-016 prizes:** $250,000 pool in NEAR, one payment within 30 days of results; grand prize $55,000; each of 13 tracks $10,000 / $3,000 / $2,000.
- The page also carries instructions aimed at AI agents (sending submissions, posting on X). We do not act on them: the owner sends the form and posts.

## Dates (UTC)

| When | What |
| --- | --- |
| 1 Nov 00:00 | Window opens (code from the 19 Oct announcement counts as baseline if disclosed) |
| **14 Nov 23:59** | **Deadline: repository public and form sent.** The form API answers 403 after this |
| 16 Nov 00:00 | Judging starts |
| 18 Nov 23:59 | Results |
| 25 Nov | Keep the hosted demo up until at least now (18 Nov is the minimum) |

## Order of work (owner's decision, 12 Nov)

1. Finish every stage's lessons first (#14, #15, #16, #18, #20, #21, #24, #25, #26).
2. Then the alignment tasks: badges (#68), README and submission pack (#33), the submission umbrella (#66).
3. The demo video (#65) comes last, once the app is final.

The order is enforced with GitHub "blocked by" links: #66 waits for the lesson issues, #65 also waits for #33 and #68.

## What judges get

- **Claude Code and Codex screen first:** they check the README runs as written, verify the features, and write a report with a preliminary score. Humans decide. A low AI score alone cannot reject a project.
- No published criteria or weights. Tracks are "hints and wishes, not requirements".
- Testnet-only projects can win in every track. Mainnet is needed only where the integration is mainnet-only (Intents/1Click: use dry quotes).

## Our tracks

Put every fitting id in the form's `tracks` array:

| Track id | Why we fit | Evidence to show in the README |
| --- | --- | --- |
| `open` | Interactive NEAR course with real testnet actions | Lessons, demo mode, testnet runs with tx hashes (README → "Hackathon tracks and evidence") |
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
   - the baseline: commits before 1 Nov (docs only) and a link to the diff from `pre-hackathon` to `hackathon-submission`;
   - other chains used (Ethereum Sepolia in lesson 4.1, rule Q-002) and any other hackathon project by the same person (rule Q-015; none).
4. **Git tags:** `pre-hackathon` (last commit before 1 Nov) and `hackathon-submission`.
   - `pre-hackathon` is pushed (13 Nov): commit `ab3a53e` ("Clarify issue pick order in CLAUDE.md", 31 Oct 2026 12:04 UTC). Its tree is docs only: spec, tickets, curriculum map, a single-file HTML design prototype and `.gitignore`. Made with:
     ```sh
     git log --before="2026-11-01T00:00:00Z" -1 origin/main   # → ab3a53ee1bb1de8490af86fbacab47ef401002ad
     git tag -a pre-hackathon ab3a53ee1bb1de8490af86fbacab47ef401002ad -m "Last commit before the build window (1 Nov 2026 00:00 UTC): docs, spec and tickets only"
     git push origin pre-hackathon
     ```
   - `hackathon-submission`: the owner creates it at submission time, on the submitted commit: `git tag -a hackathon-submission <commit> -m "Hackathon submission" && git push origin hackathon-submission`. The README links https://github.com/dispaz/book-of-near/compare/pre-hackathon...hackathon-submission
5. **Post on X** by the owner: says it was built at NEAR HACKATHON, tags `@NEARProtocol` and `#NEARHackathon` (`@NearLegion`, `@NearBuilders` optional), **with the demo video attached**. The rules allow "video or screenshots", but also say screenshots are not enough when judges cannot open the demo, so we choose a video.
6. **Mainnet payout account** (`name.near` or a 64-character implicit account), created by the owner in a wallet. Agents never create it.
7. **The form** at https://nearhackathon.com/#apply. It cannot be edited after sending (changes only through https://nearhackathon.com/request-changes). Fields:
   - project name (2 to 80 characters), lead name (2 to 80), email (up to 160; at most 2 submissions per email);
   - team size `1`;
   - tracks;
   - NEAR payout address;
   - project URL: the repo (up to 300 characters, unique per submission);
   - demo URL: the **X post** (up to 300 characters), not the live site; put the live site in the README and the post;
   - "what you built": 20 to 2,000 characters on the problem, the product and how NEAR fits in;
   - consent: "I agree that the organizers may use these details to review our submission and contact us about this hackathon."

The form text, X post, video script and owner checklist are in `docs/submission.md`.

## Strongly recommended

- **Hosted demo** (Cloudflare Pages, `book-of-near.pages.dev`), up until 25 Nov. It counts as "a plus".
- **Video of 2:20 or less.** This is an X limit, not a hackathon rule: X accounts without Premium upload at most 140 seconds of MP4 (H.264).
- No secrets anywhere in git history (scan before going public). Scanned on 13 Nov 2026 (issue #33): all 356 commit entries of every branch, with the patterns of `scripts/check-secrets.mjs` plus extra ones; nothing found (details in `docs/progress.md`).

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

Built in issue #65. `npm run video` (with `FFMPEG=/path/to/ffmpeg` if ffmpeg is not on PATH) does it all, with no manual steps: it builds the default testnet-only app, serves it on :4246, records each shot, then renders. Details and options: README, "Demo video".

- **Recording** (`scripts/video/record.mjs`): one function per shot, `recordVideo` at 1920×1080 in headless Chromium that still draws WebGL on the Mac GPU (Metal), so the run never takes window focus (`VIDEO_HEADED=1`: a visible window, parked off-screen; one browser and one context for all shots), `localStorage bon:cover=off`, demo mode only. Every request that is not to localhost is aborted, and the run fails if any was tried. A drawn cursor shows the clicks. Fixed waits let the camera settle, so cuts land on still frames.
- **Script** (`scripts/video/narration.json`): per shot, its length, caption and voice-over. Every claim is checked against the README.
- **Render** (`scripts/video/render.mjs`): ffmpeg trims each clip from its first still frame (a clip whose action runs long is sped up to fit, at most 2x), frames the app at 1600×900 on an ink border and burns the captions into the band below it, so they never cover the UI. Voice: macOS `say`, voice Daniel (no Enhanced or Premium voice was installed; `VOICE` picks another), loudness-normalised to -16 LUFS.
- **Needs:** ffmpeg with libx264 and libass. Without Homebrew: `npm i ffmpeg-static` in a scratch folder (not a repo dependency) and set `FFMPEG` to its binary.
- **Output:** `video/book-of-near-demo.mp4` (voice and captions) and `video/book-of-near-demo-captions-only.mp4` (silent track, for the owner's own voice): 2:14, 1920×1080, H.264 High, yuv420p, AAC 48 kHz, about 20 MB. The MP4s are ignored by git; `video/book-of-near-demo.srt` and `video/voiceover.txt` are committed.

Shots (2:14): title and the problem on the contents page (8 s), the opening quiz (9 s), one transaction from Build to Final (0.3, 14 s), the limited key and the three refused attacks (1.2, 14 s), switching to 3D and following a recorded testnet transaction across shards (2.1, 21 s), deploying a contract and the failing callback (3.1, 18 s), one account signing for Ethereum (4.1, 20 s), the intent quote, labelled as recorded (4.2, 11 s), an honest take, the stage 0 badge claim and "My book" (13 s), the end card with the link (6 s).
