import type { ChainMode } from "./types";

const STORAGE_KEY = "bon:chain-mode";

/** Demo mode is the default: no wallet, no network. Testnet is opt-in (URL, saved choice, or env). */
export function initialMode(): ChainMode {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mode");
    if (fromUrl === "testnet" || fromUrl === "demo") return fromUrl;
  } catch {
    /* no window in tests */
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "testnet" || saved === "demo") return saved;
  } catch {
    /* storage blocked */
  }
  return import.meta.env.VITE_CHAIN_MODE === "testnet" ? "testnet" : "demo";
}

/** Remember the learner's choice for the next visit (a `?mode=` in the URL still wins). */
export function saveMode(mode: ChainMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}
