/**
 * The ONE state of lesson 3.3, shared by the 2D and the 3D view. Every request goes through
 * useChain().probeRpc: DemoChain answers after recorded round trips, TestnetChain times real requests.
 * The outage is simulated here, in the browser. No three.js here, so 2D never loads 3D code.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { HISTORICAL_BLOCK, type RpcEndpointId } from "../../../chain/rpcEndpoints";
import type { BlockRef, RpcProbe } from "../../../chain/types";
import {
  BLOCKABLE,
  failover as runFailover,
  historical as runHistorical,
  hostOf,
  ms,
  nameOf,
  race as runRace,
  RACE_IDS,
  varsFor,
  type Attempt,
  type Failover,
  type Historical,
  type Race,
} from "./race";
import { ARCHIVE, FAILOVER, HOOK, OUTAGE, RACE } from "./steps";

export * from "./steps";

export type RaceState = ReturnType<typeof useRace>;
type Busy = null | "race" | "failover" | "history";

export function useRace({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const chain = useChain();
  const network = chain.network;
  /** Answers as they land during the race (the bars grow one by one). */
  const [answers, setAnswers] = useState<Partial<Record<RpcEndpointId, RpcProbe>>>({});
  const [raced, setRaced] = useState<Race | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [fo, setFo] = useState<Failover | null>(null);
  const [hist, setHist] = useState<Historical | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<RpcEndpointId | "mailbox" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);

  // Requests still in flight when the lesson closes are aborted: nobody is left to read the answers.
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    abort.current = ctl;
    return () => ctl.abort();
  }, []);

  const pace = reducedMotion ? "instant" : "realtime";
  const probeWith =
    (instant: boolean) =>
    (id: RpcEndpointId, ref?: BlockRef): Promise<RpcProbe> =>
      chain.probeRpc(id, ref, { pace: instant ? "instant" : pace, signal: abort.current?.signal });

  const busyRef = useRef<Busy>(null);
  const guard = async (what: Exclude<Busy, null>, work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = what;
    setBusy(what);
    setError(null);
    setHint(null);
    try {
      await work();
    } catch {
      if (abort.current?.signal.aborted) return;
      setError("The request did not go through. Please try again in a moment.");
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  };

  const race = (instant = false) =>
    void guard("race", async () => {
      setAnswers({});
      setRaced(null);
      const r = await runRace(probeWith(instant), (p) => setAnswers((a) => ({ ...a, [p.endpointId]: p })));
      setRaced(r);
    });

  const failover = (instant = false) =>
    void guard("failover", async () => {
      setAttempts([]);
      setFo(null);
      const f = await runFailover(probeWith(instant), [BLOCKABLE], (a) => setAttempts((l) => [...l, a]));
      setFo(f);
    });

  const queryHistory = (instant = false) =>
    void guard("history", async () => {
      setHist(await runHistorical(probeWith(instant)));
    });

  const toggleBlock = () => {
    setHint(null);
    setBlocked((b) => !b);
  };

  // A link to a later step (or a reload) finds nothing done: run what the earlier steps did, at once.
  useEffect(() => {
    if (busy || error) return;
    if (step > RACE && !raced) race(true);
    else if (step > OUTAGE && !blocked) setBlocked(true);
    else if (step > FAILOVER && blocked && !fo) failover(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, raced, blocked, fo, busy, error]);

  // A new step clears the last pick.
  useEffect(() => {
    setPicked(null);
    setHint(null);
  }, [step]);

  // The learner's own numbers in later text; the completion record keeps the race and the failover.
  useEffect(() => {
    if (!raced) return;
    setVars?.(varsFor(raced, fo));
    const ev: Record<string, string> = {};
    if (raced.winner) {
      ev.fastestRpc = nameOf(raced.winner.endpointId);
      ev.latencyMs = String(raced.winner.latencyMs);
    }
    if (fo?.answeredBy) {
      ev.failoverRpc = nameOf(fo.answeredBy);
      ev.failoverMs = String(fo.totalMs);
    }
    ev.source = network === "demo" ? "recorded" : "live";
    reportEvidence?.(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raced, fo]);

  const failoverDone = !!fo?.answeredBy;
  useEffect(() => {
    if (step === RACE) setGate(!!raced?.winner);
    if (step === OUTAGE) setGate(blocked);
    if (step === FAILOVER) setGate(failoverDone);
    if (step === ARCHIVE) setGate(!!hist);
  }, [step, raced, blocked, failoverDone, hist, setGate]);

  // Picks read the latest state, not the render they were made in.
  const now = useRef({ step, raced, blocked, fo, hist });
  useLayoutEffect(() => {
    now.current = { step, raced, blocked, fo, hist };
  });

  /** FastNEAR is off only while the outage and failover steps run; it is back for the archive test. */
  const down = blocked && (step === OUTAGE || step === FAILOVER);

  const detailOf = (id: RpcEndpointId): string => {
    const n = now.current;
    const host = hostOf(id);
    if (n.step === ARCHIVE && n.hist && (id === "archival" || id === "fastnear")) {
      const p = id === "archival" ? n.hist.archival : n.hist.regular;
      return p.ok
        ? `${nameOf(id)} (${host}): block #${p.blockHeight.toLocaleString("en-US")} found, made ${new Date(p.blockTimestampMs).toISOString().slice(0, 10)}, in ${ms(p.latencyMs)} ms.`
        : `${nameOf(id)} (${host}): no block #${HISTORICAL_BLOCK.height.toLocaleString("en-US")}. ${p.message}`;
    }
    if (n.step === FAILOVER && n.fo) {
      const a = n.fo.attempts.find((x) => x.endpointId === id);
      if (a)
        return `${nameOf(id)} (${host}): ${a.ok ? `answered in ${ms(a.latencyMs)} ms with block ${a.message.replace("Block ", "")}` : a.message}.`;
      return `${nameOf(id)} (${host}): not asked. The client stops at the first good answer.`;
    }
    const p = n.raced?.results.find((x) => x.endpointId === id);
    if (p)
      return `${nameOf(id)} (${host}): ${p.ok ? `${ms(p.latencyMs)} ms round trip in the race.` : p.message}`;
    return `${nameOf(id)}: ${host}.`;
  };

  /** Picking a counter window: does the step's action when it has not run, else shows that node. */
  const pickWindow = (id: RpcEndpointId) => {
    const n = now.current;
    setPicked(id);
    if (n.step === HOOK) {
      setHint(`${nameOf(id)}: ${hostOf(id)}. Not yet: race the nodes at the next step.`);
      return;
    }
    if (n.step === RACE && !n.raced?.winner) return race();
    if (n.step === OUTAGE) {
      if (id === BLOCKABLE) return toggleBlock();
      setHint(`${detailOf(id)} Switch FastNEAR off: it is first in your app's list.`);
      return;
    }
    if (n.step === FAILOVER && !n.fo?.answeredBy) {
      if (!n.blocked) {
        setHint("Not yet: switch FastNEAR off first.");
        return;
      }
      return failover();
    }
    if (n.step === ARCHIVE && !n.hist) {
      if (id === "archival" || id === "fastnear") return queryHistory();
      setHint("This test asks FastNEAR and the archival node. Pick one of them.");
      return;
    }
    setHint(detailOf(id));
  };

  /** Picking the learner's mailbox (their app): starts the step's request, or shows the fallback list. */
  const pickMailbox = () => {
    const n = now.current;
    setPicked("mailbox");
    if (n.step === RACE && !n.raced?.winner) return race();
    if (n.step === FAILOVER && !n.fo?.answeredBy && n.blocked) return failover();
    if (n.step === ARCHIVE && !n.hist) return queryHistory();
    setHint(`Your app's fallback list, in order: ${RACE_IDS.map(hostOf).join(", ")}.`);
  };

  /** What a window shows: lit while it answers, shut when it does not keep the block, down when off. */
  const windowLook = (id: RpcEndpointId): "idle" | "lit" | "shut" | "down" => {
    if (id === BLOCKABLE && down) return "down";
    if (step === ARCHIVE) {
      if (!hist) return "idle";
      const p = id === "archival" ? hist.archival : id === "fastnear" ? hist.regular : null;
      return p ? (p.ok ? "lit" : "shut") : "idle";
    }
    if (step === FAILOVER) return fo?.answeredBy === id ? "lit" : "idle";
    if (step === RACE || step === OUTAGE) return raced?.winner?.endpointId === id ? "lit" : "idle";
    return "idle";
  };

  /** Every provider failed (no network, or all of them down): the step's button offers a new try. */
  const canRetry =
    !busy && ((step === RACE && !!raced && !raced.winner) || (step === FAILOVER && !!fo && !fo.answeredBy));
  const noAnswer = canRetry ? "No provider answered. Check your internet connection, then try again." : null;

  const state = [
    `race:${raced ? "done" : busy === "race" ? "racing" : "none"}`,
    `fastest:${raced?.winner?.endpointId ?? "none"}`,
    `blocked:${blocked ? "fastnear" : "none"}`,
    `failover:${fo ? (fo.answeredBy ?? "failed") : busy === "failover" ? "trying" : "none"}`,
    `archive:${hist ? (hist.archival.ok && !hist.regular.ok ? "done" : "odd") : busy === "history" ? "asking" : "none"}`,
    `source:${network === "demo" ? "recorded" : "live"}`,
  ].join(";");

  return {
    step,
    network,
    answers,
    raced,
    blocked,
    down,
    attempts,
    fo,
    hist,
    busy,
    error: error ?? noAnswer,
    canRetry,
    picked,
    hint,
    passed,
    state,
    pass: () => setPassed(true),
    race: () => race(),
    failover: () => failover(),
    queryHistory: () => queryHistory(),
    toggleBlock,
    pickWindow,
    pickMailbox,
    windowLook,
  };
}
