/** Closing card: the name, the promise, where to try it. */
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD, FONTS, INK, MUTE, NEAR } from "../theme";
import { Paper, Scribble, WriteOn } from "../components/ink";
import { LINKS, TURN } from "../storyboard";

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const coin = spring({ frame: frame - TURN - 30, fps, config: { damping: 7 } });
  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <WriteOn delay={TURN} frames={20}>
          <div style={{ fontFamily: FONTS.serif, fontWeight: 700, fontSize: 130, color: INK }}>
            Book of NEAR
          </div>
        </WriteOn>
        <div style={{ margin: "4px auto 24px" }}>
          <Scribble width={560} color={NEAR.green} delay={TURN + 14} thickness={9} />
        </div>
        <WriteOn delay={TURN + 18} frames={22}>
          <div style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 64, color: INK }}>
            Open the book. Learn by doing. Keep the proof.
          </div>
        </WriteOn>
        <div style={{ display: "flex", gap: 28, marginTop: 56, justifyContent: "center" }}>
          {[LINKS.site, LINKS.repo].map((l, i) => {
            const pop = spring({ frame: frame - TURN - 34 - i * 6, fps, config: { damping: 12 } });
            return (
              <div
                key={l}
                style={{
                  padding: "16px 30px",
                  border: `4px solid ${INK}`,
                  borderRadius: 14,
                  background: CARD,
                  boxShadow: `7px 7px 0 ${INK}`,
                  fontFamily: FONTS.ui,
                  fontWeight: 700,
                  fontSize: 34,
                  color: INK,
                  transform: `scale(${pop})`,
                }}
              >
                {l}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 34, fontFamily: FONTS.ui, fontSize: 26, color: MUTE }}>
          Works in demo mode with no wallet, or for real on NEAR testnet.
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 170,
          top: 150,
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: NEAR.green,
          border: `6px solid ${INK}`,
          transform: `scale(${coin}) rotateY(${(1 - coin) * 540}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONTS.serif,
          fontWeight: 700,
          fontSize: 58,
          color: INK,
        }}
      >
        N
      </div>
    </Paper>
  );
}
