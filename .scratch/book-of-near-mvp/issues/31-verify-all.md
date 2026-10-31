# 31: Full demo-mode verification suite

**What to build:** A single command runs the opening quiz, every lesson and the badge claim flow in demo mode and reports pass or fail per lesson. A separate documented command runs the lessons that touch the chain against testnet. A fresh clone with only the README steps must run both.

**Blocked by:** 29 (Final badge: rarity, mainnet mint and testnet edition), 30 (Backlog topics as locked cards), 27 (Evidence checks and claims for stages 1 to 4)

**Status:** ready-for-agent

**Priority:** P0

- [ ] One command exercises every shipped lesson in demo mode and prints a per-lesson result
- [ ] The testnet command runs the chain lessons and its results can be recorded
- [ ] A fresh clone in an empty folder passes the demo-mode command following only the README
