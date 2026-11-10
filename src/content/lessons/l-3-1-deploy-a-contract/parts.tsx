/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the contract's
 * name, the Wasm file, the storage numbers, the count, the receipts. Same words, same test ids.
 */
import { explorerTxUrl } from "../../../chain/ops";
import { bytesText, CONTRACT_FUNDING, nearText, storageLock } from "./contract";
import { CALL, CLEAR, DEPLOY, FAIL, HOOK, WASM } from "./steps";
import type { Deploy } from "./useDeploy";

/** Long names cut in the middle, so they fit a label. */
export const short = (id: string, max = 30) =>
  id.length > max ? `${id.slice(0, Math.ceil(max / 2) - 1)}…${id.slice(-Math.floor(max / 2) + 1)}` : id;

export interface PickSpec {
  pickLabel: string;
  onPick: () => void;
}

/**
 * What picking each object does at this step, the same in 2D and 3D: the mailbox and the sub-mailbox
 * deploy, the scroll runs the step's contract call, the gauge reads the account (or the count).
 */
export function picksOf(d: Deploy): Record<"parent" | "sub" | "scroll" | "gauge", PickSpec> {
  const deploy = () => void d.deploy();
  const inspect = () => void d.inspect();
  const own = d.parent ? short(d.parent.id, 34) : "your account";
  const deploying = d.step === DEPLOY && !d.deployed;
  const scroll: PickSpec =
    d.step === CALL
      ? { pickLabel: "Scroll: increment the count", onPick: () => void d.increment() }
      : d.step === FAIL
        ? { pickLabel: "Scroll: call fail with a callback", onPick: () => void d.failWithCallback() }
        : d.step === CLEAR
          ? { pickLabel: "Scroll: reset and clear state", onPick: () => void d.reset() }
          : deploying
            ? { pickLabel: "Scroll: deploy the counter contract", onPick: deploy }
            : { pickLabel: "Scroll: unroll the Wasm file", onPick: d.unroll };
  return {
    parent: deploying
      ? { pickLabel: `Mailbox: ${own}, deploy the counter under it`, onPick: deploy }
      : { pickLabel: `Mailbox: your account, ${own}`, onPick: inspect },
    sub: deploying
      ? { pickLabel: "Sub-mailbox: deploy the counter contract", onPick: deploy }
      : { pickLabel: `Sub-mailbox: ${d.contractId ?? "the contract's account"}`, onPick: inspect },
    scroll,
    gauge:
      d.step === CALL
        ? { pickLabel: "Balance gauge: read the count", onPick: () => void d.readCount() }
        : { pickLabel: "Balance gauge: read the account's storage", onPick: inspect },
  };
}

/** One sentence: what the figure shows at this step (screen readers, the 2D group label). */
export function describe(d: Deploy): string {
  const c = d.contractId ?? "the contract's sub-account";
  if (d.step === HOOK)
    return `Your account's mailbox, a dashed sub-mailbox for ${c} and a dashed contract scroll.`;
  if (d.step === WASM)
    return `The contract scroll, unrolled: ${bytesText(d.facts.size)} of WebAssembly starting ${d.facts.header}.`;
  if (!d.deployed) return `The sub-account ${c} is not created yet. The contract is not deployed.`;
  const lock = nearText(d.gauge.lock);
  const base = `${c} holds the contract. ${lock} NEAR of its balance is locked for storage, ${nearText(d.gauge.available)} NEAR is available.`;
  if (d.step === CALL) return `${base} The count is ${d.count ?? 0}.`;
  if (d.step === FAIL)
    return d.receipts
      ? `${base} Three receipts: ${d.receipts.map((r) => `${r.method} ${r.ok ? "worked" : "failed"}`).join(", ")}.`
      : `${base} No call has failed yet.`;
  if (d.step === CLEAR) return d.cleared ? `${base} The state is cleared.` : base;
  return base;
}

export function Facts({ d, compact = false }: { d: Deploy; compact?: boolean }) {
  const { step } = d;
  return (
    <div className={`dpc-facts${compact ? " compact" : ""}`} data-testid="deploy-facts">
      {d.error ? (
        <p className="dpc-warn" role="alert">
          {d.error}
        </p>
      ) : null}
      {step === HOOK ? <Names d={d} /> : null}
      {step === WASM ? <WasmFile d={d} compact={compact} /> : null}
      {step >= DEPLOY && step <= CLEAR ? <Storage d={d} /> : null}
      {step >= CALL && step <= CLEAR && d.deployed ? <Count d={d} /> : null}
      {step === FAIL && d.receipts ? <Receipts d={d} /> : null}
      {step === CLEAR && d.cleared ? <Refund d={d} /> : null}
    </div>
  );
}

function Names({ d }: { d: Deploy }) {
  return (
    <dl className="dpc-list">
      <dt>Your account</dt>
      <dd>
        <code>{d.parent ? short(d.parent.id, 34) : "…"}</code>
      </dd>
      <dt>The contract's account</dt>
      <dd>
        <code>{d.contractId ?? "…"}</code> {d.deployed ? "" : "(not created yet)"}
      </dd>
    </dl>
  );
}

function WasmFile({ d, compact }: { d: Deploy; compact: boolean }) {
  return (
    <section aria-label="The Wasm file" data-testid="contract-facts">
      <dl className="dpc-list">
        <dt>File</dt>
        <dd>
          <code>counter.wasm</code>, {bytesText(d.facts.size)}
        </dd>
        <dt>First bytes</dt>
        <dd>
          <code>{d.facts.header}</code> <span className="dpc-soft">(\0asm, version 1)</span>
        </dd>
        <dt>Methods</dt>
        <dd>
          <code>{d.exportsList.join(", ")}</code>
        </dd>
      </dl>
      {d.parent?.make && !compact ? (
        <p className="dpc-soft">
          Your practice account is a hex id, so the lesson will first make the short name{" "}
          <code>{d.parent.id}</code> for it.
        </p>
      ) : null}
    </section>
  );
}

function Storage({ d }: { d: Deploy }) {
  if (!d.deployed)
    return (
      <p className="dpc-soft">
        {d.contractId ? <code>{d.contractId}</code> : "The sub-account"} does not exist yet. The batch will
        send it {nearText(CONTRACT_FUNDING)} NEAR.
      </p>
    );
  const v = d.view;
  return (
    <section aria-label="Storage staking" className="dpc-storage">
      <div
        className="dpc-gauge"
        role="img"
        aria-label={`${Math.round(d.gauge.share * 100)}% of the balance is locked for storage`}
      >
        <span className="dpc-gauge-lock" style={{ width: `${Math.max(2, d.gauge.share * 100)}%` }} />
      </div>
      <dl className="dpc-list">
        <dt>Locked for storage</dt>
        <dd>
          <strong data-testid="storage-locked">{nearText(d.gauge.lock)} NEAR</strong> for{" "}
          <span data-testid="storage-bytes">{v ? bytesText(v.storageUsage) : "…"}</span>
        </dd>
        <dt>Available</dt>
        <dd data-testid="storage-available">{nearText(d.gauge.available)} NEAR</dd>
        {d.step === DEPLOY && d.deployTx ? (
          <>
            <dt>Deploy</dt>
            <dd>
              {d.network === "testnet" ? (
                <a href={explorerTxUrl(d.deployTx)} target="_blank" rel="noreferrer">
                  <code>{short(d.deployTx, 16)}</code>
                </a>
              ) : (
                <code>{short(d.deployTx, 16)}</code>
              )}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function Count({ d }: { d: Deploy }) {
  return (
    <dl className="dpc-list">
      <dt>Count, read back</dt>
      <dd>
        <strong data-testid="count-read">{d.read ?? "–"}</strong>
        {d.step === CALL && d.read === null && d.increments > 0 ? (
          <span className="dpc-soft"> (press Read the count)</span>
        ) : null}
      </dd>
      {d.step === FAIL && d.lastResult ? (
        <>
          <dt>last_result</dt>
          <dd>
            <strong data-testid="last-result">{d.lastResult}</strong>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

function Receipts({ d }: { d: Deploy }) {
  return (
    <ol className="dpc-receipts" data-testid="callback-receipts" aria-label="Receipts of the call">
      {d.receipts!.map((r) => (
        <li key={r.id} className={r.ok ? "ok" : "failed"}>
          <span className="dpc-mark" aria-hidden="true">
            {r.ok ? "✓" : "✗"}
          </span>{" "}
          <code>{r.method}</code> <span className="visually-hidden">{r.ok ? "worked" : "failed"}</span>
          <span className="dpc-note">
            {r.note} · {r.gas} Tgas burnt
          </span>
        </li>
      ))}
    </ol>
  );
}

function Refund({ d }: { d: Deploy }) {
  const c = d.cleared!;
  return (
    <p data-testid="refund">
      Freed {bytesText(c.before - c.after)}: <strong>{nearText(storageLock(c.before - c.after))} NEAR</strong>{" "}
      back to available.
    </p>
  );
}
