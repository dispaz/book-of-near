/**
 * The badge wall: one badge per stage, stamped onto the page in order. The art is the real collection
 * art (public/badges, copied by scripts/sync-assets.mjs): NEAR's own colours only (docs/palette.md rule 4).
 */
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONTS, INK, MUTE, NEAR, STAGES } from "../theme";
import { Paper, Scribble, WriteOn } from "../components/ink";
import { TURN } from "../storyboard";

/** Stages whose badge can be claimed in the app today (src/badges/rules.ts); the rest are marked "soon". */
const CLAIMABLE = new Set([0, 1, 2, 3, 4]);

export function Badges() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Paper>
      <AbsoluteFill style={{ padding: "90px 140px", alignItems: "center" }}>
        <WriteOn delay={TURN} frames={18}>
          <div
            style={{
              fontFamily: FONTS.serif,
              fontWeight: 700,
              fontSize: 76,
              color: INK,
              textAlign: "center",
            }}
          >
            One badge for every stage you finish
          </div>
        </WriteOn>
        <div style={{ margin: "10px auto 0" }}>
          <Scribble width={520} color={NEAR.green} delay={TURN + 14} />
        </div>
        <div
          style={{
            marginTop: 54,
            display: "grid",
            gridTemplateColumns: "repeat(4, 300px)",
            columnGap: 70,
            rowGap: 34,
          }}
        >
          {STAGES.map((s, i) => {
            const at = TURN + 16 + i * 7;
            const stamp = spring({
              frame: frame - at,
              fps,
              config: { damping: 11, mass: 0.8, stiffness: 160 },
            });
            const thud = interpolate(frame - at, [6, 10, 16], [0, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: 230, height: 230 }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: -14,
                      borderRadius: "50%",
                      border: `4px solid ${INK}`,
                      opacity: thud * 0.6,
                      transform: `scale(${1 + thud * 0.12})`,
                    }}
                  />
                  <Img
                    src={staticFile(`badges/stage-${s.id}.svg`)}
                    style={{
                      width: 230,
                      height: 230,
                      opacity: Math.min(1, stamp * 1.5),
                      transform: `scale(${1.7 - 0.7 * stamp}) rotate(${(1 - stamp) * -24 + (i % 2 ? 3 : -3)}deg)`,
                      filter: `drop-shadow(6px 6px 0 ${INK})`,
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: FONTS.ui,
                    fontWeight: 700,
                    fontSize: 24,
                    color: INK,
                    opacity: stamp,
                  }}
                >
                  Stage {s.id} · {s.name}
                </div>
                <div style={{ fontFamily: FONTS.hand, fontSize: 30, color: MUTE, opacity: stamp }}>
                  {CLAIMABLE.has(s.id) ? s.title : "coming soon"}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Paper>
  );
}
