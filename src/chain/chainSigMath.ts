/**
 * Chain Signatures: the constants and the key derivation, with no viem (noble only), so DemoChain can
 * import them without pulling viem into the app's main bundle. The Ethereum side (transactions, the
 * address checksum, recovering the signer) is in chainSignatures.ts, reached only from lesson code.
 *
 * Facts: docs/spikes-seed.md, "Result log", spike 5.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { base58 } from "@scure/base";
import type { Gas, Yocto } from "./types";
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

/** The prefix the signer contract hashes with the account and path (chainsig.js, the contract). */
const EPSILON_PREFIX = "near-mpc-recovery v0.1.0 epsilon derivation:";

/** The tweak for (account, path): sha3-256 of "prefix + account,path", as a scalar. */
export function derivationTweak(predecessor: string, path: string): bigint {
  const h = sha3_256(utf8ToBytes(`${EPSILON_PREFIX}${predecessor},${path}`));
  return BigInt(`0x${bytesToHex(h)}`) % secp256k1.Point.Fn.ORDER;
}

/** `secp256k1:<base58 of x‖y>` (the contract's format) → uncompressed bytes (0x04 ‖ x ‖ y). */
function bytesFromNear(key: string): Uint8Array {
  if (!key.startsWith("secp256k1:")) throw new Error(`Not a secp256k1 key: ${key}`);
  const xy = base58.decode(key.slice("secp256k1:".length));
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  bytes.set(xy, 1);
  return bytes;
}

/** Uncompressed key bytes → the contract's format, `secp256k1:<base58 of x‖y>`. */
export const nearKeyOf = (raw: Uint8Array) => `secp256k1:${base58.encode(raw.slice(1))}`;

/** The child key for (account, path): root + tweak × G, as uncompressed bytes. Pure math, free. */
export function deriveChildKey(rootKey: string, predecessor: string, path: string): Uint8Array {
  const root = secp256k1.Point.fromBytes(bytesFromNear(rootKey));
  return root.add(secp256k1.Point.BASE.multiply(derivationTweak(predecessor, path))).toBytes(false);
}
