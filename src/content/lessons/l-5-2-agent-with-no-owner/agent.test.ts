import { describe, expect, it } from "vitest";
import { describe as describeFigure, OBJECTS, reactionsFor, type LessonState } from "./agent";
import { ATTACK, BOOT, HOOK, REGISTER, RUN } from "./steps";

const AGENT = "ab".repeat(32);
const base: LessonState = {
  step: HOOK,
  envOpen: false,
  agent: null,
  registered: false,
  devRefused: null,
  copyRefused: false,
  run: { status: "idle" },
};
const at = (step: number, more: Partial<LessonState> = {}): LessonState => ({ ...base, step, ...more });
const done = {
  envOpen: true,
  agent: { accountId: AGENT },
  registered: true,
  devRefused: "Agent not registered",
  copyRefused: true,
};

describe("reactionsFor: every object acts, says 'not yet', or shows a detail (rule 10a)", () => {
  it("opens the .env file from the laptop on step 1; the other actors say not yet", () => {
    const r = reactionsFor(at(HOOK));
    expect(r.laptop).toEqual({ act: "openEnv" });
    expect(r.key.hint).toBe("Not yet: the developer tries this key on step 4.");
    expect(r.enclave.hint).toBe("Not yet: the agent starts on step 2.");
    expect(r.contract.hint).toBe("Start the agent first (step 2).");
    expect(r.signer.hint).toBe("Not yet: the agent asks for a signature on step 5.");
    expect(r.eth.hint).toBe("Not yet: the address is used on step 5.");
  });

  it("each step's object does that step's action", () => {
    expect(reactionsFor(at(BOOT, { envOpen: true })).enclave).toEqual({ act: "boot" });
    expect(reactionsFor(at(REGISTER, { envOpen: true, agent: { accountId: AGENT } })).contract).toEqual({
      act: "register",
    });
    const attack = reactionsFor(at(ATTACK, { ...done, devRefused: null, copyRefused: false }));
    expect(attack.key).toEqual({ act: "devSign" });
    expect(attack.enclave).toEqual({ act: "copy" });
    const run = reactionsFor(at(RUN, done));
    expect(run.signer).toEqual({ act: "run" });
    expect(run.eth).toEqual({ act: "run" });
  });

  it("the contract says 'not yet' on step 2 once the agent runs", () => {
    expect(reactionsFor(at(BOOT, { agent: { accountId: AGENT } })).contract.hint).toBe(
      "Not yet: the agent registers on step 3.",
    );
  });

  it("shows details once done, naming the real values", () => {
    const r = reactionsFor(
      at(RUN, {
        ...done,
        run: {
          status: "done",
          address: "0x1234567890abcdef1234567890abcdef12345678",
          payload: "11".repeat(32),
        },
      }),
    );
    expect(r.laptop.detail).toMatch(/anyone who reads the file can sign as the bot/i);
    expect(r.key.detail).toContain("Agent not registered");
    expect(r.enclave.detail).toContain("abababab…abababab");
    expect(r.contract.detail).toMatch(/genuine quote, approved measurements, approved PPID/);
    expect(r.signer.detail).toContain("agent.example.testnet");
    expect(r.eth.detail).toContain("0x1234…345678");
  });

  it("has a reaction for every object at every step", () => {
    for (let step = HOOK; step <= RUN; step++) {
      const r = reactionsFor(at(step, done));
      for (const o of OBJECTS) expect(r[o].act ?? r[o].hint ?? r[o].detail).toBeTruthy();
    }
  });
});

describe("describe: one sentence for screen readers", () => {
  it("names what the figure shows at each step", () => {
    expect(describeFigure(at(HOOK))).toMatch(/laptop/);
    expect(describeFigure(at(ATTACK, done))).toMatch(/refused/);
    expect(describeFigure(at(RUN, { ...done, run: { status: "running" } }))).toMatch(/signature/);
  });
});
