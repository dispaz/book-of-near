import type { ChainMode, Registry } from "../app/types";
import type { CompletionRecord, Route } from "./types";

export interface TestOutQuestion {
  text: string;
  options: { label: string; correct?: boolean }[];
}

/** Stage 0 test-out. Questions come from the checks in docs/lessons/stage-0/0.1–0.3.md. */
export const TEST_OUT_QUESTIONS: TestOutQuestion[] = [
  {
    text: "Why does changing an old block break the chain?",
    options: [
      { label: "The block's hash changes, and the next block still stores the old hash.", correct: true },
      { label: "The network deletes any block older than one hour." },
      { label: "Old blocks are locked with a password." },
    ],
  },
  {
    text: 'A website asks you to paste your seed phrase to "verify your wallet". What should you do?',
    options: [
      { label: "Paste it; the site only reads it." },
      { label: "Close the page. Real wallets never need your seed phrase on a website.", correct: true },
      { label: "Paste only the first six words." },
    ],
  },
  {
    text: "You change one letter of a signed message. What happens when someone checks the signature?",
    options: [
      { label: "It still passes, because the public key is the same." },
      { label: "The signature updates itself." },
      { label: "Verification fails, because the signature no longer matches the message.", correct: true },
    ],
  },
  {
    text: "What does an RPC node do?",
    options: [
      { label: "It holds your private key and signs for you." },
      {
        label: "It passes your signed transaction into the network and answers questions about the chain.",
        correct: true,
      },
      { label: "It is the website where you look up transactions." },
    ],
  },
  {
    text: "Why does each transaction carry a nonce (a counter)?",
    options: [
      { label: "To pay the fee." },
      { label: "So the same signed transaction cannot be sent again to move coins twice.", correct: true },
      { label: "To hide the amount." },
    ],
  },
];

/** Right answers needed to skip stage 0. */
export const TEST_OUT_PASS = 4;

/** `picks[i]` is the chosen option index for question i (or undefined when unanswered). */
export function gradeTestOut(picks: (number | undefined)[]): { score: number; passed: boolean } {
  const score = TEST_OUT_QUESTIONS.filter((q, i) => {
    const p = picks[i];
    return p !== undefined && !!q.options[p]?.correct;
  }).length;
  return { score, passed: score >= TEST_OUT_PASS };
}

/** One tested-out completion record per stage 0 lesson in the menu, planned ones included. */
export function testOutRecords(
  reg: Registry,
  route: Route,
  mode: ChainMode,
  completedAt: string,
): CompletionRecord[] {
  const stage0 = reg.stages.find((s) => s.id === 0);
  return (stage0?.lessons ?? [])
    .filter((l) => !l.hidden)
    .map((l) => ({ lessonId: l.id, stage: 0, route, mode, completedAt, testedOut: true }));
}
