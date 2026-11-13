/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the two contracts,
 * the receipts in block order, the gas split and the last pick's detail. Same words, same test ids.
 */
import { DEMO_BUYER, DEMO_SHOP } from "../../../chain/demo/shop";
import { explorerTxUrl } from "../../../chain/ops";
import { formatTgas } from "../../../chain/units";
import { contractHops, gasUse, type CrossCall, type Hop } from "./call";
import { RECORDED } from "./recorded";
import { FAIL, GAS, HOOK, HOP, ORDER, orderButton } from "./steps";
import type { CallState } from "./useCrossCall";

/** Long names cut in the middle, so they fit a label. */
export const short = (id: string, max = 24) =>
  id.length > max ? `${id.slice(0, Math.ceil(max / 2) - 1)}…${id.slice(-Math.floor(max / 2) + 1)}` : id;

/** The two contracts' names in this mode, known before anything is sent. */
export function namesOf(c: CallState): { caller: string; callee: string } {
  if (c.call) return { caller: c.call.caller, callee: c.call.callee };
  return c.network === "demo"
    ? { caller: DEMO_BUYER, callee: DEMO_SHOP }
    : { caller: RECORDED.caller, callee: RECORDED.callee };
}

/** The hop that runs on a contract (for its shard tag): A's first receipt, B's receipt. */
export function shardOf(c: CrossCall | null, account: string): number | null {
  return c ? (contractHops(c).find((h) => h.to === account)?.shardId ?? null) : null;
}

export const blockText = (n: number) => `#${n.toLocaleString("en-US")}`;
/** A block number short enough for the figure: its last three digits. The facts list has it whole. */
export const tailText = (n: number) => `#…${String(n).slice(-3)}`;
/** A contract's short tag on its scroll: "A · buyer". `which` is its letter: A, B, C… */
export const tagOf = (which: string, id: string) => `${which} · ${id.split(".")[0]}`;

/** The smallest share of the gas meter a part gets, so a contract that burnt little stays visible. */
const MIN_PART = 0.2;

export interface MeterPart {
  /** "A · buyer burned 14.21 Tgas": the exact gas, whatever the part's width. */
  label: string;
  /** Where the part starts and how wide it is, as fractions of the bar. Not to scale: see MIN_PART. */
  start: number;
  frac: number;
  /** Only the first and the last part carry a label, so labels never overlap. */
  showLabel: boolean;
  /** Which end of the bar the label sits at: the first part's on the left, the last one's on the right. */
  align: "start" | "end";
}

/**
 * The gas meter's parts, shared by the 2D and the 3D view: one per contract (A first, then B, C…), sized
 * by the gas its receipts burnt, all of it burned.
 */
export function meterParts(call: CrossCall): MeterPart[] {
  const g = gasUse(call);
  const raw = g.byContract.map((b) => (g.contractGas > 0n ? Number(b.gas) / Number(g.contractGas) : 0));
  const lifted = raw.map((f) => Math.max(f, MIN_PART));
  const sum = lifted.reduce((s, f) => s + f, 0) || 1;
  const last = g.byContract.length - 1;
  let start = 0;
  return g.byContract.map((b, i) => {
    const frac = lifted[i]! / sum;
    const part: MeterPart = {
      label: `${tagOf(String.fromCharCode(65 + i), b.accountId)} burned ${formatTgas(b.gas)} Tgas`,
      start,
      frac,
      showLabel: i === 0 || i === last,
      align: i > 0 && i === last ? "end" : "start",
    };
    start += frac;
    return part;
  });
}

/** The four hops the block row draws: the transaction, then the three contract receipts. */
export function rowOf(c: CrossCall | null): (Hop | null)[] {
  if (!c) return [null, null, null, null];
  const [tx] = c.hops;
  const list = contractHops(c);
  return [tx ?? null, list[0] ?? null, list[1] ?? null, list[2] ?? null];
}

/** Labels for the row's slips before anything ran. */
export const ROW_NAMES = ["transaction", "call A", "call B", "callback"];

export interface Slot {
  /** Drawn solid (it ran) or dashed (still to come). */
  ran: boolean;
  failed: boolean;
  /** Method name, or what is still to come. */
  name: string;
  block: string;
  shard: string;
  pickLabel: string;
  onPick: () => void;
  picked: boolean;
}

/** The block row, the same in 2D and 3D: the transaction, then each contract receipt as it runs. */
export function slotsOf(c: CallState): Slot[] {
  const row = rowOf(c.drawn);
  return row.map((h, i) => {
    const ran = !!h && (i === 0 || i - 1 < c.revealed);
    const name = h && ran ? (h.method ?? "receipt") : ROW_NAMES[i]!;
    const where =
      h && ran ? ` on ${short(h.to, 26)}, block ${blockText(h.blockHeight)}, shard ${h.shardId}` : "";
    const how = h && ran ? (h.ok ? ", worked" : ", failed") : ", not run yet";
    return {
      ran,
      failed: !!h && ran && !h.ok,
      name,
      block: h && ran ? tailText(h.blockHeight) : "block ?",
      shard: h && ran ? `shard ${h.shardId}` : "",
      pickLabel: `${i === 0 ? "Transaction" : `Receipt ${i}`}: ${name}${where}${how}`,
      onPick: i === 0 ? () => c.pickContract("caller") : () => c.pickHop(i - 1),
      picked: i > 0 && c.picked === i - 1,
    };
  });
}

/** Contract B's scroll fails (red cross) once its failed receipt has run. */
export function calleeFailed(c: CallState): boolean {
  return slotsOf(c).some((s) => s.failed);
}

/** The contract whose receipt runs right now (its gear turns). */
export function runningOn(c: CallState): string | null {
  if (c.busy) return namesOf(c).caller;
  if (!c.drawn || c.complete) return null;
  return c.hops[c.revealed]?.to ?? null;
}

/** One sentence: what the figure shows at this step (screen readers, the 2D group label). */
export function describe(c: CallState): string {
  const { caller, callee } = namesOf(c);
  if (c.step === HOOK)
    return `Two contracts, two scrolls: ${caller} (contract A) and ${callee} (contract B).`;
  if (c.step === HOP)
    return `An action receipt addressed from ${caller} to ${callee}, waiting for a later block.`;
  const d = c.drawn;
  if (!d) return `${caller} and ${callee}. Nothing sent yet.`;
  const hops = c.hops.slice(0, c.revealed);
  const list = hops
    .map(
      (h) =>
        `${h.method ?? "receipt"} on ${h.to} in block ${blockText(h.blockHeight)}${h.ok ? "" : " failed"}`,
    )
    .join(", ");
  const base = `Receipts in order: ${list || "none yet"}.`;
  if (c.step === GAS) {
    const g = gasUse(d);
    const each = g.byContract.map((b) => `${b.accountId} ${formatTgas(b.gas)} Tgas`).join(", ");
    return `${base} The contracts burnt ${formatTgas(g.contractGas)} Tgas (${each}); the NEAR paid for it was destroyed.`;
  }
  return base;
}

export function Facts({ c, compact = false }: { c: CallState; compact?: boolean }) {
  const { step } = c;
  return (
    <div className={`xcc-facts${compact ? " compact" : ""}`} data-testid="call-facts">
      {c.error ? (
        <p className="xcc-warn" role="alert">
          {c.error}
        </p>
      ) : null}
      {step === HOOK || step === HOP ? <Names c={c} /> : null}
      {step === ORDER || step === FAIL ? <Receipts c={c} /> : null}
      {step === GAS && c.call ? <Gas call={c.call} inspected={c.inspected} /> : null}
      {c.hint ? (
        <p className="xcc-hint" role="status" data-testid="pick-hint">
          {c.hint}
        </p>
      ) : null}
    </div>
  );
}

function Names({ c }: { c: CallState }) {
  const { caller, callee } = namesOf(c);
  return (
    <dl className="xcc-list">
      <dt>Contract A, the caller</dt>
      <dd>
        <code>{caller}</code>
      </dd>
      <dt>Contract B, the one it calls</dt>
      <dd>
        <code>{callee}</code>
      </dd>
    </dl>
  );
}

function Source({ d }: { d: CrossCall }) {
  if (d.source === "demo") return null;
  return (
    <p className="xcc-soft" data-testid="call-source">
      {d.source === "recorded"
        ? "Testnet mode: a real call recorded on testnet. Its numbers match the chain (open the transaction below). The lesson shows it instead of sending a new call, so it stays free and fast."
        : "Testnet mode: an illustration on the recorded call. No transaction was sent and this failure did not happen on chain."}
    </p>
  );
}

function Receipts({ c }: { c: CallState }) {
  const d = c.drawn;
  if (!d) return <p className="xcc-soft">{c.busy ? "Sending…" : pressHint(c)}</p>;
  const hops = c.hops.slice(0, c.revealed);
  return (
    <section aria-label="Receipts in block order">
      <Source d={d} />
      <ol className="xcc-receipts" data-testid="receipt-list">
        <li className="tx">
          <span className="xcc-block">{blockText(d.hops[0]!.blockHeight)}</span> shard {d.hops[0]!.shardId}:{" "}
          transaction from <code>{short(d.signerId, 20)}</code> ({formatTgas(d.attachedGas, 0)} Tgas attached)
        </li>
        {hops.map((h, i) => (
          <li key={h.id} className={`${h.ok ? "ok" : "failed"}${c.picked === i ? " picked" : ""}`}>
            <span className="xcc-block">{blockText(h.blockHeight)}</span> shard {h.shardId}:{" "}
            <span aria-hidden="true">{h.ok ? "✓" : "✗"}</span> <code>{h.method}</code> on{" "}
            <code>{short(h.to, 22)}</code>
            <span className="visually-hidden">{h.ok ? " worked" : " failed"}</span>
            {h.kind === "callback" ? <em> (callback, after the data receipt)</em> : null}
            <span className="xcc-note">
              {h.note} · {formatTgas(h.gasBurnt)} Tgas burnt
            </span>
          </li>
        ))}
      </ol>
      {d.source !== "illustration" ? (
        <p className="xcc-soft">
          Transaction{" "}
          {d.source === "recorded" ? (
            <a href={explorerTxUrl(d.txHash)} target="_blank" rel="noreferrer">
              <code>{short(d.txHash, 16)}</code>
            </a>
          ) : (
            <code>{short(d.txHash, 16)}</code>
          )}
          {c.complete ? `, ${d.receiptHops} hops between the contracts.` : ""}
        </p>
      ) : null}
    </section>
  );
}

const pressHint = (c: CallState) =>
  c.step === FAIL ? "Press Simulate out-of-stock failure." : `Press ${orderButton(c.network).press}.`;

function Gas({ call, inspected }: { call: CrossCall; inspected: boolean }) {
  const g = gasUse(call);
  return (
    <section aria-label="Where the gas went" data-testid="gas-split">
      <Source d={call} />
      <dl className="xcc-list">
        <dt>Gas burnt running the contracts</dt>
        <dd>
          <strong data-testid="gas-contracts">{formatTgas(g.contractGas)} Tgas</strong>
        </dd>
        {inspected
          ? g.byContract.map((b) => (
              <div key={b.accountId} className="xcc-sub" data-testid="gas-by-contract">
                <dt>
                  by <code>{short(b.accountId, 22)}</code>
                </dt>
                <dd>{formatTgas(b.gas)} Tgas</dd>
              </div>
            ))
          : null}
        <dt>Burned for good</dt>
        <dd data-testid="gas-burned">all of it</dd>
        <dt>Whole transaction, with the signer's steps and refunds</dt>
        <dd>{formatTgas(g.total)} Tgas</dd>
      </dl>
      <p className="xcc-soft" data-testid="gas-history">
        No account receives burnt gas, not even the contract. Up to and including protocol version 86, the
        contract got 30% of the gas its code burnt. From version 87, all of it is burned.
      </p>
    </section>
  );
}
