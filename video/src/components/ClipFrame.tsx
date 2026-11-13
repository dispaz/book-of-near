/**
 * Real app footage in an ink-outlined browser window: the take's segments (base rate, speed ramps)
 * played back to back, a camera push-in timed to beats, and a tag over any sped-up part. The recording
 * comes from `npm run capture` (public/clips/manifest.json); a shot not recorded yet shows a placeholder.
 */
import {
  AbsoluteFill,
  Easing,
  Freeze,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CARD, FONTS, INK, MUTE, PAGE, withAlpha } from "../theme";
import type { ClipId, Push } from "../storyboard";
import type { ClipInfo, Segment } from "../timing";

const BAR = 54;
const W = 1680;
const H = 945;

export function ClipFrame({
  clip,
  info,
  segments,
  pushes,
  accent,
  url,
}: {
  clip: ClipId;
  info?: ClipInfo;
  segments: Segment[];
  /** Push-ins with their start frames already resolved from beats. */
  pushes: (Push & { frame: number })[];
  accent: string;
  url: string;
}) {
  const frame = useCurrentFrame();
  const cam = camera(frame, pushes);
  const ramp = segments.find((s) => s.label && frame >= s.start && frame < s.start + s.frames);
  const last = segments[segments.length - 1];

  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 64,
        width: W,
        height: H + BAR,
        border: `5px solid ${INK}`,
        borderRadius: 22,
        background: CARD,
        boxShadow: `14px 14px 0 ${INK}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: BAR,
          borderBottom: `4px solid ${INK}`,
          background: PAGE,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 22px",
        }}
      >
        {[accent, CARD, CARD].map((c, i) => (
          <span
            key={i}
            style={{ width: 18, height: 18, borderRadius: 9, border: `3px solid ${INK}`, background: c }}
          />
        ))}
        <span
          style={{
            marginLeft: 18,
            flex: 1,
            maxWidth: 760,
            padding: "6px 18px",
            border: `3px solid ${INK}`,
            borderRadius: 30,
            background: CARD,
            fontFamily: FONTS.ui,
            fontWeight: 500,
            fontSize: 22,
            color: MUTE,
          }}
        >
          {url}
        </span>
      </div>
      <div style={{ position: "relative", width: W, height: H, overflow: "hidden" }}>
        {info && last ? (
          <AbsoluteFill
            style={{
              transformOrigin: "0 0",
              transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`,
            }}
          >
            {segments.map((seg, i) => (
              <Sequence key={i} from={seg.start} durationInFrames={seg.frames} layout="none">
                <Footage info={info} seg={seg} />
              </Sequence>
            ))}
            {/* Hold the last frame if the scene outlasts the take. */}
            <Sequence from={last.start + last.frames} layout="none">
              <Freeze frame={last.frames - 1}>
                <Footage info={info} seg={last} />
              </Freeze>
            </Sequence>
          </AbsoluteFill>
        ) : (
          <Placeholder clip={clip} />
        )}
        {ramp ? <RampTag label={ramp.label!} rate={ramp.rate} /> : null}
      </div>
    </div>
  );
}

function Footage({ info, seg }: { info: ClipInfo; seg: Segment }) {
  const { fps } = useVideoConfig();
  return (
    <OffthreadVideo
      src={staticFile(`clips/${info.file}`)}
      trimBefore={Math.round((info.trimStart + seg.from) * fps)}
      playbackRate={seg.rate}
      muted
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

/** Eases from one push to the next over 28 frames: scale about the push's focus point. */
function camera(frame: number, pushes: (Push & { frame: number })[]) {
  let s = 1;
  let x = 0.5;
  let y = 0.5;
  for (const p of pushes) {
    const k = interpolate(frame, [p.frame, p.frame + 28], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.45, 0, 0.2, 1),
    });
    s += (p.scale - s) * k;
    x += ((p.x ?? x) - x) * k;
    y += ((p.y ?? y) - y) * k;
  }
  // Scale about (x, y), kept inside the frame.
  const tx = Math.min(0, Math.max(W - W * s, W * x - W * x * s));
  const ty = Math.min(0, Math.max(H - H * s, H * y - H * y * s));
  return { s, tx, ty };
}

function RampTag({ label, rate }: { label: string; rate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 24,
        top: 20,
        padding: "8px 18px",
        border: `3px solid ${INK}`,
        borderRadius: 30,
        background: CARD,
        boxShadow: `4px 4px 0 ${INK}`,
        fontFamily: FONTS.ui,
        fontWeight: 700,
        fontSize: 22,
        color: INK,
      }}
      title={`${rate}x`}
    >
      ▶▶ {label}
    </div>
  );
}

function Placeholder({ clip }: { clip: ClipId }) {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: `repeating-linear-gradient(45deg, ${CARD} 0 28px, ${withAlpha(INK, 0.04)} 28px 56px)`,
        fontFamily: FONTS.hand,
        fontSize: 64,
        color: INK,
        textAlign: "center",
      }}
    >
      <div>Footage “{clip}” not recorded yet</div>
      <div style={{ fontFamily: FONTS.ui, fontSize: 28, color: MUTE, marginTop: 16 }}>
        npm run capture -- --only {clip}
      </div>
    </AbsoluteFill>
  );
}
