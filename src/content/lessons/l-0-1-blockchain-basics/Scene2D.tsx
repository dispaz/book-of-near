import { useEffect, useRef } from "react";
import { PEOPLE, shortHash, START, verify, type Chain, type Person } from "./ledger";
import { AUTO_TAMPER_NOTE, BlockDetails, COMPARE_RESULT, EditAmount, useHotLines } from "./parts";
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

/** The 2D view: three ledgers of balances and the chain as flat ink cards. Draws the shared lesson state. */
export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: LedgerLesson;
  reducedMotion: boolean;
  mode: string;
}) {
  const { step, chain } = m;
  const hot = useHotLines(m.lastTx);
  const showBalances = step >= SEND && step <= LINKS;
  const showChain = step >= SEND && step <= TAMPER;
  const showCopies = step === COMPARE;
  const summary = step >= CHECK;
  return (
    <div
      className={`bb${reducedMotion ? " still" : ""}${summary ? " summary" : ""}`}
      data-testid="ledger-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
      role="group"
      aria-label="Toy ledger of Ana, Ben and Cora"
    >
      {step === NOTEBOOK ? <Ledgers opened={m.opened} onOpen={m.openNotebook} /> : null}

      {showBalances ? <Ledgers bal={m.bal} hot={hot} /> : null}

      {step === TAMPER ? (
        <Ledgers
          bal={m.bal}
          hot={[]}
          ben={{ bal: m.benBal, hot: PEOPLE.filter((q) => m.benBal[q] !== m.bal[q]) }}
        />
      ) : null}

      {showCopies ? (
        <Copies
          tips={{ honest: m.honestHashes[m.honestHashes.length - 1]!, ben: m.benCheck.computed.at(-1)! }}
          benDiffers={m.benDiffers && !m.compared}
          compared={m.compared}
          autoTampered={m.autoTampered}
        />
      ) : null}

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
          tamperTo={m.tamperTo}
          waiting={!m.benDiffers}
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

/** The page of a ledger: "Balances" and one line per person. `hot` lines just changed. */
function Page({ bal, hot = [] }: { bal: Record<Person, number>; hot?: Person[] }) {
  return (
    <span className="bb-lg-page">
      <span className="bb-lg-head">Balances</span>
      {PEOPLE.map((q) => (
        <span key={q} className={`bb-lg-row${hot.includes(q) ? " hot" : ""}`}>
          <span>{q}</span> <b>{bal[q]}</b>
        </span>
      ))}
    </span>
  );
}

/**
 * Ana's, Ben's and Cora's ledgers. With `onOpen` (the first step) they start closed and open on a click,
 * showing the starting balances. With `bal` they all stand open at the current balances.
 */
function Ledgers(
  props:
    | {
        opened: Person | null;
        onOpen: (p: Person) => void;
        bal?: undefined;
        hot?: undefined;
        ben?: undefined;
      }
    | {
        bal: Record<Person, number>;
        hot: Person[];
        /** Ben's own view, when his copy of the chain differs (the tamper step). */
        ben?: { bal: Record<Person, number>; hot: Person[] };
        opened?: undefined;
        onOpen?: undefined;
      },
) {
  const { opened, onOpen, bal, hot } = props;
  const { ben } = props;
  return (
    <>
      <ul className="bb-ledgers" aria-label="Three ledgers" data-explain="ledgers">
        {PEOPLE.map((p) => (
          <li key={p}>
            <span className="bb-lg-name" aria-hidden="true">
              {p}'s ledger
            </span>
            {onOpen ? (
              <button
                className={`bb-ledger${opened === p ? " open" : ""}${opened ? "" : " hint"}`}
                aria-label={`Open ${p}'s notebook`}
                aria-pressed={opened === p}
                data-testid={`notebook-${p}`}
                onClick={() => onOpen(p)}
              >
                {opened === p ? <Page bal={START} /> : <span className="visually-hidden">closed</span>}
              </button>
            ) : (
              // The same balances three times: screen readers get them once, below.
              <div className="bb-ledger open" aria-hidden="true">
                {ben && p === "Ben" ? <Page bal={ben.bal} hot={ben.hot} /> : <Page bal={bal} hot={hot} />}
              </div>
            )}
          </li>
        ))}
      </ul>
      {ben && bal ? (
        <p className="visually-hidden">
          Ben's ledger follows his copy: {PEOPLE.map((p) => `${p} ${ben.bal[p]}`).join(", ")}. Ana's and
          Cora's say {PEOPLE.map((p) => `${p} ${bal[p]}`).join(", ")}.
        </p>
      ) : bal ? (
        <p className="visually-hidden">
          Every ledger says:{" "}
          {PEOPLE.map((p) => (
            <span key={p}>
              {p} <strong data-testid={`balance-${p}`}>{bal[p]}</strong> coins.{" "}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

/** The compare step: each person's copy of the chain, by its newest hash. */
function Copies({
  tips,
  benDiffers,
  compared,
  autoTampered,
}: {
  tips: { honest: string; ben: string };
  benDiffers: boolean;
  compared: boolean;
  autoTampered: boolean;
}) {
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
                data-explain={`copy-${p}`}
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
  tamperTo,
  waiting,
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
  tamperTo: number;
  waiting: boolean;
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
                  <EditAmount
                    from={b.tx.from}
                    to={b.tx.to}
                    value={tamperText}
                    target={tamperTo}
                    waiting={waiting}
                    onEdit={onEdit}
                  />
                ) : b.height === 0 ? (
                  "start: Ana 10, Ben 5, Cora 0"
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
                <span className={`bb-field${changed ? " changed" : ""}`} data-explain={`hash-${b.height}`}>
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
                  data-explain={`block-${b.height}`}
                  className={`bb-block${selected === b.height ? " selected" : ""}${hint === b.height ? " hint" : ""}`}
                  aria-label={`Open block #${b.height}`}
                  aria-pressed={selected === b.height}
                  onClick={() => onPick(b.height)}
                >
                  {body}
                </button>
              ) : (
                <div
                  data-explain={`block-${b.height}`}
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
      data-explain={`link-${n}`}
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
