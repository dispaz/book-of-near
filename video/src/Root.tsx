import "./fonts";
import { Composition, staticFile } from "remotion";
import { DemoVideo, type DemoVideoProps } from "./DemoVideo";
import { FPS, HEIGHT, MUSIC, totalFrames, WIDTH } from "./storyboard";

const MAX_SECONDS = 60;

export function Root() {
  const frames = totalFrames();
  if (frames >= MAX_SECONDS * FPS) {
    throw new Error(`The storyboard runs ${(frames / FPS).toFixed(1)} s: keep it under ${MAX_SECONDS} s.`);
  }
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={frames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ clips: {}, audio: false } satisfies DemoVideoProps}
      // The recordings, their trims and beats come from `npm run capture` (public/clips/manifest.json).
      calculateMetadata={async ({ props }) => {
        const clips = await fetch(staticFile("clips/manifest.json"))
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
        const audio = await fetch(staticFile(MUSIC.src), { method: "HEAD" })
          .then((r) => r.ok)
          .catch(() => false);
        return { props: { ...props, clips, audio } };
      }}
    />
  );
}
