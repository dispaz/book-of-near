# 02: Chain interface and demo chain

**What to build:** All chain access goes through one `Chain` interface. A deterministic in-browser demo implementation supports the operations lessons need: create an account, send a transfer, add and delete an access key, call a contract method, deploy a contract, batch actions, read a transaction with its receipts, shard and block information, and timings. It is seeded and repeatable so tests are stable. The placeholder lesson uses it to show a transfer.

**Blocked by:** 01 (Walking skeleton on the live URL)

**Status:** ready-for-agent

**Priority:** P0

- [ ] The placeholder lesson sends a transfer in demo mode and shows the resulting transaction details
- [ ] Running the same behavioural checks twice gives identical results
- [ ] The interface has no import from any network library, so it can be swapped for a real implementation
- [ ] A short note documents the operations and the shape of results so lesson tickets can rely on them
