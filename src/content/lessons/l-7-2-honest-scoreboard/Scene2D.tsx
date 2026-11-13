/**
 * Lesson 7.2, flat view: the same board as the 3D book scene, drawn from the front in SVG. Four chain
 * pillars stand on a line and rise or sink with the open card; the four dimension cards lie below them.
 * Every pillar and card is a pick, as in 3D. Only draws the shared state from useScoreboard.
 */
import type { SceneProps } from "../../../app/types";
import { SvgPickable } from "../../../scene-kit/svg";
import { COLORS, INK } from "../../../scene-kit/theme";
import stage from "../../stages/7-book-of-near/stage";
import { CHAINS, describeBoard, DIMS, pillarHeight, VERDICT_TEXT, verdictOf, type Obj } from "./board";
import { CARD_X, CHAIN_COLOR, PILLAR_X } from "./layout";
import { Facts, pickName } from "./parts";
import { CHECK, type Scoreboard } from "./useScoreboard";

const ACCENT = stage.accent;
const W = 560;
/** SVG units per world unit along x, and per unit of pillar height. */
const SX = 64;
const SY = 62;
const BASE = 196;
const BAR = 64;
const CARD_W = 116;
const CARD_Y = 236;
const x = (wx: number) => W / 2 + wx * SX;

export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: Scoreboard;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`hsb${reducedMotion ? " still" : ""}`}
      data-testid="hsb-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="hsb-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} 300`} role="group" aria-label={describeBoard(m.active)}>
          <Board m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

function Board({ m }: { m: Scoreboard }) {
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) => (m.notYet(o) ? ` hsb-shake${(m.picked?.n ?? 0) % 2}` : "");
  const max = 2 * SY;
  return (
    <g>
      <line x1={16} x2={W - 16} y1={BASE} y2={BASE} stroke={INK} strokeWidth="2.5" />
      {CHAINS.map((c) => {
        const o: Obj = { kind: "pillar", chain: c.id };
        const h = pillarHeight(c.id, m.active) * SY;
        const verdict = m.active ? VERDICT_TEXT[verdictOf(m.active, c.id)] : "";
        const cx = x(PILLAR_X[c.id]);
        return (
          <g key={c.id} className={shake(o).trim() || undefined}>
            <SvgPickable
              label={pickName(o)}
              selected={m.isPicked(o)}
              onPick={() => m.pick(o)}
              focus={[cx - BAR / 2 - 8, BASE - max - 40, BAR + 16, max + 64]}
            >
              <rect
                className="hsb-bar"
                x={cx - BAR / 2}
                y={BASE - max}
                width={BAR}
                height={max}
                rx="6"
                fill={CHAIN_COLOR[c.id]}
                stroke={INK}
                strokeWidth={m.isPicked(o) ? 4 : 2.5}
                style={{ transform: `scaleY(${h / max})` }}
              />
              <text x={cx} y={BASE + 20} textAnchor="middle" className="hsb-name">
                {c.name}
              </text>
              <text
                x={cx}
                y={BASE - max - 14}
                textAnchor="middle"
                className="hsb-verdict-label"
                data-verdict={verdict || undefined}
              >
                {verdict}
              </text>
            </SvgPickable>
          </g>
        );
      })}
      {DIMS.map((d) => {
        const o: Obj = { kind: "card", dim: d.id };
        const cx = x(CARD_X[d.id]);
        const on = m.active === d.id;
        const seen = m.explored.has(d.id);
        return (
          <g key={d.id} className={shake(o).trim() || undefined}>
            <SvgPickable
              label={pickName(o)}
              selected={on}
              onPick={() => m.pick(o)}
              focus={[cx - CARD_W / 2 - 6, CARD_Y - 6, CARD_W + 12, 56]}
            >
              <rect
                x={cx - CARD_W / 2}
                y={CARD_Y}
                width={CARD_W}
                height={44}
                rx="8"
                fill={seen ? ACCENT : COLORS.paper}
                stroke={INK}
                strokeWidth={on ? 4 : 2}
                strokeDasharray={seen || d.step === m.step ? undefined : "6 5"}
              />
              <text x={cx} y={CARD_Y + 28} textAnchor="middle" className="hsb-card-title">
                {d.title}
              </text>
            </SvgPickable>
          </g>
        );
      })}
    </g>
  );
}
