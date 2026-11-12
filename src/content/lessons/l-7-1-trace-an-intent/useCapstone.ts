/**
 * The ONE state of lesson 7.1, shared by the 2D and the 3D view: the trail (built once from what earlier
 * lessons left in progress), whether the intent is authorized, the receipt's hop, the contract run, the
 * settlement and what the learner picked. A replay: nothing here touches a network or a wallet, so it
 * works the same in demo and testnet mode. No three.js here.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { progress } from "../../../progress";
import { AUTHORIZE, CONTRACT, SETTLE, SHARDS } from "./steps";
import {
  buildTrail,
  evidenceBook,
  evidenceFor,
  pickResult,
  SETTLE_AT,
  spotOf,
  type Obj,
  type PickResult,
  type SettlePhase,
} from "./trail";

export * from "./steps";

export type Capstone = ReturnType<typeof useCapstone>;

/** How long the verifier's gear turns when the contract runs. */
const RUN_MS = 2400;

export function useCapstone({
  step,
  setGate,
  setVars,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reportEvidence" | "reducedMotion">) {
  const network = useChain().network;
  const trail = useMemo(() => buildTrail(evidenceBook(progress.snapshot())), []);
  const [authorized, setAuthorized] = useState(false);
  /** The receipt's hop is being replayed (a pick at step 3 sends it back to your shard for a moment). */
  const [replaying, setReplaying] = useState(false);
  const [running, setRunning] = useState(false);
  const [settle, setSettle] = useState<SettlePhase>("idle");
  const [picked, setPicked] = useState<{ what: Obj; result: PickResult; n: number } | null>(null);
  const [passed, setPassed] = useState(false);
  const timers = useRef<number[]>([]);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    const pending = timers.current;
    return () => {
      live.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);
  const later = (ms: number, fn: () => void) =>
    timers.current.push(window.setTimeout(() => live.current && fn(), ms));

  const authorize = () => setAuthorized(true);
  const hop = () => {
    if (reducedMotion || replaying) return;
    setReplaying(true);
    later(700, () => setReplaying(false));
  };
  /** The timer that stops the gear: a repeat pick restarts the turn rather than cutting it short. */
  const runStop = useRef<number | undefined>(undefined);
  const run = () => {
    if (reducedMotion) return;
    setRunning(true);
    window.clearTimeout(runStop.current);
    runStop.current = window.setTimeout(() => live.current && setRunning(false), RUN_MS);
  };
  useEffect(() => () => window.clearTimeout(runStop.current), []);
  /** True only once the learner has verified the settlement themselves (not when the view was filled in). */
  const verified = useRef(false);
  const verify = () => {
    if (settle !== "idle") return;
    verified.current = true;
    if (reducedMotion) return setSettle("done");
    for (const [phase, ms] of Object.entries(SETTLE_AT) as [SettlePhase, number][])
      later(ms, () => setSettle(phase));
  };

  // Opened at a later step (a link, a reload): fill in the earlier steps, so the page is not empty. This
  // only draws them; it reports no evidence (the record comes from an earlier visit, or from verify()).
  useEffect(() => {
    if (step > AUTHORIZE && !authorized) setAuthorized(true);
    if (step > SETTLE && settle === "idle") setSettle("done");
  }, [step, authorized, settle]);
  // The contract runs when its page opens.
  useEffect(() => {
    if (step === CONTRACT) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Gates.
  useEffect(() => {
    if (step === AUTHORIZE) setGate(authorized);
    if (step === SETTLE) setGate(settle === "done");
  }, [step, authorized, settle, setGate]);

  useEffect(() => {
    setVars?.({ name: trail.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail]);

  // The completion record: once the learner has verified the settlement.
  useEffect(() => {
    if (settle === "done" && verified.current) reportEvidence?.(evidenceFor(trail, network));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settle]);

  const latest = useRef({ step, authorized, settle });
  useLayoutEffect(() => {
    latest.current = { step, authorized, settle };
  });

  /** Picking an object does the step's action when it is the step's object, or shows a detail or hint. */
  const pick = (what: Obj) => {
    const result = pickResult(what, { ...latest.current, name: trail.name, intent: trail.intent });
    setPicked((p) => ({ what, result, n: (p?.n ?? 0) + 1 }));
    if (result.act === "authorize") authorize();
    if (result.act === "hop") hop();
    if (result.act === "run") run();
    if (result.act === "settle") verify();
  };

  const spot = step === SHARDS && replaying ? "shardA" : spotOf(step, authorized, settle);
  const state = [
    `intent:${trail.intent.source}`,
    `authorized:${authorized ? "yes" : "no"}`,
    `spot:${spot}`,
    `settle:${settle}`,
  ].join(";");

  return {
    step,
    network,
    trail,
    authorized,
    authorize,
    running: running && step === CONTRACT,
    settle,
    verify,
    spot,
    picked,
    pick,
    /** The last pick was this object (both views draw it selected). */
    isPicked: (o: Obj) => picked?.what === o,
    /** The last pick was this object, too early: both views shake it and show the hint. */
    notYet: (o: Obj) => picked?.what === o && !!picked.result.notYet,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
