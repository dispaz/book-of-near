/**
 * The ONE state of lesson 4.1, shared by the 2D and the 3D view: the path, the derived address, the
 * packed Sepolia transfer, the signature request and the check of who signed. Everything on chain goes
 * through useChain() and src/chain/chainSignatures.ts (built on the Chain interface). No three.js here.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import {
  DEFAULT_PATH,
  deriveEvmAccount,
  finalizeEvmTransaction,
  prepareEvmTransfer,
  recoverEvmSigner,
  requestSignature,
  rootPublicKey,
  SIGNER_CONTRACT,
  type EvmAccount,
  type PreparedTransfer,
  type SignatureResult,
} from "../../../chain/chainSignatures";
import { isChainError } from "../../../chain/errors";
import type { Hex } from "viem";
import { cleanPath, sharesLit, shortHex, shortName, type SignPhase } from "./signing";
import { DERIVE, PREPARE, SIGN, VERIFY } from "./steps";
import type { ChainKey } from "./layout3d";

export * from "./steps";

export type ChainSig = ReturnType<typeof useChainSig>;
/** Something on the page the learner picked, to read about it. */
export type Picked = "near" | "ring" | "signer" | ChainKey | "address" | "parcel" | null;

export function useChainSig({
  step,
  setGate,
  setVars,
  reportEvidence,
  reducedMotion,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reportEvidence" | "reducedMotion">) {
  const chain = useChain();
  const network = chain.network;
  const [me, setMe] = useState<string | null>(null);
  const [pathText, setPathText] = useState(DEFAULT_PATH);
  const [account, setAccount] = useState<EvmAccount | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [prepared, setPrepared] = useState<PreparedTransfer | null>(null);
  const [phase, setPhase] = useState<SignPhase>("idle");
  const [waitStart, setWaitStart] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [signed, setSigned] = useState<Hex | null>(null);
  const [recovered, setRecovered] = useState<Hex | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked>(null);
  const [passed, setPassed] = useState(false);

  const pathCheck = cleanPath(pathText);
  const path = account?.path ?? (pathCheck.ok ? pathCheck.path : DEFAULT_PATH);

  useEffect(() => {
    let live = true;
    void chain.practiceAccount().then(
      (a) => live && setMe(a.accountId),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [chain]);

  /** A new path starts the address over, and everything after it. */
  const editPath = (text: string) => {
    setPathText(text);
    if (account && text.trim() !== account.path) again();
  };

  /** Start the address over with the path box open again (the same text, ready to change). */
  const again = () => {
    setAccount(null);
    setPrepared(null);
    setResult(null);
    setSigned(null);
    setRecovered(null);
    setPhase("idle");
  };

  const derive = async () => {
    if (deriving || account) return;
    const check = cleanPath(pathText);
    if (!check.ok) return setProblem(check.why);
    setProblem(null);
    setDeriving(true);
    try {
      const who = me ?? (await chain.practiceAccount()).accountId;
      setMe(who);
      const root = await rootPublicKey(chain);
      setAccount(deriveEvmAccount(root, who, check.path));
    } catch (e) {
      setProblem(
        isChainError(e)
          ? `The app could not read the signer's public key: ${e.message}`
          : "The app could not work out the address just now. Try again.",
      );
    } finally {
      setDeriving(false);
    }
  };

  const prepare = () => {
    if (!account || prepared) return;
    setPrepared(prepareEvmTransfer({ from: account.address }));
  };

  const sign = async () => {
    if (!prepared || !account || phase === "sending" || phase === "waiting" || result) return;
    setProblem(null);
    setPhase("sending");
    const t0 = Date.now();
    setWaitStart(t0);
    setNow(t0);
    try {
      const out = await requestSignature(chain, prepared.payload, account.path, {
        pace: reducedMotion ? "instant" : "realtime",
        onPhase: (e) => {
          if (e.phase === "broadcast" || e.phase === "included") {
            setPhase((p) => (p === "sending" ? "waiting" : p));
            if (e.phase === "broadcast") setWaitStart(Date.now());
          }
        },
      });
      setResult(out);
      setSigned(finalizeEvmTransaction(prepared, out.signature));
      setPhase("answered");
    } catch (e) {
      setPhase("failed");
      setProblem(
        isChainError(e)
          ? `NEAR refused the request: ${e.message}`
          : `The signing network did not answer: ${(e as Error).message}`,
      );
    }
  };

  const verify = async () => {
    if (!signed || recovered) return;
    setRecovered(await recoverEvmSigner(signed));
  };

  // A tick while the request waits, so the timer and the nodes move.
  useEffect(() => {
    if (phase !== "sending" && phase !== "waiting") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  // Opened at a later step (a link, a reload): do the free, offline steps so the page is not empty.
  // Signing costs a NEAR transaction, so it is never done for the learner.
  useEffect(() => {
    if (step > DERIVE && !account && !deriving && !problem) void derive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, account, deriving, problem]);
  useEffect(() => {
    if (step > PREPARE && account && !prepared) prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, account, prepared]);

  const match = !!recovered && !!account && recovered.toLowerCase() === account.address.toLowerCase();

  // Gates.
  useEffect(() => {
    if (step === DERIVE) setGate(!!account);
    if (step === PREPARE) setGate(!!prepared);
    if (step === SIGN) setGate(!!result);
    if (step === VERIFY) setGate(match);
  }, [step, account, prepared, result, match, setGate]);

  // The learner's own values in later text.
  useEffect(() => {
    const v: Record<string, string> = { signer: SIGNER_CONTRACT, path };
    if (me) v.name = shortName(me);
    // Short form in captions: a 42-character address overflows the printed page. The facts show it whole.
    if (account) v.derivedEthAddress = shortHex(account.address, 8, 5);
    setVars?.(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, path, account]);

  // The completion record carries the evidence: the address, the sign request and the check.
  useEffect(() => {
    if (!account) return;
    const ev: Record<string, string> = {
      mode: network,
      path: account.path,
      derivedEthAddress: account.address,
      signerContract: SIGNER_CONTRACT,
    };
    if (result) {
      ev.txHash = result.txHash;
      ev.mpcTxHash = result.txHash;
      ev.signatureReturned = "true";
    }
    if (signed) ev.signedTx = signed;
    if (recovered) {
      ev.recoveredAddress = recovered;
      ev.recoveredMatches = String(match);
      ev.broadcast = "not sent: the derived address has 0 Sepolia ETH for gas";
    }
    reportEvidence?.(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, result, signed, recovered]);

  // Picks read the latest state: during a page turn the old page's objects can still be picked.
  const latest = useRef({ step, account, prepared, result, signed });
  useLayoutEffect(() => {
    latest.current = { step, account, prepared, result, signed };
  });

  /** Picking an object reads about it, and does the step's action when it is the step's object. */
  const pick = (what: Exclude<Picked, null>) => {
    const n = latest.current;
    setPicked(what);
    if (n.step === DERIVE && (what === "near" || what === "address") && !n.account) void derive();
    if (n.step === PREPARE && (what === "parcel" || what === "address")) prepare();
    if (n.step === SIGN && (what === "ring" || what === "signer" || what === "parcel")) void sign();
    if (n.step === VERIFY && (what === "address" || what === "parcel")) void verify();
  };

  const elapsed = phase === "sending" || phase === "waiting" ? Math.max(0, now - waitStart) : 0;
  const lit = reducedMotion && phase === "waiting" ? 0 : sharesLit(phase, elapsed);
  const state = [
    `path:${path}`,
    `derived:${account ? "yes" : "no"}`,
    `packed:${prepared ? "yes" : "no"}`,
    `sign:${phase}`,
    `match:${recovered ? (match ? "yes" : "no") : "unchecked"}`,
  ].join(";");

  return {
    step,
    network,
    me,
    pathText,
    pathCheck,
    path,
    editPath,
    again,
    account,
    deriving,
    derive,
    prepared,
    prepare,
    phase,
    elapsed,
    lit,
    result,
    signed,
    sign,
    recovered,
    match,
    verify,
    problem,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    state,
  };
}
