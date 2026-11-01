import { useEffect, useState } from "react";

function query(q: string): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(q).matches
  );
}

export function useMediaQuery(q: string): boolean {
  const [match, setMatch] = useState(() => query(q));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return match;
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** True when the browser can create a WebGL context. `?webgl=0` forces false for testing the fallback. */
export function hasWebGL(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("webgl") === "0") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
