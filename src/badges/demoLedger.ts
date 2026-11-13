/**
 * Demo-mode badges survive a reload: the DemoChain lives for one visit, so the badges claimed on it
 * are kept in localStorage and handed to the next visit's DemoChain (`DemoChainOptions.badges`).
 * Storage errors are swallowed: the badges then last for the visit only.
 */
import type { DemoBadgeSeed, DemoFinalSeed } from "../chain/demo/badges";
import { STAGE_BADGES } from "./config";
import { isRarity } from "./message";

export const DEMO_BADGES_KEY = "bon:demo-badges:v1";
/** Demo final badges (issue #29), kept beside the stage badges. */
export const DEMO_FINALS_KEY = "bon:demo-final:v1";

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
        b.stage < STAGE_BADGES &&
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

export function loadDemoFinals(storage: Pick<Storage, "getItem"> | null = safeStorage()): DemoFinalSeed[] {
  try {
    const list = JSON.parse(storage?.getItem(DEMO_FINALS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    return list.filter((f): f is DemoFinalSeed => {
      const ok =
        !!f &&
        typeof f.owner === "string" &&
        typeof f.route === "string" &&
        isRarity(f.rarity) &&
        typeof f.mintedAtMs === "number" &&
        !seen.has(f.owner);
      if (ok) seen.add(f.owner);
      return ok;
    });
  } catch {
    return [];
  }
}

export function keepDemoFinals(
  finals: DemoFinalSeed[],
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
) {
  try {
    storage?.setItem(DEMO_FINALS_KEY, JSON.stringify(finals));
  } catch {
    /* blocked or full: the badge lasts for this visit */
  }
}

/** Keep one more demo final badge, replacing an earlier one for the same account. */
export function addDemoFinal(seed: DemoFinalSeed) {
  keepDemoFinals([...loadDemoFinals().filter((f) => f.owner !== seed.owner), seed]);
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
