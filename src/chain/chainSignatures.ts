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
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { base58 } from "@scure/base";
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
import type { Chain, Gas, SendOptions, Yocto } from "./types";
import { tgas } from "./units";

/** The signer contract on testnet (spike 5). DemoChain runs a demo signer under the same name. */
export const SIGNER_CONTRACT = "v1.signer-prod.testnet";
/** The flat deposit a sign call needs (spike 5: `experimental_signature_deposit` is gone). */
export const SIGN_DEPOSIT: Yocto = 1n;
/** Gas attached to a sign call. Real ones attach 20–30 Tgas and burn about 8.5 Tgas (spike 5). */
export const SIGN_GAS: Gas = tgas(30);
/** The domain for secp256k1 (ECDSA) signatures, the kind Ethereum and Bitcoin use. */
export const ECDSA_DOMAIN = 0;
/** The path the lesson starts with. Any string works; each gives another address. */
export const DEFAULT_PATH = "ethereum-1";

/** Sepolia, Ethereum's test network. */
export const SEPOLIA_CHAIN_ID = 11_155_111;

/** The prefix the signer contract hashes with the account and path (chainsig.js, the contract). */
const EPSILON_PREFIX = "near-mpc-recovery v0.1.0 epsilon derivation:";

// ---------- derivation ----------

/** The tweak for (account, path): sha3-256 of "prefix + account,path", as a scalar. */
export function derivationTweak(predecessor: string, path: string): bigint {
  const h = sha3_256(utf8ToBytes(`${EPSILON_PREFIX}${predecessor},${path}`));
  return BigInt(`0x${bytesToHex(h)}`) % secp256k1.Point.Fn.ORDER;
}

/** `secp256k1:<base58 of x‖y>` (the contract's format) → a curve point. */
function pointFromNear(key: string) {
  if (!key.startsWith("secp256k1:")) throw new Error(`Not a secp256k1 key: ${key}`);
  const xy = base58.decode(key.slice("secp256k1:".length));
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  bytes.set(xy, 1);
  return secp256k1.Point.fromBytes(bytes);
}

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
  const child = pointFromNear(rootKey).add(secp256k1.Point.BASE.multiply(derivationTweak(predecessor, path)));
  const raw = child.toBytes(false);
  return {
    address: publicKeyToAddress(`0x${bytesToHex(raw)}`),
    publicKey: `secp256k1:${base58.encode(raw.slice(1))}`,
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

// ---------- the demo signer's math (DemoChain only) ----------

/**
 * Sign as the derived key would: (root secret + tweak) signs the payload. Only DemoChain uses this,
 * with its own demo root secret. On the real network no machine holds a root secret: each node holds
 * a share, and they sign together.
 */
export function demoThresholdSign(rootSecret: bigint, predecessor: string, path: string, payload: string) {
  const n = secp256k1.Point.Fn.ORDER;
  const child = (rootSecret + derivationTweak(predecessor, path)) % n;
  const key = hexToBytes(child.toString(16).padStart(64, "0"));
  const sig = secp256k1.Signature.fromBytes(
    secp256k1.sign(hexToBytes(payload), key, { prehash: false, format: "recovered" }),
    "recovered",
  );
  const hex = (x: bigint) => x.toString(16).padStart(64, "0").toUpperCase();
  return {
    scheme: "Secp256k1",
    big_r: { affine_point: `${sig.recovery ? "03" : "02"}${hex(sig.r)}` },
    s: { scalar: hex(sig.s) },
    recovery_id: sig.recovery!,
  };
}

/** A root key in the contract's format, from a secret (DemoChain's demo signer). */
export function demoRootPublicKey(rootSecret: bigint): string {
  const raw = secp256k1.Point.BASE.multiply(rootSecret).toBytes(false);
  return `secp256k1:${base58.encode(raw.slice(1))}`;
}
