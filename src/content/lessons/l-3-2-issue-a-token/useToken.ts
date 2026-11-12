/**
 * The ONE state of lesson 3.2, shared by the 2D and the 3D view. Everything on chain goes through the
 * Chain interface: making the parent name when needed, the token deploy batch, the refused transfer,
 * the storage deposit, and the meta-transaction (signDelegate + relayDelegate). No three.js here.
 *
 * The token is the demo NEP-141 contract (src/chain/demo/token.ts). This repo has no token Wasm yet, so
 * in testnet mode the lesson runs on its own DemoChain and says so.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../../../app/types";
import { useChain } from "../../../chain/ChainContext";
import { DEMO_RELAYER, DemoChain, demoContractCode } from "../../../chain/DemoChain";
import { FT_STORAGE_DEPOSIT } from "../../../chain/demo/token";
import { isChainError } from "../../../chain/errors";
import { actions, callMethod, createNamedAccount } from "../../../chain/ops";
import { tgas } from "../../../chain/units";
import type { AccountView, Chain, TxOutcome, TxPhase } from "../../../chain/types";
import { CONTRACT_FUNDING, gaugeOf, nearText, newParentName, PARENT_FUNDING } from "../l-3-1-deploy-a-contract/contract";
import {
  DEFAULT_SUPPLY,
  DEFAULT_SYMBOL,
  evidenceOf,
  FRIEND,
  pickResult,
  SEND_AMOUNT,
  supplyOf,
  supplyProblem,
  symbolProblem,
  tokenIdFor,
  type Obj,
  type PickResult,
} from "./ft";
import { CHECK, GASLESS, HONEST, HOOK, MINT, REGISTER, TRAP } from "./steps";

export { CHECK, GASLESS, HONEST, HOOK, MINT, REGISTER, TRAP };

export type Busy = null | "mint" | "send" | "register" | "gasless";

const CALL_GAS = tgas(30);
const TRANSFER_GAS = tgas(10);
const transferArgs = { receiver_id: FRIEND, amount: `${SEND_AMOUNT}` };

export type Token = ReturnType<typeof useToken>;

export function useToken({
  step,
  setGate,
  setVars,
  reducedMotion,
  reportEvidence,
}: Pick<SceneProps, "step" | "setGate" | "setVars" | "reducedMotion" | "reportEvidence">) {
  const live = useChain();
  // No token Wasm ships yet, so testnet mode runs the token on a private demo chain (honest notice below).
  const chain: Chain = useMemo(() => (live.network === "demo" ? live : new DemoChain()), [live]);
  const demoOnly = live.network !== "demo";
  const pace = reducedMotion ? "instant" : "realtime";

  const [parent, setParent] = useState<{ id: string; make: boolean } | null>(null);
  const [parentMade, setParentMade] = useState(false);
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOL);
  const [supplyInput, setSupplyInput] = useState(String(DEFAULT_SUPPLY));
  const [minted, setMinted] = useState<{ symbol: string; supply: number; tx: string } | null>(null);
  const [myBalance, setMyBalance] = useState(0);
  const [friendBalance, setFriendBalance] = useState(0);
  const [refused, setRefused] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ tx: string; bytes: number } | null>(null);
  const [tokenView, setTokenView] = useState<AccountView | null>(null);
  const [relayed, setRelayed] = useState(0);
  const [relayTx, setRelayTx] = useState<string | null>(null);
  const [relay, setRelay] = useState<{ remaining: number; cap: number; relayerId: string; gasTgas: string } | null>(
    null,
  );
  const [relayRefused, setRelayRefused] = useState<string | null>(null);
  const [myNear, setMyNear] = useState<{ before: bigint; after: bigint } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ what: Obj; n: number; result: PickResult } | null>(null);
  const [passed, setPassed] = useState(false);

  const tokenId = parent ? tokenIdFor(parent.id) : null;
  const symbol = minted?.symbol ?? (symbolProblem(symbolInput) ? DEFAULT_SYMBOL : symbolInput.trim());
  const supply = minted?.supply ?? (supplyProblem(supplyInput) ? DEFAULT_SUPPLY : supplyOf(supplyInput));

  useEffect(() => {
    let on = true;
    chain
      .practiceAccount()
      .then((acc) => {
        if (!on) return;
        const own = tokenIdFor(acc.accountId);
        setParent(own ? { id: acc.accountId, make: false } : { id: newParentName(), make: true });
      })
      .catch((e) => on && setError(message(e)));
    return () => {
      on = false;
    };
  }, [chain]);

  const done = [true, !!minted, !!refused, !!registered, relayed > 0, passed, true];
  const stepDone = done[step] ?? false;
  useEffect(() => {
    setGate(stepDone);
  }, [stepDone, setGate]);

  // The learner's own values in later text.
  const varsRef = useRef(setVars);
  varsRef.current = setVars;
  useEffect(() => {
    varsRef.current?.({ symbol, supply: supply.toLocaleString("en-US") });
  }, [symbol, supply]);

  const evidenceRef = useRef(reportEvidence);
  evidenceRef.current = reportEvidence;
  useEffect(() => {
    const ev = evidenceOf({ minted: !!minted, tokenId, symbol, supply, relayTx });
    if (ev) evidenceRef.current?.(ev);
  }, [minted, tokenId, symbol, supply, relayTx]);

  // A new step clears the last pick's hint.
  useEffect(() => setPicked(null), [step]);

  async function run(kind: Exclude<Busy, null>, work: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    setPhase(null);
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
      setPhase(null);
    }
  }
  const send = { pace, onPhase: (e: { phase: TxPhase }) => setPhase(e.phase) } as const;

  function failed(out: TxOutcome): boolean {
    if (out.status.type !== "Failure") return false;
    setError(out.status.error.message);
    return true;
  }

  async function balances(id: string) {
    const [mine, theirs] = await Promise.all([
      chain.viewCall<string>(id, "ft_balance_of", { account_id: parent!.id }),
      chain.viewCall<string>(id, "ft_balance_of", { account_id: FRIEND }),
    ]);
    setMyBalance(Number(mine.result));
    setFriendBalance(Number(theirs.result));
    setTokenView(await chain.viewAccount(id));
  }

  const mint = () =>
    run("mint", async () => {
      if (!parent || !tokenId || minted || step !== MINT) return;
      const sp = symbolProblem(symbolInput);
      const np = supplyProblem(supplyInput);
      if (sp || np) return setError(sp ?? np);
      const sym = symbolInput.trim();
      const total = supplyOf(supplyInput);
      if (parent.make && !parentMade) {
        const made = await createNamedAccount(chain, parent.id, await chain.newKeyPair(), PARENT_FUNDING, send);
        if (failed(made)) return;
        setParentMade(true);
      }
      const out = await chain.sendTransaction(
        {
          signerId: parent.id,
          receiverId: tokenId,
          actions: [
            actions.createAccount(),
            actions.transfer(CONTRACT_FUNDING),
            actions.addFullAccessKey(await chain.newKeyPair()),
            actions.deployContract(demoContractCode("ft")),
            actions.functionCall(
              "new",
              { owner_id: parent.id, total_supply: `${total}`, metadata: { symbol: sym, name: sym, decimals: 0 } },
              CALL_GAS,
              0n,
            ),
          ],
        },
        send,
      );
      if (failed(out)) return;
      setMinted({ symbol: sym, supply: total, tx: out.transaction.hash });
      await balances(tokenId);
    });

  const sendToFriend = () =>
    run("send", async () => {
      if (!parent || !tokenId || !minted || refused || step !== TRAP) return;
      const out = await callMethod(chain, tokenId, "ft_transfer", transferArgs, {
        ...send,
        signerId: parent.id,
        gas: TRANSFER_GAS,
        deposit: 1n,
      });
      if (out.status.type === "Failure") setRefused(out.status.error.message);
      else setError("The transfer went through: your friend was already registered.");
      await balances(tokenId);
    });

  const register = () =>
    run("register", async () => {
      if (!parent || !tokenId || !minted || registered || step !== REGISTER) return;
      const before = (await chain.viewAccount(tokenId)).storageUsage;
      const out = await callMethod(chain, tokenId, "storage_deposit", { account_id: FRIEND }, {
        ...send,
        signerId: parent.id,
        gas: TRANSFER_GAS,
        deposit: FT_STORAGE_DEPOSIT,
      });
      if (failed(out)) return;
      const after = (await chain.viewAccount(tokenId)).storageUsage;
      setRegistered({ tx: out.transaction.hash, bytes: after - before });
      await balances(tokenId);
    });

  const gasless = () =>
    run("gasless", async () => {
      if (!parent || !tokenId || !registered || step !== GASLESS) return;
      setRelayRefused(null);
      const before = (await chain.viewAccount(parent.id)).amount;
      const signed = await chain.signDelegate({
        senderId: parent.id,
        receiverId: tokenId,
        actions: [actions.functionCall("ft_transfer", transferArgs, TRANSFER_GAS, 1n)],
      });
      try {
        const r = await chain.relayDelegate(signed, send);
        if (failed(r.outcome)) return;
        const gas = r.outcome.receipts.reduce((s, x) => s + x.gasBurnt, r.outcome.transactionOutcome.gasBurnt);
        setRelay({
          remaining: r.remaining,
          cap: r.cap,
          relayerId: r.relayerId,
          gasTgas: (Number(gas / 10n ** 9n) / 1000).toFixed(2),
        });
        setRelayTx(r.outcome.transaction.hash);
        setRelayed((n) => n + 1);
      } catch (e) {
        if (isChainError(e) && e.kind === "RelayRefused") {
          setRelayRefused(e.message);
          setRelay((x) => (x ? { ...x, remaining: 0 } : x));
          return;
        }
        throw e;
      }
      const after = (await chain.viewAccount(parent.id)).amount;
      setMyNear((m) => ({ before: m?.before ?? before, after }));
      await balances(tokenId);
    });

  const actionsByName = { mint, send: sendToFriend, register, gasless } as const;

  /** A pick on a scene object (2D or 3D): run the step's action, or answer with a hint or a detail. */
  const pick = (what: Obj) => {
    const result = pickResult(
      {
        step,
        minted: !!minted,
        refused: !!refused,
        registered: !!registered,
        relayed,
        symbol,
        supply,
        myBalance,
        friendBalance,
        depositText: nearText(FT_STORAGE_DEPOSIT),
      },
      what,
    );
    setPicked((p) => ({ what, n: (p?.n ?? 0) + 1, result }));
    if ("act" in result) void actionsByName[result.act]();
  };

  const capped = !!relayRefused;
  const state = [
    `step:${step}`,
    `minted:${minted ? "yes" : "no"}`,
    `refused:${refused ? "yes" : "no"}`,
    `registered:${registered ? "yes" : "no"}`,
    `relayed:${relayed}`,
    `capped:${capped ? "yes" : "no"}`,
    `busy:${busy ?? "no"}`,
    `error:${error ? "yes" : "no"}`,
    `network:${chain.network}`,
  ].join(";");

  let status: string | null = null;
  if (error) status = null;
  else if (busy === "mint")
    status = parent?.make && !parentMade ? `Making ${parent.id} first…` : `Minting… ${phase ?? ""}`.trim();
  else if (busy === "gasless") status = `The relayer is sending it… ${phase ?? ""}`.trim();
  else if (busy) status = phase ? `Working… ${phase}` : "Working…";
  else if (step === MINT) status = minted ? "Minted. Press Next." : null;
  else if (step === TRAP)
    status = !minted ? "Mint your tokens first (step 2)." : refused ? "Refused, as expected. Press Next." : null;
  else if (step === REGISTER)
    status = !minted ? "Mint your tokens first (step 2)." : registered ? "Registered. Press Next." : null;
  else if (step === GASLESS)
    status = !registered
      ? "Register your friend's storage first (step 4)."
      : capped
        ? "The relayer refused: you reached its cap."
        : relayed
          ? "Delivered. Send again to reach the relayer's cap, or press Next."
          : null;

  return {
    step,
    network: chain.network,
    demoOnly,
    parent,
    tokenId,
    relayerId: relay?.relayerId ?? DEMO_RELAYER,
    symbolInput,
    setSymbolInput,
    supplyInput,
    setSupplyInput,
    symbolProblem: symbolProblem(symbolInput),
    supplyProblem: supplyProblem(supplyInput),
    symbol,
    supply,
    minted,
    myBalance,
    friendBalance,
    refused,
    registered,
    deposit: FT_STORAGE_DEPOSIT,
    tokenView,
    gauge: gaugeOf(tokenView),
    relayed,
    relayTx,
    relay,
    relayRefused,
    capped,
    myNear,
    busy,
    phase,
    error,
    picked,
    pick,
    passed,
    pass: () => setPassed(true),
    state,
    status,
    canMint: step === MINT && !minted && !busy && !!tokenId,
    canSend: step === TRAP && !!minted && !refused && !busy,
    canRegister: step === REGISTER && !!refused && !registered && !busy,
    canGasless: step === GASLESS && !!registered && !busy && !capped,
    mint,
    sendToFriend,
    register,
    gasless,
  };
}

function message(e: unknown): string {
  return isChainError(e) ? e.message : "Something went wrong. Please try again.";
}
