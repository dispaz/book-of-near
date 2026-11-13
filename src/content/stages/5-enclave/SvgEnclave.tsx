/**
 * Stage 5's hardware enclave, flat (2D): a chip with pins and a lock inside a dashed perimeter that turns
 * solid in the stage accent once `lit`. Lessons 5.1 and 5.2 both draw it (classes in enclave.css).
 */
import { SvgLabel } from "../../../scene-kit/svg";
import "./enclave.css";

export function SvgEnclave({
  x,
  y,
  lit,
  label,
  note,
}: {
  x: number;
  y: number;
  lit: boolean;
  label: string;
  /** A short line under the enclave: what it holds now. */
  note?: string;
}) {
  return (
    <g>
      <rect
        x={x - 58}
        y={y - 58}
        width={116}
        height={92}
        rx={10}
        className={`pai-perimeter${lit ? " on" : ""}`}
      />
      <rect x={x - 42} y={y - 44} width={84} height={64} rx={4} className="pai-chip" />
      {[-30, -10, 10, 30].map((d) => (
        <g key={d} className="pai-pins">
          <line x1={x + d} x2={x + d} y1={y - 52} y2={y - 44} />
          <line x1={x + d} x2={x + d} y1={y + 20} y2={y + 28} />
        </g>
      ))}
      <rect x={x - 11} y={y - 14} width={22} height={18} rx={3} className="pai-lock" />
      <path d={`M${x - 7},${y - 14} v-6 a7,7 0 0 1 14,0 v6`} className="pai-shackle" />
      {note ? (
        <text x={x} y={y + 50} className="pai-svg-note mid">
          {note}
        </text>
      ) : null}
      <SvgLabel x={x} y={y - 66} variant="small">
        {label}
      </SvgLabel>
    </g>
  );
}
