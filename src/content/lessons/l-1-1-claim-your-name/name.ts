/**
 * Pure helpers for lesson 1.1: the name box (rules in plain English) and the deposit. No chain access
 * here; the scene goes through useChain().
 */
import { accountIdProblem } from "../../../chain/accountId";
import { parseNear } from "../../../chain/units";

/** The registrar's suffix: it makes top-level `.testnet` names (docs/spikes-seed.md, spike 1). */
export const SUFFIX = ".testnet";
export const REGISTRAR = "testnet";
/** What the practice account sends along with the name, so the new account can pay for its own keys. */
export const CREATE_DEPOSIT = parseNear("0.1");

export const fullName = (label: string): string => `${label.trim()}${SUFFIX}`;

/** `problem: null` means the box is empty: show a hint, not an error. */
export type NameRead = { ok: true; id: string } | { ok: false; problem: string | null };

export function readLabel(text: string): NameRead {
  const label = text.trim();
  if (!label) return { ok: false, problem: null };
  if (label.includes("."))
    return {
      ok: false,
      problem: "Leave out the dot. A dot makes a sub-account, and this lesson makes a top-level name.",
    };
  const id = fullName(label);
  const problem = accountIdProblem(id);
  // The id is longer than the label, so "too short" only means a one-character label.
  if (problem) return { ok: false, problem };
  return { ok: true, id };
}
