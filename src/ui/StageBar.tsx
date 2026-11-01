import type { Step } from "../app/types";
import { Icon, Svg } from "./icons";

interface Props {
  steps: Step[];
  step: number;
  canNext: boolean;
  playing: boolean;
  menuOpen: boolean;
  onStep: (n: number) => void;
  onTogglePlay: () => void;
  onToggleMenu: () => void;
}

/** Bottom control bar: menu, back, play, caption, dots, next. */
export function StageBar({
  steps,
  step,
  canNext,
  playing,
  menuOpen,
  onStep,
  onTogglePlay,
  onToggleMenu,
}: Props) {
  const last = steps.length - 1;
  return (
    <nav className="stage-bar" aria-label="Lesson steps">
      <button aria-label="Lessons menu" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <Svg>{Icon.menu}</Svg>
      </button>
      <button aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)}>
        <Svg>{Icon.back}</Svg>
      </button>
      <button
        aria-label={playing ? "Pause" : "Play"}
        disabled={!playing && (step === last || !canNext)}
        onClick={onTogglePlay}
      >
        <Svg>{playing ? Icon.pause : Icon.play}</Svg>
      </button>
      <div className="caption" aria-live="polite" data-testid="caption">
        {steps[step]?.caption}
      </div>
      <div className="dots">
        {steps.map((_, i) => (
          <button
            key={i}
            aria-label={`Step ${i + 1}`}
            aria-current={i === step ? "step" : undefined}
            // A dot can jump back freely, and forward only while no gate is closed on the way.
            disabled={i > step && !canNext}
            onClick={() => onStep(i)}
          />
        ))}
      </div>
      <button aria-label="Next step" disabled={step === last || !canNext} onClick={() => onStep(step + 1)}>
        <Svg>{Icon.next}</Svg>
      </button>
    </nav>
  );
}
