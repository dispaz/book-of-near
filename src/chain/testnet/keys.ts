/**
 * Key pairs held by TestnetChain. near-kit does the ed25519 work and is loaded on first use,
 * so demo mode never downloads it.
 */
import { base58 } from "@scure/base";
import type { PublicKey } from "../types";

type NearKit = typeof import("near-kit");
let kit: Promise<NearKit> | null = null;
export function loadNearKit(): Promise<NearKit> {
  kit ??= import("near-kit");
  return kit;
}

export class KeyStore {
  private readonly secrets = new Map<PublicKey, string>();

  add(publicKey: PublicKey, secretKey: string) {
    this.secrets.set(publicKey, secretKey);
  }

  has(publicKey: PublicKey): boolean {
    return this.secrets.has(publicKey);
  }

  /** A new ed25519 key pair; the secret stays in this store. */
  async generate(): Promise<{ publicKey: PublicKey; secretKey: string }> {
    const { generateKey } = await loadNearKit();
    const k = generateKey();
    const pair = { publicKey: k.publicKey.toString(), secretKey: k.secretKey };
    this.add(pair.publicKey, pair.secretKey);
    return pair;
  }

  /** Sign a 32-byte transaction digest. Returns `ed25519:<base58 signature>`. */
  async sign(publicKey: PublicKey, digest: Uint8Array): Promise<string> {
    const secret = this.secrets.get(publicKey);
    if (!secret) throw new Error(`This app does not hold the secret for ${publicKey}`);
    const { parseKey } = await loadNearKit();
    return `ed25519:${base58.encode(parseKey(secret).sign(digest).data)}`;
  }
}
