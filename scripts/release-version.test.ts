import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module without types
import { nextVersion } from "./release-version.mjs";

describe("nextVersion", () => {
  it("starts at the package.json version when no tag matches its series", () => {
    expect(nextVersion("0.1.0", [])).toBe("0.1.0");
    expect(nextVersion("0.2.0", ["v0.1.0", "v0.1.1"])).toBe("0.2.0");
  });

  it("bumps the patch past the highest tag in the same MAJOR.MINOR series", () => {
    expect(nextVersion("0.1.0", ["v0.1.0"])).toBe("0.1.1");
    expect(nextVersion("0.1.0", ["v0.1.0", "v0.1.9", "v0.1.10", "v0.1.2"])).toBe("0.1.11");
  });

  it("never goes below the package.json patch", () => {
    expect(nextVersion("1.0.5", ["v1.0.1"])).toBe("1.0.5");
  });

  it("ignores tags that are not plain vX.Y.Z", () => {
    expect(nextVersion("0.1.0", ["v0.1.7-rc.1", "latest", "0.1.8", "v0.1.0"])).toBe("0.1.1");
  });

  it("rejects a package.json version that is not X.Y.Z", () => {
    expect(() => nextVersion("1.0", [])).toThrow(/X\.Y\.Z/);
  });
});
