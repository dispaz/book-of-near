/**
 * Lesson 5.2's pure logic, shared by both views: what each scene object does when picked at a step (its
 * step action, a "not yet" hint or a detail; docs/lessons/stage-5/5.2.md "Reactions") and the
 * one-sentence description for screen readers. No React, no three.js.
 */
import { AGENT_CONTRACT, AGENT_PATH } from "./agentContract";
import { ATTACK, BOOT, HOOK, REGISTER, RUN } from "./steps";

export type Run =
  { status: "idle" } | { status: "running" } | { status: "done"; address: string; payload: string };

/** The state the reactions and the description read. */
export interface LessonState {
  step: number;
  /** The bot's .env file is open (step 1). */
  envOpen: boolean;
  /** The agent has started and made its key (step 2). */
  agent: { accountId: string } | null;
  /** The agent contract accepted the agent (step 3). */
  registered: boolean;
  /** The contract's answer to the developer's own request_signature (step 4). */
  devRefused: string | null;
  /** The changed copy's registration was refused (step 4). */
  copyRefused: boolean;
  /** The agent's signing request (step 5). */
  run: Run;
}

/** Scene objects the learner can pick. */
export const OBJECTS = ["laptop", "key", "enclave", "contract", "signer", "eth"] as const;
export type Obj = (typeof OBJECTS)[number];

export const PICK_LABELS: Record<Obj, string> = {
  laptop: "The developer's laptop",
  key: "The developer's key",
  enclave: "The agent's enclave",
  contract: "The agent contract",
  signer: "The signing network",
  eth: "The contract's Ethereum address",
};

export type Act = "openEnv" | "boot" | "register" | "devSign" | "copy" | "run";
/** One object's reaction: its step action, a "not yet" hint, or a detail. */
export type Reaction = { act?: Act; hint?: string; detail?: string };

export const short = (s: string, n = 8) => (s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
/** "0x1234…345678": an Ethereum address, shortened. */
export const shortAddress = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const attackDone = (s: LessonState) => !!s.devRefused && s.copyRefused;

export function reactionsFor(s: LessonState): Record<Obj, Reaction> {
  return {
    laptop: laptop(s),
    key: key(s),
    enclave: enclave(s),
    contract: contract(s),
    signer: signer(s),
    eth: eth(s),
  };
}

function laptop(s: LessonState): Reaction {
  if (s.envOpen)
    return {
      detail:
        "The bot's key, in plain text in .env. Anyone who reads the file can sign as the bot, and the developer can read it.",
    };
  if (s.step === HOOK) return { act: "openEnv" };
  return { detail: "The developer's laptop: where they wrote the agent's code." };
}

function key(s: LessonState): Reaction {
  if (s.devRefused)
    return {
      detail: `Refused: "${s.devRefused}". The developer's own account never registered, so the agent contract will not ask for a signature.`,
    };
  if (s.step === ATTACK) return { act: "devSign" };
  if (s.step < ATTACK) return { hint: "Not yet: the developer tries this key on step 4." };
  return { act: "devSign" };
}

function enclave(s: LessonState): Reaction {
  if (s.step === ATTACK && s.agent && !s.copyRefused) return { act: "copy" };
  if (s.agent)
    return {
      detail: `The agent's account ${short(s.agent.accountId)}: an implicit account made from a key the agent made inside the enclave. The private key never leaves it.${
        s.copyRefused ? " A changed copy of the code was refused: its measurements are not approved." : ""
      }`,
    };
  if (s.step < BOOT) return { hint: "Not yet: the agent starts on step 2." };
  return { act: "boot" };
}

function contract(s: LessonState): Reaction {
  if (s.registered)
    return {
      detail: `${AGENT_CONTRACT} registered the agent: genuine quote, approved measurements, approved PPID, and report data that holds the agent's own account.`,
    };
  if (!s.agent) return { hint: "Start the agent first (step 2)." };
  if (s.step < REGISTER) return { hint: "Not yet: the agent registers on step 3." };
  return { act: "register" };
}

function signer(s: LessonState): Reaction {
  if (s.run.status === "done")
    return {
      detail: `sign called by ${AGENT_CONTRACT}, path ${AGENT_PATH}, 1 yoctoNEAR attached. The signing network only sees the contract as the caller.`,
    };
  if (s.run.status === "running") return { detail: "The agent is asking for a signature…" };
  if (s.step < RUN || !s.registered || !attackDone(s))
    return { hint: "Not yet: the agent asks for a signature on step 5." };
  return { act: "run" };
}

function eth(s: LessonState): Reaction {
  if (s.run.status === "done")
    return {
      detail: `${shortAddress(s.run.address)}: derived from ${AGENT_CONTRACT} and the path ${AGENT_PATH}, not from the agent's key. It stays the same when the agent restarts.`,
    };
  if (s.run.status === "running") return { detail: "Deriving the contract's address…" };
  if (s.step < RUN || !s.registered || !attackDone(s))
    return { hint: "Not yet: the address is used on step 5." };
  return { act: "run" };
}

/** What the figure shows, in one sentence (the 2D group's label and the 3D description). */
export function describe(s: LessonState): string {
  switch (s.step) {
    case HOOK:
      return s.envOpen
        ? "The developer's laptop shows the bot's .env file with its key in plain text."
        : "A developer's laptop on the left, with the bot's key in a file. On the right, a sealed enclave, the agent contract and the signing network.";
    case BOOT:
      return s.agent
        ? "The agent runs inside the enclave and has made its own key and account."
        : "The enclave waits for the agent to start.";
    case REGISTER:
      return s.registered
        ? "The agent contract has checked the agent's quote and registered it."
        : "The agent hands its quote to the agent contract.";
    case ATTACK:
      return attackDone(s)
        ? "Both of the developer's attempts were refused by the agent contract."
        : "The developer's key faces the agent contract.";
    case RUN:
      return s.run.status === "done"
        ? "The agent contract asked the signing network for a signature for its own Ethereum address."
        : "The agent is ready to ask its contract for a signature.";
    default:
      return "The book is open at the agent page.";
  }
}
