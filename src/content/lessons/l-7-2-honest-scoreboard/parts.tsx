/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the four designs on
 * the first page, then the open card's board (one row per chain: verdict, note, source), labelled as
 * recorded data, and the last pick's note. Same words, same test ids in both views.
 */
import {
  CELLS,
  CHAINS,
  chainOf,
  dimForStep,
  dimOf,
  RECORDED_ON,
  SOURCES,
  VERDICT_TEXT,
  type Obj,
} from "./board";
import { MYTH, type Scoreboard } from "./useScoreboard";

/** An object's pick label: the same in 2D and 3D. */
export const pickName = (o: Obj) =>
  o.kind === "card" ? `The ${dimOf(o.dim).title} card` : `The ${chainOf(o.chain).name} pillar`;

export function Facts({ m, compact = false }: { m: Scoreboard; compact?: boolean }) {
  const { step, active } = m;
  const stepDim = dimForStep(step);
  return (
    <div className={`hsb-facts${compact ? " compact" : ""}`}>
      {step === MYTH ? (
        <ul className="hsb-designs" data-testid="designs">
          {CHAINS.map((c) => (
            <li key={c.id}>
              <strong>{c.name}:</strong> {c.thesis} <em>Trade-off:</em> {c.tradeoff}
              {c.unverified ? <span className="unverified"> (unverified)</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {stepDim && !m.explored.has(stepDim) ? (
        <p className="hsb-status" data-testid="board-status">
          Open the {dimOf(stepDim).title} card to fill in the board.
        </p>
      ) : null}

      {active && step !== MYTH ? (
        <table className="hsb-board" data-testid="board" data-dim={active}>
          <caption data-testid="recorded-label">
            <strong>{dimOf(active).title}.</strong> Recorded on {RECORDED_ON} from the source linked in each
            row. Not live data.
          </caption>
          <tbody>
            {CHAINS.map((c) => {
              const cell = CELLS[active][c.id];
              return (
                <tr key={c.id} data-chain={c.id} data-verdict={cell.verdict}>
                  <th scope="row">{c.name}</th>
                  <td className={`hsb-verdict v-${cell.verdict.replace(" ", "-")}`}>
                    {VERDICT_TEXT[cell.verdict]}
                  </td>
                  <td>
                    {cell.note}
                    {cell.unverified ? <span className="unverified"> (unverified)</span> : null}
                    {(cell.sources ?? []).map((tag) => {
                      const src = SOURCES[tag];
                      return src ? (
                        <span key={tag}>
                          {" "}
                          <a href={src.url} target="_blank" rel="noreferrer" className="hsb-src">
                            {src.name}
                          </a>
                        </span>
                      ) : null;
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {m.picked && (m.picked.reaction.hint || m.picked.reaction.detail) ? (
        <p
          className={`hsb-note${m.picked.reaction.hint ? " not-yet" : ""}`}
          data-testid="picked-note"
          data-not-yet={m.picked.reaction.hint ? "yes" : undefined}
          key={m.picked.n}
        >
          <strong>{pickName(m.picked.what)}:</strong> {m.picked.reaction.hint ?? m.picked.reaction.detail}
        </p>
      ) : null}
    </div>
  );
}
