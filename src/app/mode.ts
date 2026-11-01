import type { ChainMode } from "./types";

/** Demo mode is the default: no wallet, no network. Testnet is opt-in. */
export function initialMode(): ChainMode {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mode");
    if (fromUrl === "testnet" || fromUrl === "demo") return fromUrl;
  } catch {
    /* no window in tests */
  }
  return import.meta.env.VITE_CHAIN_MODE === "testnet" ? "testnet" : "demo";
}
