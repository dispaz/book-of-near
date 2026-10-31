# Book of NEAR

An interactive, 3D (ink-outline) course that teaches NEAR from zero to expert. Learners do real testnet actions, then mint NFT badges as proof of learning. Built solo with Claude Code for the NEAR Hackathon 2026 (build window 1 Nov 00:00 UTC to 14 Nov 23:59 UTC).

**Status:** planning only. Implementation starts on 1 Nov 2026. See [START-HERE.md](START-HERE.md).

## What is in this folder

| Path | What it is |
| --- | --- |
| `START-HERE.md` | How to begin: setup steps and the pasteable start prompt |
| `CLAUDE.md` | Project rules every agent follows |
| `GLOSSARY.md` | Shared vocabulary (lesson, stage, badge, demo mode ...) |
| `.scratch/book-of-near-mvp/spec.md` | The product spec (problem, user stories, decisions, testing) |
| `.scratch/book-of-near-mvp/issues/` | 33 tickets for agents, in dependency order |
| `.scratch/book-of-near-mvp/tickets.md` | Ticket map with priorities and blockers |
| `docs/curriculum/` | The 57-topic curriculum map (HTML + `topics.json`) |
| `docs/prototype/ink-stage.html` | The 3D ink-style stage prototype |
| `docs/ARTIFACTS.md` | Links to the plan, research and vision docs |
| `docs/spikes-seed.md` | Unverified facts that ticket 04 must check |
| `docs/progress.md` | Running log kept by the agents |

## Scope (MVP)

Stages 0 to 4 plus a capstone and final exam: 15 lessons, 5 stage badges, 1 final badge with four rarity tiers. Everything else is shown as locked "planned" cards.

## Quick start (filled in by ticket 01)

```
npm install && npm run dev      # app in demo mode, no wallet needed
npm test                        # unit and contract tests
npm run e2e                     # Playwright against demo mode
```
