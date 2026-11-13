/** Closing card: the name, the promise, where to try it. */
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD, FONTS, INK, MUTE, NEAR, withAlpha } from "../theme";
import { Paper, Scribble, WriteOn } from "../components/ink";
import { NearCoin } from "../components/NearCoin";
import { LINKS, TURN } from "../storyboard";

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const coin = spring({ frame: frame - TURN - 26, fps, config: { damping: 11, mass: 1.1 } });
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
      {/* A NEAR coin drops onto the page with a spin and settles, rocking gently. */}
      <div
        style={{
          position: "absolute",
          right: 160,
          top: 120,
          transform: `translateY(${(1 - coin) * -260}px) rotate(${Math.sin(frame / 14) * 3 * coin}deg)`,
          opacity: Math.min(1, coin * 3),
        }}
      >
        <NearCoin size={160} turn={(1 - coin) * 2} />
        <div
          style={{
            margin: "6px auto 0",
            width: 110 * coin,
            height: 14,
            borderRadius: "50%",
            background: withAlpha(INK, 0.18),
          }}
        />
      </div>
    </Paper>
  );
}
