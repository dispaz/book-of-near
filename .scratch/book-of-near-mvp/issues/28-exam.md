# 28: Final exam and badge gating

**What to build:** A final exam with a developer route and a non-developer route. Each route draws about 20 questions from its stages' question bank, written for this ticket from the lesson content. Answers are graded on the Worker and never shipped to the browser. The exam unlocks only for an account that holds the required stage badges for its route, checked on chain. The exam result feeds the final badge rarity.

**Blocked by:** 27 (Evidence checks and claims for stages 1 to 4), 26 (Capstone lesson: trace one intent end to end)

**Status:** ready-for-agent

**Priority:** P0

- [ ] The exam is locked for an account missing a required badge and unlocks when it holds them
- [ ] The two routes ask different questions and require different stages
- [ ] Correct answers are not present in anything the browser downloads
- [ ] The score is returned and stored as evidence for the final claim
- [ ] An end-to-end test covers a pass and a fail in demo mode
