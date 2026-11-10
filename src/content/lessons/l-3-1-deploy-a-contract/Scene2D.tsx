/**
 * Lesson 3.1, flat view: the same page as the 3D book scene, drawn in SVG with the same layout
 * (layout3d.ts) and the same scene objects: your mailbox, the contract's sub-mailbox, the contract scroll,
 * the balance gauge and, at the failing callback, one receipt slip per receipt. Every object is a pick,
 * as in 3D. Only draws the shared state from useDeploy.
 */
import type { SceneProps } from "../../../app/types";
import { SvgPickable } from "../../../scene-kit/svg";
import { SvgMailbox, SvgReceiptSlip, SvgScroll } from "../../../scene-kit/svg/objects";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import { nearText } from "./contract";
import { FIGURE, GAUGE, PARENT, partsAt, SCROLL, SLIPS, SUB } from "./layout3d";
import { describe, Facts, picksOf, short } from "./parts";
import { CHECK, FAIL, WASM } from "./steps";
import type { Deploy } from "./useDeploy";

/** The stage accent (stage 3). */
export const ACCENT = STAGE_ACCENTS[3];

/** SVG units per world unit. */
const SCALE = 70;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE;

export default function Scene2D({
  d,
  reducedMotion,
  mode,
}: {
  d: Deploy;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (d.step >= CHECK) return null;
  return (
    <div
      className={`dpc${reducedMotion ? " still" : ""}`}
      data-testid="deploy-scene"
      data-scene-state={d.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="dpc-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(d)}>
          <Figure d={d} />
        </svg>
      </div>
      <Facts d={d} />
    </div>
  );
}

function Figure({ d }: { d: Deploy }) {
  const parts = partsAt(d.step);
  const picks = picksOf(d);
  const running = d.busy !== null && d.busy !== "read" && d.busy !== "deploy";
  const scrollNote =
    d.step === WASM || (!d.deployed && d.unrolled)
      ? d.facts.header.slice(0, 11)
      : d.deployed
        ? `count ${d.count ?? 0}`
        : undefined;
  const [sx, sy] = [px(SUB[0]), pz(SUB[2]) + 40];
  const [ax, ay] = [px(PARENT[0]), pz(PARENT[2]) + 50];
  return (
    <g>
      {/* The post line from your account to the sub-account under it. */}
      <path
        d={`M${ax},${ay} L${sx},${sy}`}
        className={`dpc-link${d.deployed ? "" : " dashed"}`}
        fill="none"
      />
      <g data-explain={d.step === 0 ? "submailbox" : undefined}>
        <SvgMailbox
          x={sx}
          y={sy}
          size={96}
          name="counter"
          color={ACCENT}
          state={d.deployed ? "ok" : "pending"}
          flag={d.deployed}
          {...picks.sub}
        />
      </g>
      <SvgMailbox
        x={ax}
        y={ay}
        size={124}
        name={short(d.parent?.id ?? "your account", 18)}
        color={ACCENT}
        {...picks.parent}
      />
      <g data-explain={d.step === WASM || d.step === 3 ? "scroll" : undefined}>
        <SvgScroll
          x={px(SCROLL[0])}
          y={pz(SCROLL[2]) + 70}
          size={118}
          name="counter.wasm"
          note={scrollNote}
          state={d.deployed || d.step === WASM ? "ok" : "pending"}
          running={running}
          {...picks.scroll}
        />
      </g>
      {parts.includes("gauge") ? <Gauge d={d} /> : null}
      {parts.includes("slips") ? <Slips d={d} /> : null}
    </g>
  );
}

/** The contract account's balance: locked for storage (accent) and available (paper). */
function Gauge({ d }: { d: Deploy }) {
  const p = picksOf(d).gauge;
  const w = GAUGE.length * SCALE;
  const h = GAUGE.depth * SCALE;
  const x = px(GAUGE.center[0]) - w / 2;
  const y = pz(GAUGE.center[2]) - h / 2;
  const lockW = d.deployed ? Math.max(4, w * d.gauge.share) : 0;
  return (
    <g data-explain="gauge">
      <SvgPickable label={p.pickLabel} onPick={p.onPick} focus={[x - 6, y - 26, w + 12, h + 52]}>
        <rect x={x} y={y} width={w} height={h} rx={8} className={`dpc-bar${d.deployed ? "" : " dashed"}`} />
        {lockW > 0 ? <rect x={x} y={y} width={lockW} height={h} rx={8} className="dpc-bar-lock" /> : null}
        <text x={x} y={y - 8} className="dpc-svg-label">
          {d.deployed ? `locked for storage: ${nearText(d.gauge.lock)} NEAR` : "no account yet"}
        </text>
        {d.deployed ? (
          <text x={x + w} y={y + h + 20} textAnchor="end" className="dpc-svg-label">
            {`available: ${nearText(d.gauge.available)} NEAR`}
          </text>
        ) : null}
      </SvgPickable>
    </g>
  );
}

/** Step 5: one slip per receipt of the call, top to bottom, ✓ or ✗. */
function Slips({ d }: { d: Deploy }) {
  const list = d.receipts ?? [];
  return (
    <g data-explain={d.step === FAIL ? "receipts" : undefined}>
      {SLIPS.map((s, i) => {
        const r = list[i];
        return (
          <g key={i}>
            <SvgReceiptSlip
              x={px(s[0])}
              y={pz(s[2]) + 18}
              size={46}
              color={ACCENT}
              state={r ? "ok" : "pending"}
              fate={r ? (r.ok ? "done" : "failed") : "idle"}
              label={String(i + 1)}
              pickLabel={`Receipt ${i + 1}: ${r ? r.method : "not sent yet"}${r ? (r.ok ? " worked" : " failed") : ""}`}
              onPick={() => void (d.receipts ? d.inspect() : d.failWithCallback())}
            />
            <text x={px(s[0])} y={pz(s[2]) + 40} textAnchor="middle" className="dpc-svg-label small">
              {r ? r.method : ["call_other", "fail", "on_other_done"][i]}
            </text>
          </g>
        );
      })}
    </g>
  );
}
