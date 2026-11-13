/**
 * Reads and checks an Intel TDX attestation quote (version 4) in the browser, with Web Crypto only.
 * Lesson 5.1 runs it on NEAR AI Cloud's quote (recorded, or fetched live in testnet mode).
 *
 * What it checks, in order (each is one `Check`):
 * 1. quote-signature: the quote's report is signed by the attestation key inside the quote (ECDSA P-256).
 * 2. qe-binds-key:    Intel's quoting enclave vouches for that key (its report data is SHA-256(key ‖ auth
 *                    data), then 32 zero bytes).
 * 3. qe-signature:    the quoting enclave's report is signed by the chip's PCK certificate.
 * 4. chain:           PCK certificate → PCK Platform CA → Intel SGX Root CA, each signed by the next.
 * 5. intel-root:      that root is the one Intel publishes (SHA-256 of the certificate, pinned below).
 * 6. report-data:     the signed report data holds the model's signing address and the request's nonce.
 * 7. measurements:    the measurements the server reports (MRTD, RTMR0–3) are the ones the chip signed.
 * 8. not-debug:       the TD is not in debug mode (TDATTRIBUTES bit 0 is clear): a debug TD's memory can
 *                    be read by the host, so its quote proves nothing about privacy.
 *
 * What it does NOT check (the honest take says so):
 * - certificate revocation lists (CRLs), so a revoked chip or CA would still pass;
 * - the TCB level: whether the chip's firmware and microcode are up to date (Intel's TCB info);
 * - the certificates' validity dates;
 * - the quoting enclave's identity (Intel's QE identity: its MRSIGNER, ISV SVN and attributes);
 * - MRSEAM, the measurement of the TDX module (Intel's firmware that runs the TD), against Intel's list;
 * - the NVIDIA GPU evidence that comes with NEAR AI Cloud's report;
 * - what the measured code actually does.
 * A full check is Intel's DCAP verifier plus NEAR AI's own verifier. Pure: no network.
 */

/** SHA-256 of Intel's SGX Root CA certificate (DER), from
 * https://certificates.trustedservices.intel.com/Intel_SGX_Provisioning_Certification_RootCA.cer
 * (fetched 13 Nov 2026). The same root signs TDX quotes. */
export const INTEL_SGX_ROOT_SHA256 = "44a0196b2b99f889b8e149e95b807a350e7424964399e885a7cbb8ccfab674d3";

const HEADER = 48;
const BODY = 584;
const SIGNED = HEADER + BODY; // 632: what the attestation key signs
const TEE_TDX = 0x81;
const QE_REPORT = 384;
/** TDATTRIBUTES, in the TD report body; its bit 0 is DEBUG. */
const TD_ATTRIBUTES = 120;

export interface Cert {
  /** The subject's common name, for example "Intel SGX Root CA". */
  name: string;
  der: Uint8Array;
  tbs: Uint8Array;
  spki: Uint8Array;
  /** The issuer's signature over `tbs`, as raw r ‖ s (64 bytes). */
  signature: Uint8Array;
}

export interface TdxQuote {
  version: number;
  tee: "Intel TDX";
  /** Bytes in the whole quote. */
  size: number;
  /** The measurement of the TD's initial code and data (hex, 48 bytes). */
  mrtd: string;
  /** Runtime measurement registers 0 to 3 (hex, 48 bytes each). */
  rtmr: [string, string, string, string];
  /** The 64 bytes the code inside put in the report (hex). */
  reportData: string;
  /** TDATTRIBUTES (hex, 8 bytes). Bit 0 of the first byte is DEBUG. */
  tdAttributes: string;
  /** The TD runs in debug mode (its memory can be read by the host). */
  debug: boolean;
  signed: Uint8Array;
  signature: Uint8Array;
  attestationKey: Uint8Array;
  qeReport: Uint8Array;
  qeSignature: Uint8Array;
  qeAuth: Uint8Array;
  /** The PCK certificate chain, leaf first. */
  certs: Cert[];
}

export type CheckId =
  | "quote-signature"
  | "qe-binds-key"
  | "qe-signature"
  | "chain"
  | "intel-root"
  | "report-data"
  | "measurements"
  | "not-debug";

export interface Check {
  id: CheckId;
  ok: boolean;
  /** One plain sentence: what was checked. */
  label: string;
}

export const CHECK_LABELS: Record<CheckId, string> = {
  "quote-signature": "The report is signed by the quote's attestation key.",
  "qe-binds-key": "Intel's quoting enclave vouches for that attestation key.",
  "qe-signature": "The quoting enclave's report is signed by the chip's own certificate (PCK).",
  chain: "The chip's certificate chains up to Intel's root: each one is signed by the next.",
  "intel-root": "That root is the one Intel publishes (fingerprint matches).",
  "report-data": "The signed report holds the model's signing address and the request's nonce.",
  measurements: "The measurements the server reports are the ones the chip signed.",
  "not-debug": "The enclave is not in debug mode, which would let the host read its memory.",
};

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error("Not a hex string.");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

/** Reads a TDX quote's parts. Throws on anything that is not a version 4 TDX quote with a PCK chain. */
export function parseTdxQuote(b: Uint8Array): TdxQuote {
  if (b.length < SIGNED + 4 || u16(b, 0) !== 4 || u32(b, 4) !== TEE_TDX)
    throw new Error("This is not a TDX quote (version 4, TEE type TDX).");
  const body = b.subarray(HEADER, SIGNED);
  const at = (o: number, n: number) => toHex(body.subarray(o, o + n));
  let o = SIGNED + 4;
  const take = (n: number) => {
    if (o + n > b.length) throw new Error("The quote ends too early.");
    const part = b.subarray(o, o + n);
    o += n;
    return part;
  };
  const signature = take(64);
  const attestationKey = take(64);
  if (u16(b, o) !== 6) throw new Error("The quote has no quoting-enclave certification data.");
  take(6);
  const qeReport = take(QE_REPORT);
  const qeSignature = take(64);
  const qeAuth = take(u16(b, o) + 2).subarray(2);
  if (u16(b, o) !== 5) throw new Error("The quote has no PCK certificate chain.");
  const pemSize = u32(b, o + 2);
  take(6);
  const pem = new TextDecoder().decode(take(pemSize));
  const certs = [...pem.matchAll(/-----BEGIN CERTIFICATE-----([^-]+)-----END CERTIFICATE-----/g)].map((m) =>
    parseCert(base64(m[1]!)),
  );
  if (certs.length < 2) throw new Error("The PCK certificate chain is too short.");
  return {
    version: 4,
    tee: "Intel TDX",
    size: b.length,
    mrtd: at(136, 48),
    rtmr: [at(328, 48), at(376, 48), at(424, 48), at(472, 48)],
    reportData: at(520, 64),
    tdAttributes: at(TD_ATTRIBUTES, 8),
    debug: (body[TD_ATTRIBUTES]! & 0x01) === 1,
    signed: b.subarray(0, SIGNED),
    signature,
    attestationKey,
    qeReport,
    qeSignature,
    qeAuth,
    certs,
  };
}

function base64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ""));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- a small DER reader: just enough for an X.509 certificate ----------

interface Tlv {
  tag: number;
  /** The whole element, header included. */
  all: Uint8Array;
  /** Its contents. */
  value: Uint8Array;
}

function tlv(b: Uint8Array, o: number): Tlv {
  const tag = b[o]!;
  let len = b[o + 1]!;
  let head = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[o + 2 + i]!;
    head += n;
  }
  if (o + head + len > b.length) throw new Error("Bad certificate encoding.");
  return { tag, all: b.subarray(o, o + head + len), value: b.subarray(o + head, o + head + len) };
}

function children(b: Uint8Array): Tlv[] {
  const out: Tlv[] = [];
  for (let o = 0; o < b.length;) {
    const t = tlv(b, o);
    out.push(t);
    o += t.all.length;
  }
  return out;
}

const ECDSA_SHA256 = "2a8648ce3d040302";
const COMMON_NAME = "550403";

function parseCert(der: Uint8Array): Cert {
  const [tbs, alg, sig] = children(tlv(der, 0).value);
  if (!tbs || !alg || !sig) throw new Error("Bad certificate.");
  if (toHex(children(alg.value)[0]!.value) !== ECDSA_SHA256)
    throw new Error("The certificate is not signed with ECDSA and SHA-256.");
  const fields = children(tbs.value);
  // [0] version (explicit), serial, signature algorithm, issuer, validity, subject, public key, …
  const shift = fields[0]!.tag === 0xa0 ? 1 : 0;
  const subject = fields[4 + shift]!;
  const spki = fields[5 + shift]!;
  return { name: commonName(subject.value), der, tbs: tbs.all, spki: spki.all, signature: rawSig(sig.value) };
}

function commonName(name: Uint8Array): string {
  for (const set of children(name))
    for (const pair of children(set.value)) {
      const [oid, value] = children(pair.value);
      if (oid && value && toHex(oid.value) === COMMON_NAME) return new TextDecoder().decode(value.value);
    }
  return "";
}

/** A DER ECDSA signature (in a BIT STRING) as raw r ‖ s, 32 bytes each. */
function rawSig(bitString: Uint8Array): Uint8Array {
  const [r, s] = children(tlv(bitString, 1).value);
  const out = new Uint8Array(64);
  const put = (v: Uint8Array, at: number) => {
    const trimmed = v.subarray(Math.max(0, v.length - 32));
    out.set(trimmed, at + 32 - trimmed.length);
  };
  put(r!.value, 0);
  put(s!.value, 32);
  return out;
}

// ---------- the checks ----------

export interface Expected {
  /** The model's signing address (0x…, 20 bytes): the first bytes of the report data. */
  address: string;
  /** The request's nonce (hex, 32 bytes): the last 32 bytes of the report data. */
  nonce: string;
  /** The measurements the server reported alongside the quote. */
  measurements: { mrtd: string; rtmr0: string; rtmr1: string; rtmr2: string; rtmr3: string };
}

const P256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
/** Web Crypto wants an ArrayBuffer-backed view. */
const buf = (b: Uint8Array) => new Uint8Array(b);

export async function verifyTdxQuote(
  q: TdxQuote,
  expected: Expected,
  opts: { rootSha256?: string; subtle?: SubtleCrypto } = {},
): Promise<Check[]> {
  const subtle = opts.subtle ?? globalThis.crypto.subtle;
  const rawKey = (xy: Uint8Array) => {
    const k = new Uint8Array(65);
    k[0] = 4;
    k.set(xy, 1);
    return subtle.importKey("raw", k, P256, false, ["verify"]);
  };
  const spkiKey = (c: Cert) => subtle.importKey("spki", buf(c.spki), P256, false, ["verify"]);
  const safe = async (f: () => Promise<boolean>) => {
    try {
      return await f();
    } catch {
      return false;
    }
  };

  const quoteSig = await safe(async () =>
    subtle.verify(SHA256, await rawKey(q.attestationKey), buf(q.signature), buf(q.signed)),
  );
  const bindsKey = await safe(async () => {
    const both = new Uint8Array(q.attestationKey.length + q.qeAuth.length);
    both.set(q.attestationKey);
    both.set(q.qeAuth, q.attestationKey.length);
    const h = new Uint8Array(await subtle.digest("SHA-256", both));
    // The QE's 64 bytes of report data: the hash, then 32 zero bytes.
    const zeros = q.qeReport.subarray(352, 384).every((x) => x === 0);
    return zeros && toHex(h) === toHex(q.qeReport.subarray(320, 352));
  });
  const qeSig = await safe(async () =>
    subtle.verify(SHA256, await spkiKey(q.certs[0]!), buf(q.qeSignature), buf(q.qeReport)),
  );
  const chain = await safe(async () => {
    for (let i = 0; i < q.certs.length; i++) {
      const cert = q.certs[i]!;
      const issuer = q.certs[Math.min(i + 1, q.certs.length - 1)]!;
      if (!(await subtle.verify(SHA256, await spkiKey(issuer), buf(cert.signature), buf(cert.tbs))))
        return false;
    }
    return true;
  });
  const root = q.certs[q.certs.length - 1]!;
  const rootHash = toHex(new Uint8Array(await subtle.digest("SHA-256", buf(root.der))));
  const intelRoot = rootHash === (opts.rootSha256 ?? INTEL_SGX_ROOT_SHA256);
  const address = expected.address.replace(/^0x/, "").toLowerCase();
  const reportData =
    q.reportData === address.padEnd(64, "0") + expected.nonce.toLowerCase() && /^[0-9a-f]{40}$/.test(address);
  const m = expected.measurements;
  const measurements = [m.mrtd, m.rtmr0, m.rtmr1, m.rtmr2, m.rtmr3].join() === [q.mrtd, ...q.rtmr].join();

  const results: [CheckId, boolean][] = [
    ["quote-signature", quoteSig],
    ["qe-binds-key", bindsKey],
    ["qe-signature", qeSig],
    ["chain", chain],
    ["intel-root", intelRoot],
    ["report-data", reportData],
    ["measurements", measurements],
    ["not-debug", !q.debug],
  ];
  return results.map(([id, ok]) => ({ id, ok, label: CHECK_LABELS[id] }));
}

/** SHA-256 of the whole quote (hex): the lesson's evidence names the quote it checked by this. */
export async function quoteHash(b: Uint8Array, subtle: SubtleCrypto = globalThis.crypto.subtle) {
  return toHex(new Uint8Array(await subtle.digest("SHA-256", buf(b))));
}
