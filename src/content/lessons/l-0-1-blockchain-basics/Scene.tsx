import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { SceneProps } from "../../../app/types";
import { ActionSlot, SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import {
  balances,
  compareCopies,
  DEFAULT_TXS,
  fillTo,
  genesisChain,
  hashOfText,
  PEOPLE,
  repairNext,
  send,
  shortHash,
  START,
  tamperAmount,
  verify,
  type Chain,
  type Person,
  type Tx,
} from "./ledger";
import "./scene.css";

// Step numbers (0-based) from manifest.ts.
const NOTEBOOK = 0;
const SEND = 1;
const BLOCKS = 2;
const HASH = 3;
const LINKS = 4;
const TAMPER = 5;
const COMPARE = 6;
const CHECK = 7;
const HONEST = 8;

/** The chain stops at block #3, so it always fits on screen. */
const MAX_BLOCKS = 4;

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "Why does changing an old block break the chain?",
    options: [
      { text: "The block's hash changes, and the next block still stores the old hash.", correct: true },
      {
        text: "The network deletes any block older than one hour.",
        why: "Blocks are never deleted; the problem is the hash link.",
      },
      {
        text: "Old blocks are locked with a password.",
        why: "There is no password; anyone can read and recompute the hashes.",
      },
      { text: "Coins in old blocks expire.", why: "Nothing expires; the mismatch comes from the hash." },
    ],
  },
  {
    prompt: "Ana has 7 coins. She tries to send Ben 9. What happens?",
    options: [
      { text: "The transaction is rejected and no balances change.", correct: true },
      { text: "Ana's balance goes to −2.", why: "The ledger checks a transaction before accepting it." },
      {
        text: "Ben gets 7 coins and the rest is skipped.",
        why: "A transaction is accepted whole or not at all.",
      },
    ],
  },
  {
    prompt: "What does a block's hash do?",
    options: [
      { text: "It acts as a fingerprint: any change to the block gives a different hash.", correct: true },
      {
        text: "It encrypts the block so nobody can read it.",
        why: "A hash does not hide the data; blocks are public.",
      },
      {
        text: "It records the time the block was made.",
        why: "That would be a timestamp, not a hash.",
      },
      { text: "It shows how many coins are in the block.", why: "The hash is a fingerprint, not a balance." },
    ],
  },
];

const nextDefault = (chain: Chain): Tx => DEFAULT_TXS[chain.length - 1] ?? DEFAULT_TXS[0]!;

export default function Scene({ step, setGate, reducedMotion, mode }: SceneProps) {
  const [chain, setChain] = useState<Chain>(genesisChain);
  const [ben, setBen] = useState<Chain | null>(null);
  const [opened, setOpened] = useState<Person | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saw1, setSaw1] = useState(false);
  const [sandbox, setSandbox] = useState<string | null>(null);
  const [hashChanged, setHashChanged] = useState(false);
  const [tamperText, setTamperText] = useState<string | null>(null);
  const [sawAllRed, setSawAllRed] = useState(false);
  const [autoTampered, setAutoTampered] = useState(false);
  const [compared, setCompared] = useState(false);
  const [passed, setPassed] = useState(false);
  const [lastTx, setLastTx] = useState<{ tx: Tx; n: number } | null>(null);
  const sceneRef = useDockClearance();

  // Opening a step by URL (or skipping ahead) builds the blocks that step needs.
  useEffect(() => {
    const need = step >= LINKS + 1 ? MAX_BLOCKS : step >= BLOCKS ? 2 : 1;
    if (chain.length < need) setChain((c) => fillTo(c, need));
  }, [step, chain.length]);

  const benChain = ben ?? chain;
  const benDiffers = !compareCopies(chain, benChain);

  // The comparison needs a changed copy: if Ben undid his edit, put the script's edit back.
  useEffect(() => {
    if (step !== COMPARE || compared || chain.length < MAX_BLOCKS || benDiffers) return;
    const amount = chain[1]?.tx?.amount === 9 ? 10 : 9;
    setBen(tamperAmount(chain, 1, amount));
    setTamperText(String(amount));
    setAutoTampered(true);
  }, [step, compared, chain, benDiffers]);

  const benCheck = useMemo(() => verify(benChain), [benChain]);
  const allRed = benCheck.allLaterBroken(1);
  useEffect(() => {
    if (step === TAMPER && allRed) setSawAllRed(true);
  }, [step, allRed]);

  const done = [
    opened !== null,
    chain.length >= 2,
    saw1,
    hashChanged,
    chain.length >= MAX_BLOCKS,
    sawAllRed,
    compared,
    passed,
    true,
  ];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    if (stepDone) setGate(true);
  }, [stepDone, setGate]);

  const shown = step === TAMPER ? benChain : chain;
  const check = step === TAMPER ? benCheck : verify(shown);
  const honestHashes = verify(chain).computed;
  const broken = check.links.flatMap((ok, i) => (ok ? [] : [i]));
  const copies = step < COMPARE ? "same" : compared ? "restored" : benDiffers ? "differs" : "same";
  const state = `step:${step};blocks:${shown.length};broken:${broken.join(",") || "none"};copies:${copies}`;

  const bal = balances(chain);
  const block1 = chain[1];

  function doSend(tx: Tx): string | null {
    const r = send(chain, tx);
    if (!r.ok) return r.reason;
    setChain(r.chain);
    setLastTx({ tx, n: r.chain.length });
    return null;
  }

  function editAmount(text: string) {
    setTamperText(text);
    setCompared(false);
    if (!/^\d{1,4}$/.test(text.trim())) return;
    setBen(tamperAmount(chain, 1, Number(text)));
  }

  function undo() {
    setBen(null);
    setTamperText(null);
    setAutoTampered(false);
  }

  function compare() {
    setCompared(true);
    setBen(null);
    setTamperText(null);
  }

  // ---------- what the scene shows per step ----------
  const showBalances = step >= SEND && step <= LINKS;
  const showChain = step >= SEND && step <= TAMPER;
  const showNotebooks = step === NOTEBOOK || step === COMPARE;
  const summary = step >= CHECK;

  let status: ReactNode = null;
  if (step === NOTEBOOK)
    status = opened ? "Every copy says the same. Try the others too." : "Click a notebook to open it.";
  else if (step === SEND)
    status = chain.length >= 2 ? `Accepted. Block #1 now holds "${block1?.text}".` : null;
  else if (step === BLOCKS)
    status = saw1 ? "One transaction, written down together in block #1." : "Click block #1 to look inside.";
  else if (step === LINKS)
    status =
      chain.length >= MAX_BLOCKS
        ? "Block #3 is on the chain. Each block points back to the hash before it."
        : `Send ${MAX_BLOCKS - chain.length} more. Each one gets its own block.`;
  else if (step === TAMPER && tamperText !== null && !/^\d{1,4}$/.test(tamperText.trim()))
    status = "Type a whole number, such as 9.";
  else if (step === TAMPER)
    status = allRed
      ? "#1's hash changed, so #2's link broke. That changed #2's hash, so #3's link broke too."
      : broken.length
        ? "Still broken further on. Every later block would need redoing."
        : "Change the 3 in block #1 to 9 and watch the links.";

  return (
    <>
      <div
        className={`bb${reducedMotion ? " still" : ""}${summary ? " summary" : ""}`}
        data-testid="ledger-scene"
        data-scene-state={state}
        data-mode={mode}
        role="group"
        aria-label="Toy ledger of Ana, Ben and Cy"
        ref={sceneRef}
      >
        {showNotebooks ? (
          <Notebooks
            step={step}
            opened={opened}
            onOpen={setOpened}
            tips={{ honest: honestHashes[honestHashes.length - 1]!, ben: verify(benChain).computed.at(-1)! }}
            benDiffers={benDiffers && !compared}
            compared={compared}
            autoTampered={autoTampered}
          />
        ) : null}

        {showBalances ? <BalanceRow bal={bal} lastTx={reducedMotion ? null : lastTx} /> : null}

        {showChain || summary ? (
          <ChainStrip
            chain={shown}
            check={check}
            honest={honestHashes}
            showHash={step >= HASH}
            showPrev={step >= LINKS}
            pickable={step === BLOCKS || step === HASH}
            selected={step === HASH ? 1 : selected}
            hint={step === BLOCKS && !saw1 ? 1 : null}
            editing={step === TAMPER}
            tamperText={tamperText ?? String(chain[1]?.tx?.amount ?? "")}
            onEdit={editAmount}
            onPick={(n) => {
              setSelected(n);
              if (n === 1) setSaw1(true);
            }}
            title={step === TAMPER ? "Ben's copy" : summary ? "The honest chain" : "The chain"}
          />
        ) : null}

        {(step === BLOCKS && selected !== null) || step === HASH ? (
          <BlockDetails
            chain={chain}
            n={step === HASH ? 1 : selected!}
            withHash={step === HASH}
            sandbox={sandbox ?? block1?.text ?? ""}
            onSandbox={(t) => {
              setSandbox(t);
              if (block1 && shortHash(hashOfText(chain, 1, t)) !== shortHash(honestHashes[1]!))
                setHashChanged(true);
            }}
          />
        ) : null}

        {status ? (
          <p className="bb-status" aria-live="polite" data-testid="scene-status">
            {status}
          </p>
        ) : null}
      </div>

      {/* Step actions, docked above the lesson card. Panels float in the scene area. */}
      {step === SEND && chain.length < 2 ? (
        <TxForm key="send" fixed initial={DEFAULT_TXS[0]!} bal={bal} onSend={doSend} />
      ) : null}
      {step === LINKS && chain.length < MAX_BLOCKS ? (
        <TxForm key={`links-${chain.length}`} initial={nextDefault(chain)} bal={bal} onSend={doSend} />
      ) : null}
      {step === TAMPER ? (
        <>
          <SceneAction onClick={() => setBen((b) => repairNext(b ?? chain))} disabled={!broken.length}>
            Repair next block
          </SceneAction>
          <SceneAction onClick={undo} disabled={!benDiffers}>
            Undo my edit
          </SceneAction>
        </>
      ) : null}
      {step === COMPARE && !compared ? <SceneAction onClick={compare}>Compare copies</SceneAction> : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={passed}
          onPass={() => {
            setPassed(true);
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["Bitcoin", "Ethereum"]}
          strengths={[
            "Tamper-evident history. Any change to an old block breaks every later link, so anyone can spot it by recomputing hashes.",
            "No single owner. Nobody has to trust one bank's private copy of the ledger. Everyone can check the same public history.",
            "NEAR is fast for a blockchain. It makes a new block about every second or less (NEAR's docs give figures between 0.6 and 1 s) and reaches finality, the point where a block cannot change, in about 1.2 s. Ethereum makes a block every 12 s; Bitcoin aims for one every 10 minutes.",
          ]}
          weaknesses={[
            "Slower and costlier than a normal database. Many computers must store and agree on every change. One company's database is far quicker and cheaper when you can trust its owner. This is true of NEAR too.",
            "Public by default. On Bitcoin, Ethereum and NEAR anyone can see transactions and balances with an explorer (a website that shows the chain). Privacy needs extra tools.",
            "Mistakes are hard to undo. Once a transaction is final there is no bank to call. A typo in the amount or the receiver stays in the history.",
          ]}
        />
      ) : null}
    </>
  );
}

/** Narrow screens: keep the scene above the docked lesson card, whatever its height. */
function useDockClearance() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const lesson = el?.closest(".lesson");
    const dock = lesson?.querySelector(".lesson-dock");
    if (!el || !lesson || !dock) return;
    const update = () => {
      const gap = lesson.getBoundingClientRect().bottom - dock.getBoundingClientRect().top;
      el.style.setProperty("--bb-dock", `${Math.max(0, Math.round(gap))}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(dock);
    ro.observe(lesson);
    return () => ro.disconnect();
  }, []);
  return ref;
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
          Ana's and Cy's copies match. Ben's copy does not match, so they reject it. Ben gets the honest copy
          back.
        </p>
      ) : autoTampered ? (
        <p className="bb-result">
          Ben's edit is back in his copy (block #1 changed), so there is something to catch.
        </p>
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

function BlockDetails({
  chain,
  n,
  withHash,
  sandbox,
  onSandbox,
}: {
  chain: Chain;
  n: number;
  withHash: boolean;
  sandbox: string;
  onSandbox: (t: string) => void;
}) {
  const b = chain[n];
  if (!b) return null;
  const real = shortHash(verify(chain).computed[n]!);
  const mine = shortHash(hashOfText(chain, n, sandbox));
  return (
    <section className="bb-details" aria-label={`Block #${n}`}>
      {n === 0 ? (
        <p>
          <strong>Block #0</strong>, the genesis block (the first block), holds the starting balances: Ana 10,
          Ben 5, Cy 0.
        </p>
      ) : (
        <p>
          <strong>Inside block #{n}:</strong> one transaction, <code>{b.text}</code>.
        </p>
      )}
      {withHash ? (
        <>
          <p>
            Its hash: <code data-testid="detail-hash">{real}</code>
          </p>
          <label className="bb-sandbox">
            <span>Change the text</span>
            <input value={sandbox} onChange={(e) => onSandbox(e.target.value)} spellCheck={false} />
          </label>
          <p>
            Hash of your text:{" "}
            <code data-testid="sandbox-hash" className={mine === real ? "" : "diff"}>
              {mine}
            </code>{" "}
            <span className="bb-note">
              {mine === real ? "Same text, same hash." : "A small change, a completely different hash."}
            </span>
          </p>
        </>
      ) : null}
    </section>
  );
}

/** The transaction form, docked above the lesson card. Enter or Send submits it. */
function TxForm({
  initial,
  fixed = false,
  bal,
  onSend,
}: {
  initial: Tx;
  fixed?: boolean;
  bal: Record<Person, number>;
  onSend: (tx: Tx) => string | null;
}) {
  const slot = useContext(ActionSlot);
  const [from, setFrom] = useState<Person>(initial.from);
  const [to, setTo] = useState<Person>(initial.to);
  const [amount, setAmount] = useState(String(initial.amount));
  const [error, setError] = useState<string | null>(null);

  const form = (
    <form
      className="bb-txform"
      aria-label="New transaction"
      onSubmit={(e) => {
        e.preventDefault();
        const n = amount.trim() === "" ? Number.NaN : Number(amount);
        setError(onSend({ from, to, amount: n }));
      }}
    >
      <div className="bb-txrow">
        {fixed ? (
          <span className="bb-txparties">
            {from} → {to}
          </span>
        ) : (
          <>
            <label>
              <span className="visually-hidden">From</span>
              <select
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value as Person);
                  setError(null);
                }}
              >
                {PEOPLE.map((p) => (
                  <option key={p} value={p}>
                    {p} ({bal[p]})
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden="true">→</span>
            <label>
              <span className="visually-hidden">To</span>
              <select
                value={to}
                onChange={(e) => {
                  setTo(e.target.value as Person);
                  setError(null);
                }}
              >
                {PEOPLE.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="bb-amount">
          <span className="visually-hidden">Amount (coins)</span>
          <input
            inputMode="numeric"
            value={amount}
            size={3}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
          />
          <span aria-hidden="true">coins</span>
        </label>
        <button type="submit" className="btn primary">
          Send
        </button>
      </div>
      {error ? (
        <p className="bb-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
  return slot ? createPortal(form, slot) : form;
}
