/**
 * Demo-mode badges survive a reload: the DemoChain lives for one visit, so the badges claimed on it
 * are kept in localStorage and handed to the next visit's DemoChain (`DemoChainOptions.badges`).
 * Storage errors are swallowed: the badges then last for the visit only.
 */
import type { DemoBadgeSeed } from "../chain/demo/badges";

export const DEMO_BADGES_KEY = "bon:demo-badges:v1";

export function loadDemoBadges(storage: Pick<Storage, "getItem"> | null = safeStorage()): DemoBadgeSeed[] {
  try {
    const list = JSON.parse(storage?.getItem(DEMO_BADGES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b): b is DemoBadgeSeed =>
        !!b &&
        typeof b.owner === "string" &&
        Number.isInteger(b.stage) &&
        b.stage >= 0 &&
        b.stage < 5 &&
        typeof b.mintedAtMs === "number",
    );
  } catch {
    return [];
  }
}

export function keepDemoBadges(
  badges: DemoBadgeSeed[],
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
) {
  try {
    storage?.setItem(DEMO_BADGES_KEY, JSON.stringify(badges));
  } catch {
    /* blocked or full: the badges last for this visit */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
