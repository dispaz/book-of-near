/**
 * Chain Signatures (lesson 4.1, docs/lessons/stage-4/4.1-topic.md), built only on the Chain interface.
 *
 * - Derivation is offline math: the signer contract's root public key (a `viewCall`), the NEAR account
 *   and a path give a child secp256k1 key, and its Ethereum address. No fee, no transaction.
 * - Signing is one ordinary NEAR function call, `sign` on the signer contract with 1 yoctoNEAR, sent
 *   with `chain.sendTransaction`. DemoChain answers with its own demo signer (demo/mpcSigner.ts);
 *   TestnetChain sends it to the real `v1.signer-prod.testnet`.
 * - The Ethereum side (EIP-1559 transfer, its 32-byte payload, the signed bytes and the recovered
 *   signer) uses viem's offline helpers. Nothing here calls a network or broadcasts to Ethereum.
 *
 * Facts: docs/spikes-seed.md, "Result log", spike 5.
 */
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  keccak256,
  parseEther,
  parseGwei,
  recoverTransactionAddress,
  serializeTransaction,
  type Hex,
  type TransactionSerializableEIP1559,
} from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { callMethod, decodeSuccessValue } from "./ops";
import type { Chain, SendOptions, Yocto } from "./types";
import {
  deriveChildKey,
  nearKeyOf,
  SIGN_DEPOSIT,
  SIGN_GAS,
  SIGNER_CONTRACT,
  ECDSA_DOMAIN,
} from "./chainSigMath";

// The viem-free part (constants, derivation) lives in chainSigMath.ts so DemoChain can use it.
export * from "./chainSigMath";

/** Sepolia, Ethereum's test network. */
export const SEPOLIA_CHAIN_ID = 11_155_111;

// ---------- derivation ----------

export interface EvmAccount {
  /** The Ethereum address, checksummed (`0x…`, 20 bytes). */
  address: Hex;
  /** The derived public key in the contract's format, `secp256k1:<base58>`. */
  publicKey: string;
  predecessor: string;
  path: string;
}

/**
 * The address an account controls on Ethereum for a path: child key = root + tweak × G, address =
 * the last 20 bytes of keccak-256 of the child key. Pure math, done in the browser for free.
 */
export function deriveEvmAccount(rootKey: string, predecessor: string, path: string): EvmAccount {
  const raw = deriveChildKey(rootKey, predecessor, path);
  return {
    address: publicKeyToAddress(`0x${bytesToHex(raw)}`),
    publicKey: nearKeyOf(raw),
    predecessor,
    path,
  };
}

/** The signer contract's root public key (a free view call). */
export async function rootPublicKey(chain: Chain): Promise<string> {
  const out = await chain.viewCall<string>(SIGNER_CONTRACT, "public_key", {});
  return out.result;
}

// ---------- the Ethereum transaction ----------

export interface PreparedTransfer {
  /** The fields a learner reads: to, value, gas, fees, nonce, chain id. */
  fields: TransactionSerializableEIP1559 & { nonce: number; chainId: number };
  /** The unsigned EIP-1559 transaction, as bytes. */
  unsigned: Hex;
  /** keccak-256 of the unsigned bytes: the 32 bytes the signing network signs. */
  payload: Hex;
}

/**
 * A small Sepolia transfer from the derived address to itself. Nonce 0 (a fresh address has sent
 * nothing) and fixed, typical fees: the lesson never broadcasts it, so it needs no Sepolia RPC.
 */
export function prepareEvmTransfer({
  from,
  to = from,
  value = parseEther("0.0001"),
}: {
  from: Hex;
  to?: Hex;
  value?: bigint;
}): PreparedTransfer {
  const fields = {
    type: "eip1559" as const,
    chainId: SEPOLIA_CHAIN_ID,
    nonce: 0,
    to,
    value,
    gas: 21_000n,
    maxFeePerGas: parseGwei("2"),
    maxPriorityFeePerGas: parseGwei("1"),
  };
  const unsigned = serializeTransaction(fields);
  return { fields, unsigned, payload: keccak256(unsigned) };
}

// ---------- the sign call ----------

/** The raw arguments of `sign` (spike 5): `{ request: { payload_v2: { Ecdsa: hex }, path, domain_id } }`. */
export function signRequestArgs(payload: Hex, path: string) {
  return {
    request: { payload_v2: { Ecdsa: payload.slice(2).toLowerCase() }, path, domain_id: ECDSA_DOMAIN },
  };
}

export interface RsvSignature {
  r: Hex;
  s: Hex;
  /** 0 or 1: which of the two possible public keys signed (Ethereum's recovery bit). */
  yParity: number;
}

/** The signer's answer `{ big_r: { affine_point }, s: { scalar }, recovery_id }` → r, s, yParity. */
export function parseSignResponse(value: unknown): RsvSignature {
  const v = value as { big_r?: { affine_point?: string }; s?: { scalar?: string }; recovery_id?: number };
  const point = v?.big_r?.affine_point;
  const scalar = v?.s?.scalar;
  if (typeof point !== "string" || typeof scalar !== "string" || typeof v.recovery_id !== "number")
    throw new Error("The signing network's answer is not a secp256k1 signature.");
  return {
    r: `0x${point.slice(2).toLowerCase()}`,
    s: `0x${scalar.toLowerCase()}`,
    yParity: v.recovery_id,
  };
}

/** What the signing network answered, and how long the request waited. */
export interface SignatureResult {
  signature: RsvSignature;
  /** The NEAR transaction that asked for it. */
  txHash: string;
  /** Blocks between the request's block and the answer's block. */
  waitBlocks: number;
  /** Milliseconds from sending to final. */
  ms: number;
  /** NEAR burnt for gas, yoctoNEAR. */
  tokensBurnt: Yocto;
}

/**
 * Ask the signing network to sign a 32-byte payload for this account and path: one `sign` call with
 * 1 yoctoNEAR. Resolves when the answer is final. Rejects with a ChainError when NEAR refuses the
 * transaction, and with an Error when the signer contract fails.
 */
export async function requestSignature(
  chain: Chain,
  payload: Hex,
  path: string,
  options: SendOptions = {},
): Promise<SignatureResult> {
  const out = await callMethod(chain, SIGNER_CONTRACT, "sign", signRequestArgs(payload, path), {
    ...options,
    gas: SIGN_GAS,
    deposit: SIGN_DEPOSIT,
  });
  if (out.status.type === "Failure") throw new Error(out.status.error.message);
  const work = out.receipts.filter((r) => !r.isRefund);
  const answer = work.at(-1)?.blockHeight ?? out.transactionOutcome.blockHeight;
  const burnt = [out.transactionOutcome, ...out.receipts].reduce((a, r) => a + r.tokensBurnt, 0n);
  return {
    signature: parseSignResponse(decodeSuccessValue(out.status)),
    txHash: out.transaction.hash,
    waitBlocks: answer - out.transactionOutcome.blockHeight,
    ms: out.timings.final,
    tokensBurnt: burnt,
  };
}

// ---------- after signing ----------

/** The signed transaction, ready for an Ethereum node (EIP-1559 bytes, starting 0x02). */
export function finalizeEvmTransaction(prepared: PreparedTransfer, sig: RsvSignature): Hex {
  return serializeTransaction(prepared.fields, { r: sig.r, s: sig.s, yParity: sig.yParity });
}

/** Who signed it, worked out from the signature alone (Ethereum's ecrecover, via viem). */
export function recoverEvmSigner(signed: Hex): Promise<Hex> {
  return recoverTransactionAddress({ serializedTransaction: signed as `0x02${string}` });
}
