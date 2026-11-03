import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionSlot } from "../../../ui/SceneAction";
import { hashOfText, PEOPLE, shortHash, verify, type Chain, type Person, type Tx } from "./ledger";

// HTML parts shared by the 2D and the 3D view: the block details panel, the transaction form and texts.

export const COMPARE_RESULT =
  "Ana's and Cora's copies match. Ben's copy does not match, so they reject it. Ben gets the honest copy back.";
export const AUTO_TAMPER_NOTE =
  "Ben's edit is back in his copy (block #1 changed), so there is something to catch.";

/**
 * The lines a transaction just changed (sender and receiver), for about two seconds after it lands.
 * A transaction that was already there when the view opened lights nothing.
 */
export function useHotLines(lastTx: { tx: Tx; n: number } | null): Person[] {
  const [hot, setHot] = useState<Person[]>([]);
  const seen = useRef(lastTx?.n ?? 0);
  useEffect(() => {
    if (!lastTx || lastTx.n === seen.current) return;
    seen.current = lastTx.n;
    setHot([lastTx.tx.from, lastTx.tx.to]);
    const id = setTimeout(() => setHot([]), 2200);
    return () => clearTimeout(id);
  }, [lastTx]);
  return hot;
}

export function BlockDetails({
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
          Ben 5, Cora 0.
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
export function TxForm({
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
