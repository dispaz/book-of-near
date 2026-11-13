/**
 * POST /exam: grades the final exam (issue #28). The answer key lives here and in the demo grader's
 * lazy chunk only, never in the app's main bundle.
 *
 * Checks first that the account holds every stage badge its exam route requires, by reading the badge
 * contract on testnet (`has_badge`), then grades, then signs a receipt for a pass:
 * `bon-exam-v1|<contract>|<account>|<route>|<score>|<total>|<passed_at_ms>` with the claim key. The
 * final badge (#29) checks that receipt before it signs a final claim. The client never chooses the
 * time, the score or the route's stages.
 */
import { ANSWER_KEY } from "../../src/exam/answerKey";
import { questionsFor } from "../../src/exam/bank";
import { examMessage, gradeExam, validPicks } from "../../src/exam/grade";
import { badgeList, EXAM_ROUTE_INFO, examGate, isExamRoute } from "../../src/exam/routes";
import { signText, type Reply } from "./claim";

/** An exam body is an account, a route and 15 small numbers. */
export const MAX_EXAM_BODY_BYTES = 2 * 1024;

export interface BadgeReader {
  /** The account holds the stage badge on the badge contract. Throws when testnet cannot be read. */
  hasBadge(accountId: string, stage: number): Promise<boolean>;
}

export interface ExamDeps {
  contractId: string;
  signingKey: string;
  badges: BadgeReader;
  now: Date;
}

const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const isAccount = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 2 && v.length <= 64 && ACCOUNT.test(v);

export async function exam(input: unknown, deps: ExamDeps): Promise<Reply> {
  const bad = (error: string): Reply => ({ status: 400, body: { error } });
  if (!input || typeof input !== "object") return bad("Send JSON with accountId, route and answers.");
  const { accountId, route, answers } = input as { accountId?: unknown; route?: unknown; answers?: unknown };
  if (!isAccount(accountId)) return bad("That is not a NEAR account id.");
  if (!isExamRoute(route)) return bad("Unknown exam route.");
  const questions = questionsFor(route);
  if (!validPicks(questions, answers))
    return bad(`Send one answer (or null) for each of the ${questions.length} questions.`);

  const stages = EXAM_ROUTE_INFO[route].requiredBadges;
  let held: number[];
  try {
    const has = await Promise.all(stages.map((s) => deps.badges.hasBadge(accountId, s)));
    held = stages.filter((_, i) => has[i]);
  } catch {
    return { status: 502, body: { error: "Testnet could not be reached. Try again in a minute." } };
  }
  const gate = examGate(route, held);
  if (!gate.open)
    return {
      status: 403,
      body: { error: `Claim the ${badgeList(gate.missing)} first.`, missing: gate.missing },
    };

  const graded = gradeExam(questions, ANSWER_KEY, answers);
  if (!graded.passed) return { status: 200, body: graded };
  const passedAtMs = deps.now.getTime();
  const signature = await signText(
    deps.signingKey,
    examMessage(deps.contractId, accountId, route, graded.score, graded.total, passedAtMs),
  );
  return {
    status: 200,
    body: {
      ...graded,
      receipt: {
        contractId: deps.contractId,
        accountId,
        route,
        score: graded.score,
        total: graded.total,
        passedAtMs,
        signature,
      },
    },
  };
}

/** `has_badge` on the badge contract through testnet RPC, regular node first, then the fallbacks. */
export function rpcBadges(
  contractId: string,
  urls = [
    "https://rpc.testnet.fastnear.com",
    "https://test.rpc.fastnear.com",
    "https://rpc.testnet.near.org",
  ],
  fetchFn: typeof fetch = fetch,
): BadgeReader {
  return {
    async hasBadge(accountId, stage) {
      const args = btoa(JSON.stringify({ account_id: accountId, stage }));
      let lastError: unknown = new Error("no rpc");
      for (const url of urls) {
        try {
          const res = await fetchFn(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "exam",
              method: "query",
              params: {
                request_type: "call_function",
                finality: "final",
                account_id: contractId,
                method_name: "has_badge",
                args_base64: args,
              },
            }),
          });
          const json = (await res.json()) as { result?: { result?: number[] }; error?: unknown };
          if (!json.result?.result) throw new Error("rpc");
          return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result))) === true;
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError;
    },
  };
}
