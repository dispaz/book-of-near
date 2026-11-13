import { describe as group, expect, it } from "vitest";
import { RECORDED_ATTESTATION } from "../../../chain/nearai";
import { describe, enclaveNoise, PROMPTS, reactionsFor, type LessonState } from "./tutor";
import { ENCLAVE, HOOK, PROMPT, QUOTE, VERIFY } from "./steps";

const base: LessonState = {
  step: HOOK,
  dumped: false,
  asked: null,
  answered: false,
  attestation: null,
  fetching: false,
  verify: { status: "idle" },
  quoteHash: null,
};
const at = (step: number, more: Partial<LessonState> = {}): LessonState => ({ ...base, step, ...more });
const fetched = { asked: 0, answered: true, dumped: true, attestation: RECORDED_ATTESTATION };

group("the tutor's questions", () => {
  it("has three sample questions, each with a pre-written answer", () => {
    expect(PROMPTS).toHaveLength(3);
    for (const p of PROMPTS) {
      expect(p.question).toMatch(/\?$/);
      expect(p.answer.length).toBeGreaterThan(80);
    }
  });
});

group("enclaveNoise", () => {
  it("is the same every time (an illustration), and looks like random bytes", () => {
    expect(enclaveNoise(4)).toEqual(enclaveNoise(4));
    expect(enclaveNoise(4)).toHaveLength(4);
    for (const line of enclaveNoise(4)) expect(line).toMatch(/^([0-9a-f]{2} ){7}[0-9a-f]{2}$/);
  });
});

group("reactionsFor (docs/lessons/stage-5/5.1.md, Reactions)", () => {
  it("root: not yet on the hook, reads memory on step 2, then a detail", () => {
    expect(reactionsFor(at(HOOK)).root).toEqual({ hint: "Not yet: you try root access on step 2." });
    expect(reactionsFor(at(ENCLAVE)).root).toEqual({ act: "dump" });
    expect(reactionsFor(at(ENCLAVE, { dumped: true })).root.detail).toMatch(/plain text.+noise/);
  });

  it("terminal: sends the prompt on step 3, then says what you picked, without claiming it was sent", () => {
    expect(reactionsFor(at(PROMPT, { dumped: true })).terminal).toEqual({ act: "send" });
    expect(reactionsFor(at(PROMPT, { dumped: true, asked: 0, answered: true })).terminal.detail).toBe(
      `You picked: "${PROMPTS[0]!.question}" On NEAR AI Cloud, a prompt goes over an encrypted channel into the enclave. Here the answer is pre-written.`,
    );
    const answered = at(PROMPT, { dumped: true, asked: 0, answered: true });
    expect(reactionsFor(answered).enclave.detail).toMatch(/On NEAR AI Cloud, your prompt goes in here/);
    expect(describe(answered)).toMatch(/^On NEAR AI Cloud your prompt goes into the enclave/);
    expect(describe(answered)).toMatch(/pre-written/);
  });

  it("quote: 'Send prompt first' before the prompt, fetches on step 4, verifies on step 5", () => {
    expect(reactionsFor(at(ENCLAVE)).quote).toEqual({ hint: "Send a prompt first." });
    expect(reactionsFor(at(PROMPT, { asked: 0, answered: true })).quote).toEqual({
      hint: "Not yet: you fetch the quote on step 4.",
    });
    expect(reactionsFor(at(QUOTE, { asked: 0, answered: true })).quote).toEqual({ act: "fetch" });
    expect(reactionsFor(at(QUOTE, fetched)).quote.detail).toMatch(/^Intel TDX quote, 5006 bytes/);
    expect(reactionsFor(at(VERIFY, fetched)).quote).toEqual({ act: "verify" });
  });

  it("seal: not yet until the quote is fetched; verifies on step 5; then names Intel's root", () => {
    expect(reactionsFor(at(QUOTE, { asked: 0, answered: true })).seal).toEqual({
      hint: "Fetch the quote first (step 4).",
    });
    expect(reactionsFor(at(QUOTE, fetched)).seal).toEqual({ hint: "Not yet: you verify on step 5." });
    expect(reactionsFor(at(VERIFY, fetched)).seal).toEqual({ act: "verify" });
    const done = at(VERIFY, {
      ...fetched,
      verify: { status: "done", ok: true, checks: [] },
      quoteHash: "ab".repeat(32),
    });
    expect(reactionsFor(done).seal.detail).toBe(
      "Intel SGX Root CA, fingerprint 44a0196b…fab674d3: the root Intel publishes.",
    );
    expect(reactionsFor(done).quote.detail).toBe(
      "Signed by the chip and chained to Intel's root: verified in your browser. Quote SHA-256 abababab…abababab.",
    );
  });

  it("the server and the enclave always show a detail", () => {
    for (const s of [at(HOOK), at(ENCLAVE, { dumped: true }), at(VERIFY, fetched)]) {
      expect(reactionsFor(s).server.detail).toBeTruthy();
      expect(reactionsFor(s).enclave.detail).toBeTruthy();
    }
    expect(reactionsFor(at(ENCLAVE, { dumped: true })).server.detail).toMatch(/plain text/);
  });
});

group("describe", () => {
  it("says what the figure shows at each step, in one sentence", () => {
    expect(describe(at(HOOK))).toMatch(/ordinary cloud server/);
    expect(describe(at(ENCLAVE, { dumped: true }))).toMatch(/noise/);
    expect(describe(at(QUOTE, fetched))).toMatch(/quote/);
  });
});
