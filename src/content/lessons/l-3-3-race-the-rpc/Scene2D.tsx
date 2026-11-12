/**
 * Lesson 3.3, flat view: the same page as the 3D book scene, drawn in SVG with the same layout
 * (layout3d.ts) and the same scene objects: the learner's mailbox (their app) and a counter window per
 * RPC provider, a latency bar beside each. Every object is a pick, as in 3D. Only draws useRace's state.
 */
import type { SceneProps } from "../../../app/types";
import type { RpcEndpointId } from "../../../chain/rpcEndpoints";
import { SvgMailbox, SvgRpcWindow } from "../../../scene-kit/svg/objects";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import { BAR, FIGURE, LABELS, MAILBOX, WINDOWS, windowsAt } from "./layout3d";
import { barsOf, describe, Facts, noteOf } from "./parts";
import { nameOf } from "./race";
import { CHECK, HOOK, RACE } from "./steps";
import type { RaceState } from "./useRace";

/** The stage accent (stage 3). */
export const ACCENT = STAGE_ACCENTS[3];

/** SVG units per world unit. */
const SCALE = 70;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + 60;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + 60;

export default function Scene2D({
  r,
  reducedMotion,
  mode,
}: {
  r: RaceState;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (r.step >= CHECK) return null;
  return (
    <div
      className={`rpc${reducedMotion ? " still" : ""}`}
      data-testid="rpc-scene"
      data-scene-state={r.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="rpc-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(r)}>
          <Figure r={r} />
        </svg>
      </div>
      <Facts r={r} />
    </div>
  );
}

function Figure({ r }: { r: RaceState }) {
  const ids = windowsAt(r.step);
  const bars = barsOf(r);
  const base = pz(WINDOWS.fastnear[2]) + 40;
  const mb = pz(MAILBOX[2]) + 40;
  return (
    <g>
      {/* The lines from the app to each window: dashed until a window answers. */}
      {ids.map((id) => {
        const look = r.windowLook(id);
        return (
          <path
            key={`l-${id}`}
            d={`M${px(MAILBOX[0])},${mb - 80} L${px(WINDOWS[id][0])},${base + 34}`}
            className={`rpc-link${look === "lit" ? " live" : " dashed"}${look === "down" ? " off" : ""}`}
          />
        );
      })}
      <g data-explain={r.step === HOOK || r.step > RACE ? "windows" : undefined}>
        {ids.map((id) => (
          <Window key={id} r={r} id={id} base={base} />
        ))}
      </g>
      <g data-explain={r.step === RACE ? "bars" : undefined}>
        {bars.map((b) => {
          // Each bar is drawn full height and scaled to its share, so a CSS transition can grow it:
          // from the page when its answer lands, and to a new height when a slower answer rescales.
          const full = BAR.maxHeight * SCALE * 0.6;
          const h = b.share * full;
          const x = px(WINDOWS[b.id][0] + BAR.dx) - 9;
          return (
            <g key={b.id} data-testid={`bar-${b.id}`} data-share={b.share.toFixed(3)}>
              <g className="rpc-grow">
                <rect
                  x={x}
                  y={base - full}
                  width={18}
                  height={full}
                  rx={3}
                  className={`rpc-bar${r.raced?.winner?.endpointId === b.id ? " first" : ""}`}
                  style={{ transform: `scaleY(${b.share})` }}
                />
              </g>
              <text
                x={x + 9}
                y={base - 6}
                textAnchor="middle"
                className="rpc-svg-label small rpc-bar-label"
                style={{ transform: `translateY(${-h}px)` }}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </g>
      <SvgMailbox
        x={px(MAILBOX[0])}
        y={mb}
        size={90}
        name="Your app"
        color={ACCENT}
        flag={r.windowLook("fastnear") === "lit" || !!r.fo?.answeredBy || !!r.hist}
        selected={r.picked === "mailbox"}
        pickLabel="Mailbox: your app and its fallback list"
        onPick={r.pickMailbox}
      />
    </g>
  );
}

function Window({ r, id, base }: { r: RaceState; id: RpcEndpointId; base: number }) {
  const look = r.windowLook(id);
  const tag = noteOf(r, id);
  const x = px(WINDOWS[id][0]);
  return (
    <g data-explain={id === "archival" ? "archive" : undefined}>
      {tag ? (
        <text
          x={x}
          y={base + 24}
          textAnchor="middle"
          className={`rpc-svg-label small${look === "down" ? " off" : ""}`}
        >
          {tag}
        </text>
      ) : null}
      <SvgRpcWindow
        x={x}
        y={base}
        size={92}
        name={LABELS[id]}
        color={ACCENT}
        state={look === "down" ? "failed" : "ok"}
        lit={look === "lit"}
        shut={look === "shut"}
        selected={r.picked === id}
        pickLabel={`Counter window: ${nameOf(id)} RPC node`}
        onPick={() => r.pickWindow(id)}
      />
    </g>
  );
}
