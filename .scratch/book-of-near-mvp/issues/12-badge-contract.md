# 12: Badge contract

**What to build:** A badge contract following the NEAR NFT standard with metadata and events. It mints stage badges and a final badge with a rarity stored in the token's extra data. Each token has a transferable flag; stage badges and the main final badge are non-transferable. Minting requires a claim signed by the project's claim key over account, stage and expiry; the contract verifies it, allows one badge per account per stage, and requires the previous stage's badge. The contract pays storage from its own balance. The owner can set the stage count and the required stages per exam route, and a daily mint cap. A public method says whether an account holds a badge for a stage. Deployed to testnet.

**Blocked by:** 04 (First-day spikes)

**Status:** ready-for-agent

**Priority:** P0

- [ ] Contract tests in a local sandbox cover valid claim, expired claim, replayed claim, wrong signer, skipping a stage, a second badge for the same stage and a transfer attempt on a non-transferable token
- [ ] A learner account with no balance beyond gas can claim without attaching a deposit
- [ ] The owner can add a stage and change required stages for a route without redeploying
- [ ] A mint on testnet appears on the testnet explorer as a collectible with the badge image
- [ ] The deployment steps are documented without secrets
