import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initialMode, saveMode } from "../app/mode";
import type { ChainMode } from "../app/types";
import { loadDemoBadges } from "../badges/demoLedger";
import { DemoChain } from "./DemoChain";
import type { Chain } from "./types";

export type ChainStatus = "ready" | "connecting" | "fallback";

export interface ChainModeState {
  /** What the learner asked for. */
  requested: ChainMode;
  /** What lessons are really using now (demo after a fallback). */
  active: ChainMode;
  status: ChainStatus;
  /** Why testnet is not in use, in plain English. Set when status is "fallback". */
  notice: string | null;
  setMode(mode: ChainMode): void;
}

const ChainContext = createContext<Chain | null>(null);
const ModeContext = createContext<ChainModeState>({
  requested: "demo",
  active: "demo",
  status: "ready",
  notice: null,
  setMode: () => {},
});

/** Loads TestnetChain (and near-kit) only when testnet mode is used. Replaceable in tests. */
export type TestnetLoader = () => Promise<Chain>;
const loadTestnet: TestnetLoader = async () => (await import("./testnet")).createTestnetChain();

/** A Chain whose calls wait until the real one is known (while the practice account is set up). */
function deferredChain(target: Promise<Chain>): Chain {
  return new Proxy({} as Chain, {
    get(_, prop) {
      if (prop === "network") return "testnet";
      if (prop === "then") return undefined;
      return (...args: unknown[]) =>
        target.then((c) => (c[prop as keyof Chain] as (...a: unknown[]) => unknown).apply(c, args));
    },
  });
}

/**
 * Gives every lesson the same Chain. Demo mode (the default) uses a DemoChain that lives for the
 * whole visit, so a transfer in one lesson shows up in the next. Testnet mode (`?mode=testnet`,
 * VITE_CHAIN_MODE or the mode switch) loads TestnetChain and sets up the practice account; if
 * that fails the app falls back to demo mode and `useChainMode().notice` says why.
 * Pass `chain` to pin one Chain (tests).
 */
export function ChainProvider({
  chain,
  children,
  loadTestnetChain = loadTestnet,
}: {
  chain?: Chain;
  children: ReactNode;
  loadTestnetChain?: TestnetLoader;
}) {
  const [demo] = useState<Chain>(() => chain ?? new DemoChain({ badges: loadDemoBadges() }));
  const [requested, setRequested] = useState<ChainMode>(() => (chain ? chain.network : initialMode()));
  const [testnet, setTestnet] = useState<{ chain: Chain; status: ChainStatus; notice: string | null } | null>(
    null,
  );
  const attempt = useRef<Promise<Chain> | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (chain || requested !== "testnet" || attempt.current) return;
    let resolveTarget!: (c: Chain) => void;
    const target = new Promise<Chain>((r) => (resolveTarget = r));
    attempt.current = target;
    setTestnet({ chain: deferredChain(target), status: "connecting", notice: null });
    loadTestnetChain()
      .then(async (real) => {
        await real.practiceAccount(); // creates and funds it on first use
        resolveTarget(real);
        setTestnet({ chain: real, status: "ready", notice: null });
      })
      .catch((e: unknown) => {
        resolveTarget(demo);
        attempt.current = null; // the switch can try again later
        setTestnet({ chain: demo, status: "fallback", notice: fallbackNotice(e) });
      });
  }, [chain, requested, demo, loadTestnetChain, tries]);

  const setMode = useCallback((mode: ChainMode) => {
    saveMode(mode);
    setRequested(mode);
    if (mode === "testnet") {
      setTestnet((t) => (t?.status === "fallback" ? null : t));
      setTries((n) => n + 1);
    }
  }, []);

  const value = chain ?? (requested === "testnet" && testnet ? testnet.chain : demo);
  const state = useMemo<ChainModeState>(() => {
    if (chain) return { requested, active: chain.network, status: "ready", notice: null, setMode };
    if (requested === "demo" || !testnet)
      return {
        requested,
        active: "demo",
        status: requested === "demo" ? "ready" : "connecting",
        notice: null,
        setMode,
      };
    return {
      requested,
      active: testnet.status === "fallback" ? "demo" : "testnet",
      status: testnet.status,
      notice: testnet.notice,
      setMode,
    };
  }, [chain, requested, testnet, setMode]);

  return (
    <ModeContext.Provider value={state}>
      <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
    </ModeContext.Provider>
  );
}

function fallbackNotice(e: unknown): string {
  const why = e instanceof Error && e.message ? e.message : "testnet did not answer";
  return `Testnet is not available right now, so you are in demo mode. Lessons work the same, but nothing goes to a real network. Why: ${why}`;
}

/** The Chain for this page. Lessons never touch RPC, wallets or SDKs directly. */
export function useChain(): Chain {
  const chain = useContext(ChainContext);
  if (!chain) throw new Error("useChain() needs a <ChainProvider> above it");
  return chain;
}

/** Which network lessons use, whether testnet is still connecting, and why it fell back. */
export function useChainMode(): ChainModeState {
  return useContext(ModeContext);
}
