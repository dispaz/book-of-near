import { describe, expect, it } from "vitest";
import { CREATE_DEPOSIT, fullName, readLabel } from "./name";

describe("readLabel", () => {
  it("accepts a plain word and adds .testnet", () => {
    expect(readLabel("ana-1")).toEqual({ ok: true, id: "ana-1.testnet" });
    expect(fullName("ana")).toBe("ana.testnet");
  });
  it("trims spaces and treats an empty box as a hint, not an error", () => {
    expect(readLabel("  ana ")).toEqual({ ok: true, id: "ana.testnet" });
    expect(readLabel("")).toEqual({ ok: false, problem: null });
  });
  it("explains the rules in plain English", () => {
    // "a.testnet" is already 9 characters, so a one-letter name passes the length rule.
    expect(readLabel("a")).toEqual({ ok: true, id: "a.testnet" });
    expect(readLabel("Ana")).toMatchObject({ ok: false, problem: "Use lowercase letters only." });
    expect(readLabel("a b")).toMatchObject({ ok: false, problem: expect.stringContaining("Use only") });
    expect(readLabel("ana-")).toMatchObject({ ok: false, problem: expect.stringContaining("between two") });
  });
  it("refuses dots: they would make a sub-account, which this lesson skips", () => {
    expect(readLabel("a.b")).toMatchObject({ ok: false, problem: expect.stringContaining("dot") });
  });
  it("refuses a name that makes the whole id too long", () => {
    expect(readLabel("a".repeat(60))).toMatchObject({
      ok: false,
      problem: expect.stringContaining("Too long"),
    });
  });
  it("sends 0.1 NEAR", () => {
    expect(CREATE_DEPOSIT).toBe(10n ** 23n);
  });
});
