/**
 * The ONE state of lesson 6.1, shared by the 2D and the 3D view: the lock length, whether the learner set
 * a lock and read the proposal, their practice ballot and what they picked last. Nothing here touches a
 * network or a wallet, so it works the same in demo and testnet mode. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import {
  evidenceFor,
  MAX_MONTHS,
  MIN_MONTHS,
  nextPreset,
  reactionFor,
  vePower,
  type Ballot,
  type Choice,
  type Gov,
  type Obj,
  type Reaction,
} from "./governance";
import { INSPECT, LOCK, VOTE } from "./steps";

export * from "./steps";

export type Governance = ReturnType<typeof useGovernance>;

export function useGovernance({
  step,
  setGate,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "reportEvidence">) {
  const [months, setMonthsState] = useState(MIN_MONTHS);
  const [locked, setLocked] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [picked, setPicked] = useState<{ what: Obj; result: Reaction; n: number } | null>(null);
  const [passed, setPassed] = useState(false);

  const setMonths = (m: number) => {
    setMonthsState(Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(m))));
    setLocked(true);
  };
  const lock = () => setMonths(nextPreset(months));
  const review = () => setReviewed(true);
  const vote = (choice: Choice) => {
    if (ballot) return;
    const b = { choice, power: vePower(months) };
    setBallot(b);
    reportEvidence?.(evidenceFor(b));
  };

  // Opened at a later step (a link, a reload): fill in the earlier steps, so the page is not empty. This
  // only draws them; it records nothing.
  useEffect(() => {
    if (step > LOCK && !locked) setLocked(true);
    if (step > INSPECT && !reviewed) setReviewed(true);
  }, [step, locked, reviewed]);

  // Gates.
  useEffect(() => {
    if (step === LOCK) setGate(locked);
    if (step === INSPECT) setGate(reviewed);
    if (step === VOTE) setGate(!!ballot);
  }, [step, locked, reviewed, ballot, setGate]);

  const gov: Gov = { step, months, locked, reviewed, ballot };
  const latest = useRef(gov);
  useLayoutEffect(() => {
    latest.current = gov;
  });

  /** What picking an object does now: its step action, a "not yet" hint or a detail (rule 10a). */
  const reaction = (what: Obj) => reactionFor(what, gov);

  /** Picking an object does the step's action when it is the step's object, or notes a detail or hint. */
  const pick = (what: Obj) => {
    const result = reactionFor(what, latest.current);
    setPicked((p) => ({ what, result, n: (p?.n ?? 0) + 1 }));
    if (result.act === "lock") lock();
    if (result.act === "review") review();
    if (result.act === "vote" && (what === "yes" || what === "no")) vote(what);
  };

  const state = [
    `months:${months}`,
    `locked:${locked ? "yes" : "no"}`,
    `reviewed:${reviewed ? "yes" : "no"}`,
    `vote:${ballot ? ballot.choice : "none"}`,
  ].join(";");

  return {
    ...gov,
    setMonths,
    review,
    vote,
    reaction,
    pick,
    picked,
    /** The last pick was this object (both views draw it selected). */
    isPicked: (o: Obj) => picked?.what === o,
    /** The last pick was this object, too early: the 2D view shakes it and shows the hint. */
    notYet: (o: Obj) => picked?.what === o && !!picked.result.hint,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
