/**
 * The badge contract in demo mode: the rules of contracts/badge (src/lib.rs) in JavaScript.
 * One badge per account per stage, stage n needs stage n - 1, the claim must be signed by the claim
 * key over `stageMessage` and not be expired (block time), no deposit, nothing can be transferred.
 * A replayed claim is refused because the stage is already claimed, exactly as on chain.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base58, base64 } from "@scure/base";
import { stageMessage } from "../../badges/message";
import { tgas } from "../units";
import type { DemoContract, DemoContractContext } from "./contracts";

/**
 * The demo claim key. Public on purpose: demo mode signs claims in the browser, without the Worker,
 * and a demo badge proves nothing. Testnet uses a different key that only the Worker holds.
 */
export const DEMO_CLAIM_SEED = sha256(utf8ToBytes("book-of-near demo claim key"));
export const DEMO_CLAIM_PUBLIC_KEY = `ed25519:${base58.encode(ed25519.getPublicKey(DEMO_CLAIM_SEED))}`;

export const DEMO_STAGE_COUNT = 8;

interface DemoToken {
  owner: string;
  stage: number;
  mintedAtMs: number;
}

function tokenJson(id: string, t: DemoToken) {
  return {
    token_id: id,
    owner_id: t.owner,
    metadata: {
      title: `Book of NEAR: Stage ${t.stage}`,
      description: `Finished stage ${t.stage} of the Book of NEAR course.`,
      media: `stage-${t.stage}.svg`,
      issued_at: String(t.mintedAtMs),
      extra: JSON.stringify({
        kind: "stage",
        stage: t.stage,
        route: null,
        rarity: null,
        transferable: false,
      }),
    },
  };
}

const ownedIds = (ctx: DemoContractContext, account: string): string[] =>
  JSON.parse(ctx.get(`o:${account}`) ?? "[]") as string[];

const holds = (ctx: DemoContractContext, account: string, stage: number) =>
  ctx.get(`s:${account}:${stage}`) !== undefined;

/** A badge to start a DemoChain with: what the contract stores, without the claim. */
export interface DemoBadgeSeed {
  owner: string;
  stage: number;
  mintedAtMs: number;
}

/** Write `badges` into the badge contract's state, as if they had been claimed in that order. */
export function seedBadgeState(set: (key: string, value: string) => void, badges: DemoBadgeSeed[]) {
  const owned = new Map<string, string[]>();
  badges.forEach((b, i) => {
    const id = String(i);
    set(`s:${b.owner}:${b.stage}`, id);
    set(`t:${id}`, JSON.stringify({ owner: b.owner, stage: b.stage, mintedAtMs: b.mintedAtMs }));
    owned.set(b.owner, [...(owned.get(b.owner) ?? []), id]);
  });
  for (const [owner, ids] of owned) set(`o:${owner}`, JSON.stringify(ids));
  if (badges.length) set("next", String(badges.length));
}

export function badgeContract(claimPublicKey = DEMO_CLAIM_PUBLIC_KEY): DemoContract {
  const pk = base58.decode(claimPublicKey.slice("ed25519:".length));
  return {
    claim_stage: {
      gas: tgas(4),
      run(ctx) {
        if (ctx.deposit !== 0n) throw new Error("Attach no deposit");
        const account = ctx.predecessorId;
        const stage = Number(ctx.args.stage);
        const expiresAtMs = Number(ctx.args.expires_at_ms);
        if (!Number.isInteger(stage) || stage < 0 || stage >= DEMO_STAGE_COUNT)
          throw new Error("Unknown stage");
        if (ctx.blockTimestampMs > expiresAtMs) throw new Error("Claim expired");
        let sig: Uint8Array;
        try {
          sig = base64.decode(String(ctx.args.signature ?? ""));
        } catch {
          throw new Error("Signature must be 64 bytes");
        }
        if (sig.length !== 64) throw new Error("Signature must be 64 bytes");
        const msg = utf8ToBytes(stageMessage(ctx.contractId, account, stage, expiresAtMs));
        if (!ed25519.verify(sig, msg, pk)) throw new Error("Invalid claim signature");
        if (holds(ctx, account, stage)) throw new Error("Badge for this stage already claimed");
        if (stage > 0 && !holds(ctx, account, stage - 1)) throw new Error("Claim the previous stage first");
        const id = ctx.get("next") ?? "0";
        ctx.set("next", String(Number(id) + 1));
        ctx.set(`s:${account}:${stage}`, id);
        ctx.set(`t:${id}`, JSON.stringify({ owner: account, stage, mintedAtMs: ctx.blockTimestampMs }));
        ctx.set(`o:${account}`, JSON.stringify([...ownedIds(ctx, account), id]));
        ctx.log(
          `EVENT_JSON:{"standard":"nep171","version":"1.2.0","event":"nft_mint","data":[{"owner_id":"${account}","token_ids":["${id}"]}]}`,
        );
        return id;
      },
    },
    has_badge: {
      view: true,
      run: (ctx) => holds(ctx, String(ctx.args.account_id), Number(ctx.args.stage)),
    },
    stages_of: {
      view: true,
      run(ctx) {
        const a = String(ctx.args.account_id);
        return [...Array(DEMO_STAGE_COUNT).keys()].filter((s) => holds(ctx, a, s));
      },
    },
    get_stage_count: { view: true, run: () => DEMO_STAGE_COUNT },
    nft_tokens_for_owner: {
      view: true,
      run(ctx) {
        const a = String(ctx.args.account_id);
        return ownedIds(ctx, a).map((id) => tokenJson(id, JSON.parse(ctx.get(`t:${id}`)!) as DemoToken));
      },
    },
    nft_metadata: {
      view: true,
      run: () => ({ spec: "nft-1.0.0", name: "Book of NEAR Badges", symbol: "BOOK", base_uri: "/badges" }),
    },
    nft_transfer: {
      run() {
        throw new Error("This badge is non-transferable");
      },
    },
  };
}
