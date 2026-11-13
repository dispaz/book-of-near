/**
 * The ONE state of lesson 7.2, shared by the 2D and the 3D view: which cards (dimensions) are explored,
 * which one is open on the board, and what the learner last picked. No network, no wallet, no three.js:
 * the board is recorded data (board.ts), the same in demo and testnet mode.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import {
  CHECK,
  dimForStep,
  DIMS,
  exploredBy,
  reaction,
  RECORDED_ON,
  stateOf,
  type DimId,
  type Obj,
  type Reaction,
} from "./board";

export * from "./steps";

export type Scoreboard = ReturnType<typeof useScoreboard>;

/** Where the board stands when a step opens: its own card if explored, the last card after the board. */
function activeFor(step: number, explored: ReadonlySet<DimId>): DimId | null {
  const d = dimForStep(step);
  if (d) return explored.has(d) ? d : null;
  return step >= CHECK ? "liquidity" : null;
}

export function useScoreboard({
  step,
  setGate,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "reportEvidence">) {
  const [explored, setExplored] = useState<ReadonlySet<DimId>>(() => exploredBy(step));
  const [active, setActive] = useState<DimId | null>(() => activeFor(step, exploredBy(step)));
  const [picked, setPicked] = useState<{ what: Obj; reaction: Reaction; n: number } | null>(null);
  const [passed, setPassed] = useState(false);

  // A new step: fill in the cards before it (a link or a reload lands mid-lesson), and set the board.
  const seenStep = useRef(step);
  useEffect(() => {
    if (seenStep.current === step) return;
    seenStep.current = step;
    const next = new Set([...explored, ...exploredBy(step)]);
    if (next.size !== explored.size) setExplored(next);
    setActive(activeFor(step, next));
    setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The gate of a comparison step: its card is open.
  const stepDim = dimForStep(step);
  useEffect(() => {
    if (stepDim) setGate(explored.has(stepDim));
  }, [stepDim, explored, setGate]);

  /** Opened by the learner (not filled in): the completion record comes from the last card. */
  const reported = useRef(false);
  const open = (dim: DimId) => {
    setActive(dim);
    if (explored.has(dim)) return;
    const next = new Set(explored).add(dim);
    setExplored(next);
    if (!reported.current && DIMS.every((d) => next.has(d.id))) {
      reported.current = true;
      reportEvidence?.({ scoreboardReviewed: "true", recordedOn: RECORDED_ON });
    }
  };

  const latest = useRef({ step, explored, active });
  useLayoutEffect(() => {
    latest.current = { step, explored, active };
  });

  /** A pick opens the card, or shows a hint or a detail (both views; 3D's Pickable shows them too). */
  const pick = (what: Obj) => {
    const r = reaction(what, latest.current);
    setPicked((p) => ({ what, reaction: r, n: (p?.n ?? 0) + 1 }));
    if (r.act) open(r.act);
  };

  const same = (a: Obj, b: Obj) =>
    a.kind === b.kind &&
    (a.kind === "card" ? a.dim === (b as typeof a).dim : a.chain === (b as typeof a).chain);
  const isPicked = (o: Obj) => !!picked && same(picked.what, o);

  return {
    step,
    explored,
    active,
    open,
    pick,
    picked,
    /** What a pick of this object would do now: 3D passes it to Pickable as `disabledHint` / `detail`. */
    reactionOf: (o: Obj) => reaction(o, { step, explored, active }),
    isPicked,
    /** The last pick was this object, too early: both views shake it and show the hint. */
    notYet: (o: Obj) => isPicked(o) && !!picked?.reaction.hint,
    passed,
    pass: () => setPassed(true),
    state: stateOf({ step, active, explored }),
  };
}
