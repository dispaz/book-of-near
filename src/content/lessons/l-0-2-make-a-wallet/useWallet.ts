import { useEffect, useState } from "react";
import type { ChainMode } from "../../../app/types";
import {
  DEMO_PHRASE,
  changeOneLetter,
  keyPairFromPhrase,
  newPhrase,
  practiceEthAddress,
  sign,
  verify,
  wipe,
  type PracticeKeyPair,
} from "./wallet";

// Step numbers (0-based) from manifest.ts.
export const STEP = {
  warning: 0,
  generate: 1,
  seed: 2,
  address: 3,
  compare: 4,
  sign: 5,
  verify: 6,
  custody: 7,
  check: 8,
  honest: 9,
} as const;

export const MESSAGE = "Hello from Book of NEAR";
export const CONVERT_STAGES = 4;
const CONVERT_MS = 700;

export type Verdict = "pass" | "fail" | null;
/** Which part of the words → keys → address chain a step is about. Both views draw from it. */
export type ArtFocus = "warning" | "words" | "keys" | "address" | "sign" | "verify" | "gone";

/** Counts network requests the page starts after `since` (performance timeline). */
function useRequestsSince(since: number | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (since === null || typeof PerformanceObserver === "undefined") return;
    const obs = new PerformanceObserver(() =>
      setCount(performance.getEntriesByType("resource").filter((e) => e.startTime >= since).length),
    );
    try {
      obs.observe({ type: "resource" });
    } catch {
      /* unsupported */
    }
    return () => obs.disconnect();
  }, [since]);
  return since === null ? 0 : count;
}

/**
 * The whole state of lesson 0.2, shared by the 2D and the 3D view, so switching views mid-lesson keeps
 * every key, value and gate. Everything secret lives in React memory only: never in storage, URL or
 * evidence.
 */
export function useWallet({
  step,
  setGate,
  reducedMotion,
  mode,
}: {
  step: number;
  setGate: (open: boolean) => void;
  reducedMotion: boolean;
  mode: ChainMode;
}) {
  const [ack, setAck] = useState(false);
  const [keys, setKeys] = useState<PracticeKeyPair | null>(null);
  const [isDocsExample, setIsDocsExample] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [madeAt, setMadeAt] = useState<number | null>(null);
  const [rebuilt, setRebuilt] = useState<string | null>(null);
  /** Counts presses of "Rebuild from words", so the 3D view can replay the fold each time. */
  const [rebuilds, setRebuilds] = useState(0);
  const [convert, setConvert] = useState(0);
  const [converting, setConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ethAddress, setEthAddress] = useState("");
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);
  const [message, setMessage] = useState(MESSAGE);
  const [signed, setSigned] = useState<{ message: string; signature: string } | null>(null);
  const [checkMessage, setCheckMessage] = useState(MESSAGE);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [saw, setSaw] = useState({ pass: false, fail: false });
  const [cleared, setCleared] = useState(false);
  const [passed, setPassed] = useState(false);
  const requests = useRequestsSince(madeAt);

  const loadKeys = (phrase: string, docsExample: boolean) => {
    if (keys) wipe(keys);
    setKeys(keyPairFromPhrase(phrase));
    setIsDocsExample(docsExample);
    setMadeAt(performance.now());
    setEthAddress(practiceEthAddress());
    setShowSecret(false);
    setRebuilt(null);
    setRebuilds(0);
    setConvert(0);
    setConverting(false);
    setCopied(false);
    setFlipped([false, false, false]);
    setSigned(null);
    setVerdict(null);
    setSaw({ pass: false, fail: false });
    setCleared(false);
  };

  const acknowledge = (v: boolean) => {
    setAck(v);
    setGate(v);
  };

  const generate = () => {
    if (!ack) return;
    // Demo mode shows the public example from NEAR's docs; testnet mode makes a fresh random phrase.
    loadKeys(mode === "demo" ? DEMO_PHRASE : newPhrase(), mode === "demo");
    setGate(true);
  };

  const rebuild = () => {
    if (!keys) return;
    const again = keyPairFromPhrase(keys.phrase);
    setRebuilt(again.publicKey);
    setRebuilds((n) => n + 1);
    const same = again.publicKey === keys.publicKey;
    wipe(again);
    if (same) setGate(true);
  };

  // The conversion animation in step 4. Timers stop when the learner leaves the step.
  useEffect(() => {
    if (!converting || step !== STEP.address) return;
    const t = window.setTimeout(() => {
      const next = convert + 1;
      setConvert(next);
      if (next >= CONVERT_STAGES) {
        setConverting(false);
        setGate(true);
      }
    }, CONVERT_MS);
    return () => window.clearTimeout(t);
  }, [converting, convert, step, setGate]);

  const startConvert = () => {
    if (reducedMotion) {
      setConvert(CONVERT_STAGES);
      setGate(true);
    } else {
      setConvert(1);
      setConverting(true);
    }
  };
  const skipConvert = () => {
    setConvert(CONVERT_STAGES);
    setConverting(false);
    setGate(true);
  };

  const copy = () => {
    if (!keys) return;
    navigator.clipboard?.writeText(keys.implicitAccount).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const flip = (i: number) => {
    const next = flipped.map((f, j) => (j === i ? !f : f));
    setFlipped(next);
    // Opening the gate needs every card seen once; flipping back does not close it again.
    if (next.every(Boolean)) setGate(true);
  };

  const doSign = () => {
    if (!keys || !message.trim()) return;
    setSigned({ message, signature: sign(keys, message) });
    setCheckMessage(message);
    setVerdict(null);
    setSaw({ pass: false, fail: false });
    setGate(true);
  };

  const changeCheckMessage = (v: string) => {
    setCheckMessage(v);
    setVerdict(null);
  };
  const tamper = () => {
    if (!signed) return;
    changeCheckMessage(changeOneLetter(signed.message));
  };

  const doVerify = () => {
    if (!keys || !signed) return;
    const ok = verify(keys.publicKey, checkMessage, signed.signature);
    setVerdict(ok ? "pass" : "fail");
    const next = { pass: saw.pass || ok, fail: saw.fail || !ok };
    setSaw(next);
    if (next.pass && next.fail) setGate(true);
  };

  const throwAway = () => {
    if (keys) wipe(keys);
    setKeys(null);
    setSigned(null);
    setRebuilt(null);
    setEthAddress("");
    setShowSecret(false);
    setMadeAt(null);
    setCleared(true);
    setGate(true);
  };

  const pass = () => {
    setPassed(true);
    setGate(true);
  };

  const state = !keys
    ? cleared
      ? "cleared"
      : ack
        ? "acknowledged"
        : "warning"
    : saw.pass && saw.fail
      ? "tamper-caught"
      : verdict
        ? `verified-${verdict}`
        : signed
          ? "signed"
          : flipped.every(Boolean)
            ? "compared"
            : convert >= CONVERT_STAGES
              ? "address"
              : rebuilt
                ? "rebuilt"
                : "keys";

  const focus: ArtFocus =
    step === STEP.warning || (!keys && step <= STEP.generate)
      ? "warning"
      : !keys
        ? "gone"
        : step === STEP.seed
          ? "words"
          : step === STEP.address || step === STEP.compare
            ? "address"
            : step === STEP.sign
              ? "sign"
              : step === STEP.verify
                ? "verify"
                : "keys";

  const needsKeys = step >= STEP.seed && step <= STEP.custody && !keys && !(step === STEP.custody && cleared);

  return {
    ack,
    keys,
    isDocsExample,
    showSecret,
    rebuilt,
    rebuilds,
    convert,
    converting,
    copied,
    ethAddress,
    flipped,
    message,
    signed,
    checkMessage,
    verdict,
    saw,
    cleared,
    passed,
    requests,
    state,
    focus,
    needsKeys,
    acknowledge,
    toggleSecret: () => setShowSecret((s) => !s),
    loadKeys,
    generate,
    rebuild,
    startConvert,
    skipConvert,
    copy,
    flip,
    setMessage,
    doSign,
    changeCheckMessage,
    tamper,
    doVerify,
    throwAway,
    pass,
  };
}

export type Wallet = ReturnType<typeof useWallet>;
