import { useId } from "react";
import "./lessonKit.css";

/** A claim in the Honest take. Mark anything not yet checked against a source with `unverified`. */
export type Claim = string | { text: string; unverified?: boolean };

/** The chain NEAR is compared with, or "not different" when NEAR behaves like most chains here. */
/** Free text is allowed when the comparison is with a design, not a chain (e.g. "classic lock-and-mint bridges"). */
export type ComparedWith = "Ethereum" | "Solana" | "Cosmos" | "Bitcoin" | "not different" | (string & {});

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

function ClaimList({ label, items }: { label: string; items: Claim[] }) {
  const id = useId();
  return (
    <div className="honest-col">
      <h3 id={id}>{label}</h3>
      <ul aria-labelledby={id}>
        {items.map((c, i) => {
          const { text, unverified } = typeof c === "string" ? { text: c, unverified: false } : c;
          return (
            <li key={i}>
              {text}
              {unverified ? <span className="unverified"> (unverified)</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The closing card of every lesson: what NEAR does well and badly, and against which chain. */
export function HonestTake({
  strengths,
  weaknesses,
  comparedWith,
}: {
  strengths: Claim[];
  weaknesses: Claim[];
  comparedWith: ComparedWith | ComparedWith[];
}) {
  const id = useId();
  const chains = Array.isArray(comparedWith) ? comparedWith : [comparedWith];
  const vs = chains.includes("not different")
    ? "NEAR is not different here from most chains."
    : `Compared with ${listFormat.format(chains)}.`;
  return (
    <section className="lesson-panel scroll-fade honest-take" aria-labelledby={id}>
      <h2 id={id} className="panel-title">
        Honest take
      </h2>
      <p className="honest-vs">{vs}</p>
      <ClaimList label="Strengths" items={strengths} />
      <ClaimList label="Weaknesses" items={weaknesses} />
    </section>
  );
}
