import type { AccountId, ShardId, ShardLayout } from "./types";

/**
 * NEAR's account-to-shard rule: boundary accounts split the sorted account-id space.
 * An account goes to shard i when boundaryAccounts[i-1] <= accountId < boundaryAccounts[i].
 * (nearcore `ShardLayout::account_id_to_shard_id`).
 */
export function shardForAccount(layout: ShardLayout, accountId: AccountId): ShardId {
  let i = 0;
  while (i < layout.boundaryAccounts.length && accountId >= layout.boundaryAccounts[i]!) i++;
  return layout.shardIds[i]!;
}
