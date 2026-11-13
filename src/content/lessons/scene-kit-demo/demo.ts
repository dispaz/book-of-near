import { useCallback, useState } from "react";
import type { SceneProps } from "../../../app/types";

/**
 * Shared state of the scene kit demo, used by the 3D scene and the SVG fallback alike.
 * No three.js here.
 */
export type Who = "ana" | "ben";

export const NAMES: Record<Who, string> = { ana: "Ana's account", ben: "Ben's account" };

/** Step 3 (index 2) is where the learner sends the coin; the last step shows it with Ben. */
export const SEND_STEP = 2;

export function coinHolder(step: number, sent: boolean): Who {
  return step > SEND_STEP || (step === SEND_STEP && sent) ? "ben" : "ana";
}

export function sceneState(s: {
  holder: Who;
  shown: Who;
  selected: Who | null;
  view: "3d" | "flat";
}): string {
  const coin = s.holder === s.shown ? s.holder : "moving";
  return `coin=${coin};selected=${s.selected ?? "none"};view=${s.view}`;
}

export function statusText(selected: Who | null, holder: Who): string {
  if (!selected) return "";
  const n = selected === holder ? 1 : 0;
  return `Selected: ${NAMES[selected]}. It holds ${n} ${n === 1 ? "coin" : "coins"}.`;
}

/**
 * How the coin reacts to a pick (docs/book-scene.md rule 10a): "not yet" until it rests with Ben, then
 * a detail for exploring. `shown` is where the coin was last seen at rest.
 */
export function coinPick(holder: Who, shown: Who): { disabledHint: string } | { detail: string } {
  return holder === "ben" && shown === "ben"
    ? { detail: "One coin. Ben's account holds it now." }
    : { disabledHint: "Not yet: send the coin to Ben first." };
}

/** The demo's state machine, as a hook both scenes share. */
export function useDemo({
  step,
  setGate,
  reducedMotion,
  view,
}: Pick<SceneProps, "step" | "setGate" | "reducedMotion"> & { view: "3d" | "flat" }) {
  const [sent, setSent] = useState(false);
  const [selected, setSelected] = useState<Who | null>(null);
  const holder = coinHolder(step, sent);
  // Where the coin was last seen at rest. Differs from `holder` while the coin is in the air.
  const [shown, setShown] = useState<Who>(holder);

  const onArrive = useCallback(() => {
    setShown(holder);
    if (holder === "ben" && step === SEND_STEP) setGate(true);
  }, [holder, step, setGate]);

  return {
    holder,
    selected,
    canSend: step === SEND_STEP && !sent,
    send: () => setSent(true),
    select: setSelected,
    onArrive,
    coinPick: coinPick(holder, reducedMotion ? holder : shown),
    // Under reduced motion nothing travels: the coin is wherever it belongs.
    state: sceneState({ holder, shown: reducedMotion ? holder : shown, selected, view }),
    status: statusText(selected, holder),
  };
}
