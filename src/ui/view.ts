import { useCallback, useState } from "react";
import type { SceneView } from "../app/types";

const KEY = "bon:view";

function stored(): SceneView | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "2d" || v === "3d" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The view a lesson opens in. The learner's last choice wins. Otherwise 3D on wide screens with WebGL,
 * and 2D on phones, without WebGL or with reduced motion. `?view=2d|3d` overrides (tests, links).
 */
export function initialView(opts: { webgl: boolean; reducedMotion: boolean; wide: boolean }): SceneView {
  if (!opts.webgl) return "2d";
  try {
    const q = new URLSearchParams(window.location.search).get("view");
    if (q === "2d" || q === "3d") return q;
  } catch {
    /* no window */
  }
  return stored() ?? (opts.wide && !opts.reducedMotion ? "3d" : "2d");
}

/** The current view for lessons that offer both, remembered across lessons and visits. */
export function useSceneView(opts: {
  available: boolean;
  webgl: boolean;
  reducedMotion: boolean;
  wide: boolean;
}) {
  const [view, setView] = useState<SceneView>(() => (opts.available ? initialView(opts) : "2d"));
  const choose = useCallback((v: SceneView) => {
    setView(v);
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
  }, []);
  return [view, choose] as const;
}
