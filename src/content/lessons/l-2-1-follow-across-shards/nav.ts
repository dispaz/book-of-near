/**
 * Step 4's own back/forward, like the lesson's step bar but through the hops. Back looks at the hop
 * before; forward looks at the next hop already reached, or follows on from the newest one. Pure.
 */
export interface HopNav {
  /** The hop being looked at (never past what is reached). */
  at: number;
  canPrev: boolean;
  canNext: boolean;
  /** Forward follows the path on (the same as "Follow next receipt"), not just a look. */
  nextFollows: boolean;
}

export function hopNav({
  reached,
  looking,
  last,
}: {
  reached: number;
  looking: number;
  last: number;
}): HopNav {
  const at = Math.min(looking, reached);
  return { at, canPrev: at > 0, canNext: at < last, nextFollows: at === reached && reached < last };
}
