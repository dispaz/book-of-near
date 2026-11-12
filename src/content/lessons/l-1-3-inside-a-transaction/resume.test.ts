import { beforeEach, describe, expect, it } from "vitest";
import { DemoChain } from "../../../chain/DemoChain";
import { createNamedAccount } from "../../../chain/ops";
import type { PracticeAccount, PublicKey } from "../../../chain/types";
import { WORKSHOP_DEPOSIT, workshopLabel } from "./batch";
import { findWorkshop, rememberWorkshop } from "./resume";

let chain: DemoChain;
let me: PracticeAccount;
const name = (attempt = 1) => `${workshopLabel(me.accountId, attempt)}.testnet`;

/** What "Make the workshop account" does: the registrar makes `id` with `key`. */
async function make(id: string, key: PublicKey) {
  const out = await createNamedAccount(chain, id, key, WORKSHOP_DEPOSIT);
  return out.transaction.hash;
}

beforeEach(async () => {
  localStorage.clear();
  chain = new DemoChain({ pace: "instant" });
  me = await chain.practiceAccount();
});

describe("findWorkshop: the workshop account from an earlier visit", () => {
  it("finds none on a first visit and offers the first workshop name", async () => {
    expect(await findWorkshop(chain, me)).toEqual({ found: null, freeId: name(1) });
  });

  it("reuses the remembered account and reads back the transaction that made it", async () => {
    const hash = await make(name(1), me.publicKey);
    rememberWorkshop(chain.network, { id: name(1), txHash: hash });
    const { found } = await findWorkshop(chain, me);
    expect(found?.id).toBe(name(1));
    expect(found?.outcome?.transaction.hash).toBe(hash);
    expect(found?.balance).toBe((await chain.viewAccount(name(1))).amount);
  });

  it("reuses an account with our key even when this browser forgot it, without its transaction", async () => {
    await make(name(1), me.publicKey);
    const { found } = await findWorkshop(chain, me);
    expect(found?.id).toBe(name(1));
    expect(found?.outcome).toBeNull();
  });

  it("skips a name held by someone else's key and offers the next one", async () => {
    await make(name(1), await chain.newKeyPair());
    expect(await findWorkshop(chain, me)).toEqual({ found: null, freeId: name(2) });
  });
});
