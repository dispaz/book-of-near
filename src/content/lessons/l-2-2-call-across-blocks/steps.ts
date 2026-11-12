// Step numbers (0-based) from manifest.ts: the one place they live. Keep them in sync with its steps.
export const HOOK = 0;
export const HOP = 1;
export const ORDER = 2;
export const GAS = 3;
export const FAIL = 4;
export const CHECK = 5;
export const HONEST = 6;

/**
 * Step 3's words in each mode (script 2.2.md, step 3). Demo mode sends a 30 Tgas order to the shop; testnet
 * mode opens a recorded real call (recorded.ts: market.withdraw → usdc.ft_transfer, 150 Tgas). The demo
 * words are the manifest's default vars; the scene sets the testnet ones in testnet mode.
 */
export const ORDER_COPY = {
  demo: {
    orderTask: "Order an item from the shop contract.",
    orderIntro:
      "You attach 30 Tgas (Tgas: a trillion gas units; about 0.003 NEAR). Contract A reserves the order and sends the order slip.",
    orderAction: "send the cross-contract order",
  },
  testnet: {
    orderTask: "Open a real call between two testnet contracts.",
    orderIntro:
      "This call was sent on testnet and recorded. Its sender attached 150 Tgas (Tgas: a trillion gas units). Contract A, market, asks contract B, usdc, to send test tokens, and waits for the answer.",
    orderAction: "open the recorded testnet call",
  },
} as const;

/** Step 3's button and its "not yet" hint in each mode (the scene picks them by network). */
export const ORDER_BUTTON = {
  demo: {
    press: "Send cross-contract order",
    done: "Order completed ✓",
    notYet: "Not yet: send the cross-contract order first.",
  },
  testnet: {
    press: "Open recorded call",
    done: "Call opened ✓",
    notYet: "Not yet: open the recorded testnet call first.",
  },
} as const;

export const orderButton = (network: string) => ORDER_BUTTON[network === "demo" ? "demo" : "testnet"];
