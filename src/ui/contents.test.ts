import { describe, expect, it } from "vitest";
import { leafCount, stageEntry, turnedHere } from "./contents";

const lesson = (id: string, status: "ready" | "planned" = "ready", hidden = false) => ({
  id,
  status,
  hidden,
});

describe("leafCount", () => {
  it("turns a few leaves for the first lessons and more for later ones, up to a cap", () => {
    expect(leafCount(0)).toBe(3);
    expect(leafCount(2)).toBe(3);
    expect(leafCount(3)).toBe(4);
    expect(leafCount(9)).toBe(6);
    expect(leafCount(40)).toBe(8);
  });
});

describe("stageEntry", () => {
  const isOpen = (l: { status: string }) => l.status !== "planned";
  it("opens the first unread lesson of a stage", () => {
    const s = { lessons: [lesson("a"), lesson("b"), lesson("c")] };
    expect(stageEntry(s, new Set(["a"]), isOpen)?.id).toBe("b");
  });
  it("skips planned and hidden lessons", () => {
    const s = { lessons: [lesson("x", "planned"), lesson("h", "ready", true), lesson("a")] };
    expect(stageEntry(s, new Set(), isOpen)?.id).toBe("a");
  });
  it("goes back to the first lesson when the whole stage is read", () => {
    const s = { lessons: [lesson("a"), lesson("b")] };
    expect(stageEntry(s, new Set(["a", "b"]), isOpen)?.id).toBe("a");
  });
  it("has nothing to open in a stage of planned lessons", () => {
    expect(stageEntry({ lessons: [lesson("x", "planned")] }, new Set(), isOpen)).toBeUndefined();
  });
});

describe("turnedHere", () => {
  it("is true only for navigation state left by a page turn from the contents", () => {
    expect(turnedHere({ turned: true })).toBe(true);
    expect(turnedHere({ turned: "yes" })).toBe(false);
    expect(turnedHere(null)).toBe(false);
    expect(turnedHere(undefined)).toBe(false);
  });
});
