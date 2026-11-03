import { Icon, Svg } from "./icons";

interface Props {
  count: number;
  step: number;
  canNext: boolean;
  menuOpen: boolean;
  onStep: (n: number) => void;
  onToggleMenu: () => void;
}

/** Bottom control bar: contents, back, one dot per step, next. The caption is the step heading at the top. */
export function StageBar({ count, step, canNext, menuOpen, onStep, onToggleMenu }: Props) {
  const last = count - 1;
  return (
    <nav className="stage-bar" aria-label="Lesson steps">
      <button aria-label="Contents" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <Svg>{Icon.menu}</Svg>
      </button>
      <button aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)}>
        <Svg>{Icon.back}</Svg>
      </button>
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
