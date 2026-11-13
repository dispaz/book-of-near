/**
 * The final badge (issue #29): what a passed exam's receipt must say, and the rarity it earns. Pure,
 * no imports beyond pure modules: the Worker (`POST /final`) and demo mode both use it, so the two
 * can never disagree.
 *
 * Rarity comes only from facts the signer can check itself. The spec lists four inputs. Two are in
 * the signed exam receipt, so they are used:
 *   - the exam score (signed with the receipt);
 *   - the time of the pass (`passed_at_ms`, the Worker's own clock, signed with the receipt), checked
 *     against the event window.
 * Two are not used, because nothing on testnet proves them: the real swap (lesson 4.2 sends it on
 * mainnet through 1Click, and the app keeps only what the browser reports) and "the key challenge
 * without hints" (hint use is recorded in the browser only). Using them would let a learner raise
 * their own rarity.
 *
 * The rule: the score sets the tier (12 or less of 15: common, 13 or 14: rare, 15: epic), and a pass
 * inside the event window raises it one tier. So legendary is a perfect score inside the window.
 */
import { examMessage, type ExamReceipt } from "../exam/grade";
import { passMark, type ExamRoute } from "../exam/routes";
import { type Rarity } from "./message";

/**
 * The event window: the NEAR hackathon, 1 Nov 2026 00:00 UTC to the end of 14 Nov 2026 UTC. `endMs` is
 * exclusive. A pass inside it raises the rarity one tier.
 */
export const EVENT_WINDOW = { startMs: Date.UTC(2026, 10, 1), endMs: Date.UTC(2026, 10, 15) } as const;

export const inEventWindow = (ms: number) => ms >= EVENT_WINDOW.startMs && ms < EVENT_WINDOW.endMs;

/** The tier a pass earns from its score alone: 15 of 15 epic, 13 or 14 rare, else common. */
function scoreTier(score: number, total: number): number {
  const missed = total - score;
  if (missed <= 0) return 2;
  if (missed <= 2) return 1;
  return 0;
}

/** The final badge's rarity for a pass with this score at this time. */
export function rarityFor(score: number, total: number, passedAtMs: number): Rarity {
  const tiers: Rarity[] = ["common", "rare", "epic", "legendary"];
  return tiers[scoreTier(score, total) + (inEventWindow(passedAtMs) ? 1 : 0)]!;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/**
 * Check a receipt's fields (not its signature) against who is claiming. Returns the error to show, or
 * null when the receipt is a pass on this route, for this account, on this badge contract.
 */
export function receiptProblem(
  receipt: unknown,
  want: { contractId: string; accountId: string; route: ExamRoute; total: number },
): string | null {
  if (!receipt || typeof receipt !== "object") return "Send the receipt of a passed exam.";
  const r = receipt as Partial<ExamReceipt>;
  if (
    typeof r.contractId !== "string" ||
    typeof r.accountId !== "string" ||
    typeof r.route !== "string" ||
    typeof r.signature !== "string" ||
    !isNum(r.score) ||
    !isNum(r.total) ||
    !isNum(r.passedAtMs)
  )
    return "The receipt is not complete.";
  if (r.contractId !== want.contractId) return "The receipt is for another badge contract.";
  if (r.accountId !== want.accountId) return "The receipt is for another account.";
  if (r.route !== want.route) return "The receipt is for another exam route.";
  if (r.total !== want.total || r.score > r.total) return "The receipt's score does not fit this exam.";
  if (r.score < passMark(r.total)) return "The receipt is not for a passed exam.";
  return null;
}

/** The text the receipt's signature covers. */
export const receiptText = (r: ExamReceipt) =>
  examMessage(r.contractId, r.accountId, r.route, r.score, r.total, r.passedAtMs);
