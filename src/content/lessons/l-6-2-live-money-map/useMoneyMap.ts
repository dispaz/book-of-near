/**
 * The ONE state of lesson 6.2, shared by the 2D and the 3D view: whether the learner compared the two
 * USDCs, read the oracle, which trade size they last tried and whether the intent flows show, plus what
 * they picked last. Everything shown is recorded data (money.ts); nothing here touches a network or a
 * wallet, so demo and testnet mode behave the same. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import {
  evidenceFor,
  nextSize,
  reactionFor,
  type MapState,
  type Obj,
  type Reaction,
  type Size,
} from "./money";
import { DOLLARS, FLOWS, ORACLE, SWAP } from "./steps";

export type MoneyMap = ReturnType<typeof useMoneyMap>;

export function useMoneyMap({
  step,
  setGate,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "reportEvidence">) {
  const [compared, setCompared] = useState(false);
  const [oracleRead, setOracleRead] = useState(false);
  const [trade, setTrade] = useState<Size | null>(null);
  const [bigTrade, setBigTrade] = useState(false);
  const [flows, setFlows] = useState(false);
  const [picked, setPicked] = useState<{ what: Obj; result: Reaction; n: number } | null>(null);
  const [passed, setPassed] = useState(false);
  const reported = useRef(false);

  const compare = () => setCompared(true);
  const readOracle = () => setOracleRead(true);
  const tradeSize = (s: Size) => {
    setTrade(s);
    if (s === 100_000) {
      setBigTrade(true);
      if (!reported.current) {
        reported.current = true;
        reportEvidence?.(evidenceFor());
      }
    }
  };
  const showFlows = () => setFlows(true);

  // Opened at a later step (a link, a reload): fill in the earlier steps, so the page is not empty. This
  // only draws them; it records nothing.
  useEffect(() => {
    if (step > DOLLARS && !compared) setCompared(true);
    if (step > ORACLE && !oracleRead) setOracleRead(true);
    if (step > SWAP && trade === null) setTrade(100_000);
    if (step > FLOWS && !flows) setFlows(true);
  }, [step, compared, oracleRead, trade, flows]);

  // Gates.
  useEffect(() => {
    if (step === DOLLARS) setGate(compared);
    if (step === ORACLE) setGate(oracleRead);
    if (step === SWAP) setGate(bigTrade);
  }, [step, compared, oracleRead, bigTrade, setGate]);

  const map: MapState = { step, compared, oracleRead, trade, flows };
  const latest = useRef(map);
  useLayoutEffect(() => {
    latest.current = map;
  });

  /** What picking an object does now: its step action, a "not yet" hint or a detail (rule 10a). */
  const reaction = (what: Obj) => reactionFor(what, map);

  const pick = (what: Obj) => {
    const now = latest.current;
    const result = reactionFor(what, now);
    setPicked((p) => ({ what, result, n: (p?.n ?? 0) + 1 }));
    if (result.act === "compare") compare();
    if (result.act === "read") readOracle();
    if (result.act === "trade") tradeSize(nextSize(now.trade));
    if (result.act === "flows") showFlows();
  };

  const state = [
    `compared:${compared ? "yes" : "no"}`,
    `oracle:${oracleRead ? "read" : "no"}`,
    `trade:${trade ?? "none"}`,
    `flows:${flows ? "yes" : "no"}`,
  ].join(";");

  return {
    ...map,
    bigTrade,
    compare,
    readOracle,
    tradeSize,
    showFlows,
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
