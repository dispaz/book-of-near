/**
 * The final exam's two routes and the gate in front of them (issue #28). Pure, no imports beyond
 * types: the Worker imports this file too.
 *
 * Gate: the exam opens for an account that holds every stage badge its route requires, read from the
 * badge contract through the Chain interface (demo contract in demo mode, testnet contract in testnet
 * mode). This is the spec's rule ("the exam and final badge unlock only when I own the required stage
 * badges"). Lesson 7.1 is recommended reading but not part of the gate.
 *
 * Why these stages: the contract only mints stage n to an account that holds stage n - 1, so a
 * route's required badges can only be a run from stage 0. Stage 3 (the builder stage) is optional off
 * the developer path, and a learner who skips it cannot hold the stage 4 badge either. So the general
 * route needs stages 0 to 2 and the developer route stages 0 to 4. The questions still cover every
 * stage on the route's path (`questionStages`), including stage 4 and the stages that have no badge yet.
 */

export type ExamRoute = "general" | "developer";

export const EXAM_ROUTES: readonly ExamRoute[] = ["general", "developer"];

export interface ExamRouteInfo {
  route: ExamRoute;
  name: string;
  /** Who the route is for, in plain words. */
  forWho: string;
  /** Stage badges the account must hold before the exam opens. The badge contract's `set_route` uses the same list. */
  requiredBadges: number[];
  /** Stages the route's questions come from. */
  questionStages: number[];
}

export const EXAM_ROUTE_INFO: Record<ExamRoute, ExamRouteInfo> = {
  general: {
    route: "general",
    name: "General route",
    forWho: "For newcomers and veterans. No questions on the builder stage (stage 3).",
    requiredBadges: [0, 1, 2],
    questionStages: [0, 1, 2, 4, 5, 6, 7],
  },
  developer: {
    route: "developer",
    name: "Developer route",
    forWho: "For developers. Includes the builder stage: contracts, tokens and RPC nodes.",
    requiredBadges: [0, 1, 2, 3, 4],
    questionStages: [0, 1, 2, 3, 4, 6, 7],
  },
};

export const isExamRoute = (v: unknown): v is ExamRoute => v === "general" || v === "developer";

/** The exam route that fits a reading path from the opening quiz. */
export const examRouteFor = (path: string | null | undefined): ExamRoute =>
  path === "developer" ? "developer" : "general";

/** Share of right answers needed to pass. */
export const PASS_SHARE = 0.8;

/** Right answers needed to pass an exam of `total` questions (12 of 15). */
export const passMark = (total: number) => Math.ceil(total * PASS_SHARE);

export interface ExamGate {
  open: boolean;
  /** Required stages the account does not hold yet, lowest first. */
  missing: number[];
}

/** [0] → "stage 0 badge", [0, 1, 2] → "stage 0, 1 and 2 badges". */
export function badgeList(stages: number[]): string {
  if (stages.length <= 1) return `stage ${stages[0] ?? ""} badge`;
  return `stage ${stages.slice(0, -1).join(", ")} and ${stages[stages.length - 1]} badges`;
}

/** Is the exam open for an account that holds `held` (stage numbers)? */
export function examGate(route: ExamRoute, held: Iterable<number>): ExamGate {
  const have = new Set(held);
  const missing = EXAM_ROUTE_INFO[route].requiredBadges.filter((s) => !have.has(s));
  return { open: missing.length === 0, missing };
}
