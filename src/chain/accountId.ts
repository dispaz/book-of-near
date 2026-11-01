/**
 * NEAR account id rules, from https://docs.near.org/protocol/account-id :
 * - 2 to 64 characters;
 * - lowercase letters a-z, digits 0-9 and the separators `-`, `_` and `.`;
 * - a separator must sit between two letters or digits (no leading, trailing or doubled separators);
 * - `.` splits the id into parts; `alice.near` is a sub-account of `near`.
 * Implicit accounts are 64 lowercase hex characters (the ed25519 public key in hex).
 * Ethereum-style implicit accounts are `0x` plus 40 lowercase hex characters.
 */

const ACCOUNT_ID = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const IMPLICIT = /^[0-9a-f]{64}$/;
const ETH_IMPLICIT = /^0x[0-9a-f]{40}$/;

export function isValidAccountId(id: string): boolean {
  return id.length >= 2 && id.length <= 64 && ACCOUNT_ID.test(id);
}

/**
 * Plain-English reason why `id` is not a valid account id, or null when it is valid.
 * Meant for live feedback while the learner types.
 */
export function accountIdProblem(id: string): string | null {
  if (id.length < 2) return "Too short: an account name needs at least 2 characters.";
  if (id.length > 64) return "Too long: an account name can have at most 64 characters.";
  if (/[A-Z]/.test(id)) return "Use lowercase letters only.";
  if (/[^a-z\d\-_.]/.test(id)) return "Use only letters, digits, and the marks - _ and .";
  if (!ACCOUNT_ID.test(id)) return "A mark (- _ .) must sit between two letters or digits.";
  return null;
}

/** 64 hex characters: an account named after its own public key. */
export function isImplicitAccountId(id: string): boolean {
  return IMPLICIT.test(id);
}

export function isEthImplicitAccountId(id: string): boolean {
  return ETH_IMPLICIT.test(id);
}

/** True when `child` is a direct sub-account of `parent`: `a.b.testnet` of `b.testnet`. */
export function isDirectSubAccount(child: string, parent: string): boolean {
  return child.endsWith(`.${parent}`) && !child.slice(0, -parent.length - 1).includes(".");
}

/** The parent of a named account (`b.testnet` for `a.b.testnet`), or null for a top-level id. */
export function parentAccountId(id: string): string | null {
  const i = id.indexOf(".");
  return i < 0 ? null : id.slice(i + 1);
}
