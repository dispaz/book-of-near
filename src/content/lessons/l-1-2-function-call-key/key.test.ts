import { describe, expect, it } from "vitest";
import {
  ALLOWED_PROMPT,
  SUGGESTION,
  nextHint,
  readAllowance,
  readPrompt,
  refusedKinds,
  type Attempt,
  type Intent,
} from "./key";

const attempt = (intent: Intent, ok: boolean, id = 1): Attempt => ({
  id,
  intent,
  prompt: "",
  ok,
  message: "",
});

describe("readPrompt", () => {
  it("understands its own suggestions", () => {
    for (const k of Object.keys(SUGGESTION) as Intent[]) expect(readPrompt(SUGGESTION[k])).toBe(k);
  });

  it("reads free wording", () => {
    expect(readPrompt("please transfer my money away")).toBe("send");
    expect(readPrompt("increment it")).toBe("count");
    expect(readPrompt("give me access")).toBe("addkey");
    expect(readPrompt("call the other contract")).toBe("other");
  });

  it("does not understand small talk", () => {
    expect(readPrompt("hello there")).toBeNull();
    expect(readPrompt("")).toBeNull();
    expect(readPrompt(ALLOWED_PROMPT)).toBe("count");
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

  it("hints at an untried attack first", () => {
    expect(nextHint([])).toBe("send");
    expect(nextHint([attempt("send", false)])).toBe("other");
    const all = [attempt("send", false), attempt("other", false, 2), attempt("addkey", false, 3)];
    expect(nextHint(all)).toBe("count");
    expect(nextHint([...all, attempt("count", true, 4)])).toBeNull();
  });
});
