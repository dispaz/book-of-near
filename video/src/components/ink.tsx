/**
 * Ink-style building blocks shared by every scene: the paper ground, the page-turn entrance, the
 * margin note written in by hand, and a hand-drawn underline. Black outlines on paper-white, one accent
 * per stage (CLAUDE.md "Ink style").
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS, INK, MUTE, PAGE, withAlpha } from "../theme";
import { TURN } from "../storyboard";

/** The paper ground: page colour, faint ruling, a soft edge. */
export function Paper({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAGE,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 47px, ${withAlpha(INK, 0.05)} 47px 48px), radial-gradient(ellipse at center, transparent 55%, ${withAlpha(INK, 0.1)} 100%)`,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/**
 * A scene enters like a turned page: it swings in from the right edge around the spine on the left,
 * with the shadow of the page falling across it. `durationInFrames` lets it turn out at the end too.
 */
export function PageTurn({ children, durationInFrames }: { children: ReactNode; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, TURN], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(frame, [durationInFrames - TURN, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  // Entering: the page comes from the right (rotateY 0 = flat). Leaving: it stays put and darkens, the
  // next page swings over it.
  return (
    <AbsoluteFill style={{ perspective: 2400 }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0% 50%",
          transform: `rotateY(${-75 * enter}deg)`,
          backfaceVisibility: "hidden",
        }}
      >
        {children}
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `linear-gradient(90deg, ${withAlpha(INK, 0.35 * enter)}, transparent 60%)`,
          }}
        />
        <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: withAlpha(INK, 0.25 * leave) }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Reveals children left to right, like a line being written. */
export function WriteOn({
  children,
  delay = 0,
  frames = 24,
  style,
}: {
  children: ReactNode;
  delay?: number;
  frames?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, frames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  return <div style={{ clipPath: `inset(-20% ${100 - p}% -20% 0)`, ...style }}>{children}</div>;
}

/** A hand-drawn underline that draws itself. */
export function Scribble({
  width,
  color,
  delay = 0,
  frames = 16,
  thickness = 7,
}: {
  width: number;
  color: string;
  delay?: number;
  frames?: number;
  thickness?: number;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const d = `M4 14 C ${width * 0.25} 4, ${width * 0.5} 20, ${width * 0.75} 9 S ${width - 20} 12, ${width - 4} 8`;
  return (
    <svg
      width={width}
      height={24}
      viewBox={`0 0 ${width} 24`}
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={p}
      />
    </svg>
  );
}

/** The margin note: a small eyebrow, then a handwritten line with the stage accent under it. */
export function MarginNote({
  eyebrow,
  note,
  accent,
  delay = TURN,
  style,
}: {
  eyebrow: string;
  note: string;
  accent: string;
  delay?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.6 } });
  return (
    <div
      style={{
        position: "absolute",
        maxWidth: 560,
        padding: "26px 32px 22px",
        background: withAlpha(PAGE, 0.96),
        border: `4px solid ${INK}`,
        borderRadius: 18,
        boxShadow: `8px 8px 0 ${INK}`,
        transform: `rotate(${-1.5 + (1 - pop) * -4}deg) scale(${0.85 + 0.15 * pop})`,
        opacity: pop,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.ui,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: MUTE,
        }}
      >
        {eyebrow}
      </div>
      <WriteOn delay={delay + 6} frames={28}>
        <div style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 50, lineHeight: 1.05, color: INK }}>
          {note}
        </div>
      </WriteOn>
      <div style={{ marginTop: 6 }}>
        <Scribble width={260} color={accent} delay={delay + 26} />
      </div>
    </div>
  );
}
