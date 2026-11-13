/**
 * The demo video: SCENES from storyboard.ts in order, each turning in over the last like a page.
 */
import { AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FPS, SCENES, TURN, type Scene } from "./storyboard";
import { ClipFrame, type ClipManifest } from "./components/ClipFrame";
import { MarginNote, PageTurn, Paper } from "./components/ink";
import { Intro } from "./scenes/Intro";
import { Badges } from "./scenes/Badges";
import { Wallet } from "./scenes/Wallet";
import { Outro } from "./scenes/Outro";
import { FONTS, INK, STAGES, accentOf } from "./theme";

export interface DemoVideoProps extends Record<string, unknown> {
  clips: ClipManifest;
}

const URLS: Record<string, string> = {
  home: "book-of-near.pages.dev",
  "book-open": "book-of-near.pages.dev/lesson/l-0-1-blockchain-basics",
  learn: "book-of-near.pages.dev/lesson/l-0-1-blockchain-basics",
  stages: "book-of-near.pages.dev/lesson/…",
  check: "book-of-near.pages.dev/lesson/l-0-1-blockchain-basics",
  claim: "book-of-near.pages.dev/my-book",
  proof: "book-of-near.pages.dev/check",
};

export function DemoVideo({ clips }: DemoVideoProps) {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {SCENES.map((scene) => {
        const frames = Math.round(scene.seconds * FPS);
        const start = from;
        from += frames - TURN;
        return (
          <Sequence key={scene.id} from={start} durationInFrames={frames} name={scene.id}>
            <PageTurn durationInFrames={frames}>
              <SceneBody scene={scene} clips={clips} />
            </PageTurn>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function SceneBody({ scene, clips }: { scene: Scene; clips: ClipManifest }) {
  switch (scene.kind) {
    case "intro":
      return <Intro />;
    case "badges":
      return <Badges />;
    case "wallet":
      return <Wallet />;
    case "outro":
      return <Outro />;
    case "clip": {
      const accent = accentOf(scene.stage);
      return (
        <Paper>
          <ClipFrame
            clip={scene.clip}
            info={clips[scene.clip]}
            accent={accent}
            seconds={scene.seconds}
            zoom={scene.zoom}
            focus={scene.focus}
            url={URLS[scene.clip] ?? ""}
          />
          {scene.clip === "stages" ? <StageChips seconds={scene.seconds} /> : null}
          <MarginNote
            eyebrow={scene.eyebrow}
            note={scene.note}
            accent={accent}
            style={{ left: 60, bottom: 40, maxWidth: 640 }}
          />
        </Paper>
      );
    }
  }
}

/** The stage tabs along the top edge, the current one lifted, stepping along with the montage. */
function StageChips({ seconds }: { seconds: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = STAGES.slice(0, 5);
  const per = (seconds * fps - TURN) / shown.length;
  const current = Math.min(shown.length - 1, Math.floor(Math.max(0, frame - TURN) / per));
  return (
    <div style={{ position: "absolute", right: 150, top: 18, display: "flex", gap: 14 }}>
      {shown.map((s, i) => {
        const lift = spring({ frame: frame - TURN - i * per, fps, config: { damping: 12 } });
        const on = i === current;
        return (
          <div
            key={s.id}
            style={{
              padding: "6px 18px",
              border: `4px solid ${INK}`,
              borderRadius: 12,
              background: on ? accentOf(s.id) : "white",
              transform: `translateY(${on ? -6 * lift : 0}px)`,
              fontFamily: FONTS.ui,
              fontWeight: 700,
              fontSize: 24,
              color: INK,
              boxShadow: on ? `5px 5px 0 ${INK}` : "none",
            }}
          >
            {s.id} · {s.name}
          </div>
        );
      })}
    </div>
  );
}
