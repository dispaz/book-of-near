import { afterEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return (await import("./flags")).ENABLE_MAINNET;
}

describe("ENABLE_MAINNET", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off by default", async () => {
    vi.stubEnv("VITE_ENABLE_MAINNET", undefined);
    expect(await load()).toBe(false);
  });

  it("is on only for exactly 'true'", async () => {
    vi.stubEnv("VITE_ENABLE_MAINNET", "true");
    expect(await load()).toBe(true);
    for (const v of ["", "false", "1", "yes", "TRUE"]) {
      vi.stubEnv("VITE_ENABLE_MAINNET", v);
      expect(await load()).toBe(false);
    }
  });
});
