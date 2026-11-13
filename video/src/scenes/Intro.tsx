/**
 * Opening: a closed book on the paper, its cloth cover swings open, the title is written on the left
 * page and the eight stages fold up off the right page, one row each: what the stage covers, a bar for
 * how deep it goes and stars for how hard it is, so the climb from stage 0 to 7 reads at a glance.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD, FONTS, INK, MUTE, NEAR, PAGE, STAGES, accentOf, withAlpha } from "../theme";
import { Scribble, WriteOn, Paper } from "../components/ink";

const W = 1300;
const H = 780;

/** How hard each stage is, out of five: the book climbs from first ideas to a veteran capstone. */
const DEPTH = [1, 2, 3, 3, 4, 4, 4, 5];

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drop = spring({ frame, fps, config: { damping: 18 } });
  const open = interpolate(frame, [14, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.6, 0.02, 0.2, 1),
  });

  return (
    <Paper>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2600 }}>
        <div
          style={{
            position: "relative",
            width: W,
            height: H,
            transform: `translateY(${(1 - drop) * 80}px) rotateX(${16 - 10 * open}deg) scale(${0.93 + 0.07 * open})`,
            transformStyle: "preserve-3d",
          }}
        >
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
                position: "relative",
              }}
            >
              <TitlePage open={open} />
            </div>
            <div style={{ flex: 1, background: CARD, borderRadius: "0 8px 8px 0", position: "relative" }}>
              <StageLadder open={open} />
            </div>
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

function TitlePage({ open }: { open: number }) {
  return (
    <div style={{ position: "absolute", left: 56, top: 190, width: 520, opacity: open }}>
      <WriteOn delay={40} frames={20}>
        <div style={{ fontFamily: FONTS.serif, fontWeight: 700, fontSize: 92, lineHeight: 1, color: INK }}>
          Book of NEAR
        </div>
      </WriteOn>
      <div style={{ margin: "14px 0 22px" }}>
        <Scribble width={420} color={NEAR.green} delay={54} />
      </div>
      <WriteOn delay={58} frames={24}>
        <div style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 50, lineHeight: 1.1, color: INK }}>
          Learn NEAR by doing, one page at a time.
        </div>
      </WriteOn>
      <WriteOn delay={76} frames={16}>
        <div style={{ fontFamily: FONTS.ui, fontSize: 23, color: MUTE, marginTop: 24 }}>
          Interactive lessons · 2D and 3D · badges on NEAR testnet
        </div>
      </WriteOn>
    </div>
  );
}

/** The stages as rows that fold up off the page, then fill their depth bars and stars. */
function StageLadder({ open }: { open: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 34,
        right: 30,
        top: 30,
        bottom: 26,
        opacity: open > 0.55 ? 1 : 0,
        perspective: 900,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: FONTS.ui,
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: MUTE,
          marginBottom: 10,
          opacity: interpolate(frame, [36, 46], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span>Eight stages</span>
        <span>deeper as you go</span>
      </div>
      {STAGES.map((s, i) => {
        const at = 40 + i * 5;
        const rise = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.6 } });
        const fill = interpolate(frame - at - 8, [0, 18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const accent = accentOf(s.id);
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              height: 80,
              borderBottom: `2px dashed ${withAlpha(INK, 0.18)}`,
              transformOrigin: "50% 100%",
              transform: `rotateX(${(1 - rise) * 85}deg)`,
              opacity: Math.min(1, rise * 2),
            }}
          >
            <div
              style={{
                flex: "0 0 auto",
                width: 42,
                height: 42,
                borderRadius: 21,
                background: accent,
                border: `3px solid ${INK}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.ui,
                fontWeight: 700,
                fontSize: 22,
                color: INK,
              }}
            >
              {s.id}
            </div>
            <div style={{ flex: "0 0 214px", lineHeight: 1.05 }}>
              <div style={{ fontFamily: FONTS.ui, fontWeight: 700, fontSize: 21, color: INK }}>{s.name}</div>
              <div style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 25, color: MUTE }}>
                {s.title}
              </div>
            </div>
            <div
              style={{
                flex: "0 0 150px",
                height: 18,
                borderRadius: 9,
                border: `3px solid ${INK}`,
                background: PAGE,
                overflow: "hidden",
              }}
            >
              <div
                style={{ width: `${(DEPTH[i]! / 5) * 100 * fill}%`, height: "100%", background: accent }}
              />
            </div>
            <Stars n={DEPTH[i]!} from={at + 14} accent={accent} />
          </div>
        );
      })}
    </div>
  );
}

function Stars({ n, from, accent }: { n: number; from: number; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const star = "M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.8z";
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map((k) => {
        const on = k < n;
        const pop = on
          ? spring({ frame: frame - from - k * 3, fps, config: { damping: 9, stiffness: 220 } })
          : 1;
        return (
          <svg
            key={k}
            width={21}
            height={21}
            viewBox="0 0 20 20"
            style={{ transform: `scale(${on ? pop : 1})` }}
          >
            <path
              d={star}
              fill={on ? accent : "none"}
              stroke={on ? INK : withAlpha(INK, 0.25)}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}
