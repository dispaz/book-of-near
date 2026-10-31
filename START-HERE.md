# START HERE

Do not write code before **1 Nov 2026, 00:00 UTC** (hackathon rule). Everything below is setup you can do from then on.

## 0. Prerequisites
- Testnet and mainnet NEAR accounts (you have both).
- A 1Click API key (request from the NEAR Intents docs); keep it out of git.
- Cloudflare account (Pages + Workers, free tier).
- Claude Code CLI, with Opus 5.5 selected: `/model`.

## 1. Open the project (on or after 1 Nov)
```
cd ~/projects/book-of-near
git init && git add -A && git commit -m "Planning docs and tickets"
claude
```

## 2. Install the Matt Pocock skills
In your terminal (you run this, not an agent):
```
claude plugin install mattpocock-skills@claude-plugins-official
```
Then inside Claude Code run `/setup-matt-pocock-skills` and answer:
- Issue tracker: **local markdown** (`.scratch/`)
- Triage labels: **defaults**
- Context: **single-context**

It adds an `## Agent skills` block to `CLAUDE.md`; keep it.

## 3. Start the build (pasteable orchestrator prompt)
```
You are the orchestrator for Book of NEAR. Read CLAUDE.md, GLOSSARY.md and
.scratch/book-of-near-mvp/spec.md, then run /implement-spec on that spec.

Rules:
- Tickets are in .scratch/book-of-near-mvp/issues/ and ordered in tickets.md.
  Start a ticket only when everything it is blocked by is done.
- Work on an integration branch named build/mvp. Each implementer agent runs in
  its own git worktree with fresh context and gets exactly one ticket plus
  CLAUDE.md, GLOSSARY.md and the spec. Run 2 to 3 agents at once.
- First wave: tickets 01 and 04 (skeleton and spikes). Do not start others
  until 01 is merged. Spike results go to docs/spikes-seed.md; if a spike
  contradicts the spec, stop and tell me before continuing.
- Each agent uses /tdd, ticks the acceptance boxes, appends to docs/progress.md,
  sets Status: done, and commits. Review each branch with /code-review before
  merging into build/mvp.
- Checkpoints: end of day 7 and day 10. At day 7 cut tickets 18 and 21 if the
  P0 and P1 tickets are not done; at day 10 cut 20 and 25 if still behind.
  Report status to me at each checkpoint.
- Never commit secrets. Demo mode must work for every merged ticket.
- Stop and ask me before: deploying to mainnet, spending NEAR, or changing scope.
```

## 4. Manual fallback (one ticket at a time)
```
Read CLAUDE.md and .scratch/book-of-near-mvp/issues/NN-slug.md. Check every
"Blocked by" ticket is done. Implement it with /tdd, tick the acceptance
boxes, log to docs/progress.md, set Status: done, and commit.
```

## Ticket order at a glance
01 skeleton, 04 spikes, then 02/03/05, 07, 06, lessons by stage, badges (11, 12, 13), capstone 26, exam 28, final badge 29, then 30 to 33. Full map: `.scratch/book-of-near-mvp/tickets.md`.
