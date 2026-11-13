import "./fonts";
import { Composition, staticFile } from "remotion";
import { DemoVideo, type DemoVideoProps } from "./DemoVideo";
import { FPS, HEIGHT, totalFrames, WIDTH } from "./storyboard";

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
      defaultProps={{ clips: {} } satisfies DemoVideoProps}
      // The recordings and their trims come from `npm run capture` (public/clips/manifest.json).
      calculateMetadata={async ({ props }) => {
        try {
          const res = await fetch(staticFile("clips/manifest.json"));
          if (res.ok) return { props: { ...props, clips: await res.json() } };
        } catch {
          // No recordings yet: every clip scene shows its placeholder.
        }
        return { props };
      }}
    />
  );
}
