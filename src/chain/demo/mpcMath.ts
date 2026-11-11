/**
 * The demo signer's math (DemoChain only, no viem): sign as the derived key would. On the real network no
 * machine holds a root secret: each node holds a share, and they sign together.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { derivationTweak, nearKeyOf } from "../chainSigMath";

/** (root secret + tweak) signs the 32-byte payload; the answer has the real signer's shape. */
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

/** A root key in the contract's format, from a secret. */
export const demoRootPublicKey = (rootSecret: bigint) =>
  nearKeyOf(secp256k1.Point.BASE.multiply(rootSecret).toBytes(false));
