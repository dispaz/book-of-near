/**
 * Build flags, read in one place. Vite replaces `import.meta.env.*` at build time, so a flag that is off
 * also drops the code behind it from the bundle.
 *
 * VITE_ENABLE_MAINNET: the learner's own mainnet wallet (NEAR Connect), the /wallet page and lesson 4.2's
 * tiny real swap. Off by default: the hackathon build is testnet only. Set it to "true" to switch them on.
 */
export const ENABLE_MAINNET: boolean = import.meta.env.VITE_ENABLE_MAINNET === "true";
