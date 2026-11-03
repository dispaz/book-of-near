import type { Step } from "../app/types";

/**
 * The summary page of a lesson: every step's heading and explanation, in order. It fills the page at the
 * check step, behind the quiz, so a learner who minimises the quiz can read the lesson back.
 */
export function Summary({ title, steps }: { title: string; steps: Step[] }) {
  const items = steps.filter((s) => s.explain && !s.page);
  return (
    <section className="summary-page" aria-label="Summary">
      <p className="summary-kicker">Summary</p>
      <h2>{title}</h2>
      <ol>
        {items.map((s, i) => (
          <li key={i}>
            <h3>{s.caption}</h3>
            <p>{s.explain}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
