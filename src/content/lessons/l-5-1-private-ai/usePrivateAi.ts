/**
 * The ONE state of lesson 5.1, shared by the 2D and the 3D view: root's look at both memories, the prompt
 * and the tutor's (pre-written) answer, the attestation (recorded in demo mode, live in testnet mode),
 * and the verification, which runs for real in the browser (src/chain/nearai/tdx.ts). NEAR AI Cloud is
 * reached only through src/chain/nearai. No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChainMode } from "../../../chain/ChainContext";
import { fetchAttestation, newNonce, RECORDED_ATTESTATION, type Attestation } from "../../../chain/nearai";
import { hexToBytes, parseTdxQuote, quoteHash, verifyTdxQuote, type Check } from "../../../chain/nearai/tdx";
import { PROMPTS, reactionsFor, type LessonState, type Obj, type Reaction, type Verify } from "./tutor";
import { ENCLAVE, PROMPT, QUOTE, VERIFY } from "./steps";

export * from "./steps";

export type PrivateAi = ReturnType<typeof usePrivateAi>;

/** Demo mode's quote "arrives" after this long, so the slip is seen coming out. */
const DEMO_FETCH_MS = 600;
/** The answer arrives a few words at a time. */
const WORD_MS = 45;
/** The byte the tamper test changes: the first byte of MRTD in the signed report. */
const TAMPER_AT = 48 + 136;

const checkAgainst = (a: Attestation, bytes: Uint8Array) =>
  verifyTdxQuote(parseTdxQuote(bytes), {
    address: a.signingAddress,
    nonce: a.nonce,
    measurements: a.measurements,
  });

export function usePrivateAi({
  step,
  setGate,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "reportEvidence" | "reducedMotion">) {
  // The attestation endpoint needs no NEAR account, so a live fetch follows the mode the learner asked
  // for, even when the testnet practice account fell back to demo mode.
  const wantsLive = useChainMode().requested === "testnet";
  const [dumped, setDumped] = useState(false);
  const [choice, setChoice] = useState(0);
  const [asked, setAsked] = useState<number | null>(null);
  const [words, setWords] = useState(0);
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [verify, setVerify] = useState<Verify>({ status: "idle" });
  const [hash, setHash] = useState<string | null>(null);
  const [tamper, setTamper] = useState<Check[] | null>(null);
  const [picked, setPicked] = useState<{ what: Obj; reaction: Reaction; n: number } | null>(null);
  const [passed, setPassed] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const answerWords = asked === null ? [] : PROMPTS[asked]!.answer.split(" ");
  const answered = asked !== null && words >= answerWords.length;

  const dump = () => setDumped(true);

  /** Step 3: send the chosen question. The answer then arrives word by word (all at once, reduced motion). */
  const send = (i = choice) => {
    if (asked !== null) return;
    setChoice(i);
    setAsked(i);
    setWords(reducedMotion ? Number.MAX_SAFE_INTEGER : 0);
  };
  useEffect(() => {
    if (asked === null || answered) return;
    const id = window.setTimeout(() => live.current && setWords((w) => w + 2), WORD_MS);
    return () => clearTimeout(id);
  }, [asked, answered, words]);

  /** Step 4: the quote. Demo: the recorded one. Testnet mode: a fresh one with our nonce, recorded on failure. */
  const fetchQuote = async () => {
    if (fetching || attestation) return;
    setFetching(true);
    setNotice(null);
    try {
      if (!wantsLive) {
        if (!reducedMotion) await new Promise((r) => setTimeout(r, DEMO_FETCH_MS));
        if (live.current) setAttestation(RECORDED_ATTESTATION);
        return;
      }
      const nonce = newNonce();
      const a = await fetchAttestation(nonce);
      if (!live.current) return;
      if (a.nonce !== nonce) throw new Error("NEAR AI Cloud sent a quote for another nonce.");
      setAttestation(a);
    } catch (e) {
      if (!live.current) return;
      setNotice(`${(e as Error).message} Showing the quote recorded on 13 Nov 2026 instead.`);
      setAttestation(RECORDED_ATTESTATION);
    } finally {
      if (live.current) setFetching(false);
    }
  };

  /** Step 5: every check, for real, in this browser. */
  const runVerify = async () => {
    if (!attestation || verify.status === "running" || (verify.status === "done" && verify.ok)) return;
    setVerify({ status: "running" });
    let a = attestation;
    let checks: Check[];
    try {
      checks = await checkAgainst(a, hexToBytes(a.quote));
      if (!checks.every((c) => c.ok) && a.source === "live") {
        // A live quote that fails: say so, and carry on with the recorded one.
        if (live.current)
          setNotice(
            `The live quote failed: ${checks
              .filter((c) => !c.ok)
              .map((c) => c.label)
              .join(" ")} Checking the quote recorded on 13 Nov 2026 instead.`,
          );
        a = RECORDED_ATTESTATION;
        if (live.current) setAttestation(a);
        checks = await checkAgainst(a, hexToBytes(a.quote));
      }
    } catch (e) {
      if (live.current) {
        setNotice(`The quote could not be read: ${(e as Error).message}`);
        setVerify({ status: "idle" });
      }
      return;
    }
    const h = await quoteHash(hexToBytes(a.quote));
    if (!live.current) return;
    setHash(h);
    setVerify({ status: "done", ok: checks.every((c) => c.ok), checks });
  };

  /** After a pass: change one byte of the signed report and check again. It must fail. */
  const tamperTest = async () => {
    if (!attestation) return;
    const bytes = hexToBytes(attestation.quote);
    bytes[TAMPER_AT] = bytes[TAMPER_AT]! ^ 0x01;
    const checks = await checkAgainst(attestation, bytes);
    if (live.current) setTamper(checks);
  };

  // Opened at a later step (a link, a reload): do the free, offline steps so the page is not empty.
  useEffect(() => {
    if (step > ENCLAVE && !dumped) setDumped(true);
    if (step > PROMPT && asked === null) {
      setAsked(choice);
      setWords(Number.MAX_SAFE_INTEGER);
    }
    if (step > QUOTE && !attestation && !fetching) void fetchQuote();
    if (step > VERIFY && attestation && verify.status === "idle") void runVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, dumped, asked, attestation, fetching, verify.status]);

  const ok = verify.status === "done" && verify.ok;

  // Gates.
  useEffect(() => {
    if (step === ENCLAVE) setGate(dumped);
    if (step === PROMPT) setGate(answered);
    if (step === QUOTE) setGate(!!attestation);
    if (step === VERIFY) setGate(ok);
  }, [step, dumped, answered, attestation, ok, setGate]);

  // The completion record: which quote was checked, and that it passed.
  useEffect(() => {
    if (!attestation || !ok || !hash) return;
    const ev: Record<string, string> = {
      attestationHash: hash,
      verified: "true",
      tee: "Intel TDX",
      model: attestation.model,
      quoteSource: attestation.source,
      checksPassed: String(verify.status === "done" ? verify.checks.length : 0),
      tutorAnswer: "pre-written (no API key)",
    };
    if (attestation.recordedOn) ev.recordedOn = attestation.recordedOn;
    reportEvidence?.(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attestation, ok, hash]);

  const lessonState: LessonState = {
    step,
    dumped,
    asked,
    answered,
    attestation,
    fetching,
    verify,
    quoteHash: hash,
  };
  const reactions = reactionsFor(lessonState);

  // Picks read the latest state: during a page turn the old page's objects can still be picked.
  const latest = useRef(reactions);
  useLayoutEffect(() => {
    latest.current = reactions;
  });

  /** Runs the object's step action, if it has one now. */
  const act = (what: Obj) => {
    const r = latest.current[what];
    if (r.act === "dump") dump();
    if (r.act === "send") send();
    if (r.act === "fetch") void fetchQuote();
    if (r.act === "verify") void runVerify();
  };
  /** A pick in the 2D view: the action, or the hint or detail as a note (the 3D kit shows its own). */
  const pick = (what: Obj) => {
    const reaction = latest.current[what];
    setPicked((p) => ({ what, reaction, n: (p?.n ?? 0) + 1 }));
    act(what);
  };

  const state = [
    `dump:${dumped ? "yes" : "no"}`,
    `asked:${asked ?? "none"}`,
    `answered:${answered ? "yes" : "no"}`,
    `quote:${attestation ? attestation.source : fetching ? "loading" : "none"}`,
    `verify:${verify.status === "done" ? (verify.ok ? "ok" : "failed") : verify.status}`,
    `tamper:${tamper ? (tamper.every((c) => c.ok) ? "passed" : "failed") : "none"}`,
  ].join(";");

  return {
    ...lessonState,
    choice,
    setChoice: (i: number) => asked === null && setChoice(i),
    shownAnswer: answerWords.slice(0, words).join(" "),
    send,
    dump,
    fetchQuote,
    notice,
    runVerify,
    verified: ok,
    tamper,
    tamperTest,
    reactions,
    act,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    reducedMotion,
    state,
  };
}
