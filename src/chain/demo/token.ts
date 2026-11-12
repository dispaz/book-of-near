/**
 * A demo fungible token (lesson 3.2): NEP-141 transfers with NEP-145 storage registration, as
 * near-contract-standards' FungibleToken behaves. DemoChain runs it when `demoContractCode("ft")` is
 * deployed. There is no real token Wasm in this repo yet, so testnet mode does not run this contract.
 *
 * Amounts are decimal strings of whole token units (`decimals: 0`), like NEP-141's U128 JSON strings.
 * State: `meta` (metadata JSON), `supply`, and `b:<account>` (a registered account's balance).
 */
import type { DemoContract, DemoContractContext } from "./contracts";
import { parseNear } from "../units";

/** NEP-145 minimum deposit this token asks for (the common FT value; see docs/lessons/stage-3/3.2.md). */
export const FT_STORAGE_DEPOSIT = parseNear("0.00125");

export interface FtMetadata {
  spec: "ft-1.0.0";
  name: string;
  symbol: string;
  decimals: number;
}

const key = (id: string) => `b:${id}`;

function amountArg(ctx: DemoContractContext, name = "amount"): bigint {
  const raw = ctx.args[name];
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number as a string`);
  const n = BigInt(raw);
  if (n <= 0n) throw new Error("The amount should be a positive number");
  return n;
}

function idArg(ctx: DemoContractContext, name: string): string {
  const v = ctx.args[name];
  if (typeof v !== "string" || !v) throw new Error(`${name} is missing`);
  return v;
}

function balance(ctx: DemoContractContext, id: string): bigint | null {
  const v = ctx.get(key(id));
  return v === undefined ? null : BigInt(v);
}

function needInit(ctx: DemoContractContext) {
  if (ctx.get("meta") === undefined) throw new Error("The contract is not initialized");
}

function storageBalance(registered: boolean) {
  return registered ? { total: `${FT_STORAGE_DEPOSIT}`, available: "0" } : null;
}

export const tokenContract: DemoContract = {
  /** Mint `total_supply` to `owner_id` and register it. Runs once. */
  new: {
    run(ctx) {
      if (ctx.get("meta") !== undefined) throw new Error("The contract has already been initialized");
      const owner = idArg(ctx, "owner_id");
      const supply = amountArg(ctx, "total_supply");
      const m = (ctx.args.metadata ?? {}) as Partial<FtMetadata>;
      const meta: FtMetadata = {
        spec: "ft-1.0.0",
        name: String(m.name ?? m.symbol ?? "Token"),
        symbol: String(m.symbol ?? "FT"),
        decimals: Number(m.decimals ?? 0),
      };
      ctx.set("meta", JSON.stringify(meta));
      ctx.set("supply", `${supply}`);
      ctx.set(key(owner), `${supply}`);
      ctx.log(
        `EVENT_JSON:${JSON.stringify({ standard: "nep141", version: "1.0.0", event: "ft_mint", data: [{ owner_id: owner, amount: `${supply}` }] })}`,
      );
      return null;
    },
  },
  ft_metadata: {
    view: true,
    run(ctx) {
      needInit(ctx);
      return JSON.parse(ctx.get("meta")!) as FtMetadata;
    },
  },
  ft_total_supply: {
    view: true,
    run: (ctx) => ctx.get("supply") ?? "0",
  },
  ft_balance_of: {
    view: true,
    run: (ctx) => `${balance(ctx, idArg(ctx, "account_id")) ?? 0n}`,
  },
  /** NEP-141: exactly 1 yoctoNEAR attached (proof of a full-access key or a signed delegate). */
  ft_transfer: {
    run(ctx) {
      needInit(ctx);
      if (ctx.deposit !== 1n) throw new Error("Requires attached deposit of exactly 1 yoctoNEAR");
      const to = idArg(ctx, "receiver_id");
      const amount = amountArg(ctx);
      const from = ctx.predecessorId;
      if (to === from) throw new Error("Sender and receiver should be different");
      const fromBal = balance(ctx, from);
      if (fromBal === null) throw new Error(`The account ${from} is not registered`);
      const toBal = balance(ctx, to);
      if (toBal === null) throw new Error(`The account ${to} is not registered`);
      if (fromBal < amount) throw new Error("The account doesn't have enough balance");
      ctx.set(key(from), `${fromBal - amount}`);
      ctx.set(key(to), `${toBal + amount}`);
      ctx.log(`Transfer ${amount} from ${from} to ${to}`);
      return null;
    },
  },
  /** NEP-145: register `account_id` (default: the caller). Keeps exactly the minimum, returns the rest. */
  storage_deposit: {
    run(ctx) {
      needInit(ctx);
      const id = typeof ctx.args.account_id === "string" ? ctx.args.account_id : ctx.predecessorId;
      if (balance(ctx, id) !== null) {
        ctx.log("The account is already registered, refunding the deposit");
        if (ctx.deposit > 0n)
          return ctx.batch(ctx.predecessorId, [{ type: "Transfer", deposit: ctx.deposit }]);
        return storageBalance(true);
      }
      if (ctx.deposit < FT_STORAGE_DEPOSIT)
        throw new Error("The attached deposit is less than the minimum storage balance");
      ctx.set(key(id), "0");
      ctx.log(`Registered ${id}`);
      const extra = ctx.deposit - FT_STORAGE_DEPOSIT;
      if (extra > 0n) return ctx.batch(ctx.predecessorId, [{ type: "Transfer", deposit: extra }]);
      return storageBalance(true);
    },
  },
  storage_balance_of: {
    view: true,
    run: (ctx) => storageBalance(balance(ctx, idArg(ctx, "account_id")) !== null),
  },
  storage_balance_bounds: {
    view: true,
    run: () => ({ min: `${FT_STORAGE_DEPOSIT}`, max: `${FT_STORAGE_DEPOSIT}` }),
  },
};
