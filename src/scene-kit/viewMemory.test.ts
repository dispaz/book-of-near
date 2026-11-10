import { describe, expect, it } from "vitest";
import { forgetView, recallView, rememberView, type SavedView } from "./viewMemory";

const view = (x: number): SavedView => ({
  position: [x, 10, 10],
  target: [x, 0, 0],
  home: [x, 0, 0],
  from: { position: [x, 10, 10], target: [x, 0, 0] },
});

describe("view memory", () => {
  it("gives a lesson back its own view and never another lesson's", () => {
    rememberView("l-a", view(1));
    expect(recallView("l-a")).toEqual(view(1));
    expect(recallView("l-b")).toBeNull();
    rememberView("l-b", view(2));
    expect(recallView("l-a")).toEqual(view(1));
    expect(recallView("l-b")).toEqual(view(2));
  });
  it("forgets a lesson's view on reset, leaving the others", () => {
    rememberView("l-a", view(1));
    rememberView("l-b", view(2));
    forgetView("l-a");
    expect(recallView("l-a")).toBeNull();
    expect(recallView("l-b")).toEqual(view(2));
  });
});
