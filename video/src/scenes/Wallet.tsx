/**
 * Concept: the badges in a NEAR wallet's collectibles tab. The badges are NEP-171 NFTs with NEP-177
 * metadata (docs/badge-contract.md), so a wallet that lists collectibles can show them. The phone is a
 * generic ink sketch, not any real wallet's design, and it is stamped "Concept" on screen.
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
import { CARD, FONTS, INK, MUTE, NEAR, PAGE, STAGES, withAlpha } from "../theme";
import { MarginNote, Paper } from "../components/ink";
import { TURN } from "../storyboard";

const SHOWN = STAGES.slice(0, 4);

export function Wallet() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phone = spring({ frame: frame - TURN, fps, config: { damping: 15 } });
  const stamp = spring({ frame: frame - TURN - 70, fps, config: { damping: 8, stiffness: 200 } });

  return (
    <Paper>
      <MarginNote
        eyebrow="What could come next"
        note="Your badges, right in your NEAR wallet."
        accent={NEAR.green}
        delay={TURN + 4}
        style={{ left: 150, top: 330, maxWidth: 640 }}
      />
      <div
        style={{
          position: "absolute",
          left: 190,
          top: 640,
          maxWidth: 600,
          fontFamily: FONTS.ui,
          fontSize: 26,
          lineHeight: 1.4,
          color: MUTE,
          opacity: interpolate(frame, [TURN + 40, TURN + 56], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        They are standard NEAR NFTs (NEP-171), soulbound to the learner: proof of what you learned, not
        something to trade.
      </div>

      <AbsoluteFill style={{ left: 1040, top: 70, width: 600, height: 940 }}>
        <div
          style={{
            width: 480,
            height: 940,
            transform: `translateY(${(1 - phone) * 600}px) rotate(${(1 - phone) * 8 + 2}deg)`,
            border: `6px solid ${INK}`,
            borderRadius: 64,
            background: INK,
            padding: 16,
            boxShadow: `16px 16px 0 ${withAlpha(INK, 0.25)}`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 50,
              background: PAGE,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ height: 34, display: "flex", justifyContent: "center", paddingTop: 10 }}>
              <div style={{ width: 120, height: 22, borderRadius: 11, background: INK }} />
            </div>
            <div style={{ padding: "18px 28px 0" }}>
              <div style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 30, color: INK }}>
                learner.near
              </div>
              <div style={{ fontFamily: FONTS.ui, fontSize: 20, color: MUTE }}>My NEAR wallet</div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                {["Tokens", "Collectibles"].map((t) => (
                  <div
                    key={t}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 30,
                      border: `3px solid ${INK}`,
                      background: t === "Collectibles" ? NEAR.green : CARD,
                      fontFamily: FONTS.ui,
                      fontWeight: 700,
                      fontSize: 20,
                      color: INK,
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 18, fontFamily: FONTS.ui, fontWeight: 700, fontSize: 20, color: INK }}>
                Book of NEAR Badges · BOOK
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                {SHOWN.map((s, i) => {
                  const fly = spring({ frame: frame - TURN - 18 - i * 8, fps, config: { damping: 13 } });
                  return (
                    <div
                      key={s.id}
                      style={{
                        border: `3px solid ${INK}`,
                        borderRadius: 18,
                        background: CARD,
                        padding: 12,
                        transform: `translate(${(1 - fly) * -700}px, ${(1 - fly) * -120}px) rotate(${(1 - fly) * -30}deg)`,
                        opacity: Math.min(1, fly * 2),
                      }}
                    >
                      <Img
                        src={staticFile(`badges/stage-${s.id}.svg`)}
                        style={{ width: "100%", display: "block" }}
                      />
                      <div
                        style={{
                          fontFamily: FONTS.ui,
                          fontWeight: 700,
                          fontSize: 17,
                          color: INK,
                          marginTop: 6,
                        }}
                      >
                        Stage {s.id}: {s.name}
                      </div>
                      <div style={{ fontFamily: FONTS.ui, fontSize: 15, color: MUTE }}>
                        Soulbound · testnet
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 300,
            padding: "8px 22px",
            border: `5px solid ${INK}`,
            borderRadius: 10,
            background: withAlpha(CARD, 0.9),
            fontFamily: FONTS.ui,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: 4,
            color: INK,
            transform: `rotate(12deg) scale(${2 - stamp})`,
            opacity: Math.min(1, stamp * 2),
          }}
        >
          CONCEPT
        </div>
      </AbsoluteFill>
    </Paper>
  );
}
