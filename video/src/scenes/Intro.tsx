/**
 * Opening: a closed book on the paper, its cloth cover swings open, and the title and the eight stage
 * accents pop up out of the page, the way a lesson's 3D view grows from its page.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD, FONTS, INK, MUTE, NEAR, PAGE, STAGES, accentOf } from "../theme";
import { Paper, Scribble, WriteOn } from "../components/ink";

const W = 1240;
const H = 760;

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame, fps, config: { damping: 16 } });
  const open = interpolate(frame, [18, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2600 }}>
        <div
          style={{
            position: "relative",
            width: W,
            height: H,
            transform: `translateY(${(1 - drop) * 80}px) rotateX(${18 - 10 * open}deg) scale(${0.92 + 0.08 * open})`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* The open pages under the cover. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              border: `5px solid ${INK}`,
              borderRadius: 14,
              background: NEAR.forest,
              padding: 14,
              boxShadow: `16px 16px 0 ${INK}`,
            }}
          >
            <div
              style={{
                flex: 1,
                background: PAGE,
                borderRight: `3px solid ${INK}`,
                borderRadius: "8px 0 0 8px",
              }}
            />
            <div style={{ flex: 1, background: CARD, borderRadius: "0 8px 8px 0", position: "relative" }}>
              <PopUps open={open} />
            </div>
          </div>
          {/* The title, printed across the spread once it is open. */}
          <div
            style={{
              position: "absolute",
              left: 60,
              top: 180,
              width: 520,
              opacity: open,
            }}
          >
            <WriteOn delay={44} frames={20}>
              <div
                style={{ fontFamily: FONTS.serif, fontWeight: 700, fontSize: 96, lineHeight: 1, color: INK }}
              >
                Book of NEAR
              </div>
            </WriteOn>
            <div style={{ margin: "14px 0 20px" }}>
              <Scribble width={420} color={NEAR.green} delay={58} />
            </div>
            <WriteOn delay={62} frames={24}>
              <div
                style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 52, lineHeight: 1.1, color: INK }}
              >
                Learn NEAR by doing, one page at a time.
              </div>
            </WriteOn>
            <WriteOn delay={78} frames={16}>
              <div style={{ fontFamily: FONTS.ui, fontSize: 24, color: MUTE, marginTop: 24 }}>
                Interactive lessons · 2D and 3D · badges on NEAR testnet
              </div>
            </WriteOn>
          </div>
          {/* The cloth cover, hinged on the left edge. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformOrigin: "0% 50%",
              transform: `rotateY(${-178 * open}deg)`,
              backfaceVisibility: "hidden",
              border: `5px solid ${INK}`,
              borderRadius: 14,
              background: NEAR.forest,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                padding: "28px 60px",
                background: NEAR.offWhite,
                border: `5px solid ${INK}`,
                borderRadius: 10,
                fontFamily: FONTS.serif,
                fontWeight: 700,
                fontSize: 80,
                color: INK,
              }}
            >
              Book of NEAR
            </div>
            <div
              style={{
                width: 120,
                height: 10,
                borderRadius: 5,
                background: NEAR.green,
                border: `3px solid ${INK}`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </Paper>
  );
}

/** One accent block per stage rises out of the right-hand page, staggered. */
function PopUps({ open }: { open: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        bottom: 70,
        height: 520,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        opacity: open > 0.6 ? 1 : 0,
      }}
    >
      {STAGES.map((s, i) => {
        const rise = spring({ frame: frame - 46 - i * 4, fps, config: { damping: 9, mass: 0.7 } });
        const h = 110 + i * 46;
        return (
          <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 54,
                height: h,
                transformOrigin: "50% 100%",
                transform: `scaleY(${rise}) skewX(${(1 - rise) * 10}deg)`,
                background: accentOf(s.id),
                border: `4px solid ${INK}`,
                borderRadius: "10px 10px 4px 4px",
                boxShadow: `5px 0 0 ${INK}`,
              }}
            />
            <div style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 22, color: INK, opacity: rise }}>
              {s.id}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, height: 4, background: INK }} />
    </div>
  );
}
