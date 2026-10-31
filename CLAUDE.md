# Book of NEAR: project rules

Read `.scratch/book-of-near-mvp/spec.md` for the product, `GLOSSARY.md` for terms, and your ticket in `.scratch/book-of-near-mvp/issues/` for the task.

## Hard rules
- **No code before 1 Nov 2026 00:00 UTC.** Code must be written inside the hackathon window. Before that, only docs and tickets.
- **Everything on chain goes through the `Chain` interface** (TestnetChain and DemoChain). Lessons never call RPC, wallets or SDKs directly.
- **Demo-mode parity.** Every lesson, badge claim and the exam must work in demo mode with no wallet and no network. AI reviewers run the README first, so one install command must give a working app.
- **No secrets in the repo.** Keys live in Worker secrets and `.dev.vars` (ignored). Ship `.env.example` only.
- **Ink style.** Black outlines on paper-white, one accent colour per stage. 3D only in the two showpieces (shards, chain signatures); the rest is 2D SVG. Every scene has a text/SVG fallback and honours `prefers-reduced-motion`.
- **Every lesson ends with an "Honest take"** listing NEAR's strengths and weaknesses.
- **Learner copy:** plain English, short sentences, define a term the first time it appears, no hype.
- **Unverified facts** (see `docs/spikes-seed.md`) must not be coded as truth until ticket 04 verifies them.

## Workflow
1. Pick a ticket whose "Blocked by" tickets are all done. Set its Status to `in-progress`.
2. Build with TDD (`/tdd`). Test through the running app in demo mode first, then the Chain interface, the badge contract and the Worker endpoints.
3. Tick every acceptance box. Run lint, typecheck, tests and e2e.
4. Append a short entry to `docs/progress.md`, set the ticket Status to `done`, commit.

## Definition of done
Acceptance boxes ticked, tests green, works in demo mode, fallback and reduced-motion checked, no secrets, progress logged.

## Commands
Filled in by ticket 01 (dev, build, test, e2e, deploy).

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` (future `CONTEXT.md`) + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
