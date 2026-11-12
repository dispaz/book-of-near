/**
 * Helpers built only on the Chain interface, so they work with DemoChain and TestnetChain alike.
 * Lessons should prefer these over assembling actions by hand.
 */
import { base58, base64 } from "@scure/base";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  AccessKeyPermission,
  AccountId,
  Action,
  Chain,
  ExecutionStatus,
  Gas,
  PhaseEvent,
  PublicKey,
  SendOptions,
  TxOutcome,
  TxPhase,
  Yocto,
} from "./types";
import { tgas } from "./units";

/**
 * A meta-transaction (NEP-366) stays valid for this many blocks after it is signed, about 2 to 4
 * minutes. Both chains use it; 200 is near-kit's default `blockHeightOffset`.
 */
export const DELEGATE_VALIDITY_BLOCKS = 200;

export const TX_PHASES: readonly TxPhase[] = [
  "built",
  "signed",
  "broadcast",
  "included",
  "executed",
  "final",
];

/** Default gas attached to a function call: 30 Tgas, a common choice in NEAR tooling. */
export const DEFAULT_CALL_GAS: Gas = tgas(30);

// ---------- Action builders ----------

export const actions = {
  createAccount: (): Action => ({ type: "CreateAccount" }),
  transfer: (deposit: Yocto): Action => ({ type: "Transfer", deposit }),
  deployContract: (code: Uint8Array): Action => ({ type: "DeployContract", code }),
  functionCall: (
    methodName: string,
    args: Record<string, unknown> = {},
    gas: Gas = DEFAULT_CALL_GAS,
    deposit: Yocto = 0n,
  ): Action => ({ type: "FunctionCall", methodName, args, gas, deposit }),
  addFullAccessKey: (publicKey: PublicKey): Action => ({
    type: "AddKey",
    publicKey,
    permission: { type: "FullAccess" },
  }),
  addFunctionCallKey: (
    publicKey: PublicKey,
    receiverId: AccountId,
    methodNames: string[] = [],
    allowance?: Yocto,
  ): Action => ({
    type: "AddKey",
    publicKey,
    permission: { type: "FunctionCall", receiverId, methodNames, allowance } satisfies AccessKeyPermission,
  }),
  deleteKey: (publicKey: PublicKey): Action => ({ type: "DeleteKey", publicKey }),
  deleteAccount: (beneficiaryId: AccountId): Action => ({ type: "DeleteAccount", beneficiaryId }),
};

// ---------- One-call operations ----------

type From = { signerId?: AccountId; publicKey?: PublicKey } & SendOptions;

export function transfer(chain: Chain, to: AccountId, amount: Yocto, opts: From = {}): Promise<TxOutcome> {
  const { signerId, publicKey, ...send } = opts;
  return chain.sendTransaction(
    { signerId, publicKey, receiverId: to, actions: [actions.transfer(amount)] },
    send,
  );
}

/**
 * Create `newAccountId` as a sub-account of the signer (`kid.alice.testnet` from `alice.testnet`),
 * fund it and give it a full-access key, in one transaction.
 */
export function createSubAccount(
  chain: Chain,
  newAccountId: AccountId,
  publicKey: PublicKey,
  amount: Yocto,
  opts: From = {},
): Promise<TxOutcome> {
  const { signerId, publicKey: signWith, ...send } = opts;
  return chain.sendTransaction(
    {
      signerId,
      publicKey: signWith,
      receiverId: newAccountId,
      actions: [actions.createAccount(), actions.transfer(amount), actions.addFullAccessKey(publicKey)],
    },
    send,
  );
}

/**
 * Create a top-level `.testnet` name through the `testnet` registrar contract's `create_account`.
 * UNVERIFIED: the registrar method comes from docs and is checked by issue #4 before TestnetChain relies on it.
 */
export function createNamedAccount(
  chain: Chain,
  newAccountId: AccountId,
  publicKey: PublicKey,
  amount: Yocto,
  opts: From = {},
): Promise<TxOutcome> {
  return callMethod(
    chain,
    "testnet",
    "create_account",
    { new_account_id: newAccountId, new_public_key: publicKey },
    { ...opts, deposit: amount },
  );
}

/** An implicit account exists once it receives NEAR: send `amount` to the hex id of `publicKey`. */
export async function createImplicitAccount(
  chain: Chain,
  publicKey: PublicKey,
  amount: Yocto,
  opts: From = {},
): Promise<{ accountId: AccountId; outcome: TxOutcome }> {
  const accountId = implicitAccountId(publicKey);
  return { accountId, outcome: await transfer(chain, accountId, amount, opts) };
}

export function addKey(
  chain: Chain,
  publicKey: PublicKey,
  permission: AccessKeyPermission,
  opts: From = {},
): Promise<TxOutcome> {
  return onSelf(chain, [{ type: "AddKey", publicKey, permission }], opts);
}

export function deleteKey(chain: Chain, publicKey: PublicKey, opts: From = {}): Promise<TxOutcome> {
  return onSelf(chain, [actions.deleteKey(publicKey)], opts);
}

/** Deploy contract code to the signer's own account. */
export function deployContract(chain: Chain, code: Uint8Array, opts: From = {}): Promise<TxOutcome> {
  return onSelf(chain, [actions.deployContract(code)], opts);
}

export function callMethod(
  chain: Chain,
  contractId: AccountId,
  methodName: string,
  args: Record<string, unknown> = {},
  opts: From & { gas?: Gas; deposit?: Yocto } = {},
): Promise<TxOutcome> {
  const { signerId, publicKey, gas, deposit, ...send } = opts;
  return chain.sendTransaction(
    {
      signerId,
      publicKey,
      receiverId: contractId,
      actions: [actions.functionCall(methodName, args, gas, deposit)],
    },
    send,
  );
}

async function onSelf(chain: Chain, list: Action[], opts: From): Promise<TxOutcome> {
  const { signerId, publicKey, ...send } = opts;
  const self = signerId ?? (await chain.practiceAccount()).accountId;
  return chain.sendTransaction({ signerId: self, publicKey, receiverId: self, actions: list }, send);
}

// ---------- Reading results ----------

/** Phase events as an async iterator: `for await (const e of phases(chain, request)) light(e.phase)`. */
export async function* phases(
  chain: Chain,
  request: Parameters<Chain["sendTransaction"]>[0],
  options: Omit<SendOptions, "onPhase"> = {},
): AsyncGenerator<PhaseEvent, TxOutcome> {
  const queue: PhaseEvent[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  let failure: unknown = null;
  let result: TxOutcome | null = null;
  chain
    .sendTransaction(request, {
      ...options,
      onPhase: (e) => {
        queue.push(e);
        wake?.();
      },
    })
    .then(
      (r) => (result = r),
      (e: unknown) => (failure = e ?? new Error("send failed")),
    )
    .finally(() => {
      done = true;
      wake?.();
    });
  for (;;) {
    while (queue.length) yield queue.shift()!;
    if (done) break;
    await new Promise<void>((r) => (wake = r));
    wake = null;
  }
  while (queue.length) yield queue.shift()!;
  if (failure) throw failure;
  return result!;
}

/** Decode a SuccessValue (base64 JSON) into a value; undefined for empty or non-success. */
export function decodeSuccessValue<T = unknown>(status: ExecutionStatus): T | undefined {
  if (status.type !== "SuccessValue" || !status.value) return undefined;
  const text = new TextDecoder().decode(base64.decode(status.value));
  return JSON.parse(text) as T;
}

export function encodeSuccessValue(value: unknown): string {
  return value === undefined ? "" : base64.encode(new TextEncoder().encode(JSON.stringify(value)));
}

/** Sum of gas burnt by the transaction and all its receipts. */
export function totalGasBurnt(o: TxOutcome): Gas {
  return o.receipts.reduce((s, r) => s + r.gasBurnt, o.transactionOutcome.gasBurnt);
}

/** Sum of tokens burnt (the fee actually paid). */
export function totalTokensBurnt(o: TxOutcome): Yocto {
  return o.receipts.reduce((s, r) => s + r.tokensBurnt, o.transactionOutcome.tokensBurnt);
}

/** The block the transaction was included in. */
export function inclusionBlock(o: TxOutcome): { height: number; hash: string; shardId: number } {
  const t = o.transactionOutcome;
  return { height: t.blockHeight, hash: t.blockHash, shardId: t.shardId };
}

/** The implicit account id of an ed25519 public key: its 32 bytes in hex. */
export function implicitAccountId(publicKey: PublicKey): AccountId {
  const raw = publicKey.startsWith("ed25519:") ? publicKey.slice(8) : publicKey;
  return bytesToHex(base58.decode(raw));
}

/** NearBlocks link for a testnet transaction. */
export function explorerTxUrl(hash: string): string {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}
