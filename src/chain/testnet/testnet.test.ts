// @vitest-environment node
/**
 * The shared behavioural suite (contract.test-kit.ts) against the REAL NEAR testnet.
 * Opt-in, because it needs the network and spends free testnet NEAR:
 *
 *   npm run test:testnet        (sets TESTNET=1)
 *
 * The practice account comes from NEAR's public helper faucet (10 NEAR, no secrets needed).
 * The helper rate-limits (it answered 429 after a few accounts on 1 Nov 2026), so the throwaway
 * key is kept OUTSIDE the repo in $TESTNET_STORE (default: the OS temp dir) and reused while it
 * still has more than 7 NEAR. The counter contract is contracts/counter/counter.wasm.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { runChainContract } from "../contract.test-kit";
import { parseNear } from "../units";
import { helperFunder, type PracticeStore, type StoredPracticeAccount } from "./practice";
import { Rpc } from "./rpc";
import { TestnetChain } from "./TestnetChain";

const here = dirname(fileURLToPath(import.meta.url));
const counterCode = new Uint8Array(readFileSync(join(here, "../../../contracts/counter/counter.wasm")));

function fileStore(path: string): PracticeStore {
  return {
    load: () => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StoredPracticeAccount) : null),
    save: (a) => writeFileSync(path, JSON.stringify(a, null, 1), { mode: 0o600 }),
    clear: () => rmSync(path, { force: true }),
  };
}

async function freshEnough(store: PracticeStore) {
  const saved = store.load();
  if (!saved) return;
  const r = await new Rpc()
    .call<{ amount: string }>("query", {
      request_type: "view_account",
      finality: "final",
      account_id: saved.accountId,
    })
    .catch(() => null);
  if (!r || BigInt(r.amount) < parseNear("7")) store.clear();
}

if (process.env.TESTNET) {
  const store = fileStore(process.env.TESTNET_STORE ?? join(tmpdir(), "bon-testnet-practice.json"));
  // One chain (one funded practice account) for the whole run keeps the helper faucet calls to one.
  let chain: Promise<TestnetChain> | null = null;
  const make = () =>
    (chain ??= freshEnough(store).then(() => new TestnetChain({ store, funders: [helperFunder()] })));
  runChainContract(make, { counterCode, timeoutMs: 90_000 });
} else {
  describe("Chain contract on testnet", () => {
    it.skip("runs only with TESTNET=1 (npm run test:testnet)", () => {});
  });
}
