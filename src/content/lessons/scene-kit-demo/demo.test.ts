import { describe, expect, it } from "vitest";
import { coinHolder, sceneState, statusText } from "./demo";

describe("coinHolder", () => {
  it("keeps the coin with Ana until the learner sends it in step 3", () => {
    expect(coinHolder(0, false)).toBe("ana");
    expect(coinHolder(2, false)).toBe("ana");
    expect(coinHolder(2, true)).toBe("ben");
  });
  it("shows the end state when the learner jumps to the last step", () => {
    expect(coinHolder(3, false)).toBe("ben");
  });
  it("puts the coin back with Ana on earlier steps", () => {
    expect(coinHolder(1, true)).toBe("ana");
  });
});

describe("sceneState", () => {
  it("reports where the coin is, what is selected and the view", () => {
    expect(sceneState({ holder: "ana", shown: "ana", selected: null, view: "3d" })).toBe(
      "coin=ana;selected=none;view=3d",
    );
    expect(sceneState({ holder: "ben", shown: "ana", selected: "ben", view: "flat" })).toBe(
      "coin=moving;selected=ben;view=flat",
    );
  });
});

describe("statusText", () => {
  it("says what the selected account holds", () => {
    expect(statusText("ana", "ana")).toBe("Selected: Ana's account. It holds 1 coin.");
    expect(statusText("ben", "ana")).toBe("Selected: Ben's account. It holds 0 coins.");
    expect(statusText(null, "ana")).toBe("");
  });
});
