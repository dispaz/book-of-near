/**
 * Entry point the app loads lazily (ChainContext) in testnet mode, so demo mode never downloads
 * this code or near-kit.
 */
import { helperFunder, localPracticeStore, workerFunder, type Funder } from "./practice";
import { TestnetChain } from "./TestnetChain";

export { TestnetChain } from "./TestnetChain";
export type { TestnetChainOptions } from "./TestnetChain";

/** Faucets in order: our Worker when VITE_WORKER_URL is set, then NEAR's public helper. */
export function defaultFunders(workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined): Funder[] {
  const list: Funder[] = [];
  if (workerUrl) list.push(workerFunder(workerUrl));
  list.push(helperFunder());
  return list;
}

export function createTestnetChain(): TestnetChain {
  return new TestnetChain({
    store: localPracticeStore(),
    funders: defaultFunders(),
    returnAccountId: import.meta.env.VITE_RETURN_ACCOUNT_ID as string | undefined,
  });
}
