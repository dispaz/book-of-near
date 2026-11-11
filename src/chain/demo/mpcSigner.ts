/**
 * DemoChain's stand-in for the chain-signature signer contract (`v1.signer-prod.testnet`, spike 5).
 *
 * Same calls, same answers as the real one: `public_key` and `derived_public_key` views, and `sign`
 * with 1 yoctoNEAR, answered a few blocks later with `{ big_r, s, recovery_id }`. The math is real
 * (secp256k1), so the signature recovers to the derived Ethereum address. What is NOT real: one demo
 * root secret, held right here. On the real network no machine holds the root secret; the signing nodes
 * each hold a key share and sign together. The lesson says so in demo mode.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { deriveChildKey, ECDSA_DOMAIN, nearKeyOf, SIGN_DEPOSIT } from "../chainSigMath";
import { demoRootPublicKey, demoThresholdSign } from "./mpcMath";
import { tgas } from "../units";
import type { DemoContract } from "./contracts";

/** A fixed demo root secret, so demo addresses are the same on every visit. Never used outside demo mode. */
const DEMO_ROOT_SECRET = BigInt(`0x${bytesToHex(sha256(utf8ToBytes("book-of-near demo signing network")))}`);
export const DEMO_SIGNER_ROOT = demoRootPublicKey(DEMO_ROOT_SECRET);

/**
 * Blocks the request waits while the nodes sign. About 5.5 s in all with inclusion and finality, as the
 * real signer took in spike 5.
 */
export const DEMO_SIGN_WAIT_BLOCKS = 3;

export const mpcSignerContract: DemoContract = {
  public_key: { view: true, gas: tgas(1), run: () => DEMO_SIGNER_ROOT },
  derived_public_key: {
    view: true,
    gas: tgas(1),
    run: (ctx) =>
      nearKeyOf(
        deriveChildKey(DEMO_SIGNER_ROOT, String(ctx.args.predecessor ?? ""), String(ctx.args.path ?? "")),
      ),
  },
  sign: {
    gas: tgas(3),
    run(ctx) {
      if (ctx.deposit < SIGN_DEPOSIT)
        throw new Error("Attached deposit is lower than required (1 yoctoNEAR)");
      const req = ctx.args.request as
        { payload_v2?: { Ecdsa?: string }; path?: string; domain_id?: number } | undefined;
      const payload = req?.payload_v2?.Ecdsa ?? "";
      if (!/^[0-9a-f]{64}$/i.test(payload)) throw new Error("The payload must be 32 bytes of hex");
      if ((req?.domain_id ?? ECDSA_DOMAIN) !== ECDSA_DOMAIN) throw new Error("Demo signer only signs ECDSA");
      const path = String(req?.path ?? "");
      const response = demoThresholdSign(DEMO_ROOT_SECRET, ctx.predecessorId, path, payload);
      ctx.log(`sign: request from ${ctx.predecessorId}, path ${path}`);
      // The request pauses until the nodes answer, then resumes with the signature.
      return ctx.functionCall(
        ctx.contractId,
        "return_signature",
        { response },
        { gas: tgas(5), delay: DEMO_SIGN_WAIT_BLOCKS },
      );
    },
  },
  return_signature: {
    gas: tgas(2),
    run(ctx) {
      if (ctx.predecessorId !== ctx.contractId) throw new Error("Only the signer may answer");
      return ctx.args.response;
    },
  },
};
