/**
 * NEAR units. Amounts are always bigint yoctoNEAR (1 NEAR = 10^24 yoctoNEAR) and gas is always
 * bigint gas units (1 Tgas = 10^12 gas). Source: https://docs.near.org/protocol/transactions/gas
 */

export const YOCTO_PER_NEAR = 10n ** 24n;
export const GAS_PER_TGAS = 10n ** 12n;

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

/** Parse a decimal amount ("1", "0.01") into yoctoNEAR exactly, with no float rounding. */
export function parseNear(near: string | number): bigint {
  const text = String(near).trim();
  const m = DECIMAL.exec(text);
  if (!m) throw new Error(`Not a NEAR amount: ${String(near)}`);
  const frac = m[2] ?? "";
  if (frac.length > 24) throw new Error(`More than 24 decimals: ${text}`);
  return BigInt(m[1]!) * YOCTO_PER_NEAR + BigInt(frac.padEnd(24, "0") || "0");
}

/** Format yoctoNEAR as a NEAR decimal, cut (not rounded) to `maxDecimals`, trailing zeros dropped. */
export function formatNear(yocto: bigint, maxDecimals = 6): string {
  const neg = yocto < 0n;
  const abs = neg ? -yocto : yocto;
  const whole = abs / YOCTO_PER_NEAR;
  const frac = (abs % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Tgas to gas units: tgas(30) === 30_000_000_000_000n. Accepts decimals ("0.45"). */
export function tgas(n: number | string): bigint {
  const m = DECIMAL.exec(String(n));
  if (!m) throw new Error(`Not a Tgas amount: ${String(n)}`);
  const frac = (m[2] ?? "").slice(0, 12).padEnd(12, "0");
  return BigInt(m[1]!) * GAS_PER_TGAS + BigInt(frac);
}

/** Gas units as Tgas with up to `decimals` places, for display: 446_246_125_000n -> "0.45". */
export function formatTgas(gas: bigint, decimals = 2): string {
  const scale = 10n ** BigInt(decimals);
  const rounded = (gas * scale + GAS_PER_TGAS / 2n) / GAS_PER_TGAS;
  const whole = rounded / scale;
  const frac = (rounded % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""}`;
}
