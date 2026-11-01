import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The lesson page provides the element that holds step actions, docked above the lesson card. */
export const ActionSlot = createContext<HTMLElement | null>(null);

/** A step's action button, placed in the same spot in every lesson. */
export function SceneAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const slot = useContext(ActionSlot);
  const button = (
    <button className="btn primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  return slot ? createPortal(button, slot) : <div className="scene-action">{button}</div>;
}
