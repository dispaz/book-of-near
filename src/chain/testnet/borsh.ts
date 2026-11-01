/**
 * Borsh encoding of NEAR transactions (https://borsh.io, nearcore `Transaction` V0).
 * Written out by hand so TestnetChain can sign exactly the nonce and block hash that
 * `buildTransaction` showed the learner. `borsh.test.ts` checks it byte for byte against near-kit.
 */
import { base58 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import type { AccessKeyPermission, Action, PublicKey, UnsignedTransaction } from "../types";

class Writer {
  private chunks: number[] = [];
  u8(n: number) {
    this.chunks.push(n & 0xff);
  }
  u32(n: number) {
    for (let i = 0; i < 4; i++) this.u8(n >>> (8 * i));
  }
  uint(n: bigint, bytes: number) {
    if (n < 0n || n >= 1n << BigInt(bytes * 8)) throw new RangeError(`${n} does not fit in ${bytes} bytes`);
    for (let i = 0; i < bytes; i++) this.u8(Number((n >> BigInt(8 * i)) & 0xffn));
  }
  bytes(b: Uint8Array) {
    for (const x of b) this.u8(x);
  }
  vecBytes(b: Uint8Array) {
    this.u32(b.length);
    this.bytes(b);
  }
  string(s: string) {
    this.vecBytes(new TextEncoder().encode(s));
  }
  done(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

/** `ed25519:<base58>` to its 32 raw bytes. */
export function publicKeyBytes(key: PublicKey): Uint8Array {
  if (!key.startsWith("ed25519:")) throw new Error(`Only ed25519 keys are supported, got ${key}`);
  const raw = base58.decode(key.slice(8));
  if (raw.length !== 32) throw new Error("An ed25519 public key has 32 bytes");
  return raw;
}

function publicKey(w: Writer, key: PublicKey) {
  w.u8(0); // KeyType::ED25519
  w.bytes(publicKeyBytes(key));
}

function permission(w: Writer, p: AccessKeyPermission) {
  if (p.type === "FullAccess") return w.u8(1);
  w.u8(0);
  if (p.allowance === undefined) w.u8(0);
  else {
    w.u8(1);
    w.uint(p.allowance, 16);
  }
  w.string(p.receiverId);
  w.u32(p.methodNames.length);
  for (const m of p.methodNames) w.string(m);
}

function action(w: Writer, a: Action) {
  switch (a.type) {
    case "CreateAccount":
      return w.u8(0);
    case "DeployContract":
      w.u8(1);
      return w.vecBytes(a.code);
    case "FunctionCall":
      w.u8(2);
      w.string(a.methodName);
      w.vecBytes(new TextEncoder().encode(JSON.stringify(a.args)));
      w.uint(a.gas, 8);
      return w.uint(a.deposit, 16);
    case "Transfer":
      w.u8(3);
      return w.uint(a.deposit, 16);
    case "AddKey":
      w.u8(5);
      publicKey(w, a.publicKey);
      w.uint(0n, 8); // access key nonce
      return permission(w, a.permission);
    case "DeleteKey":
      w.u8(6);
      return publicKey(w, a.publicKey);
    case "DeleteAccount":
      w.u8(7);
      return w.string(a.beneficiaryId);
  }
}

export function serializeTransaction(tx: UnsignedTransaction): Uint8Array {
  const w = new Writer();
  w.string(tx.signerId);
  publicKey(w, tx.publicKey);
  w.uint(tx.nonce, 8);
  w.string(tx.receiverId);
  const blockHash = base58.decode(tx.blockHash);
  if (blockHash.length !== 32) throw new Error("A block hash has 32 bytes");
  w.bytes(blockHash);
  w.u32(tx.actions.length);
  for (const a of tx.actions) action(w, a);
  return w.done();
}

/** The transaction id: base58(sha256(borsh(tx))). This 32-byte digest is also what the key signs. */
export function transactionDigest(tx: UnsignedTransaction): Uint8Array {
  return sha256(serializeTransaction(tx));
}

export function transactionHash(tx: UnsignedTransaction): string {
  return base58.encode(transactionDigest(tx));
}

/** `ed25519:<base58 64 bytes>` signature appended after the transaction. */
export function serializeSignedTransaction(tx: UnsignedTransaction, signature: string): Uint8Array {
  if (!signature.startsWith("ed25519:")) throw new Error("Only ed25519 signatures are supported");
  const sig = base58.decode(signature.slice(8));
  if (sig.length !== 64) throw new Error("An ed25519 signature has 64 bytes");
  const body = serializeTransaction(tx);
  const out = new Uint8Array(body.length + 1 + 64);
  out.set(body);
  out[body.length] = 0;
  out.set(sig, body.length + 1);
  return out;
}
