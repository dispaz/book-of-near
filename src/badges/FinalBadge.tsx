import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { useChain } from "../chain/ChainContext";
import type { FinalBadge as FinalBadgeToken } from "../chain/types";
import type { ExamReceipt } from "../exam/grade";
import { EXAM_ROUTE_INFO, isExamRoute, type ExamRoute } from "../exam/routes";
import { STAGE_ACCENTS } from "../scene-kit/theme";
import { addDemoFinal } from "./demoLedger";
import { inEventWindow, rarityFor } from "./final";
import { claimFinalBadge } from "./finalFlow";
import type { Rarity } from "./message";
import "./badges.css";

const EXPLORER = "https://testnet.nearblocks.io/nft-token";

/** The final badge image for a tier, from `public/badges/` (the same files the contract's `base_uri` serves). */
export const finalArtUrl = (rarity: Rarity) => `${import.meta.env.BASE_URL}badges/final-${rarity}.svg`;

export function FinalArt({ rarity, size = 96 }: { rarity: Rarity; size?: number }) {
  return (
    <img
      className="badge-art"
      src={finalArtUrl(rarity)}
      width={size}
      height={size}
      alt={`Final badge, ${rarity}`}
      draggable={false}
    />
  );
}

const routeName = (route: string) =>
  isExamRoute(route) ? EXAM_ROUTE_INFO[route].name.toLowerCase() : `"${route}" route`;

/** The final badge's slot on a shelf (My book, the checker): the badge, or an empty ring. */
export function FinalBadgeSlot({ badge, dates = false }: { badge: FinalBadgeToken | null; dates?: boolean }) {
  return (
    <div
      className={badge ? "final-slot held" : "final-slot"}
      style={{ "--stage-accent": STAGE_ACCENTS[7] } as CSSProperties}
      data-final={badge ? badge.rarity : "none"}
      aria-label="Final badge"
      role="group"
    >
      {badge ? (
        <FinalArt rarity={badge.rarity} />
      ) : (
        <span className="badge-empty" aria-hidden="true">
          ★
        </span>
      )}
      <span className="badge-name">Final badge{badge ? `: ${badge.rarity}` : ""}</span>
      <span className="badge-state">
        {badge
          ? `Passed the ${routeName(badge.route)}${
              dates && badge.mintedAtMs ? `, ${new Date(badge.mintedAtMs).toISOString().slice(0, 10)}` : ""
            }`
          : "Pass the final exam to claim it"}
      </span>
    </div>
  );
}

type View =
  | { s: "checking" }
  | { s: "ready" }
  | { s: "claiming" }
  | { s: "claimed"; badge: FinalBadgeToken; fresh: boolean }
  | { s: "failed"; error: string };

/**
 * The final badge claim card on /exam, shown after a pass (issue #29). States: checking, ready (with
 * the rarity the pass earns), claiming, claimed, failed. Demo mode signs in the browser with the demo
 * key; testnet mode asks the Worker (`POST /final`), then the practice account sends `claim_final`.
 */
export function FinalClaim({ route, receipt }: { route: ExamRoute; receipt: ExamReceipt }) {
  const chain = useChain();
  const testnet = chain.network === "testnet";
  const [view, setView] = useState<View>({ s: "checking" });
  const [contractId, setContractId] = useState<string | null>(null);
  const rarity = rarityFor(receipt.score, receipt.total, receipt.passedAtMs);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = (await chain.practiceAccount()).accountId;
        const held = await chain.finalBadgeOf(me);
        const id = await chain.badgeContractId();
        if (!live) return;
        setContractId(id);
        setView((v) =>
          v.s === "claiming" || v.s === "failed"
            ? v
            : held
              ? { s: "claimed", badge: held, fresh: false }
              : { s: "ready" },
        );
      } catch {
        if (live)
          setView({ s: "failed", error: "The badge contract could not be read. Try again in a minute." });
      }
    })();
    return () => {
      live = false;
    };
  }, [chain]);

  async function claim() {
    setView({ s: "claiming" });
    const r = await claimFinalBadge(chain, route, receipt, {
      workerUrl: import.meta.env.VITE_WORKER_URL as string | undefined,
      keepDemoFinal: addDemoFinal,
    }).catch(() => ({ ok: false as const, error: "Something went wrong while claiming. Try again." }));
    if (r.ok) setView({ s: "claimed", badge: r.badge, fresh: true });
    else if ("badge" in r && r.badge) setView({ s: "claimed", badge: r.badge, fresh: false });
    else setView({ s: "failed", error: r.error });
  }

  const shown: Rarity = view.s === "claimed" ? view.badge.rarity : rarity;
  return (
    <section
      className={`claim-badge final-claim claim-${view.s}`}
      style={{ "--stage-accent": STAGE_ACCENTS[7] } as CSSProperties}
      aria-label="Final badge"
      data-claim-state={view.s}
      data-rarity={shown}
    >
      <div className="claim-art">
        {view.s === "claimed" ? (
          <FinalArt rarity={view.badge.rarity} size={88} />
        ) : (
          <span className="badge-empty" aria-hidden="true">
            ★
          </span>
        )}
      </div>
      <div className="claim-body" aria-live="polite">
        {view.s === "checking" ? <p className="claim-title">Checking your final badge…</p> : null}
        {view.s === "ready" ? (
          <>
            <p className="claim-title">Your final badge is ready: {rarity}</p>
            <p className="claim-text">
              Rarity comes from your signed exam result: {receipt.score} of {receipt.total}
              {inEventWindow(receipt.passedAtMs)
                ? ", passed during the hackathon (1 to 14 Nov 2026), which raises it one tier"
                : ""}
              . The badge cannot be sold or sent.
              {testnet
                ? " It is minted on NEAR testnet to your practice account. You pay only a little testnet gas."
                : " In demo mode it lives in this browser. Nothing is sent to a real network."}
            </p>
            <button className="btn primary" onClick={claim}>
              Claim the final badge
            </button>
          </>
        ) : null}
        {view.s === "claiming" ? (
          <p className="claim-title" role="status">
            Claiming…{" "}
            {testnet
              ? "The app's server checks your exam receipt, then your account sends the claim."
              : "Checking your exam receipt, signing the claim and sending it."}
          </p>
        ) : null}
        {view.s === "claimed" ? (
          <>
            <p className="claim-title">
              {view.fresh ? "Final badge claimed" : "You hold the final badge"}: {view.badge.rarity}
            </p>
            <p className="claim-text">
              Earned on the {routeName(view.badge.route)}. It is in <Link to="/my-book">My book</Link>.
              {testnet && contractId ? (
                <>
                  {" "}
                  <a
                    href={`${EXPLORER}/${contractId}/${view.badge.tokenId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
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
