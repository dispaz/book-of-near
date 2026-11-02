import type { SceneView } from "../app/types";

/** Two-way 2D / 3D toggle shown on lessons that offer both views. */
export function ViewSwitch({ view, onChange }: { view: SceneView; onChange: (v: SceneView) => void }) {
  return (
    <div className="view-switch" role="group" aria-label="Scene view">
      {(["2d", "3d"] as const).map((v) => (
        <button key={v} className="pill" aria-pressed={view === v} onClick={() => onChange(v)}>
          {v.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
