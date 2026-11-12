import { describe, expect, it } from "vitest";
import { RECORDED_QUOTE, type IntentQuote } from "../../../chain/intents";
import {
  BRIDGE_STEPS,
  bridgeTotal,
  describe as describeScene,
  exploitDone,
  EXPLOIT_AT,
  intentSteps,
  intentTotal,
  litSteps,
  PLAY_TICKS,
  pickResult,
  sourceTag,
  spreadUsd,
  type PickState,
} from "./compare";
import { BACKING, COMPARE, CONFIDENTIAL, EXPLOIT, HOOK } from "./steps";

const live: IntentQuote = {
  ...RECORDED_QUOTE,
  source: "worker",
  timeEstimate: 31,
  amountInUsd: 21,
  amountOutUsd: 20.5,
};

const base: PickState = { step: HOOK, played: 0, inspected: false, exploit: "idle", shielded: false };

describe("the two timelines", () => {
  it("the old bridge has 6 steps and every figure on it is an estimate", () => {
    expect(BRIDGE_STEPS).toHaveLength(6);
    for (const s of BRIDGE_STEPS) {
      expect(s.time.source).toBe("estimate");
      expect(s.fee.source).toBe("estimate");
    }
    const t = bridgeTotal();
    expect(t.time.source).toBe("estimate");
    expect(t.fee.source).toBe("estimate");
    expect(t.time.text).toMatch(/20 min/);
  });

  it("the intent has 2 steps; its delivery time and fee come from the quote", () => {
    const steps = intentSteps(RECORDED_QUOTE);
    expect(steps).toHaveLength(2);
    expect(steps[1]!.time).toEqual({ text: "about 27 s", source: "recorded" });
    expect(steps[1]!.fee).toEqual({ text: "about $0.09 spread", source: "recorded" });
    // Signing is not in the quote: an estimate, labelled.
    expect(steps[0]!.time.source).toBe("estimate");
    expect(intentTotal(RECORDED_QUOTE).time).toEqual({ text: "about 27 s", source: "recorded" });
  });

  it("a live quote is labelled live, with its own numbers", () => {
    const steps = intentSteps(live);
    expect(steps[1]!.time).toEqual({ text: "about 31 s", source: "live" });
    expect(steps[1]!.fee).toEqual({ text: "about $0.50 spread", source: "live" });
  });

  it("without USD prices the fee is an estimate, never a made-up number", () => {
    const q = { ...live, amountInUsd: null };
    expect(spreadUsd(q)).toBeNull();
    expect(intentSteps(q)[1]!.fee.source).toBe("estimate");
  });

  it("tags each source in plain words", () => {
    expect(sourceTag("estimate")).toBe("est.");
    expect(sourceTag("recorded")).toBe("recorded quote");
    expect(sourceTag("live")).toBe("live quote");
  });

  it("plays both tracks side by side: the intent is done after 2 ticks, the bridge after 6", () => {
    expect(PLAY_TICKS).toBe(6);
    expect(litSteps(0)).toEqual({ bridge: 0, intent: 0 });
    expect(litSteps(2)).toEqual({ bridge: 2, intent: 2 });
    expect(litSteps(6)).toEqual({ bridge: 6, intent: 2 });
  });
});

describe("the exploit", () => {
  it("runs crack, drain, done in order", () => {
    expect(EXPLOIT_AT.crack).toBeLessThan(EXPLOIT_AT.drain);
    expect(EXPLOIT_AT.drain).toBeLessThan(EXPLOIT_AT.done);
    expect(exploitDone("drain")).toBe(false);
    expect(exploitDone("done")).toBe(true);
  });
});

describe("picks", () => {
  it("the vault starts the exploit at step 4 and shows the damage after", () => {
    expect(pickResult("vault", { ...base, step: EXPLOIT }).act).toBe("exploit");
    const after = pickResult("vault", { ...base, step: EXPLOIT, exploit: "done" });
    expect(after.act).toBeUndefined();
    expect(after.note).toMatch(/\$0/);
  });

  it("the wrapped slip says 'not yet' before the backing is inspected, and inspects at step 3", () => {
    expect(pickResult("slip", { ...base, step: COMPARE })).toMatchObject({
      notYet: true,
      note: "Inspect asset backing first.",
    });
    expect(pickResult("slip", { ...base, step: BACKING }).act).toBe("inspect");
    expect(
      pickResult("slip", { ...base, step: CONFIDENTIAL, inspected: true, exploit: "done" }).note,
    ).toMatch(/\$0\.00/);
  });

  it("the shield waits for the exploit, then wraps the intent at step 5", () => {
    expect(pickResult("shield", { ...base, step: EXPLOIT, inspected: true })).toMatchObject({ notYet: true });
    expect(pickResult("shield", { ...base, step: CONFIDENTIAL, inspected: true, exploit: "done" }).act).toBe(
      "shield",
    );
  });

  it("the native coin always shows a detail", () => {
    const r = pickResult("coin", base);
    expect(r.notYet).toBeUndefined();
    expect(r.note).toMatch(/Native USDC/);
  });
});

describe("describe", () => {
  it("says what the figure shows at each step", () => {
    expect(describeScene(base)).toMatch(/two tracks/i);
    expect(describeScene({ ...base, step: EXPLOIT, inspected: true, exploit: "done" })).toMatch(/drained/);
  });
});
