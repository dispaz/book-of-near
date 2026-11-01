import type { LessonManifest, Registry } from "../app/types";
import type { Route } from "./types";

export interface QuizAnswers {
  wallet?: "never" | "few" | "often";
  sent?: "no" | "once" | "many";
  code?: "no" | "apps" | "contracts";
}

export interface QuizQuestion<K extends keyof QuizAnswers = keyof QuizAnswers> {
  key: K;
  text: string;
  hint?: string;
  options: { value: NonNullable<QuizAnswers[K]>; label: string }[];
}

export const QUIZ: QuizQuestion[] = [
  {
    key: "wallet",
    text: "Have you used a crypto wallet?",
    hint: "A wallet is an app that holds the keys to your coins, such as MetaMask or a NEAR wallet.",
    options: [
      { value: "never", label: "Never" },
      { value: "few", label: "A few times" },
      { value: "often", label: "Often" },
    ],
  },
  {
    key: "sent",
    text: "Have you sent a crypto transaction yourself?",
    hint: "A transaction is a signed request to move coins or run code on a blockchain.",
    options: [
      { value: "no", label: "No, not yet" },
      { value: "once", label: "Once or twice" },
      { value: "many", label: "Yes, many times" },
    ],
  },
  {
    key: "code",
    text: "Do you write code?",
    hint: "A smart contract is a program that lives on a blockchain.",
    options: [
      { value: "no", label: "I don't write code" },
      { value: "apps", label: "Yes, apps or websites" },
      { value: "contracts", label: "Yes, smart contracts too" },
    ],
  },
];

/** Has used a wallet and sent a transaction: stage 0 is probably review. */
export const offersTestOut = (a: QuizAnswers) =>
  !!a.wallet && a.wallet !== "never" && !!a.sent && a.sent !== "no";

export function routeFromAnswers(a: QuizAnswers): Route {
  if (a.code === "apps" || a.code === "contracts") return "developer";
  if (offersTestOut(a)) return "veteran";
  return "newcomer";
}

export interface RouteInfo {
  name: string;
  /** Why this path fits, shown on the quiz result. */
  why: string;
  /** What the path covers. */
  covers: string;
}

export const ROUTE_INFO: Record<Route, RouteInfo> = {
  newcomer: {
    name: "Newcomer",
    why: "You are new to crypto, so you start at the very beginning.",
    covers:
      "Stage 0 explains blockchains, wallets and transactions from zero. Then you meet NEAR. Stage 3, for builders, is optional.",
  },
  veteran: {
    name: "Veteran",
    why: "You have used a wallet and sent transactions, so you may know the basics already.",
    covers:
      "Take a short test to skip stage 0, or start there anyway. Stages 1, 2 and 4 cover what is different on NEAR. Stage 3, for builders, is optional.",
  },
  developer: {
    name: "Developer",
    why: "You write code, so your path includes the builder lessons.",
    covers:
      "You cover every stage, including stage 3: deploy a contract, issue a token and compare RPC nodes (the servers apps use to talk to the chain).",
  },
};

/** Stage 3 (builder) is optional unless the learner is on the developer path. */
export const isOptionalStage = (route: Route | null, stageId: number) =>
  stageId === 3 && route !== "developer";

/** Lessons a learner can open: not planned, not hidden. */
export const isOpen = (l: LessonManifest) => l.status !== "planned" && !l.hidden;

/** First lesson the learner can open, from `fromStage` onwards. */
export function startLesson(reg: Registry, fromStage: number): LessonManifest | undefined {
  for (const s of reg.stages) {
    if (s.id < fromStage) continue;
    const l = s.lessons.find(isOpen);
    if (l) return l;
  }
  return undefined;
}

/** The next lesson the learner can open after `lessonId`, in book order. */
export function nextLesson(reg: Registry, lessonId: string): LessonManifest | undefined {
  const all = reg.stages.flatMap((s) => s.lessons);
  const i = all.findIndex((l) => l.id === lessonId);
  return i < 0 ? undefined : all.slice(i + 1).find(isOpen);
}
