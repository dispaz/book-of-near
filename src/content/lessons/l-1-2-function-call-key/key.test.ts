import { describe, expect, it } from "vitest";
import {
  ATTACKS,
  ATTEMPT_LABEL,
  appLine,
  keyGoneShown,
  readAllowance,
  refusedKinds,
  type Attempt,
  type Intent,
} from "./key";

const attempt = (intent: Intent, ok: boolean, id = 1, extra: Partial<Attempt> = {}): Attempt => ({
  id,
  intent,
  label: ATTEMPT_LABEL[intent],
  ok,
  reason: ok ? undefined : "RequiresFullAccess",
  message: "",
  ...extra,
});

describe("what the app can be made to try", () => {
  it("offers one button per attack, plus the allowed Count", () => {
    expect(ATTACKS).toEqual(["send", "other", "addkey"]);
    expect(ATTEMPT_LABEL.count).toBe("Count");
    expect(ATTEMPT_LABEL.send).toBe("Send NEAR to the attacker");
    expect(ATTEMPT_LABEL.other).toBe("Call another contract");
    expect(ATTEMPT_LABEL.addkey).toBe("Add a full-access key for the attacker");
  });

  it("says what each try asks the chain to do, without calling the app an agent or an AI", () => {
    for (const k of Object.keys(ATTEMPT_LABEL) as Intent[]) {
      const line = appLine(k, "cf4342372b5836aaaa");
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(/agent|\bAI\b/i);
    }
    expect(appLine("count", "x")).toContain("increment");
    expect(appLine("send", "x")).toContain("attacker.testnet");
    expect(appLine("other", "x")).toContain("testnet");
  });
});

describe("readAllowance", () => {
  it("accepts 0.01 to 0.5 NEAR", () => {
    expect(readAllowance("0.1")).toMatchObject({ ok: true });
    expect(readAllowance("0,2")).toMatchObject({ ok: true });
    expect(readAllowance("0.5")).toMatchObject({ ok: true });
  });
  it("refuses other values with a reason", () => {
    for (const bad of ["", "abc", "0", "0.001", "1", "-1"]) {
      expect(readAllowance(bad)).toMatchObject({ ok: false });
    }
  });
});

describe("attempts", () => {
  it("counts each refused attack once", () => {
    const list = [attempt("send", false), attempt("send", false, 2), attempt("count", true, 3)];
    expect(refusedKinds(list)).toEqual(["send"]);
    list.push(attempt("other", false, 4), attempt("addkey", false, 5));
    expect(refusedKinds(list)).toEqual(["send", "other", "addkey"]);
  });

  it("counts an attack only when the chain refused it (a reason), not when it ran and failed", () => {
    const failed: Attempt = { ...attempt("send", false), reason: undefined, message: "ran but failed" };
    expect(refusedKinds([failed])).toEqual([]);
    expect(refusedKinds([{ ...failed, reason: "RequiresFullAccess" }])).toEqual(["send"]);
  });

  it("does not count a refused Count after the delete as an attack", () => {
    const gone = attempt("count", false, 6, { afterDelete: true, reason: "AccessKeyNotFound" });
    expect(refusedKinds([gone])).toEqual([]);
  });

  it("shows the key is gone only when a Count after the delete was refused for a missing key", () => {
    expect(keyGoneShown([])).toBe(false);
    expect(keyGoneShown([attempt("count", true)])).toBe(false);
    expect(
      keyGoneShown([attempt("count", false, 2, { afterDelete: true, reason: "AccessKeyNotFound" })]),
    ).toBe(true);
    expect(keyGoneShown([attempt("count", false, 2, { afterDelete: true, reason: "Other" })])).toBe(false);
  });
});
