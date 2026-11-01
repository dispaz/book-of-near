import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { COLORS } from "../../../scene-kit/theme";
import { SvgAccountBlock, SvgCoin, SvgLabel, SvgStage, SvgTraveller } from "../../../scene-kit/svg";
import { NAMES, useDemo, type Who } from "./demo";

const X: Record<Who, number> = { ana: 260, ben: 540 };
const BASE = 340;
const SIZE = 100;

/** The same scene drawn flat in SVG, for browsers without WebGL. */
export default function Fallback({ step, setGate, reducedMotion }: SceneProps) {
  const demo = useDemo({ step, setGate, reducedMotion, view: "flat" });
  return (
    <>
      <SvgStage
        state={demo.state}
        status={demo.status}
        reducedMotion={reducedMotion}
        description={`Two account blocks, Ana's and Ben's. The coin is with ${demo.holder === "ana" ? "Ana" : "Ben"}.`}
        note="Your browser can't draw the 3D scene, so here is a flat drawing of it."
        viewBox="160 160 480 250"
      >
        {(["ana", "ben"] as const).map((who) => (
          <SvgAccountBlock
            key={who}
            x={X[who]}
            y={BASE}
            size={SIZE}
            name={who === "ana" ? "Ana" : "Ben"}
            pickLabel={NAMES[who]}
            color={who === "ana" ? COLORS.orange : COLORS.blue}
            selected={demo.selected === who}
            onPick={() => demo.select(who)}
          />
        ))}
        <SvgTraveller to={[X[demo.holder], BASE - SIZE - 14]} onArrive={demo.onArrive}>
          <SvgCoin />
        </SvgTraveller>
        {step === 1 ? (
          <SvgLabel x={400} y={BASE + 52} variant="small">
            Click a block
          </SvgLabel>
        ) : null}
      </SvgStage>
      {demo.canSend ? <SceneAction onClick={demo.send}>Send coin</SceneAction> : null}
    </>
  );
}
