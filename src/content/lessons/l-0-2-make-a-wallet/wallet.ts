/**
 * Practice wallet maths for lesson 0.2. Everything runs in the browser; nothing here touches the network.
 * Keys live only in memory: never store them, never put them in evidence or completion records.
 *
 * Seed phrase (BIP-39) → seed → SLIP-10 ed25519 at NEAR's path m/44'/397'/0' → ed25519 key pair.
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { base58 } from "@scure/base";

/** NEAR's derivation path. 44' = BIP-44, 397' = NEAR's registered SLIP-44 coin number. */
export const NEAR_PATH = "m/44'/397'/0'";

/** Public example printed in NEAR's docs (docs.near.org). Anyone can use it, so it never holds funds. */
export const DEMO_PHRASE = "kit creek invite deputy fetch resource marble sweet camp thumb mushroom swift"; // secret-scan:allow public demo key from docs.near.org

/** What every view shows for the private key until the learner presses Show. */
export const MASKED_SECRET = `ed25519:${"•".repeat(16)} (hidden)`;

/** The private key as a view may show it: masked unless the learner chose to reveal it. */
export function shownSecret(kp: Pick<PracticeKeyPair, "secretKey">, reveal: boolean): string {
  return reveal ? kp.secretKey : MASKED_SECRET;
}

export interface PracticeKeyPair {
  phrase: string;
  /** 32-byte ed25519 private seed. Wiped by `wipe`. */
  seed: Uint8Array;
  /** `ed25519:<base58 of 32-byte public key>` */
  publicKey: string;
  /** `ed25519:<base58 of 64 bytes: seed + public key>` (NEAR's secret key format) */
  secretKey: string;
  /** Implicit account id: the public key as 64 hex characters. */
  implicitAccount: string;
  publicBytes: Uint8Array;
}

/** A fresh 12-word English BIP-39 phrase (128 bits from the browser's crypto API). */
export function newPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

export function isValidPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim(), wordlist);
}

const HARDENED = 0x80000000;

/** SLIP-10 derivation for ed25519 (hardened steps only). */
export function slip10Ed25519(seed: Uint8Array, path: string): { key: Uint8Array; chainCode: Uint8Array } {
  const parts = path.split("/");
  if (parts[0] !== "m") throw new Error(`Path must start with m: ${path}`);
  let I = hmac(sha512, utf8ToBytes("ed25519 seed"), seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);
  for (const part of parts.slice(1)) {
    if (!part.endsWith("'")) throw new Error(`ed25519 supports hardened steps only: ${part}`);
    const index = (Number(part.slice(0, -1)) + HARDENED) >>> 0;
    const data = new Uint8Array(37);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, index);
    I = hmac(sha512, chainCode, data);
    key.fill(0);
    key = I.slice(0, 32);
    chainCode = I.slice(32);
  }
  return { key, chainCode };
}

export function keyPairFromPhrase(phrase: string): PracticeKeyPair {
  const clean = phrase.trim().split(/\s+/).join(" ");
  const bip39Seed = mnemonicToSeedSync(clean);
  const { key: seed } = slip10Ed25519(bip39Seed, NEAR_PATH);
  bip39Seed.fill(0);
  const publicBytes = ed25519.getPublicKey(seed);
  const full = new Uint8Array(64);
  full.set(seed);
  full.set(publicBytes, 32);
  const secretKey = `ed25519:${base58.encode(full)}`;
  full.fill(0);
  return {
    phrase: clean,
    seed,
    publicBytes,
    publicKey: `ed25519:${base58.encode(publicBytes)}`,
    secretKey,
    implicitAccount: bytesToHex(publicBytes),
  };
}

/** `ed25519:<base58>` → 64 hex characters (the implicit account id). */
export function publicKeyToImplicit(publicKey: string): string {
  return bytesToHex(base58.decode(publicKey.replace(/^ed25519:/, "")));
}

/** Signs a UTF-8 message. Returns the 64-byte signature in base58. */
export function sign(kp: Pick<PracticeKeyPair, "seed">, message: string): string {
  return base58.encode(ed25519.sign(utf8ToBytes(message), kp.seed));
}

/** Checks a base58 signature against a message and an `ed25519:<base58>` public key. Never throws. */
export function verify(publicKey: string, message: string, signature: string): boolean {
  try {
    const pub = base58.decode(publicKey.replace(/^ed25519:/, ""));
    return ed25519.verify(base58.decode(signature), utf8ToBytes(message), pub);
  } catch {
    return false;
  }
}

/** Ethereum address: last 20 bytes of keccak-256 of the 64-byte public key, with EIP-55 checksum. */
export function ethAddressFromSecretKey(secret: Uint8Array): string {
  const pub = secp256k1.getPublicKey(secret, false).slice(1);
  const hex = bytesToHex(keccak_256(pub).slice(-20));
  const hash = bytesToHex(keccak_256(utf8ToBytes(hex)));
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i]!, 16) >= 8 ? hex[i]!.toUpperCase() : hex[i];
  return out;
}

/** A separate throwaway Ethereum-style key (secp256k1), used only to show the address rule. */
export function practiceEthAddress(): string {
  const secret = secp256k1.utils.randomSecretKey();
  const addr = ethAddressFromSecretKey(secret);
  secret.fill(0);
  return addr;
}

/** Zeroes the private key bytes. Strings cannot be wiped in JavaScript; drop every reference to them. */
export function wipe(kp: PracticeKeyPair): void {
  kp.seed.fill(0);
}

/** "Hello …" → "Hellp …": the next letter of the alphabet at the fifth character (or the last one). */
export function changeOneLetter(text: string): string {
  const i = Math.min(4, text.length - 1);
  const c = text[i] ?? "";
  const swapped =
    c === "z" ? "a" : c === "Z" ? "A" : /[a-y]/i.test(c) ? String.fromCharCode(c.charCodeAt(0) + 1) : "x";
  return text.slice(0, i) + swapped + text.slice(i + 1);
}
