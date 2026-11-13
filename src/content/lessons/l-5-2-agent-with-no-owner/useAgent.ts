/**
 * The ONE state of lesson 5.2, shared by the 2D and the 3D view: the bot's .env file, the agent (its key
 * made in the browser, standing in for the enclave), the model of the agent contract (agentContract.ts),
 * the developer's two refused attempts, and the agent's signing request. The contract's Ethereum address
 * is real derivation math from the signing network's root key, read through the Chain interface
 * (DemoChain's demo signer in demo mode). Nothing is sent. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { deriveEvmAccount, prepareEvmTransfer, rootPublicKey } from "../../../chain/chainSignatures";
import { reactionsFor, type LessonState, type Obj, type Reaction, type Run } from "./agent";
import {
  AGENT_CONTRACT,
  AGENT_PATH,
  bootAgent,
  CHANGED_MEASUREMENTS,
  DEVELOPER,
  newAgentContract,
  quoteFor,
  registerAgent,
  requestSignature,
  type Agent,
  type AgentContract,
  type RegCheck,
  type SignCall,
} from "./agentContract";
import { ATTACK, BOOT, REGISTER, RUN } from "./steps";

export * from "./steps";

export type AgentLesson = ReturnType<typeof useAgent>;

/** The request "travels" this long before the answer shows, so the parcel is seen moving. */
const RUN_MS = 900;

export function useAgent({
  step,
  setGate,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "reportEvidence" | "reducedMotion">) {
  const chain = useChain();
  const [envOpen, setEnvOpen] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contract, setContract] = useState<AgentContract>(newAgentContract);
  const [regChecks, setRegChecks] = useState<RegCheck[] | null>(null);
  const [devRefused, setDevRefused] = useState<string | null>(null);
  const [copy, setCopy] = useState<{ error: string; checks: RegCheck[] } | null>(null);
  const [run, setRun] = useState<Run>({ status: "idle" });
  const [call, setCall] = useState<SignCall | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ what: Obj; reaction: Reaction; n: number } | null>(null);
  const [passed, setPassed] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const registered = !!agent && !!contract.agents[agent.accountId];
  const copyRefused = !!copy;
  const attackDone = !!devRefused && copyRefused;

  const openEnv = () => setEnvOpen(true);
  const boot = () => {
    if (!agent) setAgent(bootAgent());
  };
  const register = () => {
    if (!agent || registered) return;
    const r = registerAgent(contract, agent.accountId, quoteFor(agent.accountId), Date.now());
    setRegChecks(r.checks);
    setContract(r.contract);
  };
  /** The developer calls request_signature from their own account. */
  const devSign = () => {
    if (devRefused) return;
    const r = requestSignature(contract, DEVELOPER, Date.now(), {
      path: AGENT_PATH,
      payload: "00".repeat(32),
    });
    setDevRefused(r.ok ? "accepted" : r.error);
  };
  /** A changed copy of the agent, in a TEE, tries to register. */
  const tryCopy = () => {
    if (copy) return;
    const c = bootAgent();
    const r = registerAgent(contract, c.accountId, quoteFor(c.accountId, CHANGED_MEASUREMENTS), Date.now());
    setCopy({ error: r.ok ? "accepted" : r.error, checks: r.checks });
  };

  /** Step 5: derive the contract's address, hash a transaction from it, ask the contract to sign. */
  const runAgent = async () => {
    if (!agent || !registered || run.status !== "idle") return;
    setProblem(null);
    setRun({ status: "running" });
    try {
      const root = await rootPublicKey(chain);
      const account = deriveEvmAccount(root, AGENT_CONTRACT, AGENT_PATH);
      const payload = prepareEvmTransfer({ from: account.address }).payload.slice(2);
      const r = requestSignature(contract, agent.accountId, Date.now(), { path: AGENT_PATH, payload });
      if (!reducedMotion) await new Promise((res) => setTimeout(res, RUN_MS));
      if (!live.current) return;
      if (!r.ok) {
        setProblem(r.error);
        setRun({ status: "idle" });
        return;
      }
      setCall(r.call);
      setRun({ status: "done", address: account.address, payload });
    } catch {
      if (!live.current) return;
      setProblem("The app could not read the signing network's public key just now. Try again.");
      setRun({ status: "idle" });
    }
  };

  // Opened at a later step (a link, a reload): do the free, offline steps so the page is not empty.
  useEffect(() => {
    if (step > 0 && !envOpen) setEnvOpen(true);
    if (step > BOOT && !agent) setAgent(bootAgent());
    if (step > REGISTER && agent && !registered) register();
    if (step > ATTACK && registered && !devRefused) devSign();
    if (step > ATTACK && registered && !copy) tryCopy();
    if (step > RUN && registered && attackDone && run.status === "idle") void runAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, envOpen, agent, registered, devRefused, copy, run.status]);

  // Gates.
  useEffect(() => {
    if (step === 0) setGate(envOpen);
    if (step === BOOT) setGate(!!agent);
    if (step === REGISTER) setGate(registered);
    if (step === ATTACK) setGate(attackDone);
    if (step === RUN) setGate(run.status === "done");
  }, [step, envOpen, agent, registered, attackDone, run.status, setGate]);

  // The completion record.
  useEffect(() => {
    if (run.status !== "done" || !agent) return;
    reportEvidence?.({
      agentContract: AGENT_CONTRACT,
      agentAccount: agent.accountId,
      derivedAddress: run.address,
      developerRefused: devRefused ?? "",
      copyRefused: String(copyRefused),
      contractModel: "reference agent contract (in browser)",
      signer: chain.network === "testnet" ? "v1.signer-prod.testnet" : "demo signer",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.status]);

  const lessonState: LessonState = { step, envOpen, agent, registered, devRefused, copyRefused, run };
  const reactions = reactionsFor(lessonState);

  // Picks read the latest state: during a page turn the old page's objects can still be picked.
  const latest = useRef(reactions);
  useLayoutEffect(() => {
    latest.current = reactions;
  });

  /** Runs the object's step action, if it has one now. */
  const act = (what: Obj) => {
    const r = latest.current[what];
    if (r.act === "openEnv") openEnv();
    if (r.act === "boot") boot();
    if (r.act === "register") register();
    if (r.act === "devSign") devSign();
    if (r.act === "copy") tryCopy();
    if (r.act === "run") void runAgent();
  };
  /** A pick in the 2D view: the action, or the hint or detail as a note (the 3D kit shows its own). */
  const pick = (what: Obj) => {
    const reaction = latest.current[what];
    setPicked((p) => ({ what, reaction, n: (p?.n ?? 0) + 1 }));
    act(what);
  };

  const state = [
    `env:${envOpen ? "open" : "closed"}`,
    `agent:${agent ? "running" : "none"}`,
    `registered:${registered ? "yes" : "no"}`,
    `dev:${devRefused ? "refused" : "none"}`,
    `copy:${copyRefused ? "refused" : "none"}`,
    `run:${run.status}`,
  ].join(";");

  return {
    ...lessonState,
    network: chain.network,
    regChecks,
    copy,
    call,
    problem,
    attackDone,
    openEnv,
    boot,
    register,
    devSign,
    tryCopy,
    runAgent,
    reactions,
    act,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
