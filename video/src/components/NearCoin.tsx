/**
 * A NEAR coin, drawn like the app's coins (src/scene-kit/svg SvgCoin): NEAR green, an ink rim, the NEAR
 * mark (src/scene-kit/nearMark.ts) on its face. `turn` is its spin in turns: the face narrows to its edge
 * and back, showing the rim's thickness on the side turned away.
 */
import { INK, NEAR } from "../theme";
import { NEAR_MARK, markTransform } from "../../../src/scene-kit/nearMark.ts";

export function NearCoin({ size, turn = 0 }: { size: number; turn?: number }) {
  const r = 46;
  const angle = turn * 2 * Math.PI;
  const c = Math.cos(angle);
  const face = Math.max(0.04, Math.abs(c));
  const rim = 9 * Math.sin(angle);
  const front = c >= 0;
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" style={{ overflow: "visible" }}>
      {/* The rim: the same disc pushed back by the coin's thickness. */}
      <ellipse cx={rim} cy={0} rx={r * face} ry={r} fill={NEAR.forest} stroke={INK} strokeWidth={4} />
      <rect
        x={Math.min(0, rim)}
        y={-r}
        width={Math.abs(rim)}
        height={r * 2}
        fill={NEAR.forest}
        stroke="none"
      />
      <ellipse cx={0} cy={0} rx={r * face} ry={r} fill={NEAR.green} stroke={INK} strokeWidth={4} />
      <ellipse
        cx={0}
        cy={0}
        rx={r * face * 0.8}
        ry={r * 0.8}
        fill="none"
        stroke={INK}
        strokeWidth={2}
        opacity={0.35}
      />
      {front ? (
        <g transform={`scale(${face} 1)`}>
          <path d={NEAR_MARK.path} fill={INK} transform={markTransform(0, 0, 46)} />
        </g>
      ) : null}
    </svg>
  );
}
