import { useState } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";

export default function Scene({ step, setGate }: SceneProps) {
  const [lines, setLines] = useState(0);
  // `?scene-error=1` makes this scene throw, so tests can check the fallback.
  if (new URLSearchParams(window.location.search).get("scene-error") === "1")
    throw new Error("Forced scene error");
  return (
    <>
      <svg
        viewBox="0 0 800 500"
        role="img"
        aria-label={`A ledger page with ${lines} lines`}
        data-scene-state={`lines:${lines}`}
      >
        <rect
          x="250"
          y="110"
          width="300"
          height="250"
          rx="14"
          fill="#fffdf7"
          stroke="#16141f"
          strokeWidth="3"
        />
        {Array.from({ length: lines }, (_, i) => (
          <text key={i} x="280" y={170 + i * 50} fontFamily="Caveat, cursive" fontSize="30" fill="#16141f">
            Line {i + 1}: Ana pays Ben 1
          </text>
        ))}
      </svg>
      {step === 1 ? (
        <SceneAction
          onClick={() => {
            setLines((n) => n + 1);
            setGate(true);
          }}
        >
          Add a line
        </SceneAction>
      ) : null}
    </>
  );
}
