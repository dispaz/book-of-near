/**
 * The facts both views show in HTML (2D under the drawing, 3D in the book scene's panel): the opened
 * transaction, the layout, the hop being looked at and where the time went. Same words, same test ids.
 */
import { breakdown, seconds, touchedBlocks, touchedShards, type Hop, type Trace } from "./trace";
import { FOLLOW, GRID, PICK, START, TIME, type ShardTrace } from "./useShardTrace";

export const KIND: Record<Hop["kind"], string> = {
  transaction: "The transaction runs",
  receipt: "A receipt runs",
  callback: "A callback receipt runs",
  refund: "A gas refund lands",
};

const KIND_SHORT: Record<Hop["kind"], string> = {
  transaction: "Transaction",
  receipt: "Receipt",
  callback: "Callback receipt",
  refund: "Gas refund",
};

export const short = (id: string) => (id.length > 26 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id);
export const ms = (n: number) => (n < 1000 ? `${n} ms` : seconds(n));

/** The accessible name of a hop's slip (3D pick button, 2D pick target). */
export const hopLabel = (h: Hop) =>
  `Chunk ${h.index + 1}: ${KIND_SHORT[h.kind].toLowerCase()} on shard ${h.shardId}, block ${h.blockHeight}`;

export function Facts({ st, compact = false }: { st: ShardTrace; compact?: boolean }) {
  const { trace, step, hop } = st;
  if (step === PICK) {
    return (
      <div className={`shs-facts${compact ? " compact" : ""}`}>
        {st.loading ? <p aria-live="polite">Looking up your transaction…</p> : null}
        {st.problem ? (
          <p className="shs-warn" role="alert">
            {st.problem}
          </p>
        ) : null}
        {st.ownProblem && !trace ? <p className="shs-note">{st.ownProblem}</p> : null}
        {trace ? <Opened trace={trace} /> : <Chosen st={st} />}
      </div>
    );
  }
  if (!trace)
    return st.loading || st.problem ? (
      <div className={`shs-facts${compact ? " compact" : ""}`}>
        {st.loading ? <p aria-live="polite">Looking up your transaction…</p> : null}
        {st.problem ? (
          <p className="shs-warn" role="alert">
            {st.problem} Go back to step 1 to choose again.
          </p>
        ) : null}
      </div>
    ) : null;
  return (
    <div className={`shs-facts${compact ? " compact" : ""}`}>
      {step === GRID ? <Layout st={st} trace={trace} /> : null}
      {step >= START && step <= FOLLOW && hop ? (
        <section className="shs-hop" aria-label="The hop you are on" data-testid="hop-box">
          <p className="shs-line">
            {step === START ? (
              <>
                Started on shard <strong data-testid="first-shard">{trace.hops[0]!.shardId}</strong>, in block{" "}
                {trace.firstBlock}.
              </>
            ) : (
              <>
                Step <strong data-testid="hop-index">{st.at + 1}</strong> of{" "}
                <strong data-testid="hop-total">{trace.hops.length}</strong>.
              </>
            )}
          </p>
          <HopDetail hop={hop} />
        </section>
      ) : null}
      {step === START ? (
        // The follow step's counters, kept in the page (hidden) so they always exist for tests and readers.
        <span className="visually-hidden">
          <span data-testid="hop-index">{st.at + 1}</span>
          <span data-testid="hop-total">{trace.hops.length}</span>
        </span>
      ) : null}
      {step === TIME ? <Timeline st={st} trace={trace} /> : null}
      {step === FOLLOW ? <PathSoFar trace={trace} upTo={st.reached} /> : null}
    </div>
  );
}

function Chosen({ st }: { st: ShardTrace }) {
  return (
    <p className="shs-line" data-testid="chosen">
      Chosen: <strong>{st.choice === "mine" ? "your transaction from 0.3" : "the recorded example"}</strong>.
      Load its path to open it.
    </p>
  );
}

function Opened({ trace }: { trace: Trace }) {
  const shards = touchedShards(trace);
  return (
    <div className="shs-opened" data-testid="opened">
      <p className="shs-line">
        {trace.source === "recorded"
          ? "Recorded example: a real testnet transaction saved on 1 Nov 2026."
          : trace.source === "yours"
            ? "Your transaction from 0.3, read from testnet."
            : "Your demo transaction from 0.3."}
      </p>
      <p className="shs-line">
        Transaction ID <code data-testid="trace-tx">{trace.txHash}</code>
      </p>
      <p className="shs-note">
        {shards.length === 1
          ? `It stayed on shard ${shards[0]}: sender and receiver live on the same shard. Choose the recorded example to see one cross shards.`
          : `It touched ${shards.length} shards in ${touchedBlocks(trace).length} blocks.`}
      </p>
    </div>
  );
}

function Layout({ st, trace }: { st: ShardTrace; trace: Trace }) {
  const picked = st.shard;
  const used =
    picked === null
      ? 0
      : touchedBlocks({ ...trace, hops: trace.hops.filter((h) => h.shardId === picked) }).length;
  return (
    <>
      <p className="shs-line" data-testid="layout-line">
        The network has <strong data-testid="shard-count">{trace.shardIds.length}</strong> shards. This page
        shows <strong>{trace.lastBlock - trace.firstBlock + 1}</strong> blocks, one chunk per shard in each.
      </p>
      {trace.source === "demo" ? (
        <p className="shs-note">Demo mode uses a made-up layout of six shards. Testnet has more.</p>
      ) : null}
      <p className="shs-note" data-testid="shard-pick" aria-live="polite">
        {picked === null
          ? "Pick a ribbon to look at one shard."
          : `Shard ${picked} made a chunk in each of these blocks. Your transaction used ${used === 0 ? "none of them" : used === 1 ? "one of them" : `${used} of them`}.`}
      </p>
    </>
  );
}

function PathSoFar({ trace, upTo }: { trace: Trace; upTo: number }) {
  const shards = touchedShards({ ...trace, hops: trace.hops.slice(0, upTo + 1) });
  return (
    <p className="shs-note">
      Path so far:{" "}
      {shards.length === 1 ? `shard ${shards[0]}` : `${shards.length} shards (${shards.join(" → ")})`}.
    </p>
  );
}

export function HopDetail({ hop }: { hop: Hop }) {
  return (
    <div className="shs-detail" data-testid="hop-detail">
      <p className="shs-kind">
        {KIND[hop.kind]} on <strong>{hop.accountId}</strong>
      </p>
      <dl>
        <div>
          <dt>Shard</dt>
          <dd>shard {hop.shardId}</dd>
        </div>
        <div>
          <dt>Block</dt>
          <dd>block {hop.blockHeight}</dd>
        </div>
        <div>
          <dt>Chunk</dt>
          <dd>
            <code title={hop.chunkHash}>{short(hop.chunkHash)}</code>
            <span className="visually-hidden"> {hop.chunkHash}</span>
          </dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>+{ms(hop.sinceMs)} after the first block</dd>
        </div>
      </dl>
    </div>
  );
}

function Timeline({ st, trace }: { st: ShardTrace; trace: Trace }) {
  const parts = breakdown(trace, st.seen);
  const total = parts.reduce((a, p) => a + p.ms, 0) || 1;
  const own = parts.length > 1;
  return (
    <section className="shs-time" data-testid="timeline" aria-label="Where the time went">
      <ol className="shs-steps">
        {trace.hops.map((h) => (
          <li key={h.id}>
            <span className="shs-when">+{ms(h.sinceMs)}</span> {KIND_SHORT[h.kind]} · shard {h.shardId}
          </li>
        ))}
      </ol>
      <p className="shs-line">
        All steps ran within <strong data-testid="work-time">{seconds(trace.workMs)}</strong> of the first
        block.
      </p>
      {st.inspected ? (
        <div data-testid="breakdown">
          <div className="shs-bar" aria-hidden="true">
            {parts.map((p) => (
              <span
                key={p.key}
                className={p.key}
                style={{ width: `${Math.max(2, (p.ms / total) * 100)}%` }}
              />
            ))}
          </div>
          <ul className="shs-legend">
            {parts.map((p) => (
              <li key={p.key} data-part={p.key}>
                <span className={`swatch ${p.key}`} aria-hidden="true" /> {p.label}:{" "}
                <strong>{seconds(p.ms)}</strong>
              </li>
            ))}
          </ul>
          {own ? null : (
            <p className="shs-note">
              This is a saved transaction, so its time to Final is not in the data. Only the hops are known. A
              stopwatch like the one in 0.3 would add the hand-over and finality.
            </p>
          )}
        </div>
      ) : (
        <p className="shs-note">Inspect the breakdown to split the time into parts.</p>
      )}
    </section>
  );
}
