import { useEffect, useRef, type CSSProperties } from "react";
import { PEOPLE, shortHash, START, verify, type Chain, type Person, type Tx } from "./ledger";
import { AUTO_TAMPER_NOTE, BlockDetails, COMPARE_RESULT, useDockClearance } from "./parts";
import {
  BLOCKS,
  CHECK,
  COMPARE,
  HASH,
  LINKS,
  NOTEBOOK,
  SEND,
  TAMPER,
  type LedgerLesson,
} from "./useLedgerLesson";
import "./scene.css";

/** The 2D view: notebooks, balances and the chain as flat ink cards. Draws the shared lesson state. */
export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: LedgerLesson;
  reducedMotion: boolean;
  mode: string;
}) {
  const sceneRef = useDockClearance();
  const { step, chain } = m;
  const showBalances = step >= SEND && step <= LINKS;
  const showChain = step >= SEND && step <= TAMPER;
  const showNotebooks = step === NOTEBOOK || step === COMPARE;
  const summary = step >= CHECK;
  return (
    <div
      className={`bb${reducedMotion ? " still" : ""}${summary ? " summary" : ""}`}
      data-testid="ledger-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
      role="group"
      aria-label="Toy ledger of Ana, Ben and Cy"
      ref={sceneRef}
    >
      {showNotebooks ? (
        <Notebooks
          step={step}
          opened={m.opened}
          onOpen={m.openNotebook}
          tips={{ honest: m.honestHashes[m.honestHashes.length - 1]!, ben: m.benCheck.computed.at(-1)! }}
          benDiffers={m.benDiffers && !m.compared}
          compared={m.compared}
          autoTampered={m.autoTampered}
        />
      ) : null}

      {showBalances ? <BalanceRow bal={m.bal} lastTx={reducedMotion ? null : m.lastTx} /> : null}

      {showChain || summary ? (
        <ChainStrip
          chain={m.shown}
          check={m.check}
          honest={m.honestHashes}
          showHash={step >= HASH}
          showPrev={step >= LINKS}
          pickable={step === BLOCKS || step === HASH}
          selected={step === HASH ? 1 : m.selected}
          hint={step === BLOCKS && !m.saw1 ? 1 : null}
          editing={step === TAMPER}
          tamperText={m.tamperText}
          onEdit={m.editAmount}
          onPick={m.pickBlock}
          title={step === TAMPER ? "Ben's copy" : summary ? "The honest chain" : "The chain"}
        />
      ) : null}

      {(step === BLOCKS && m.selected !== null) || step === HASH ? (
        <BlockDetails
          chain={chain}
          n={step === HASH ? 1 : m.selected!}
          withHash={step === HASH}
          sandbox={m.sandbox}
          onSandbox={m.setSandbox}
        />
      ) : null}

      {m.status ? (
        <p className="bb-status" aria-live="polite" data-testid="scene-status">
          {m.status}
        </p>
      ) : null}
    </div>
  );
}

function Notebooks({
  step,
  opened,
  onOpen,
  tips,
  benDiffers,
  compared,
  autoTampered,
}: {
  step: number;
  opened: Person | null;
  onOpen: (p: Person) => void;
  tips: { honest: string; ben: string };
  benDiffers: boolean;
  compared: boolean;
  autoTampered: boolean;
}) {
  if (step === NOTEBOOK) {
    return (
      <ul className="bb-notebooks" aria-label="Three copies of the notebook">
        {PEOPLE.map((p) => (
          <li key={p}>
            <button
              className={`bb-notebook${opened === p ? " open" : ""}${opened ? "" : " hint"}`}
              aria-label={`Open ${p}'s notebook`}
              aria-pressed={opened === p}
              data-testid={`notebook-${p}`}
              onClick={() => onOpen(p)}
            >
              <span className="bb-nb-title">{p}'s copy</span>
              {opened === p ? (
                <span className="bb-nb-lines">
                  {PEOPLE.map((q) => (
                    <span key={q}>
                      {q} {START[q]}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="bb-nb-closed" aria-hidden="true">
                  closed
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <ul className="bb-notebooks" aria-label="Three copies of the chain">
        {PEOPLE.map((p) => {
          const bad = p === "Ben" && benDiffers;
          const fixed = p === "Ben" && compared;
          return (
            <li key={p}>
              <div
                className={`bb-notebook open${bad ? " bad" : ""}${fixed ? " fixed" : ""}`}
                data-testid={`notebook-${p}`}
                data-copy={bad ? "differs" : "matches"}
              >
                <span className="bb-nb-title">{p}'s copy</span>
                <span className="bb-nb-lines">
                  <span>newest hash</span>
                  <code>{shortHash(p === "Ben" ? tips.ben : tips.honest)}</code>
                  <span className="bb-nb-mark">{bad ? "✗ differs" : fixed ? "↺ replaced" : "✓"}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {compared ? (
        <p className="bb-result" data-testid="compare-result" role="status">
          {COMPARE_RESULT}
        </p>
      ) : autoTampered ? (
        <p className="bb-result">{AUTO_TAMPER_NOTE}</p>
      ) : null}
    </>
  );
}

function BalanceRow({ bal, lastTx }: { bal: Record<Person, number>; lastTx: { tx: Tx; n: number } | null }) {
  return (
    <div className="bb-people">
      {PEOPLE.map((p) => (
        <div key={p} className="bb-person">
          <span className="bb-person-name">{p}</span>
          <span className="bb-person-coins">
            <strong data-testid={`balance-${p}`} key={`${p}-${bal[p]}`} className="bb-num">
              {bal[p]}
            </strong>{" "}
            coins
          </span>
        </div>
      ))}
      {lastTx ? (
        <span
          key={lastTx.n}
          className="bb-coin"
          aria-hidden="true"
          style={
            {
              "--from": PEOPLE.indexOf(lastTx.tx.from),
              "--to": PEOPLE.indexOf(lastTx.tx.to),
            } as CSSProperties
          }
        >
          <span />
        </span>
      ) : null}
    </div>
  );
}

function ChainStrip({
  chain,
  check,
  honest,
  showHash,
  showPrev,
  pickable,
  selected,
  hint,
  editing,
  tamperText,
  onEdit,
  onPick,
  title,
}: {
  chain: Chain;
  check: ReturnType<typeof verify>;
  honest: string[];
  showHash: boolean;
  showPrev: boolean;
  pickable: boolean;
  selected: number | null;
  hint: number | null;
  editing: boolean;
  tamperText: string;
  onEdit: (t: string) => void;
  onPick: (n: number) => void;
  title: string;
}) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [chain.length]);
  return (
    <section className="bb-chain-wrap" aria-label={title}>
      <p className="bb-chain-title">{title}</p>
      <ol className="bb-chain">
        {chain.map((b, i) => {
          const ok = check.links[i]!;
          const hash = check.computed[i]!;
          const changed = hash !== honest[i];
          const body = (
            <>
              <span className="bb-block-n">#{b.height}</span>
              <span className="bb-block-tx">
                {editing && b.height === 1 && b.tx ? (
                  <>
                    {b.tx.from}-&gt;{b.tx.to}{" "}
                    <input
                      className="bb-edit"
                      inputMode="numeric"
                      aria-label="Amount in block #1"
                      value={tamperText}
                      size={3}
                      onChange={(e) => onEdit(e.target.value)}
                    />
                  </>
                ) : b.height === 0 ? (
                  "start: Ana 10, Ben 5, Cy 0"
                ) : (
                  b.text
                )}
              </span>
              {showPrev && b.height > 0 ? (
                <span className={`bb-field${ok ? "" : " bad"}`}>
                  prev <code data-testid={`block-prev-${b.height}`}>{shortHash(b.prev)}</code>
                </span>
              ) : null}
              {showHash ? (
                <span className={`bb-field${changed ? " changed" : ""}`}>
                  hash <code data-testid={`block-hash-${b.height}`}>{shortHash(hash)}</code>
                </span>
              ) : null}
            </>
          );
          return (
            <li
              key={b.height}
              className="bb-item"
              ref={i === chain.length - 1 ? end : undefined}
              data-new={i === chain.length - 1 && i > 0 ? "true" : undefined}
            >
              {i > 0 ? <Link n={b.height} ok={ok} show={showPrev} /> : null}
              {pickable ? (
                <button
                  className={`bb-block${selected === b.height ? " selected" : ""}${hint === b.height ? " hint" : ""}`}
                  aria-label={`Open block #${b.height}`}
                  aria-pressed={selected === b.height}
                  onClick={() => onPick(b.height)}
                >
                  {body}
                </button>
              ) : (
                <div
                  className={`bb-block${editing && b.height === 1 ? " editing" : ""}${ok ? "" : " linkbad"}`}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The ink arrow from a block back to the block before it. Red and cracked when the stored hash is wrong. */
function Link({ n, ok, show }: { n: number; ok: boolean; show: boolean }) {
  return (
    <span
      className={`bb-link${ok ? "" : " broken"}${show ? "" : " plain"}`}
      data-testid={`link-${n}`}
      data-link={ok ? "ok" : "broken"}
      role="img"
      aria-label={ok ? `Block #${n} links to block #${n - 1}` : `Broken link: block #${n} stores an old hash`}
    >
      <svg viewBox="0 0 40 24" aria-hidden="true">
        {ok ? (
          <path d="M36 12 H6 M13 5 L5 12 L13 19" />
        ) : (
          <>
            <path d="M36 12 H24 M16 12 H6 M13 5 L5 12 L13 19" />
            <path className="crack" d="M22 4 L18 11 L23 13 L19 20" />
          </>
        )}
      </svg>
    </span>
  );
}
