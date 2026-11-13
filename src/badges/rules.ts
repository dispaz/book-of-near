/**
 * What a stage badge needs: the required lessons of each stage and the evidence the Worker (testnet)
 * or the demo signer checks. THE one place these are listed. Only lessons that exist count: a planned
 * lesson is never required (`rules.test.ts` keeps this list equal to the lessons a learner can open).
 *
 * Pure, no imports: the Worker imports this file too.
 */

/** The part of a completion record (src/progress/types.ts) the rules read. */
export interface EvidenceRecord {
  lessonId: string;
  mode: string;
  evidence?: Record<string, string>;
}

export interface EvidenceRule {
  lessonId: string;
  /** Keys the lesson's completion record must carry (transaction hashes and the like). */
  keys: string[];
  /** What the learner does to make the evidence, in plain words. */
  todo: string;
}

export interface StageRule {
  stage: number;
  /** Every lesson the stage needs finished (or tested out of). */
  lessons: string[];
  evidence: EvidenceRule[];
}

export const STAGE_RULES: StageRule[] = [
  {
    stage: 0,
    lessons: ["l-0-1-blockchain-basics", "l-0-2-make-a-wallet", "l-0-3-send-a-transaction"],
    evidence: [
      {
        lessonId: "l-0-3-send-a-transaction",
        keys: ["txHash"],
        todo: "Send your first transaction in lesson 0.3.",
      },
    ],
  },
  {
    stage: 1,
    lessons: ["l-1-1-claim-your-name", "l-1-2-function-call-key", "l-1-3-inside-a-transaction"],
    evidence: [
      {
        lessonId: "l-1-1-claim-your-name",
        keys: ["txHash", "accountId"],
        todo: "Claim your name in lesson 1.1.",
      },
      {
        lessonId: "l-1-2-function-call-key",
        keys: ["addKeyTxHash", "txHash"],
        todo: "Add the one-job key and delete it in lesson 1.2.",
      },
    ],
  },
  {
    stage: 2,
    lessons: ["l-2-1-follow-across-shards", "l-2-2-call-across-blocks"],
    evidence: [
      {
        lessonId: "l-2-1-follow-across-shards",
        keys: ["txHash"],
        todo: "Follow your own transaction across the shards in lesson 2.1.",
      },
    ],
  },
  {
    stage: 3,
    lessons: ["l-3-1-deploy-a-contract", "l-3-2-issue-a-token", "l-3-3-race-the-rpc"],
    evidence: [
      {
        lessonId: "l-3-1-deploy-a-contract",
        keys: ["txHash", "contractId"],
        todo: "Deploy the counter contract in lesson 3.1.",
      },
    ],
  },
  {
    stage: 4,
    lessons: ["l-4-1-one-account-every-chain", "l-4-2-intent-swap", "l-4-3-old-bridge-vs-near"],
    evidence: [
      {
        lessonId: "l-4-1-one-account-every-chain",
        keys: ["mpcTxHash"],
        todo: "Get a chain signature and check it in lesson 4.1.",
      },
    ],
  },
  {
    // Stage 5 sends nothing on chain: 5.1 checks an attestation quote in the browser and 5.2 runs a model
    // of an agent contract. So there is no transaction to prove, and the Worker signs a stage 5 claim
    // without a lookup. The badge contract still refuses it until the stage 4 badge is held, and stage 4
    // needs a real chain signature on testnet (4.1).
    stage: 5,
    lessons: ["l-5-1-private-ai", "l-5-2-agent-with-no-owner"],
    evidence: [],
  },
  {
    // Nothing in stage 6 happens on chain: 6.1's vote is a practice vote (kind "practice") and 6.2 reads
    // recorded data (kind "recorded"). The evidence shows the learner did the step; the contract's stage
    // order (stage 5 first, back to 4.1's chain signature) is what ties the badge to on-chain work.
    stage: 6,
    lessons: ["l-6-1-vote-on-a-proposal", "l-6-2-live-money-map"],
    evidence: [
      {
        lessonId: "l-6-1-vote-on-a-proposal",
        keys: ["voteCast"],
        todo: "Cast your practice vote in lesson 6.1.",
      },
      {
        lessonId: "l-6-2-live-money-map",
        keys: ["pair"],
        todo: "Trade 100,000 USDC in the two pools in lesson 6.2.",
      },
    ],
  },
  {
    // Stage 7 is a look back, and it sends nothing on testnet. 7.1's `txHash` is the learner's 4.2 swap
    // (NEAR Intents on mainnet), a demo-wallet hash, or the recorded replay id: never a testnet
    // transaction the Worker could look up, so it is not asked for. The keys show the trace was settled
    // (7.1) and the scoreboard read (7.2); the contract's stage order (stage 6 first, back to 4.1's
    // chain signature) is what ties the badge to on-chain work.
    stage: 7,
    lessons: ["l-7-1-trace-an-intent", "l-7-2-honest-scoreboard"],
    evidence: [
      {
        lessonId: "l-7-1-trace-an-intent",
        keys: ["capstoneComplete"],
        todo: "Trace the intent to its settlement in lesson 7.1.",
      },
      {
        lessonId: "l-7-2-honest-scoreboard",
        keys: ["scoreboardReviewed"],
        todo: "Open all four scoreboard cards in lesson 7.2.",
      },
    ],
  },
];

/**
 * How many badges a learner can claim today: the stages with a rule. My book and the checker show
 * "N of this" (not of every badge drawn); the demo contract's stage count matches it (rules.test.ts).
 */
export const CLAIMABLE_BADGES = STAGE_RULES.length;

export const ruleFor = (stage: number): StageRule | undefined => STAGE_RULES.find((r) => r.stage === stage);

export type MissingReason = "not-finished" | "no-evidence" | "demo-only";

export interface Missing {
  lessonId: string;
  reason: MissingReason;
  /** Plain-English reason, shown under the claim button. */
  text: string;
}

export interface Readiness {
  ready: boolean;
  missing: Missing[];
}

/** "l-0-3-send-a-transaction" → "0.3". */
export const lessonNumber = (lessonId: string) => {
  const m = /^l-(\d+)-(\d+)-/.exec(lessonId);
  return m ? `${m[1]}.${m[2]}` : lessonId;
};

/**
 * Can the learner claim `stage` in `mode`? A testnet claim needs testnet evidence: a stage done only
 * in demo mode proved nothing on chain.
 */
export function claimReadiness(
  stage: number,
  completions: EvidenceRecord[],
  mode: "demo" | "testnet",
): Readiness {
  const rule = ruleFor(stage);
  if (!rule) return { ready: false, missing: [] };
  const byId = new Map(completions.map((c) => [c.lessonId, c]));
  const missing: Missing[] = [];
  for (const id of rule.lessons) {
    if (!byId.has(id))
      missing.push({ lessonId: id, reason: "not-finished", text: `Finish lesson ${lessonNumber(id)}.` });
  }
  for (const ev of rule.evidence) {
    const rec = byId.get(ev.lessonId);
    if (!rec) continue;
    if (!ev.keys.every((k) => !!rec.evidence?.[k])) {
      missing.push({ lessonId: ev.lessonId, reason: "no-evidence", text: ev.todo });
    } else if (mode === "testnet" && rec.mode !== "testnet") {
      missing.push({
        lessonId: ev.lessonId,
        reason: "demo-only",
        text: `You did lesson ${lessonNumber(ev.lessonId)} in demo mode, which makes nothing on testnet. Do it again in testnet mode to claim a testnet badge.`,
      });
    }
  }
  return { ready: missing.length === 0, missing };
}
