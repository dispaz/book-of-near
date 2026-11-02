import { describe, expect, it } from "vitest";
import { fillStep, fillVars } from "./fillVars";

describe("fillVars", () => {
  it("fills placeholders with the learner's values", () => {
    expect(fillVars("Ana sent you {tamper} coins, not {sent}.", { sent: "5", tamper: "9" })).toBe(
      "Ana sent you 9 coins, not 5.",
    );
  });

  it("leaves unknown placeholders visible", () => {
    expect(fillVars("Send {amount} NEAR", {})).toBe("Send {amount} NEAR");
  });

  it("fills caption, explain and action label of a step", () => {
    const s = fillStep(
      { caption: "Send {n}", explain: "Ana pays {n}", action: { label: "send {n}", gate: true } },
      { n: "4" },
    );
    expect(s).toEqual({ caption: "Send 4", explain: "Ana pays 4", action: { label: "send 4", gate: true } });
  });
});
