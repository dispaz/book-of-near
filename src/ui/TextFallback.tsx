import type { Step } from "../app/types";

/** Default fallback: every caption as an ordered list, the current one marked. */
export function TextFallback({ steps, step, reason }: { steps: Step[]; step: number; reason: string }) {
  return (
    <div className="fallback" data-testid="text-fallback">
      <p>{reason}</p>
      <ol>
        {steps.map((s, i) => (
          <li key={i} aria-current={i === step ? "step" : undefined}>
            {s.caption}
            {s.explain ? <> {s.explain}</> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
