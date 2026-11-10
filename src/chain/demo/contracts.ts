/**
 * Simulated contracts for DemoChain. Real Wasm cannot run in demo mode, so a contract is a set of
 * JavaScript methods keyed by the sha256 of its code bytes. Deploying those bytes "installs" it.
 */
import type { AccountId, Action, Gas, Yocto } from "../types";
import { tgas } from "../units";

export type PromiseResult = { ok: true; value: unknown } | { ok: false; message: string };

export interface DemoContractContext {
  contractId: AccountId;
  predecessorId: AccountId;
  signerId: AccountId;
  /** Deposit attached to this call. */
  deposit: Yocto;
  args: Record<string, unknown>;
  blockHeight: number;
  /** Contract state (string key → string value). Writes throw in a view call. */
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  /** Delete a key. Its bytes no longer count towards storage. Throws in a view call. */
  remove(key: string): void;
  log(message: string): void;
  /** In a callback: the result of the call it waited for. */
  promiseResult?: PromiseResult;
  /** Schedule a call to another account. Return the promise from the method to chain it. */
  functionCall(
    receiverId: AccountId,
    methodName: string,
    args?: Record<string, unknown>,
    options?: {
      gas?: Gas;
      deposit?: Yocto;
      then?: { methodName: string; args?: Record<string, unknown>; gas?: Gas };
    },
  ): DemoPromise;
  /** Schedule a batch of actions on another account (for example CreateAccount + Transfer + AddKey). */
  batch(receiverId: AccountId, actions: Action[]): DemoPromise;
}

export class DemoPromise {
  constructor(
    readonly receiverId: AccountId,
    readonly actions: Action[],
    readonly then?: { methodName: string; args: Record<string, unknown>; gas: Gas },
  ) {}
}

export interface DemoMethod {
  /** View methods may be called with viewCall and must not write state. */
  view?: boolean;
  /** Gas the method's own code burns. Illustrative, not measured. Default 2 Tgas. */
  gas?: Gas;
  /** Return a JSON value or a DemoPromise. Throw to panic. */
  run(ctx: DemoContractContext): unknown;
}

export type DemoContract = Record<string, DemoMethod>;

/** Code bytes that stand for a built-in demo contract. Deploy them like real Wasm. */
export function demoContractCode(name: string): Uint8Array {
  return new TextEncoder().encode(`book-of-near demo contract: ${name}`);
}

/**
 * base58 sha256 of the real counter (contracts/counter/counter.wasm). DemoChain cannot run Wasm, so
 * deploying those exact bytes installs `counterContract` instead; its storage still counts every byte.
 * DemoChain.test.ts checks it against the file: rebuild the counter, update this.
 */
export const COUNTER_WASM_SHA256 = "3ayPSfwczvFs1xWLJzSzFYPMaBiJdZQVoEGJ8fR8NHAr";

/**
 * The `testnet` registrar: makes top-level `.testnet` names.
 * UNVERIFIED (#4): method name and arguments follow docs, not a tested call.
 */
export const registrarContract: DemoContract = {
  create_account: {
    gas: tgas(5),
    run(ctx) {
      const id = String(ctx.args.new_account_id ?? "");
      const key = String(ctx.args.new_public_key ?? "");
      return ctx.batch(id, [
        { type: "CreateAccount" },
        { type: "Transfer", deposit: ctx.deposit },
        { type: "AddKey", publicKey: key, permission: { type: "FullAccess" } },
      ]);
    },
  },
};

/** A tiny counter used by the behavioural suite and lessons 3.1 and 2.2. */
export const counterContract: DemoContract = {
  increment: {
    gas: tgas(1.5),
    run(ctx) {
      const by = Number(ctx.args.by ?? 1);
      const n = Number(ctx.get("num") ?? "0") + by;
      ctx.set("num", String(n));
      ctx.log(`Count is now ${n}`);
      return n;
    },
  },
  get_num: { view: true, gas: tgas(1), run: (ctx) => Number(ctx.get("num") ?? "0") },
  last_result: { view: true, gas: tgas(1), run: (ctx) => ctx.get("last_result") ?? null },
  reset: {
    gas: tgas(1),
    run(ctx) {
      ctx.remove("num");
      ctx.remove("last_result");
      ctx.log("State cleared");
    },
  },
  fail: {
    gas: tgas(1),
    run() {
      throw new Error("This method always fails");
    },
  },
  call_other: {
    gas: tgas(3),
    run(ctx) {
      const target = String(ctx.args.account_id);
      const method = String(ctx.args.method_name ?? "increment");
      ctx.log(`Calling ${method} on ${target}`);
      return ctx.functionCall(
        target,
        method,
        {},
        { gas: tgas(20), then: { methodName: "on_other_done", gas: tgas(20) } },
      );
    },
  },
  on_other_done: {
    gas: tgas(2),
    run(ctx) {
      if (ctx.predecessorId !== ctx.contractId) throw new Error("Only the contract itself may call this");
      const ok = ctx.promiseResult?.ok ?? false;
      ctx.set("last_result", ok ? "ok" : "failed");
      ctx.log(ok ? "The other call worked" : "The other call failed, so nothing changed there");
      return ok;
    },
  },
};
