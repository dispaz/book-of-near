import type { CSSProperties } from "react";
import { registry } from "../app/registry";
import type { StageBadge } from "../chain/types";
import { STAGE_BADGE_NAMES, STAGE_BADGES } from "./config";
import { ruleFor } from "./rules";
import "./badges.css";

/** The badge image for a stage, from `public/badges/` (the same files the contract's `base_uri` serves). */
export const badgeArtUrl = (stage: number) => `${import.meta.env.BASE_URL}badges/stage-${stage}.svg`;

export function BadgeArt({ stage, size = 96 }: { stage: number; size?: number }) {
  return (
    <img
      className="badge-art"
      src={badgeArtUrl(stage)}
      width={size}
      height={size}
      alt={`Stage ${stage} badge`}
      draggable={false}
    />
  );
}

const stageInfo = (n: number) => registry.stages.find((s) => s.id === n);

/** One slot per stage: the badge when held, an empty ring when not. */
/** `dates`: show the mint date (testnet only: demo block times are simulated). */
export function BadgeShelf({
  badges,
  label,
  dates = false,
}: {
  badges: StageBadge[];
  label: string;
  dates?: boolean;
}) {
  const held = new Map(badges.map((b) => [b.stage, b]));
  return (
    <ul className="badge-shelf" aria-label={label}>
      {[...Array(STAGE_BADGES).keys()].map((n) => {
        const s = stageInfo(n);
        const name = s?.name ?? STAGE_BADGE_NAMES[n];
        const b = held.get(n);
        // A stage with no badge rule (no lessons yet, or no claim yet) cannot be claimed.
        const open = !!ruleFor(n);
        return (
          <li
            key={n}
            className={b ? "badge-slot held" : "badge-slot"}
            style={{ "--stage-accent": s?.accent } as CSSProperties}
            data-stage={n}
          >
            {b ? (
              <BadgeArt stage={n} />
            ) : (
              <span className="badge-empty" aria-hidden="true">
                {n}
              </span>
            )}
            <span className="badge-name">
              Stage {n}
              {name ? `: ${name}` : ""}
            </span>
            <span className="badge-state">
              {b
                ? `Claimed${dates && b.mintedAtMs ? ` ${new Date(b.mintedAtMs).toISOString().slice(0, 10)}` : ""}`
                : open
                  ? "Not claimed yet"
                  : "Not open yet"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
