import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import {
  AccountBlock,
  COLORS,
  Coin,
  easeInOut,
  InkStage,
  Label,
  Pickable,
  Traveller,
  type CameraView,
  type PickMotion,
} from "../../../scene-kit";
import { NAMES, useDemo, type Who } from "./demo";

/** The coin's own pick animation: a flip in the air, like a coin toss. */
const FLIP_SECONDS = 0.7;
const flip: PickMotion = (coin, t) => {
  const u = Math.min(1, t / FLIP_SECONDS);
  coin.position.y += 0.9 * Math.sin(u * Math.PI);
  coin.rotation.x += 2 * Math.PI * easeInOut(u);
  return u < 1;
};

const X: Record<Who, number> = { ana: -3, ben: 3 };
const BLOCK = 1.7;

/** One camera preset per step. */
const VIEWS: CameraView[] = [
  { position: [-2, 6, 12.5], target: [-0.8, 1, 0] },
  { position: [0, 8.5, 14], target: [0, 1, 0] },
  { position: [1, 7.5, 13.5], target: [0, 1, 0] },
  { position: [6, 6.5, 11.5], target: [1.5, 1, 0] },
];

export default function Scene({ step, setGate, flat, reducedMotion }: SceneProps) {
  const demo = useDemo({ step, setGate, reducedMotion, view: flat ? "flat" : "3d" });
  return (
    <>
      <InkStage
        view={VIEWS[step] ?? VIEWS[0]!}
        flat={flat}
        reducedMotion={reducedMotion}
        state={demo.state}
        status={demo.status}
        description={`Two account blocks, Ana's and Ben's. The coin is with ${demo.holder === "ana" ? "Ana" : "Ben"}.`}
        onMiss={() => demo.select(null)}
      >
        {(["ana", "ben"] as const).map((who) => (
          <AccountBlock
            key={who}
            position={[X[who], 0, 0]}
            size={BLOCK}
            name={who === "ana" ? "Ana" : "Ben"}
            pickLabel={NAMES[who]}
            color={who === "ana" ? COLORS.orange : COLORS.blue}
            selected={demo.selected === who}
            onPick={() => demo.select(who)}
          />
        ))}
        <Traveller to={[X[demo.holder], BLOCK + 0.1, 0]} arc={2.6} onArrive={demo.onArrive}>
          {/* Rule 10a: "not yet" until Ben holds it, then a flip of its own and a detail. */}
          <Pickable label="The coin" anchor={[0, 0.5, 0]} pickMotion={flip} {...demo.coinPick}>
            <Coin />
          </Pickable>
        </Traveller>
        {step === 1 ? (
          <Label position={[0, 0.3, 2.2]} variant="hint">
            Click a block
          </Label>
        ) : null}
      </InkStage>
      {demo.canSend ? <SceneAction onClick={demo.send}>Send coin</SceneAction> : null}
    </>
  );
}
