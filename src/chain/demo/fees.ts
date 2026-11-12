/**
 * Gas fees DemoChain charges per action. APPROXIMATIONS taken from nearcore's runtime fee config
 * (core/parameters/res/runtime_configs/parameters.yaml) as remembered, not read from a live node.
 * The one documented anchor: a transfer costs about 0.45 Tgas
 * (https://docs.near.org/protocol/transactions/gas). Each fee has a "send" part, burnt when the
 * receipt is created, and an "exec" part, burnt when it runs.
 */
import type { Action, Gas } from "../types";

interface Fee {
  send: Gas;
  exec: Gas;
}

export const RECEIPT_FEE: Fee = { send: 108_059_500_000n, exec: 108_059_500_000n };

const CREATE_ACCOUNT: Fee = { send: 3_850_000_000_000n, exec: 3_850_000_000_000n };
const TRANSFER: Fee = { send: 115_123_062_500n, exec: 115_123_062_500n };
const DEPLOY_BASE: Fee = { send: 184_765_750_000n, exec: 184_765_750_000n };
const DEPLOY_PER_BYTE: Fee = { send: 6_812_999n, exec: 64_572_944n };
const CALL_BASE: Fee = { send: 2_319_861_500_000n, exec: 2_319_861_500_000n };
const CALL_PER_BYTE: Fee = { send: 2_235_934n, exec: 2_235_934n };
const ADD_FULL_KEY: Fee = { send: 101_765_125_000n, exec: 101_765_125_000n };
const ADD_CALL_KEY: Fee = { send: 102_217_625_000n, exec: 102_217_625_000n };
const ADD_CALL_KEY_PER_BYTE: Fee = { send: 1_925_331n, exec: 1_925_331n };
const DELETE_KEY: Fee = { send: 94_946_625_000n, exec: 94_946_625_000n };
const DELETE_ACCOUNT: Fee = { send: 147_489_000_000n, exec: 147_489_000_000n };
const DELEGATE: Fee = { send: 200_000_000_000n, exec: 200_000_000_000n };

/** Gas price DemoChain uses: 0.0001 NEAR per Tgas, NEAR's documented floor. */
export const GAS_PRICE = 100_000_000n;
/**
 * Price used to hold gas up front: 0.001 NEAR per Tgas (`min_gas_purchase_price` in the gas docs).
 * The difference comes back as a refund once the transaction is done.
 */
export const GAS_BUY_PRICE = 1_000_000_000n;
/** Storage staking: 1 NEAR per 100 kB, i.e. 10^19 yoctoNEAR per byte (docs: storage staking). */
export const STORAGE_PRICE_PER_BYTE = 10n ** 19n;

export function argsBytes(args: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(args)).length;
}

export function actionFee(action: Action): Fee {
  switch (action.type) {
    case "CreateAccount":
      return CREATE_ACCOUNT;
    case "Transfer":
      return TRANSFER;
    case "DeployContract": {
      const n = BigInt(action.code.length);
      return {
        send: DEPLOY_BASE.send + DEPLOY_PER_BYTE.send * n,
        exec: DEPLOY_BASE.exec + DEPLOY_PER_BYTE.exec * n,
      };
    }
    case "FunctionCall": {
      const n = BigInt(action.methodName.length + argsBytes(action.args));
      return { send: CALL_BASE.send + CALL_PER_BYTE.send * n, exec: CALL_BASE.exec + CALL_PER_BYTE.exec * n };
    }
    case "AddKey": {
      if (action.permission.type === "FullAccess") return ADD_FULL_KEY;
      const n = BigInt(action.permission.methodNames.join("").length);
      return {
        send: ADD_CALL_KEY.send + ADD_CALL_KEY_PER_BYTE.send * n,
        exec: ADD_CALL_KEY.exec + ADD_CALL_KEY_PER_BYTE.exec * n,
      };
    }
    case "DeleteKey":
      return DELETE_KEY;
    case "DeleteAccount":
      return DELETE_ACCOUNT;
    case "Delegate":
      // The relayer's transaction also pays to send the inner receipt (its exec and attached gas are
      // held through attachedGas below).
      return { send: DELEGATE.send + sendGas(action.delegate.actions), exec: DELEGATE.exec };
  }
}

/** Gas burnt to create a receipt carrying `actions` (paid by the sender). */
export function sendGas(actions: Action[]): Gas {
  return actions.reduce((s, a) => s + actionFee(a).send, RECEIPT_FEE.send);
}

/** Gas burnt to run a receipt's actions, not counting contract code. */
export function execGas(actions: Action[]): Gas {
  return actions.reduce((s, a) => s + actionFee(a).exec, RECEIPT_FEE.exec);
}

/** Gas attached to function calls, available to contract code. */
export function attachedGas(actions: Action[]): Gas {
  return actions.reduce(
    (s, a) =>
      s +
      (a.type === "FunctionCall"
        ? a.gas
        : a.type === "Delegate"
          ? execGas(a.delegate.actions) + attachedGas(a.delegate.actions)
          : 0n),
    0n,
  );
}

export function deposits(actions: Action[]): bigint {
  return actions.reduce(
    (s, a) =>
      s +
      (a.type === "Transfer" || a.type === "FunctionCall"
        ? a.deposit
        : a.type === "Delegate"
          ? deposits(a.delegate.actions)
          : 0n),
    0n,
  );
}
