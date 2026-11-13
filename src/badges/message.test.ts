import { describe, expect, it } from "vitest";
import { CLAIM_TTL_MS, stageMessage } from "./message";

describe("stageMessage", () => {
  it("is the contract's one-line claim text (docs/badge-contract.md)", () => {
    expect(stageMessage("badges.x.testnet", "alice.testnet", 2, 1_800_000_000_000)).toBe(
      "bon-badge-v1|badges.x.testnet|alice.testnet|stage|2|1800000000000",
    );
  });

  it("signs short expiries: minutes, not days", () => {
    expect(CLAIM_TTL_MS).toBeGreaterThanOrEqual(60_000);
    expect(CLAIM_TTL_MS).toBeLessThanOrEqual(15 * 60_000);
  });
});
