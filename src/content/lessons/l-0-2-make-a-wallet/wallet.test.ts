import { describe, expect, it } from "vitest";
import { hexToBytes } from "@noble/hashes/utils.js";
import {
  DEMO_PHRASE,
  changeOneLetter,
  NEAR_PATH,
  ethAddressFromSecretKey,
  isValidPhrase,
  keyPairFromPhrase,
  newPhrase,
  publicKeyToImplicit,
  sign,
  slip10Ed25519,
  verify,
  wipe,
} from "./wallet";

// Public example from docs.near.org ("Creating implicit and named accounts"). Never put funds on it.
const DEMO_PUBLIC = "ed25519:Ex4stLtTe43ynFmxGweGzMWLvRmRSUP6EjU6nvAdY2vg";
const DEMO_SECRET =
  "ed25519:5uJtH8hdYKPEhLVTn9EoxaneLpKh11qLEWDVvG6tKTeMUzsmf7isHYxXixhNcupRhUNQ2fHFgtKXy94YUXHfbxiG"; // secret-scan:allow public demo key from docs.near.org
const DEMO_IMPLICIT = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";

describe("SLIP-10 ed25519", () => {
  // SLIP-10 test vector 1 for ed25519 (seed 000102…0f).
  const seed = hexToBytes("000102030405060708090a0b0c0d0e0f");
  it("derives the master node", () => {
    const n = slip10Ed25519(seed, "m");
    expect(Buffer.from(n.key).toString("hex")).toBe(
      "2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7",
    );
    expect(Buffer.from(n.chainCode).toString("hex")).toBe(
      "90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb",
    );
  });
  it("derives a hardened child", () => {
    const n = slip10Ed25519(seed, "m/0'");
    expect(Buffer.from(n.key).toString("hex")).toBe(
      "68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3",
    );
    expect(Buffer.from(n.chainCode).toString("hex")).toBe(
      "8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69",
    );
  });
  it("refuses non-hardened steps (ed25519 supports hardened only)", () => {
    expect(() => slip10Ed25519(seed, "m/0")).toThrow(/hardened/);
  });
});

describe("NEAR key pair from a seed phrase", () => {
  it("matches the public example from docs.near.org", () => {
    const kp = keyPairFromPhrase(DEMO_PHRASE);
    expect(NEAR_PATH).toBe("m/44'/397'/0'");
    expect(kp.publicKey).toBe(DEMO_PUBLIC);
    expect(kp.secretKey).toBe(DEMO_SECRET);
    expect(kp.implicitAccount).toBe(DEMO_IMPLICIT);
    expect(publicKeyToImplicit(DEMO_PUBLIC)).toBe(DEMO_IMPLICIT);
  });

  it("makes a fresh 12-word phrase that rebuilds the same key", () => {
    const a = newPhrase();
    const b = newPhrase();
    expect(a.split(" ")).toHaveLength(12);
    expect(a).not.toBe(b);
    expect(isValidPhrase(a)).toBe(true);
    expect(keyPairFromPhrase(a).publicKey).toBe(keyPairFromPhrase(a).publicKey);
    expect(keyPairFromPhrase(a).implicitAccount).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects phrases that are not valid BIP-39", () => {
    expect(isValidPhrase("hello world")).toBe(false);
  });
});

describe("sign and verify", () => {
  const kp = keyPairFromPhrase(DEMO_PHRASE);
  it("verifies the signed message and fails after one letter changes", () => {
    const sig = sign(kp, "Hello from Book of NEAR");
    expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
    expect(verify(kp.publicKey, "Hello from Book of NEAR", sig)).toBe(true);
    expect(verify(kp.publicKey, "Hellp from Book of NEAR", sig)).toBe(false);
  });
  it("is deterministic (RFC 8032)", () => {
    expect(sign(kp, "Hello from Book of NEAR")).toMatchSnapshot();
    expect(sign(kp, "x")).toBe(sign(kp, "x"));
  });
  it("returns false for a garbled signature instead of throwing", () => {
    expect(verify(kp.publicKey, "x", "not-a-signature")).toBe(false);
  });
});

describe("Ethereum address", () => {
  it("is the last 20 bytes of keccak-256 of the public key, with EIP-55 checksum", () => {
    // Well-known example: private key 1 → 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf.
    const one = new Uint8Array(32);
    one[31] = 1;
    expect(ethAddressFromSecretKey(one)).toBe("0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
  });
});

describe("wipe", () => {
  it("zeroes the key bytes", () => {
    const kp = keyPairFromPhrase(DEMO_PHRASE);
    wipe(kp);
    expect(kp.seed.every((b) => b === 0)).toBe(true);
  });
});

describe("changeOneLetter", () => {
  it("changes exactly one letter", () => {
    expect(changeOneLetter("Hello from Book of NEAR")).toBe("Hellp from Book of NEAR");
    expect(changeOneLetter("zzzzz")).toBe("zzzza");
    expect(changeOneLetter("Hi")).toBe("Hj");
    expect(changeOneLetter("1234!")).toBe("1234x");
  });
});
