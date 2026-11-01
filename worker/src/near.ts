/** The faucet account talking to testnet through near-kit (verified call shapes: docs/spikes-seed.md). */
import { Near } from "near-kit";
import type { FaucetSender } from "./faucet";

export function nearSender(accountId: string, privateKey: string): FaucetSender {
  const near = new Near({
    network: "testnet",
    privateKey: privateKey as `ed25519:${string}`,
    defaultSignerId: accountId,
  });
  return {
    async fundImplicit(to, amount) {
      const r = await near.send(to, `${Number(amount)} NEAR` as const);
      return r.transaction?.hash ?? "";
    },
    async createNamed(to, publicKey, amount) {
      const r = await near.call(
        "testnet",
        "create_account",
        { new_account_id: to, new_public_key: publicKey },
        { attachedDeposit: `${Number(amount)} NEAR` as const, gas: "30 Tgas" },
      );
      return (r as { transaction: { hash: string } }).transaction.hash;
    },
    accountExists: (id) => near.accountExists(id),
  };
}
