import { createContext, useContext, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The lesson page provides the element that holds step actions, docked above the lesson card. */
export const ActionSlot = createContext<HTMLElement | null>(null);

/** Set inside a SceneActionGroup: its buttons render in the group, which is itself placed in the slot. */
const InGroup = createContext(false);

/**
 * A step's action button, placed in the same spot in every lesson. One look per state, so a learner can
 * tell them apart:
 * - the next thing to do: solid accent (the default);
 * - `quiet`: an option that is not the next thing to do, plain paper;
 * - `pressed`: a chosen option (aria-pressed), paper with an accent ring;
 * - `done`: finished, calm and flat, not greyed out (aria-disabled, does nothing);
 * - `disabled`: unavailable, greyed out. Say why in `hint`, printed right under the button.
 */
export function SceneAction({
  children,
  onClick,
  disabled,
  pressed,
  done,
  quiet,
  hint,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** A chosen option in a pair or set of choices. */
  pressed?: boolean;
  /** The action already ran: shown as finished, not as unavailable. */
  done?: boolean;
  /** Not the step's next action: a plain button instead of the solid accent. */
  quiet?: boolean;
  /** One short line under the button, read with it (aria-describedby): why it is off, or what it does. */
  hint?: string;
}) {
  const slot = useContext(ActionSlot);
  const grouped = useContext(InGroup);
  const hintId = useId();
  const look = done ? "done" : pressed ? "chosen" : quiet ? "" : "primary";
  const button = (
    <button
      className={`btn${look ? ` ${look}` : ""}`}
      onClick={done ? undefined : onClick}
      disabled={disabled}
      aria-disabled={done ? true : undefined}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-describedby={hint ? hintId : undefined}
    >
      {children}
    </button>
  );
  const node = hint ? (
    <span className="action-item">
      {button}
      <small className="action-hint" id={hintId}>
        {hint}
      </small>
    </span>
  ) : (
    button
  );
  if (grouped) return node;
  return slot ? createPortal(node, slot) : <div className="scene-action">{node}</div>;
}

/** Several SceneActions that belong together (a choice between options), named as a group. */
export function SceneActionGroup({ label, children }: { label: string; children: ReactNode }) {
  const slot = useContext(ActionSlot);
  const group = (
    <div className="action-group" role="group" aria-label={label}>
      <InGroup.Provider value={true}>{children}</InGroup.Provider>
    </div>
  );
  return slot ? createPortal(group, slot) : <div className="scene-action">{group}</div>;
}
