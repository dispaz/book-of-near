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

/**
 * Number of stage badges (stages 0 to 7), one art file each in public/badges/. The testnet contract
 * still has `set_stage_count(5)`; the owner grows it to 8 (docs/badge-contract.md). A stage is only
 * claimable once it has a rule in rules.ts: until then 5 and 6 show "Not open yet", 7 "Badge not available yet".
 */
export const STAGE_BADGES = 8;

/** Stage names for the badge shelf, for stages that have no `stage.ts` yet (docs/curriculum/topics.json). */
export const STAGE_BADGE_NAMES: Record<number, string> = {
  5: "Enclave",
  6: "Citizen",
};
