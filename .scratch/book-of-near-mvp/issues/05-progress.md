# 05: Opening quiz, routes, progress and table of contents

**What to build:** The first screen is a short opening quiz that places the learner on the newcomer, veteran or developer route. The route decides which lessons are shown first and which stages can be tested out. A table of contents shows every stage and lesson, including planned ones as locked cards. Progress is remembered in the browser. Finishing a lesson emits a completion record through a single stage-completion interface, which later tickets (badge claims, exam gating) consume. The record states the lesson, the stage, the route, whether it ran in demo or on testnet, a timestamp and any evidence the lesson produced, such as a transaction id.

**Blocked by:** 01 (Walking skeleton on the live URL)

**Status:** ready-for-agent

**Priority:** P0

- [ ] A new visitor can take the quiz and lands on a route-appropriate start
- [ ] A returning visitor resumes where they stopped
- [ ] Planned lessons show as locked cards with their stage
- [ ] Completing the placeholder lesson emits a completion record that a test can read through the interface
- [ ] A veteran can test out of stage 0 and the result is stored as a completion record marked as tested out
