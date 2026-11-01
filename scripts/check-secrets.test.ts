import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module without types
import { scanDiff, scanLine, isBlockedFile } from "./check-secrets.mjs";

// Fake values, built at runtime so this file itself passes the scanner.
const fakeNearKey = "ed25519:" + "3".repeat(30) + "abcdefghijkmnopqrstuvwxyzABCDEFGH" + "5".repeat(20);
const pem = "-----BEGIN " + "PRIVATE KEY-----";
const seed = "my seed is " + "abandon ".repeat(11) + "about";

describe("check-secrets", () => {
  it.each([
    ["NEAR private key", `const k = "${fakeNearKey}";`],
    ["PEM private key", pem],
    ["OpenAI-style key", "token = sk-" + "a".repeat(30)],
    ["GitHub token", "ghp_" + "A".repeat(36)],
    ["Seed phrase", seed],
    ["Assigned secret", "FAUCET_PRIVATE_KEY=" + "x".repeat(40)],
  ])("finds a %s", (kind, line) => {
    expect(scanLine(line)).toContain(kind);
  });

  it("passes clean code and public keys of normal length", () => {
    expect(scanLine('const pk = "ed25519:GTdUhFKmrPAFSmRPh3xp5JoLA7HMdebAdxqNNddM6ehS";')).toEqual([]);
    expect(scanLine("FAUCET_PRIVATE_KEY=")).toEqual([]);
    expect(scanLine("the quick brown fox jumps over the lazy dog")).toEqual([]);
  });

  it("honours the allow comment", () => {
    expect(scanLine(`"${fakeNearKey}" // secret-scan:allow`)).toEqual([]);
  });

  it("scans only added lines of a diff and reports file and line", () => {
    const diff = [
      "+++ b/src/a.ts",
      "@@ -1,0 +1,2 @@",
      "+const ok = 1;",
      `+const k = "${fakeNearKey}";`,
      `-const old = "${fakeNearKey}";`,
    ].join("\n");
    expect(scanDiff(diff)).toEqual([{ file: "src/a.ts", line: 2, kind: "NEAR private key" }]);
  });

  it("blocks env files but not the example", () => {
    expect(isBlockedFile(".dev.vars")).toBe(true);
    expect(isBlockedFile("worker/.dev.vars")).toBe(true);
    expect(isBlockedFile(".env")).toBe(true);
    expect(isBlockedFile(".env.local")).toBe(true);
    expect(isBlockedFile(".env.example")).toBe(false);
  });
});
