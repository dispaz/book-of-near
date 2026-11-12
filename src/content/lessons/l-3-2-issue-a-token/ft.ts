/**
 * Pure helpers for lesson 3.2: the learner's token values, what each scene object says when picked,
 * and the evidence record. No chain access and no React here; the lesson state (useToken.ts) goes
 * through the Chain interface.
 */
import { contractIdFor } from "../l-3-1-deploy-a-contract/contract";
import type { AccountId } from "../../../chain/types";
import { GASLESS, MINT, REGISTER, TRAP } from "./steps";

/** The friend the learner sends tokens to (docs/lessons/stage-3/3.2.md, section 5). */
export const FRIEND = "friend.testnet";
/** Tokens per transfer. */
export const SEND_AMOUNT = 50;
export const DEFAULT_SYMBOL = "BOOK";
export const DEFAULT_SUPPLY = 1000;
export const MAX_SUPPLY = 1_000_000_000;

/** The token contract's account, `token.<parent>`, or null when the parent cannot have sub-accounts. */
export const tokenIdFor = (parent: AccountId) => contractIdFor(parent, "token");

/** Why a ticker symbol is not usable, or null. 2 to 8 capital letters or digits, starting with a letter. */
export function symbolProblem(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "Type a symbol, for example BOOK.";
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(s)) return "Use 2 to 8 capital letters or digits, starting with a letter.";
  return null;
}

/** Why a supply is not usable, or null. A whole number from 100 to 1,000,000,000. */
export function supplyProblem(raw: string): string | null {
  const t = raw.trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return "Type a whole number, for example 1000.";
  const n = Number(t);
  if (n < 100) return "Mint at least 100, so there is enough to send.";
  if (n > MAX_SUPPLY) return "Keep it at 1,000,000,000 or less.";
  return null;
}

export const supplyOf = (raw: string) => Number(raw.trim().replace(/,/g, ""));

export const tokens = (n: number, symbol: string) => `${n.toLocaleString("en-US")} ${symbol}`;

/** The scene's clickable objects (docs/lessons/stage-3/3.2.md, "Reactions"). */
export type Obj = "me" | "stamp" | "friend" | "padlock" | "parcel";

/** What the lesson knows, for picks. */
export interface PickState {
  step: number;
  minted: boolean;
  refused: boolean;
  registered: boolean;
  relayed: number;
  symbol: string;
  supply: number;
  myBalance: number;
  friendBalance: number;
  depositText: string;
}

/** What a pick does: run the step's action, say "not yet" with a hint, or show a detail. */
export type PickResult =
  { act: "mint" | "send" | "register" | "gasless" } | { notYet: string } | { detail: string };

/** Which object runs which step's action (the same as the step's button). */
const ACTS: Partial<Record<Obj, [number, PickResult & { act: string }]>> = {
  stamp: [MINT, { act: "mint" }],
  padlock: [TRAP, { act: "send" }],
  friend: [REGISTER, { act: "register" }],
  parcel: [GASLESS, { act: "gasless" }],
};

export function pickResult(s: PickState, o: Obj): PickResult {
  const own = ACTS[o];
  const done = {
    mint: s.minted,
    send: s.refused,
    register: s.registered,
    gasless: s.relayed > 0,
  };
  if (own && s.step === own[0] && !done[own[1].act as keyof typeof done]) {
    // The step's object, at its step: run the action once its earlier steps are done.
    if (o !== "stamp" && !s.minted) return { notYet: "Mint your tokens first (step 2)." };
    if (o === "friend" && !s.refused) return { notYet: "Send tokens to your friend first (step 3)." };
    if (o === "parcel" && !s.registered) return { notYet: "Register your friend's storage first (step 4)." };
    return own[1];
  }
  switch (o) {
    case "me":
      return {
        detail: s.minted
          ? `Your account holds ${tokens(s.myBalance, s.symbol)}.${s.relayed ? " The relayer paid the gas: you spent 0 NEAR on it." : ""}`
          : "Your account. No tokens yet.",
      };
    case "stamp":
      return s.minted
        ? { detail: `NEP-141 token: symbol ${s.symbol}, total supply ${s.supply.toLocaleString("en-US")}.` }
        : { notYet: "Mint your tokens at step 2." };
    case "friend":
      if (!s.minted) return { notYet: "Mint your tokens first." };
      return {
        detail: s.registered
          ? `${FRIEND}: registered through NEP-145, holding ${tokens(s.friendBalance, s.symbol)}.`
          : `${FRIEND}: not registered with your token, so it cannot hold any.`,
      };
    case "padlock":
      if (!s.refused) return { notYet: "Send tokens to your friend first (step 3)." };
      return {
        detail: s.registered
          ? `Storage paid: ${s.depositText} NEAR locked in the token contract for ${FRIEND}'s balance record.`
          : "Locked: the token contract has no balance record for your friend.",
      };
    case "parcel":
      if (!s.registered) return { notYet: "Register your friend's storage first (step 4)." };
      return s.relayed
        ? { detail: "NEP-366 meta-transaction: you signed it, the relayer sent it and paid the gas." }
        : { notYet: "Sign the gasless transfer at step 5." };
  }
}

/** Evidence for the completion record: the token and transaction hashes, never keys. */
export function evidenceOf(v: {
  minted: boolean;
  tokenId: AccountId | null;
  symbol: string;
  supply: number;
  relayTx: string | null;
}): Record<string, string> | null {
  if (!v.minted || !v.tokenId) return null;
  return {
    tokenContract: v.tokenId,
    tokenSymbol: v.symbol,
    totalSupply: String(v.supply),
    ...(v.relayTx ? { relayerPaidGas: "true", txHash: v.relayTx } : {}),
  };
}
