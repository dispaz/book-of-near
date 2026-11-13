/**
 * Where the badge contract lives. Config, not code: lessons never name it.
 * Testnet: `VITE_BADGE_CONTRACT_ID`, else the contract deployed for issue #68 (docs/badge-contract.md).
 * Demo mode: a simulated contract on a demo account (src/chain/demo/badges.ts).
 */
export const TESTNET_BADGE_CONTRACT: string =
  (import.meta.env?.VITE_BADGE_CONTRACT_ID as string | undefined) || "badges.bon-badges-mwe57oab.testnet";

export const DEMO_BADGE_CONTRACT = "badges.book-of-near.testnet";

/** Static host of the badge images (the contract's `base_uri`). */
export const BADGE_BASE_URI = "https://book-of-near.pages.dev/badges";

/** Number of stage badges (stages 0 to 4). The contract was set up with `set_stage_count(5)`. */
export const STAGE_BADGES = 5;
