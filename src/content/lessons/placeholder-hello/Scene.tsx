import type { SceneProps } from "../../../app/types";

const LINES = ["Ana pays Ben 3", "Ben pays Cy 1", "Cy pays Ana 2"];

export default function Scene({ step }: SceneProps) {
  const shown = step === 0 ? 1 : 3;
  return (
    <svg
      viewBox="0 0 800 500"
      role="img"
      aria-label={`A ledger with ${shown} lines`}
      data-scene-state={`lines:${shown}`}
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
      {LINES.slice(0, shown).map((t, i) => (
        <g key={t}>
          <line x1="270" x2="530" y1={170 + i * 60} y2={170 + i * 60} stroke="#16141f33" strokeWidth="2" />
          <text x="280" y={160 + i * 60} fontFamily="Caveat, cursive" fontSize="30" fill="#16141f">
            {t}
          </text>
        </g>
      ))}
      {step === 2 ? (
        <text x="400" y="400" textAnchor="middle" fontFamily="Newsreader, serif" fontSize="22" fill="#16141f">
          …kept by many computers at once
        </text>
      ) : null}
    </svg>
  );
}
