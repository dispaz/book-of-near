/**
 * NEAR AI Cloud's attestation report for one model: recorded (demo mode) or fetched live (testnet mode).
 * The report endpoint is public (no key) and CORS-open; chat needs an API key this app does not ship, so
 * the tutor's answers are written in advance (lesson 5.1 says so). Verification is in tdx.ts.
 */
import recorded from "./recorded-attestation.json";

export const ATTESTATION_URL = "https://cloud-api.near.ai/v1/attestation/report";
export const TUTOR_MODEL = "Qwen/Qwen3.8-27B";

export interface Attestation {
  source: "recorded" | "live";
  /** When it was recorded (YYYY-MM-DD), for the recorded one. */
  recordedOn?: string;
  model: string;
  /** The model's response-signing address (0x…, ECDSA). */
  signingAddress: string;
  nonce: string;
  /** The Intel TDX quote, hex. */
  quote: string;
  /** The software image the server says runs inside (dstack). */
  appName: string;
  composeHash: string;
  measurements: { mrtd: string; rtmr0: string; rtmr1: string; rtmr2: string; rtmr3: string };
  /** NVIDIA GPU evidence that came with it (not checked in the page). */
  gpus: { arch: string; count: number };
}

export const RECORDED_ATTESTATION: Attestation = {
  source: "recorded",
  recordedOn: recorded.recordedOn,
  model: recorded.model_name,
  signingAddress: recorded.signing_address,
  nonce: recorded.request_nonce,
  quote: recorded.intel_quote,
  appName: recorded.app_name,
  composeHash: recorded.compose_hash,
  measurements: recorded.tcb_info,
  gpus: { arch: recorded.nvidia.arch, count: recorded.nvidia.evidence },
};

/** "13 Nov 2026" from "2026-11-13". */
export function recordedDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m! - 1];
  return `${d} ${month} ${y}`;
}

/** A fresh 32-byte nonce (hex): the live quote must carry it, so it cannot be an old one replayed. */
export function newNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

interface ModelAttestation {
  model_name: string;
  signing_address: string;
  request_nonce: string;
  intel_quote: string;
  nvidia_payload?: string;
  info: { app_name: string; compose_hash: string; tcb_info: string | Attestation["measurements"] };
}

/** Reads the model's part of a report (the shape recorded on 13 Nov 2026). Throws if it is missing. */
export function parseReport(json: unknown, model = TUTOR_MODEL): Omit<Attestation, "source"> {
  const list = (json as { model_attestations?: ModelAttestation[] }).model_attestations;
  const m = list?.find((a) => a.model_name === model) ?? list?.[0];
  if (!m?.intel_quote || !m.info) throw new Error("NEAR AI Cloud sent no quote for the model.");
  const tcb = typeof m.info.tcb_info === "string" ? JSON.parse(m.info.tcb_info) : m.info.tcb_info;
  let gpus = { arch: "none", count: 0 };
  if (m.nvidia_payload) {
    const nv = JSON.parse(m.nvidia_payload) as { arch?: string; evidence_list?: unknown[] };
    gpus = { arch: nv.arch ?? "unknown", count: nv.evidence_list?.length ?? 0 };
  }
  return {
    model: m.model_name,
    signingAddress: m.signing_address,
    nonce: m.request_nonce,
    quote: m.intel_quote,
    appName: m.info.app_name,
    composeHash: m.info.compose_hash,
    measurements: {
      mrtd: tcb.mrtd,
      rtmr0: tcb.rtmr0,
      rtmr1: tcb.rtmr1,
      rtmr2: tcb.rtmr2,
      rtmr3: tcb.rtmr3,
    },
    gpus,
  };
}

/** Asks NEAR AI Cloud for a fresh report with our nonce. No key needed. */
export async function fetchAttestation(
  nonce: string,
  {
    fetch: f = globalThis.fetch.bind(globalThis),
    timeoutMs = 20_000,
  }: { fetch?: Fetch; timeoutMs?: number } = {},
): Promise<Attestation> {
  const url = `${ATTESTATION_URL}?model=${encodeURIComponent(TUTOR_MODEL)}&nonce=${nonce}&signing_algo=ecdsa`;
  let res: Response;
  try {
    res = await f(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error("NEAR AI Cloud did not answer.");
  }
  if (!res.ok) throw new Error(`NEAR AI Cloud answered ${res.status}.`);
  return { source: "live", ...parseReport(await res.json()) };
}
