import { createContext, useContext, useState, type ReactNode } from "react";
import { DemoChain } from "./DemoChain";
import type { Chain } from "./types";

const ChainContext = createContext<Chain | null>(null);

/**
 * Gives every lesson the same Chain. Demo mode (the default) uses a DemoChain that lives for the
 * whole visit, so a transfer in one lesson shows up in the next. TestnetChain (#7) plugs in via `chain`.
 */
export function ChainProvider({ chain, children }: { chain?: Chain; children: ReactNode }) {
  const [fallback] = useState<Chain>(() => chain ?? new DemoChain());
  return <ChainContext.Provider value={chain ?? fallback}>{children}</ChainContext.Provider>;
}

/** The Chain for this page. Lessons never touch RPC, wallets or SDKs directly. */
export function useChain(): Chain {
  const chain = useContext(ChainContext);
  if (!chain) throw new Error("useChain() needs a <ChainProvider> above it");
  return chain;
}
