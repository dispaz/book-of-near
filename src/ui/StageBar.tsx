import type { Step } from "../app/types";
import { Icon, Svg } from "./icons";

interface Props {
  steps: Step[];
  step: number;
  canNext: boolean;
  menuOpen: boolean;
  onStep: (n: number) => void;
  onToggleMenu: () => void;
}

/** Bottom control bar: contents, back, caption of the current step, next. */
export function StageBar({ steps, step, canNext, menuOpen, onStep, onToggleMenu }: Props) {
  const last = steps.length - 1;
  return (
    <nav className="stage-bar" aria-label="Lesson steps">
      <button aria-label="Contents" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <Svg>{Icon.menu}</Svg>
      </button>
      <button aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)}>
        <Svg>{Icon.back}</Svg>
      </button>
      <div className="caption" aria-live="polite" data-testid="caption">
        {steps[step]?.caption}
      </div>
      <button aria-label="Next step" disabled={step === last || !canNext} onClick={() => onStep(step + 1)}>
        <Svg>{Icon.next}</Svg>
      </button>
    </nav>
  );
}
