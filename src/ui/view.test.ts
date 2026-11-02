import { afterEach, describe, expect, it } from "vitest";
import { initialView } from "./view";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("initialView", () => {
  const base = { webgl: true, reducedMotion: false, wide: true };

  it("opens wide screens with WebGL in 3D", () => {
    expect(initialView(base)).toBe("3d");
  });

  it("opens phones, reduced motion and no-WebGL browsers in 2D", () => {
    expect(initialView({ ...base, wide: false })).toBe("2d");
    expect(initialView({ ...base, reducedMotion: true })).toBe("2d");
    expect(initialView({ ...base, webgl: false })).toBe("2d");
  });

  it("remembers the learner's choice", () => {
    localStorage.setItem("bon:view", "2d");
    expect(initialView(base)).toBe("2d");
    localStorage.setItem("bon:view", "3d");
    expect(initialView({ ...base, wide: false })).toBe("3d");
  });

  it("never picks 3D without WebGL, even when asked", () => {
    localStorage.setItem("bon:view", "3d");
    window.history.replaceState(null, "", "/?view=3d");
    expect(initialView({ ...base, webgl: false })).toBe("2d");
  });

  it("lets ?view= override the stored choice", () => {
    localStorage.setItem("bon:view", "3d");
    window.history.replaceState(null, "", "/?view=2d");
    expect(initialView(base)).toBe("2d");
  });
});
