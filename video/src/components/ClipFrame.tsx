/**
 * Real app footage in an ink-outlined browser window. The recording comes from `npm run capture`
 * (public/clips/manifest.json); a shot that is not recorded yet shows a labelled placeholder instead.
 */
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CARD, FONTS, INK, MUTE, PAGE, withAlpha } from "../theme";
import type { ClipId } from "../storyboard";

export interface ClipInfo {
  /** File name in public/clips. */
  file: string;
  /** Seconds to skip at the start (page load, warm-up). */
  trimStart: number;
  /** Seconds of useful footage after trimStart. */
  duration: number;
}
export type ClipManifest = Partial<Record<ClipId, ClipInfo>>;

const BAR = 54;

export function ClipFrame({
  clip,
  info,
  accent,
  seconds,
  zoom = 1,
  focus = "50% 50%",
  url,
}: {
  clip: ClipId;
  info?: ClipInfo;
  accent: string;
  seconds: number;
  zoom?: number;
  focus?: string;
  url: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, zoom], { extrapolateRight: "clamp" });
  // Fit the footage to the slot: speed up long takes (up to 3x), slow short ones a little (to 0.8x).
  const rate = info ? Math.min(3, Math.max(0.8, info.duration / seconds)) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 70,
        width: 1680,
        height: 945 + BAR,
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
      <div style={{ position: "relative", width: "100%", height: 945, overflow: "hidden" }}>
        {info ? (
          <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: focus }}>
            <OffthreadVideo
              src={staticFile(`clips/${info.file}`)}
              trimBefore={Math.round(info.trimStart * fps)}
              playbackRate={rate}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>
        ) : (
          <Placeholder clip={clip} />
        )}
      </div>
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
