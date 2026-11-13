/**
 * Ink-style building blocks shared by every scene: the paper ground, the page-turn between scenes, the
 * margin note written in by hand, and a hand-drawn underline. Black outlines on paper-white, one accent
 * per stage (CLAUDE.md "Ink style").
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD, FONTS, INK, MUTE, PAGE, withAlpha } from "../theme";
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

/** A slow-in, soft-landing curve: how a turned page settles. */
const TURN_EASE = Easing.bezier(0.6, 0.02, 0.15, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Scenes change like a page turning over the last one. The new page swings in around the spine on the
 * left (edge-on → flat) with the fold's shadow sliding off it and a light sheen crossing it, while its
 * content settles from a touch larger. The old page sinks back a little and dims under it.
 */
export function PageTurn({ children, durationInFrames }: { children: ReactNode; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, TURN], [0, 1], { ...clamp, easing: TURN_EASE });
  const out = interpolate(frame, [durationInFrames - TURN, durationInFrames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.sin),
  });
  const entering = frame < TURN;
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "0% 50%" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0% 50%",
          transform: entering
            ? `rotateY(${-88 * (1 - p)}deg)`
            : `translateX(${-2.5 * out}%) scale(${1 - 0.04 * out})`,
          boxShadow: entering ? `${-30 * (1 - p)}px 0 60px ${withAlpha(INK, 0.35 * (1 - p))}` : "none",
          overflow: "hidden",
        }}
      >
        <AbsoluteFill style={{ transform: `scale(${1 + 0.03 * (1 - p)})` }}>{children}</AbsoluteFill>
        {/* The fold's shadow and a sheen of light crossing the page as it lands. */}
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: 1 - p,
            background: `linear-gradient(90deg, ${withAlpha(INK, 0.45)} 0%, ${withAlpha(INK, 0.12)} 30%, transparent 60%)`,
          }}
        />
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: entering ? Math.sin(Math.PI * p) * 0.55 : 0,
            background: `linear-gradient(100deg, transparent ${p * 100 - 25}%, ${withAlpha(CARD, 0.9)} ${p * 100}%, transparent ${p * 100 + 20}%)`,
          }}
        />
        <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: withAlpha(INK, 0.3 * out) }} />
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
  const p = interpolate(frame - delay, [0, frames], [0, 100], { ...clamp, easing: Easing.out(Easing.quad) });
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
  const p = interpolate(frame - delay, [0, frames], [1, 0], { ...clamp, easing: Easing.out(Easing.quad) });
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

/**
 * The margin note: a small eyebrow, then a handwritten line with the stage accent under it. Pops onto
 * the page at `delay`; with `exitAt`, lifts off again over 10 frames before the next note lands.
 */
export function MarginNote({
  eyebrow,
  note,
  accent,
  delay = TURN,
  exitAt,
  style,
}: {
  eyebrow: string;
  note: string;
  accent: string;
  delay?: number;
  exitAt?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 15, mass: 0.7 } });
  const leave =
    exitAt === undefined
      ? 0
      : interpolate(frame, [exitAt - 10, exitAt], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div
      style={{
        position: "absolute",
        maxWidth: 560,
        padding: "24px 30px 20px",
        background: withAlpha(PAGE, 0.97),
        border: `4px solid ${INK}`,
        borderRadius: 18,
        boxShadow: `8px 8px 0 ${INK}`,
        transform: `translateY(${leave * 30}px) rotate(${-1.5 + (1 - pop) * -4}deg) scale(${0.88 + 0.12 * pop})`,
        opacity: Math.min(pop, 1 - leave),
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.ui,
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: MUTE,
        }}
      >
        {eyebrow}
      </div>
      <WriteOn delay={delay + 5} frames={26}>
        <div style={{ fontFamily: FONTS.hand, fontWeight: 600, fontSize: 46, lineHeight: 1.05, color: INK }}>
          {note}
        </div>
      </WriteOn>
      <div style={{ marginTop: 6 }}>
        <Scribble width={240} color={accent} delay={delay + 24} />
      </div>
    </div>
  );
}
