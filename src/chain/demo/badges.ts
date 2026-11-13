/**
 * The badge contract in demo mode: the rules of contracts/badge (src/lib.rs) in JavaScript.
 * One badge per account per stage, stage n needs stage n - 1, the claim must be signed by the claim
 * key over `stageMessage` and not be expired (block time), no deposit, nothing can be transferred.
 * A replayed claim is refused because the stage is already claimed, exactly as on chain.
 * The final badge (`claim_final`, issue #29): one per account, the claim signed over the caller's own
 * account, route and rarity (`finalMessage`), and every stage the route requires held first.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { base58, base64 } from "@scure/base";
import { EXAM_ROUTE_INFO, EXAM_ROUTES } from "../../exam/routes";
import { finalMessage, isRarity, stageMessage, type Rarity } from "../../badges/message";
import { tgas } from "../units";
import type { DemoContract, DemoContractContext } from "./contracts";

/**
 * The demo claim key. Public on purpose: demo mode signs claims in the browser, without the Worker,
 * and a demo badge proves nothing. Testnet uses a different key that only the Worker holds.
 */
export const DEMO_CLAIM_SEED = sha256(utf8ToBytes("book-of-near demo claim key"));
export const DEMO_CLAIM_PUBLIC_KEY = `ed25519:${base58.encode(ed25519.getPublicKey(DEMO_CLAIM_SEED))}`;

export const DEMO_STAGE_COUNT = 7;

/** The stages each exam route needs, as the owner sets them on testnet with `set_route` (src/exam/routes.ts). */
export const DEMO_ROUTES: Record<string, number[]> = Object.fromEntries(
  EXAM_ROUTES.map((r) => [r, EXAM_ROUTE_INFO[r].requiredBadges]),
);

interface DemoStageToken {
  owner: string;
  stage: number;
  mintedAtMs: number;
}

interface DemoFinalToken {
  owner: string;
  kind: "final";
  route: string;
  rarity: Rarity;
  mintedAtMs: number;
}

type DemoToken = DemoStageToken | DemoFinalToken;

function tokenJson(id: string, t: DemoToken) {
  if ("kind" in t)
    return {
      token_id: id,
      owner_id: t.owner,
      metadata: {
        title: `Book of NEAR: Final badge (${t.rarity})`,
        description: "Passed the Book of NEAR final exam.",
        media: `final-${t.rarity}.svg`,
        issued_at: String(t.mintedAtMs),
        extra: JSON.stringify({
          kind: "final",
          stage: null,
          route: t.route,
          rarity: t.rarity,
          transferable: false,
        }),
      },
    };
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

/** A final badge to start a DemoChain with. */
export interface DemoFinalSeed {
  owner: string;
  route: string;
  rarity: Rarity;
  mintedAtMs: number;
}

/**
 * Write `badges` (then `finals`) into the badge contract's state, as if they had been claimed in that
 * order.
 */
export function seedBadgeState(
  set: (key: string, value: string) => void,
  badges: DemoBadgeSeed[],
  finals: DemoFinalSeed[] = [],
) {
  const owned = new Map<string, string[]>();
  const own = (owner: string, id: string) => owned.set(owner, [...(owned.get(owner) ?? []), id]);
  badges.forEach((b, i) => {
    const id = String(i);
    set(`s:${b.owner}:${b.stage}`, id);
    set(`t:${id}`, JSON.stringify({ owner: b.owner, stage: b.stage, mintedAtMs: b.mintedAtMs }));
    own(b.owner, id);
  });
  finals.forEach((f, i) => {
    const id = String(badges.length + i);
    set(`f:${f.owner}`, id);
    const t: DemoFinalToken = {
      owner: f.owner,
      kind: "final",
      route: f.route,
      rarity: f.rarity,
      mintedAtMs: f.mintedAtMs,
    };
    set(`t:${id}`, JSON.stringify(t));
    own(f.owner, id);
  });
  for (const [owner, ids] of owned) set(`o:${owner}`, JSON.stringify(ids));
  if (badges.length + finals.length) set("next", String(badges.length + finals.length));
}

function decodeSignature(value: unknown): Uint8Array {
  let sig: Uint8Array;
  try {
    sig = base64.decode(String(value ?? ""));
  } catch {
    throw new Error("Signature must be 64 bytes");
  }
  if (sig.length !== 64) throw new Error("Signature must be 64 bytes");
  return sig;
}

function mintToken(ctx: DemoContractContext, account: string, token: DemoToken): string {
  const id = ctx.get("next") ?? "0";
  ctx.set("next", String(Number(id) + 1));
  ctx.set(`t:${id}`, JSON.stringify(token));
  ctx.set(`o:${account}`, JSON.stringify([...ownedIds(ctx, account), id]));
  ctx.log(
    `EVENT_JSON:{"standard":"nep171","version":"1.2.0","event":"nft_mint","data":[{"owner_id":"${account}","token_ids":["${id}"]}]}`,
  );
  return id;
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
        const sig = decodeSignature(ctx.args.signature);
        const msg = utf8ToBytes(stageMessage(ctx.contractId, account, stage, expiresAtMs));
        if (!ed25519.verify(sig, msg, pk)) throw new Error("Invalid claim signature");
        if (holds(ctx, account, stage)) throw new Error("Badge for this stage already claimed");
        if (stage > 0 && !holds(ctx, account, stage - 1)) throw new Error("Claim the previous stage first");
        const id = mintToken(ctx, account, { owner: account, stage, mintedAtMs: ctx.blockTimestampMs });
        ctx.set(`s:${account}:${stage}`, id);
        return id;
      },
    },
    claim_final: {
      gas: tgas(4),
      run(ctx) {
        if (ctx.deposit !== 0n) throw new Error("Attach no deposit");
        // The caller, never an argument: a claim signed for another account fails the signature check.
        const account = ctx.predecessorId;
        const route = String(ctx.args.route ?? "");
        const rarity = ctx.args.rarity;
        const expiresAtMs = Number(ctx.args.expires_at_ms);
        if (!isRarity(rarity)) throw new Error("Unknown rarity");
        const required = DEMO_ROUTES[route];
        if (!required) throw new Error("Unknown route");
        if (ctx.blockTimestampMs > expiresAtMs) throw new Error("Claim expired");
        const sig = decodeSignature(ctx.args.signature);
        const msg = utf8ToBytes(finalMessage(ctx.contractId, account, route, rarity, expiresAtMs));
        if (!ed25519.verify(sig, msg, pk)) throw new Error("Invalid claim signature");
        if (ctx.get(`f:${account}`) !== undefined) throw new Error("Final badge already claimed");
        if (!required.every((s) => holds(ctx, account, s)))
          throw new Error("A stage this route requires is missing");
        const id = mintToken(ctx, account, {
          owner: account,
          kind: "final",
          route,
          rarity,
          mintedAtMs: ctx.blockTimestampMs,
        });
        ctx.set(`f:${account}`, id);
        return id;
      },
    },
    has_final_badge: {
      view: true,
      run: (ctx) => ctx.get(`f:${String(ctx.args.account_id)}`) !== undefined,
    },
    get_route: {
      view: true,
      run: (ctx) => DEMO_ROUTES[String(ctx.args.route)] ?? null,
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
