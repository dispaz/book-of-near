import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { cols, slots } from "./layout3d";
import {
  CHECK,
  FOLLOW,
  GRID,
  HONEST,
  PICK,
  START,
  TIME,
  useShardTrace,
  type ShardTrace,
} from "./useShardTrace";
import { seconds, timeSplit, touchedBlocks, touchedShards, type Hop, type Trace } from "./trace";
import "./scene.css";

/** The 3D view, loaded only when the learner picks 3D, so 2D never downloads three.js. */
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What is a chunk?",
    options: [
      { text: "The work one shard did in one block.", correct: true },
      { text: "A piece of your private key.", why: "Keys are not involved: a chunk is network work." },
      {
        text: "Another word for a transaction.",
        why: "A chunk holds many transactions and receipts from one shard.",
      },
    ],
  },
  {
    prompt: "Which shard runs your transaction first?",
    options: [
      { text: "The shard of the account that signed it.", correct: true },
      {
        text: "The shard of the receiver.",
        why: "The receiver's shard runs the receipt, in a later block.",
      },
      { text: "A random shard.", why: "The account name decides the shard, so it is always the same one." },
    ],
  },
  {
    prompt: "Why can one transaction take several blocks?",
    options: [
      { text: "Each receipt runs in a later block, and a refund receipt follows.", correct: true },
      { text: "The network waits for you to approve each step.", why: "Nothing waits for you." },
      {
        text: "Shards take turns, one per block.",
        why: "Every shard makes a chunk in every block. The wait is for the next receipt, not a turn.",
      },
    ],
  },
];

const KIND: Record<Hop["kind"], string> = {
  transaction: "The transaction runs",
  receipt: "A receipt runs",
  callback: "A callback receipt runs",
  refund: "A gas refund lands",
};

const short = (id: string) => (id.length > 26 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id);
const ms = (n: number) => (n < 1000 ? `${n} ms` : seconds(n));

export default function Scene(props: SceneProps) {
  const { step, view, flat, reducedMotion, mode, setGate, setVars, reportEvidence } = props;
  const st = useShardTrace({ step, setGate, setVars, reportEvidence });
  const summary = step >= CHECK;
  const three = view === "3d" && !summary;

  return (
    <>
      {summary ? null : (
        <div
          className={`shs${reducedMotion ? " still" : ""}${three ? " three" : ""}`}
          data-testid="shard-scene"
          data-scene-state={st.state}
          data-view={view}
          data-mode={mode}
          role="group"
          aria-label="Your transaction across shards"
        >
          {st.trace && step >= GRID ? (
            three ? (
              <div className="shs-3d" data-testid="shard-3d">
                <Suspense fallback={<p className="shs-loading">Loading the 3D scene…</p>}>
                  <Scene3D st={st} trace={st.trace} flat={flat} reducedMotion={reducedMotion} />
                </Suspense>
              </div>
            ) : (
              <Grid2D st={st} trace={st.trace} />
            )
          ) : (
            <Empty st={st} three={three} />
          )}
          <Facts st={st} />
        </div>
      )}

      {step === PICK ? <Picker st={st} /> : null}
      {step === FOLLOW && st.trace ? (
        <SceneAction onClick={st.follow} disabled={st.at >= st.last}>
          {st.at >= st.last ? "Followed ✓" : "Follow next receipt"}
        </SceneAction>
      ) : null}

      {step === CHECK ? (
        <Check
          questions={QUESTIONS}
          passed={st.passed}
          onPass={() => {
            st.pass();
            setGate(true);
          }}
        />
      ) : null}
      {step === HONEST ? (
        <HonestTake
          comparedWith={["Ethereum", "Solana"]}
          strengths={[
            "Work is split. Every block carries one chunk per shard, so shards do their work side by side instead of one machine doing everything. You saw this in the grid: one cell per shard per block.",
            "You do not have to know. You use one account and one address. The network finds the shard from the account name, and the receipts find their own way.",
          ]}
          weaknesses={[
            "A call that crosses shards takes extra blocks. A receipt runs on the receiver's shard in a later block, so the answer comes after the call. Ethereum contracts calling each other settle inside one transaction; Solana is a single shared state (unverified here).",
            "It is hard to read. A transaction's status carries no shard number. Apps must work it out from the shard layout, which is why this lesson had to look it up in two steps.",
            "Ethereum chose another road. ethereum.org says shard chains are no longer on its roadmap: it scales with rollups that batch transactions and post the results to Ethereum. Rollups add a second layer to trust. Sharding keeps one chain but puts the complexity inside it.",
            "The layout changes. Testnet had 10 shards with non-contiguous ids on 1 Nov 2026. Resharding changes the numbers, so nothing may hard-code them.",
          ]}
        />
      ) : null}
    </>
  );
}

// ---------- choosing the transaction (docked buttons) ----------

function Picker({ st }: { st: ShardTrace }) {
  return (
    <>
      <SceneAction
        onClick={() => void st.open("mine")}
        disabled={!!st.ownProblem || st.loading || st.choice === "mine"}
      >
        {st.choice === "mine" && st.trace ? "Use my 0.3 transaction ✓" : "Use my 0.3 transaction"}
      </SceneAction>
      <SceneAction onClick={() => void st.open("example")} disabled={st.loading || st.choice === "example"}>
        {st.choice === "example" ? "Use the recorded example ✓" : "Use the recorded example"}
      </SceneAction>
    </>
  );
}

// ---------- the facts shared by both views ----------

function Empty({ st, three }: { st: ShardTrace; three: boolean }) {
  return (
    <div className={`shs-empty${three ? " three" : ""}`} data-testid="shard-empty">
      <p>{st.loading ? "Looking up your transaction…" : "No transaction open yet. Pick one below."}</p>
    </div>
  );
}

function Facts({ st }: { st: ShardTrace }) {
  const { trace, step, hop } = st;
  if (step === PICK) {
    return (
      <div className="shs-facts">
        {st.loading ? <p aria-live="polite">Looking up your transaction…</p> : null}
        {st.problem ? (
          <p className="shs-warn" role="alert">
            {st.problem}
          </p>
        ) : null}
        {st.ownProblem && !trace ? <p className="shs-note">{st.ownProblem}</p> : null}
        {trace ? <Opened trace={trace} /> : null}
      </div>
    );
  }
  if (!trace) return null;
  const shards = touchedShards(trace);
  return (
    <div className="shs-facts">
      <p className="shs-line" data-explain={step === GRID ? "grid" : undefined} data-testid="layout-line">
        The network has <strong data-testid="shard-count">{trace.shardIds.length}</strong> shards. This grid
        shows <strong>{cols(trace)}</strong> blocks, one chunk per shard in each.
      </p>
      {step >= START && hop ? (
        <section className="shs-hop" data-explain="hop" aria-label="The hop you are on" data-testid="hop-box">
          <p className="shs-line">
            {step === START ? (
              <>
                Started on shard <strong data-testid="first-shard">{trace.hops[0]!.shardId}</strong>.
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
      {step >= START && step < FOLLOW ? (
        // The follow step's counters, kept in the page (hidden) so they always exist for tests and readers.
        <span className="visually-hidden">
          <span data-testid="hop-index">{st.at + 1}</span>
          <span data-testid="hop-total">{trace.hops.length}</span>
        </span>
      ) : null}
      {step === TIME ? <Timeline trace={trace} seen={st.seen} /> : null}
      {step >= FOLLOW ? (
        <p className="shs-note">
          Path so far: {shards.length === 1 ? "one shard" : `${shards.length} shards (${shards.join(" → ")})`}
          .
        </p>
      ) : null}
    </div>
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
          ? `It stayed on shard ${shards[0]}: sender and receiver live on the same shard. Open the recorded example to see one cross shards.`
          : `It touched ${shards.length} shards and ${touchedBlocks(trace).length} blocks.`}
      </p>
    </div>
  );
}

function HopDetail({ hop }: { hop: Hop }) {
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

function Timeline({ trace, seen }: { trace: Trace; seen: ShardTrace["seen"] }) {
  const split = timeSplit(trace, seen);
  const total = split ? split.finalMs : trace.workMs || 1;
  const pct = (n: number) => `${Math.max(2, (n / total) * 100)}%`;
  return (
    <section className="shs-time" data-explain="time" data-testid="timeline" aria-label="Where the time went">
      <ol className="shs-steps">
        {trace.hops.map((h) => (
          <li key={h.id}>
            <span className="shs-when">+{ms(h.sinceMs)}</span>{" "}
            {KIND[h.kind].replace(" runs", "").replace(" lands", "")} · shard {h.shardId}
          </li>
        ))}
      </ol>
      <p className="shs-line">
        All steps ran <strong data-testid="work-time">{seconds(trace.workMs)}</strong> after the first block.
      </p>
      {split ? (
        <>
          <div className="shs-bar" aria-hidden="true">
            <span style={{ width: pct(split.includedMs) }} className="a" />
            <span style={{ width: pct(split.workMs) }} className="b" />
            <span style={{ width: pct(split.restMs) }} className="c" />
          </div>
          <p className="shs-note">
            Of the {seconds(split.finalMs)} you saw in 0.3: about {seconds(split.includedMs)} to hand it over
            and get it into a block, {seconds(split.workMs)} for the receipts, and the rest waiting for the
            network to agree it is final.
          </p>
        </>
      ) : (
        <p className="shs-note">
          This is a saved transaction, so the time to Final is not in its data. The receipts above are part of
          what a stopwatch like the one in 0.3 would have counted.
        </p>
      )}
    </section>
  );
}

// ---------- the flat view ----------

function Grid2D({ st, trace }: { st: ShardTrace; trace: Trace }) {
  const rows = trace.shardIds.length;
  const n = cols(trace);
  const LEFT = 64;
  const W = 92;
  const H = 30;
  const TOP = 8;
  const width = LEFT + n * W + 10;
  const height = TOP + rows * H + 28;
  const sl = slots(trace);
  const x = (height_: number) => LEFT + (height_ - trace.firstBlock) * W;
  const y = (shardId: number) => TOP + trace.shardIds.indexOf(shardId) * H;
  const drawn = st.drawn;
  const pos = trace.hops.map((h, i) => {
    const slot = sl[i]!;
    const cw = (W - 8) / slot.of;
    return { cx: x(h.blockHeight) + 4 + slot.index * cw + cw / 2, cy: y(h.shardId) + (H - 4) / 2 };
  });
  return (
    <div className="shs-2d" data-testid="shard-2d">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Grid of ${rows} shards by ${n} blocks. ${
          drawn >= 0 ? `${drawn + 1} of ${trace.hops.length} steps drawn.` : "No path drawn yet."
        }`}
      >
        {trace.shardIds.map((s) => (
          <g key={s}>
            <text x={LEFT - 8} y={y(s) + 17} textAnchor="end" className="shs-svg-label">
              shard {s}
            </text>
            {Array.from({ length: n }, (_, c) => (
              <rect
                key={c}
                x={LEFT + c * W + 4}
                y={y(s)}
                width={W - 8}
                height={H - 4}
                rx={5}
                className="shs-cell"
              />
            ))}
          </g>
        ))}
        {Array.from({ length: n }, (_, c) => (
          <text
            key={c}
            x={LEFT + c * W + W / 2}
            y={TOP + rows * H + 16}
            textAnchor="middle"
            className="shs-svg-label"
          >
            …{String(trace.firstBlock + c).slice(-4)}
          </text>
        ))}
        {drawn > 0 ? (
          <polyline
            className="shs-path"
            fill="none"
            points={pos
              .slice(0, drawn + 1)
              .map((p) => `${p.cx},${p.cy}`)
              .join(" ")}
          />
        ) : null}
        {trace.hops.slice(0, Math.max(0, drawn + 1)).map((h, i) => (
          <g
            key={h.id}
            className={`shs-hopmark${i === st.at ? " current" : ""}`}
            onClick={() => st.pick(i)}
            aria-hidden="true"
          >
            <circle cx={pos[i]!.cx} cy={pos[i]!.cy} r={10} />
            <text x={pos[i]!.cx} y={pos[i]!.cy + 4} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      {/* Keyboard and screen-reader route to the same picks as the clicks on the drawing. */}
      <ul className="visually-hidden">
        {trace.hops.slice(0, Math.max(0, drawn + 1)).map((h, i) => (
          <li key={h.id}>
            <button
              onClick={() => st.pick(i)}
            >{`Chunk ${i + 1}: shard ${h.shardId}, block ${h.blockHeight}`}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
