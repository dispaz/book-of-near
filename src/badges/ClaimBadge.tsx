import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { useChain } from "../chain/ChainContext";
import { useProgress } from "../progress";
import { BadgeArt } from "./BadgeShelf";
import { claimStageBadge } from "./claimFlow";
import { keepDemoBadges } from "./demoLedger";
import { claimReadiness, ruleFor, type Missing } from "./rules";
import "./badges.css";

type View =
  | { s: "checking" }
  | { s: "not-yet"; missing: Missing[]; previous?: number }
  | { s: "ready" }
  | { s: "claiming" }
  | { s: "claimed"; tokenId?: string; contractId?: string }
  | { s: "failed"; error: string };

const EXPLORER = "https://testnet.nearblocks.io/nft-token";

/**
 * Sent on `window` after a badge is claimed, with `detail.stage`, so the next stage's card checks again:
 * its claim needs the badge just claimed. Without it, that card said "Claim the stage N badge first" until
 * a reload. Only that one card re-checks: in testnet mode every check costs RPC reads.
 */
const CLAIMED_EVENT = "bon:badge-claimed";

/**
 * The claim button at the end of a stage. States: not yet (with what is missing), ready, claiming,
 * claimed, failed. Demo mode signs in the browser; testnet mode asks the Worker (claimFlow.ts).
 */
export function ClaimBadge({ stage, accent }: { stage: number; accent?: string }) {
  const chain = useChain();
  const { completions } = useProgress();
  const [view, setView] = useState<View>({ s: "checking" });
  /** Bumped when the previous stage's badge is claimed, to run the check again. */
  const [recheck, setRecheck] = useState(0);
  const testnet = chain.network === "testnet";
  const rule = ruleFor(stage);

  useEffect(() => {
    const again = (e: Event) => {
      if ((e as CustomEvent<{ stage?: number }>).detail?.stage === stage - 1) setRecheck((n) => n + 1);
    };
    window.addEventListener(CLAIMED_EVENT, again);
    return () => window.removeEventListener(CLAIMED_EVENT, again);
  }, [stage]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = (await chain.practiceAccount()).accountId;
        if (await chain.hasBadge(me, stage)) {
          const contractId = await chain.badgeContractId();
          // Keep the tokenId of a claim made on this card: the explorer link needs it.
          if (live)
            setView((v) => ({
              s: "claimed",
              tokenId: v.s === "claimed" ? v.tokenId : undefined,
              contractId,
            }));
          return;
        }
        const ready = claimReadiness(stage, completions, testnet ? "testnet" : "demo");
        const prevMissing = stage > 0 && !(await chain.hasBadge(me, stage - 1));
        if (!live) return;
        // A lagging RPC node can still say "no badge" just after a claim: a claimed card never goes back.
        setView((v) =>
          v.s === "claiming" || v.s === "failed" || v.s === "claimed"
            ? v
            : !ready.ready || prevMissing
              ? { s: "not-yet", missing: ready.missing, previous: prevMissing ? stage - 1 : undefined }
              : { s: "ready" },
        );
      } catch {
        if (live)
          setView((v) =>
            v.s === "claimed"
              ? v
              : { s: "failed", error: "The badge contract could not be read. Try again in a minute." },
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [chain, stage, completions, testnet, recheck]);

  if (!rule) return null;

  async function claim() {
    setView({ s: "claiming" });
    const r = await claimStageBadge(chain, stage, completions, {
      workerUrl: import.meta.env.VITE_WORKER_URL as string | undefined,
      keepDemoBadges: (b) => keepDemoBadges(b),
    }).catch(() => ({ ok: false as const, error: "Something went wrong while claiming. Try again." }));
    if (r.ok) {
      setView({ s: "claimed", tokenId: r.tokenId, contractId: await chain.badgeContractId() });
      window.dispatchEvent(new CustomEvent(CLAIMED_EVENT, { detail: { stage } }));
    } else setView({ s: "failed", error: r.error });
  }

  return (
    <section
      className={`claim-badge claim-${view.s}`}
      style={{ "--stage-accent": accent } as CSSProperties}
      aria-label={`Stage ${stage} badge`}
      id={`stage-${stage}-badge`}
      data-claim-state={view.s}
    >
      <div className="claim-art">
        {view.s === "claimed" ? (
          <BadgeArt stage={stage} size={72} />
        ) : (
          <span className="badge-empty" aria-hidden="true">
            {stage}
          </span>
        )}
      </div>
      <div className="claim-body" aria-live="polite">
        {view.s === "checking" ? <p className="claim-title">Checking your badge…</p> : null}
        {view.s === "not-yet" ? (
          <>
            <p className="claim-title">Stage {stage} badge: not yet</p>
            <p className="claim-text">To claim it:</p>
            <ul className="claim-missing">
              {view.previous !== undefined ? <li>Claim the stage {view.previous} badge first.</li> : null}
              {view.missing.map((m) => (
                <li key={`${m.lessonId}-${m.reason}`}>{m.text}</li>
              ))}
            </ul>
          </>
        ) : null}
        {view.s === "ready" ? (
          <>
            <p className="claim-title">Stage {stage} is done. Your badge is ready.</p>
            <p className="claim-text">
              {testnet
                ? "The badge is a token on NEAR testnet that only your practice account can hold. It cannot be sold or sent."
                : "In demo mode the badge lives in this browser. Nothing is sent to a real network."}
            </p>
            <button className="btn primary" onClick={claim}>
              Claim the stage {stage} badge
            </button>
          </>
        ) : null}
        {view.s === "claiming" ? (
          <p className="claim-title" role="status">
            Claiming…{" "}
            {testnet
              ? "The app checks your work on testnet, then your account sends the claim."
              : "Signing the claim and sending it."}
          </p>
        ) : null}
        {view.s === "claimed" ? (
          <>
            <p className="claim-title">Stage {stage} badge claimed</p>
            <p className="claim-text">
              It is on the shelf in <Link to="/my-book">My book</Link>.
              {testnet && view.contractId && view.tokenId ? (
                <>
                  {" "}
                  <a href={`${EXPLORER}/${view.contractId}/${view.tokenId}`} target="_blank" rel="noreferrer">
                    See it on the testnet explorer
                  </a>
                  .
                </>
              ) : null}
            </p>
          </>
        ) : null}
        {view.s === "failed" ? (
          <>
            <p className="claim-title">The claim did not work</p>
            <p className="claim-text">{view.error}</p>
            <button className="btn" onClick={claim}>
              Try again
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
