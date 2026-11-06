import { formatNear, parseNear } from "../units";
import type { FundsRequirement, FundsResult, WalletState } from "./types";

/** Kept back for the network fee on any mainnet action. A transfer burns well under 0.001 NEAR. */
export const DEFAULT_FEE_RESERVE = parseNear("0.01");

/**
 * Decides whether the connected account can afford an action. Pure: give it the wallet state.
 * Always names the testnet fallback when the answer is not "enough" (spec: testnet edition of the badge).
 */
export function checkFunds(state: WalletState, req: FundsRequirement): FundsResult {
  const needed = req.amount + (req.feeReserve ?? DEFAULT_FEE_RESERVE);
  if (state.status !== "connected") {
    return {
      kind: "no-wallet",
      needed,
      fallback: "testnet",
      message:
        "No mainnet wallet is connected. Connect one, or carry on with the free testnet edition. Nothing is lost.",
    };
  }
  if (state.balance >= needed) {
    return {
      kind: "enough",
      needed,
      balance: state.balance,
      fallback: null,
      message: `You have ${formatNear(state.balance, 4)} NEAR. This needs ${formatNear(needed, 4)} NEAR including the fee.`,
    };
  }
  const shortfall = needed - state.balance;
  return {
    kind: "not-enough",
    needed,
    balance: state.balance,
    shortfall,
    fallback: "testnet",
    message: `You have ${formatNear(state.balance, 4)} NEAR but this needs ${formatNear(needed, 4)} NEAR including the fee. You are short by ${formatNear(shortfall, 4)} NEAR. You can use the free testnet edition instead.`,
  };
}
