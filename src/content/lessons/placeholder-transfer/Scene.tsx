import { useEffect, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { useChain } from "../../../chain/ChainContext";
import { DEMO_RETURN_ACCOUNT } from "../../../chain/DemoChain";
import { isChainError } from "../../../chain/errors";
import { inclusionBlock, totalGasBurnt, totalTokensBurnt, transfer } from "../../../chain/ops";
import type { PracticeAccount, TxOutcome, TxPhase } from "../../../chain/types";
import { formatNear, formatTgas, parseNear } from "../../../chain/units";
import "./scene.css";

const SHOWN: { phase: TxPhase; label: string }[] = [
  { phase: "built", label: "Build" },
  { phase: "signed", label: "Sign" },
  { phase: "broadcast", label: "Broadcast" },
  { phase: "included", label: "Included" },
  { phase: "final", label: "Final" },
];

function short(id: string) {
  return id.length > 20 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export default function Scene({ step, setGate, reducedMotion }: SceneProps) {
  const chain = useChain();
  const [me, setMe] = useState<PracticeAccount | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lit, setLit] = useState<Partial<Record<TxPhase, number>>>({});
  const [result, setResult] = useState<TxOutcome | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    chain.practiceAccount().then(async (acc) => {
      const view = await chain.viewAccount(acc.accountId);
      if (!live) return;
      setMe(acc);
      setBalance(view.amount);
    });
    return () => {
      live = false;
    };
  }, [chain]);

  async function send() {
    if (!me) return;
    setSending(true);
    setError(null);
    try {
      const out = await transfer(chain, DEMO_RETURN_ACCOUNT, parseNear("1"), {
        pace: reducedMotion ? "instant" : "realtime",
        onPhase: (e) => setLit((prev) => ({ ...prev, [e.phase]: e.atMs })),
      });
      setResult(out);
      setBalance((await chain.viewAccount(me.accountId)).amount);
      setGate(true);
    } catch (e) {
      setError(isChainError(e) ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const where = result ? inclusionBlock(result) : null;

  return (
    <div className={`ptx${reducedMotion ? " still" : ""}`} data-scene-state={result ? "sent" : "idle"}>
      <section className="ptx-card" aria-label="Practice account">
        <p className="ptx-label">Practice account</p>
        <p className="ptx-account" title={me?.accountId}>
          {me ? short(me.accountId) : "…"}
        </p>
        <p className="ptx-balance">
          Balance:{" "}
          <strong data-testid="practice-balance">
            {balance === null ? "…" : `${formatNear(balance, 5)} NEAR`}
          </strong>
        </p>
      </section>

      <ol className="ptx-pipeline" data-testid="pipeline" aria-label="Transaction stages">
        {SHOWN.map(({ phase, label }) => {
          const at = lit[phase];
          return (
            <li key={phase} data-phase={phase} data-lit={at !== undefined ? "true" : "false"}>
              <span className="ptx-dot" aria-hidden="true" />
              <span className="ptx-name">{label}</span>
              <span className="ptx-ms">{at !== undefined ? `${at} ms` : " "}</span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="ptx-error" role="alert">
          {error}
        </p>
      ) : null}

      {result && where ? (
        <section className="ptx-card" data-testid="tx-details" aria-label="Transaction details">
          <p className="ptx-label">
            {result.status.type === "Failure" ? "Transaction failed" : "Transaction final"}
          </p>
          <dl>
            <dt>Transaction ID</dt>
            <dd className="ptx-hash" data-testid="tx-hash">
              {result.transaction.hash}
            </dd>
            <dt>Block</dt>
            <dd data-testid="tx-block">#{where.height}</dd>
            <dt>Shard</dt>
            <dd data-testid="tx-shard">Shard {where.shardId}</dd>
            <dt>Gas burnt</dt>
            <dd data-testid="tx-gas">{formatTgas(totalGasBurnt(result))} Tgas</dd>
            <dt>Fee</dt>
            <dd data-testid="tx-fee">{formatNear(totalTokensBurnt(result), 8)} NEAR</dd>
          </dl>
        </section>
      ) : null}

      {step === 1 ? (
        <SceneAction onClick={send} disabled={!me || sending || !!result}>
          {sending ? "Sending…" : "Send 1 NEAR"}
        </SceneAction>
      ) : null}
    </div>
  );
}
