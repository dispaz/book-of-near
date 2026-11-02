import type { Step } from "./types";

/** Replaces `{name}` placeholders with values. Unknown names are left as they are, so typos show up. */
export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, name: string) => vars[name] ?? m);
}

/** A step with every learner-facing text filled in. */
export function fillStep(step: Step, vars: Record<string, string>): Step {
  return {
    ...step,
    caption: fillVars(step.caption, vars),
    explain: step.explain === undefined ? undefined : fillVars(step.explain, vars),
    action: step.action ? { ...step.action, label: fillVars(step.action.label, vars) } : undefined,
  };
}
