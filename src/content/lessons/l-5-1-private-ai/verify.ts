/**
 * Lesson 5.1's verification, without React: check a quote against what NEAR AI Cloud reported, fall back
 * to the recorded quote when a live one cannot be read or fails, and the one-byte tamper test.
 */
import { RECORDED_ATTESTATION, recordedDate, type Attestation } from "../../../chain/nearai";
import { hexToBytes, parseTdxQuote, verifyTdxQuote, type Check } from "../../../chain/nearai/tdx";

/** The byte the tamper test changes: the first byte of MRTD in the signed report. */
export const TAMPER_AT = 48 + 136;

/** Where the nonce in the report data came from, in the learner's words. */
const REPORT_DATA_LABEL: Record<Attestation["source"], string> = {
  recorded:
    "The signed report holds the model's signing address and the nonce sent when this quote was recorded.",
  live: "The signed report holds the model's signing address and the nonce this page just sent.",
};

/** Every check of `bytes` (the attestation's quote, or a changed copy) against what the server reported. */
export async function checkAgainst(
  a: Attestation,
  bytes: Uint8Array = hexToBytes(a.quote),
): Promise<Check[]> {
  const checks = await verifyTdxQuote(parseTdxQuote(bytes), {
    address: a.signingAddress,
    nonce: a.nonce,
    measurements: a.measurements,
  });
  return checks.map((c) => (c.id === "report-data" ? { ...c, label: REPORT_DATA_LABEL[a.source] } : c));
}

export type Verified =
  /** The checks ran (on `attestation`, which may be the recorded fallback). */
  | { ok: boolean; attestation: Attestation; checks: Check[]; notice: string | null }
  /** The quote could not be read at all. */
  | { error: string; attestation: Attestation; notice: string | null };

const passes = (checks: Check[]) => checks.every((c) => c.ok);
const instead = () =>
  `Checking the quote recorded on ${recordedDate(RECORDED_ATTESTATION.recordedOn!)} instead.`;

/**
 * Checks the attestation's quote. A live quote that cannot be read, or that fails a check, is reported in
 * `notice` and replaced by the recorded one, so the learner can still finish the step.
 */
export async function verifyAttestation(a: Attestation): Promise<Verified> {
  let checks: Check[] | null = null;
  let problem: string | null = null;
  try {
    checks = await checkAgainst(a);
  } catch (e) {
    problem = (e as Error).message;
  }
  if (checks && (passes(checks) || a.source !== "live"))
    return { ok: passes(checks), attestation: a, checks, notice: null };
  if (a.source !== "live")
    return { error: problem!, attestation: a, notice: `The quote could not be read: ${problem!}` };

  const why = checks
    ? `The live quote failed: ${checks
        .filter((c) => !c.ok)
        .map((c) => c.label)
        .join(" ")}`
    : `The live quote could not be read: ${problem!}`;
  const notice = `${why} ${instead()}`;
  const recorded = RECORDED_ATTESTATION;
  try {
    const again = await checkAgainst(recorded);
    return { ok: passes(again), attestation: recorded, checks: again, notice };
  } catch (e) {
    return { error: (e as Error).message, attestation: recorded, notice };
  }
}

/** Changes one byte of the signed report and checks again: it must fail. Null if the copy cannot be read. */
export async function tamperCheck(a: Attestation): Promise<Check[] | null> {
  try {
    const bytes = hexToBytes(a.quote);
    bytes[TAMPER_AT] = bytes[TAMPER_AT]! ^ 0x01;
    return await checkAgainst(a, bytes);
  } catch {
    return null;
  }
}
