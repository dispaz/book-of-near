/**
 * Pure helpers for lesson 0.3: amount rules, fee numbers from the script, balance steps, the
 * explorer link and kind error messages. No chain access here; the scene goes through useChain().
 */
import { isChainError } from "../../../chain/errors";
import { formatNear, parseNear } from "../../../chain/units";
import type { AccountId, ChainNetwork, Yocto } from "../../../chain/types";

/** Amount rules from docs/lessons/stage-0/0.3.md, step 2. */
export const DEFAULT_AMOUNT = "0.01";
export const MIN_AMOUNT = parseNear("0.001");
export const MAX_AMOUNT = parseNear("0.1");

/** A transfer's gas (NEAR docs, Gas page): 0.45 Tgas. */
export const TRANSFER_TGAS = "0.45";
/** Fee at the floor gas price (0.0001 NEAR per Tgas): 0.000045 NEAR. */
export const TRANSFER_FEE = parseNear("0.000045");
/** Gas held up front at the buy price floor (0.001 NEAR per Tgas): 0.00045 NEAR. */
export const TRANSFER_HELD = parseNear("0.00045");

/** Reads the amount box. Gives yoctoNEAR, or a short plain-English problem. */
export function readAmount(text: string): { ok: true; amount: Yocto } | { ok: false; problem: string } {
  const t = text.trim();
  const range = "Pick an amount from 0.001 to 0.1 NEAR.";
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t))
    return { ok: false, problem: `Type a number, such as 0.01. ${range}` };
  let amount: Yocto;
  try {
    amount = parseNear(t.startsWith(".") ? `0${t}` : t);
  } catch {
    return { ok: false, problem: range };
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) return { ok: false, problem: range };
  return { ok: true, amount };
}

/** NEAR amount for the page: up to 6 decimals, trailing zeros dropped. */
export function near(amount: Yocto, decimals = 6): string {
  return `${formatNear(amount, decimals)} NEAR`;
}

/** First and last characters of a long id (over 24 characters), for tight spots. The full id goes in `title`. */
export function short(id: string, head = 6, tail = 4): string {
  return id.length > Math.max(24, head + tail + 1) ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

/** "250 ms" under a second, "3.25 s" above. */
export function duration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

/** NearBlocks page for a testnet transaction (pattern from NEAR docs, Networks page). */
export function explorerUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

/**
 * Where the transfer goes. Demo: the app's return account. Testnet: VITE_RETURN_ACCOUNT_ID (the app's
 * faucet account) or, while that is unset, the practice account itself, so NEAR never goes to a stranger.
 */
export function receiverFor(
  network: ChainNetwork,
  self: AccountId,
  demoReturn: AccountId,
  configured?: string,
) {
  if (network !== "testnet") return demoReturn;
  return configured?.trim() || self;
}

/**
 * The sender's balance at each point. Included: the amount left and the gas was held at the buy price.
 * Final: the real balance from the chain (the extra gas came back).
 */
export function senderBalance(
  start: Yocto,
  amount: Yocto,
  stage: "before" | "included" | "final",
  finalBalance?: Yocto,
): Yocto {
  if (stage === "before") return start;
  if (stage === "final" && finalBalance !== undefined) return finalBalance;
  return start - amount - TRANSFER_HELD;
}

export interface KindError {
  title: string;
  detail: string;
}

/** A clear, kind message for anything that stops the transfer. Never shows a stack trace. */
export function kindError(e: unknown, network: ChainNetwork): KindError {
  const testnet = network === "testnet";
  const where = testnet ? "Nothing was charged." : "Nothing changed.";
  if (isChainError(e)) {
    if (e.kind === "InvalidTransaction") {
      if (e.reason === "NotEnoughBalance" || e.reason === "LackBalanceForState")
        return {
          title: "Not enough NEAR in the practice account",
          detail: `The network refused the transfer: the account cannot pay the amount plus the fee. ${where} Try a smaller amount${testnet ? ", or continue in demo mode" : ""}.`,
        };
      if (e.reason === "InvalidNonce")
        return {
          title: "This transaction was already used",
          detail: `Its nonce is used up, so the network will not run it twice. ${where} Build a new one.`,
        };
      if (e.reason === "Expired")
        return {
          title: "The transaction expired",
          detail: `Its block hash is too old now. ${where} Build a new one.`,
        };
      return { title: "The network refused the transaction", detail: `${e.message} ${where}` };
    }
    if (e.kind === "Network")
      return {
        title: "The RPC node did not answer",
        detail: `We could not reach NEAR testnet, so the transfer may not have gone out. If it did not, nothing was charged. Why: ${e.message}`,
      };
    return { title: "Something went wrong", detail: e.message };
  }
  const message = e instanceof Error && e.message ? e.message : "";
  if (/faucet/i.test(message))
    return {
      title: "No faucet could fund a practice account",
      detail: `Free testnet NEAR is not available right now. ${message}`,
    };
  return {
    title: "Something went wrong",
    detail: message ? `Why: ${message}` : "Please try again.",
  };
}
