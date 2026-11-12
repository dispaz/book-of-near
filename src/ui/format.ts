/** Small text formatters shared by lessons. Pure: no React, no chain calls. */
import { formatNear } from "../chain/units";

/**
 * Short form of a long account id, key or hash: "cf4342…c3c5". Ids of up to `keepUpTo` characters are left
 * as they are. Ids no longer than the short form itself (`head + tail + 1`) are always kept, so a smaller
 * `keepUpTo` has no effect.
 */
export function shortId(id: string, head = 6, tail = 4, keepUpTo = 0): string {
  return id.length > Math.max(keepUpTo, head + tail + 1) ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

/** A NEAR amount as "0.0194": cut (not rounded) to `decimals` places, trailing zeros dropped. */
export function nearAmount(yocto: bigint, decimals = 4): string {
  return formatNear(yocto, decimals);
}
