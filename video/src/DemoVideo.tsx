/**
 * The demo video: SCENES from storyboard.ts in order, each turning in over the last like a page, over a
 * calm soundtrack with a soft page sound on every turn.
 */
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { framesOf, MUSIC, PAGE_SOUND, SCENES, sceneStarts, TURN, type Scene } from "./storyboard";
import { ClipFrame } from "./components/ClipFrame";
import { MarginNote, PageTurn, Paper } from "./components/ink";
import { Intro } from "./scenes/Intro";
import { Badges } from "./scenes/Badges";
import { Wallet } from "./scenes/Wallet";
import { Outro } from "./scenes/Outro";
import { INK, accentOf } from "./theme";
import { planClip, type ClipInfo } from "./timing";

export type ClipManifest = Partial<Record<string, ClipInfo>>;

export interface DemoVideoProps extends Record<string, unknown> {
  clips: ClipManifest;
  /** Whether public/audio has the soundtrack (scripts/make-audio.mjs); checked in Root.tsx. */
  audio: boolean;
}

const URLS: Record<string, string> = {
  contents: "book-of-near.pages.dev",
  learn: "book-of-near.pages.dev/lesson/l-0-1-blockchain-basics",
  check: "book-of-near.pages.dev/lesson/l-0-1-blockchain-basics",
  claim: "book-of-near.pages.dev/?mode=testnet",
  proof: "book-of-near.pages.dev/check?mode=testnet",
};

export function DemoVideo({ clips, audio }: DemoVideoProps) {
  const { durationInFrames, fps } = useVideoConfig();
  const starts = sceneStarts();
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      {SCENES.map((scene, i) => (
        <Sequence key={scene.id} from={starts[i]} durationInFrames={framesOf(scene)} name={scene.id}>
          <PageTurn durationInFrames={framesOf(scene)}>
            <SceneBody scene={scene} clips={clips} />
          </PageTurn>
        </Sequence>
      ))}
      {audio ? (
        <>
          <Audio
            src={staticFile(MUSIC.src)}
            volume={(f) =>
              MUSIC.volume *
              interpolate(
                f,
                [0, MUSIC.fadeIn * fps, durationInFrames - MUSIC.fadeOut * fps, durationInFrames],
                [0, 1, 1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            }
          />
          {starts.slice(1).map((s) => (
            <Sequence key={s} from={s} durationInFrames={TURN + 10} layout="none">
              <Audio src={staticFile(PAGE_SOUND.src)} volume={PAGE_SOUND.volume} />
            </Sequence>
          ))}
        </>
      ) : null}
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
    case "clip":
      return <ClipScene scene={scene} info={clips[scene.clip]} />;
  }
}

function ClipScene({ scene, info }: { scene: Extract<Scene, { kind: "clip" }>; info?: ClipInfo }) {
  const frames = framesOf(scene);
  const accent = accentOf(scene.stage);
  const plan = info ? planClip(info, frames, scene.ramps) : undefined;
  const at = (beat: string | undefined, fallback: number) => plan?.beatFrame(beat, fallback) ?? fallback;
  // Notes: the first lands as the page turns in, each later one on its beat (never too close together).
  const noteFrames: number[] = [];
  scene.notes.forEach((n, i) => {
    const want = i === 0 ? TURN : at(n.at, TURN + i * 60);
    noteFrames.push(Math.max(want, (noteFrames[i - 1] ?? -99) + 45));
  });
  const pushes = (scene.push ?? []).map((p) => ({ ...p, frame: p.at ? at(p.at, 0) : 0 }));
  return (
    <Paper>
      <ClipFrame
        clip={scene.clip}
        info={info}
        segments={plan?.segments ?? []}
        pushes={pushes}
        accent={accent}
        url={URLS[scene.clip] ?? ""}
      />
      {scene.notes.map((n, i) => (
        <Sequence
          key={i}
          from={noteFrames[i]! - 1}
          durationInFrames={(noteFrames[i + 1] ?? frames + 1) - noteFrames[i]! + 1}
          layout="none"
        >
          <MarginNote
            eyebrow={n.eyebrow}
            note={n.note}
            accent={accent}
            delay={1}
            exitAt={i < scene.notes.length - 1 ? noteFrames[i + 1]! - noteFrames[i]! + 1 : undefined}
            style={{ left: 56, bottom: 36, maxWidth: 620 }}
          />
        </Sequence>
      ))}
    </Paper>
  );
}
