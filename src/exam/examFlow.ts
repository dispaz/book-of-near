/**
 * The final exam, from the gate to a graded result (issue #28).
 *
 * Gate: every stage badge the route requires, read from the badge contract through the Chain
 * interface (`hasBadge`). Demo mode reads the demo contract in this browser; testnet mode the testnet
 * contract.
 *
 * Grading: testnet mode sends the answers to the Worker (`POST /exam`), which checks the badges on
 * testnet itself, grades with the answer key and signs a receipt for a pass. A testnet page does not
 * download the key before grading. Demo mode has no network by rule, so it loads the key as a separate
 * chunk (`import()`), only at the moment it grades, and signs the receipt with the public demo claim
 * key. A demo receipt is worth nothing on testnet: no Worker or contract trusts the demo key.
 *
 * The key is not a secret (it is in the public repo, and every graded attempt returns the answers and
 * explanations). A testnet receipt is worth something because the Worker signs it after re-reading the
 * badges, and because the final badge checks that signature, not because the key is hidden.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { DEMO_CLAIM_SEED } from "../chain/demo/badges";
import type { Chain } from "../chain/types";
import { questionsFor } from "./bank";
import { EXAM_TIMEOUT_MS, examMessage, gradeExam, type ExamReceipt, type Graded, type Picks } from "./grade";
import { badgeList, EXAM_ROUTE_INFO, examGate, type ExamGate, type ExamRoute } from "./routes";

export interface GateView extends ExamGate {
  accountId: string;
}

/** Which required badges the practice account holds, and so whether the exam is open. */
export async function readExamGate(chain: Chain, route: ExamRoute): Promise<GateView> {
  const accountId = (await chain.practiceAccount()).accountId;
  const stages = EXAM_ROUTE_INFO[route].requiredBadges;
  const held = await Promise.all(stages.map((s) => chain.hasBadge(accountId, s)));
  return {
    accountId,
    ...examGate(
      route,
      stages.filter((_, i) => held[i]),
    ),
  };
}

export type ExamOutcome = ({ ok: true; receipt?: ExamReceipt } & Graded) | { ok: false; error: string };

export interface ExamDeps {
  /** The Worker that grades testnet exams (VITE_WORKER_URL). */
  workerUrl?: string;
  fetch?: typeof fetch;
}

export async function submitExam(
  chain: Chain,
  route: ExamRoute,
  picks: Picks,
  deps: ExamDeps = {},
): Promise<ExamOutcome> {
  const gate = await readExamGate(chain, route);
  if (!gate.open) return { ok: false, error: `Claim the ${badgeList(gate.missing)} first.` };
  return chain.network === "testnet"
    ? workerGrade(gate.accountId, route, picks, deps)
    : demoGrade(chain, gate.accountId, route, picks);
}

async function demoGrade(
  chain: Chain,
  accountId: string,
  route: ExamRoute,
  picks: Picks,
): Promise<ExamOutcome> {
  const { ANSWER_KEY } = await import("./answerKey");
  const graded = gradeExam(questionsFor(route), ANSWER_KEY, picks);
  if (!graded.passed) return { ok: true, ...graded };
  const contractId = await chain.badgeContractId();
  const passedAtMs = (await chain.block("final")).timestampMs;
  const text = examMessage(contractId, accountId, route, graded.score, graded.total, passedAtMs);
  const signature = base64.encode(ed25519.sign(utf8ToBytes(text), DEMO_CLAIM_SEED));
  return {
    ok: true,
    ...graded,
    receipt: {
      contractId,
      accountId,
      route,
      score: graded.score,
      total: graded.total,
      passedAtMs,
      signature,
    },
  };
}

async function workerGrade(
  accountId: string,
  route: ExamRoute,
  picks: Picks,
  deps: ExamDeps,
): Promise<ExamOutcome> {
  if (!deps.workerUrl)
    return {
      ok: false,
      error: "Testnet exams are graded by the app's server, which is not set up here. Demo mode works.",
    };
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(`${deps.workerUrl.replace(/\/$/, "")}/exam`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, route, answers: picks }),
      signal: AbortSignal.timeout(EXAM_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: "The app's server could not be reached. Try again in a minute." };
  }
  const body = (await res.json().catch(() => ({}))) as Partial<Graded> & {
    error?: string;
    receipt?: ExamReceipt;
  };
  if (!res.ok || typeof body.score !== "number" || !Array.isArray(body.results))
    return { ok: false, error: body.error ?? "The app's server did not grade the exam. Try again later." };
  return { ok: true, ...(body as Graded), receipt: body.receipt };
}
