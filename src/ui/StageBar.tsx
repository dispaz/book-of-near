import { createContext } from "react";
import { Icon, Svg } from "./icons";

/**
 * Room in the stage bar for a scene's own controls (for example the 3D figure's play button and
 * caption). The lesson page provides the element; scenes portal into it.
 */
export const BarSlot = createContext<HTMLElement | null>(null);

interface Props {
  count: number;
  step: number;
  canNext: boolean;
  menuOpen: boolean;
  onStep: (n: number) => void;
  onToggleMenu: () => void;
  /** While the book is closed. */
  inert?: boolean;
  /** Receives the element scenes can put their own controls in (see BarSlot). */
  slot?: (el: HTMLElement | null) => void;
}

/** Bottom control bar: contents, back, one dot per step, next. The caption is the step heading at the top. */
export function StageBar({ count, step, canNext, menuOpen, onStep, onToggleMenu, inert, slot }: Props) {
  const last = count - 1;
  return (
    <nav className="stage-bar" aria-label="Lesson steps" inert={inert}>
      <button aria-label="Contents" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <Svg>{Icon.menu}</Svg>
      </button>
      <button aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)}>
        <Svg>{Icon.back}</Svg>
      </button>
      <div className="bar-slot" ref={slot} />
      <ol className="dots" aria-label={`Step ${step + 1} of ${count}`}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "now" : ""} aria-hidden="true" />
        ))}
      </ol>
      <button
        aria-label="Next step"
        className={canNext && step < last ? "ready" : ""}
        disabled={step === last || !canNext}
        onClick={() => onStep(step + 1)}
      >
        <Svg>{Icon.next}</Svg>
      </button>
    </nav>
  );
}
