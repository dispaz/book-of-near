/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import type { Trace } from "./trace";

import { CHECK, FOLLOW, GRID, PICK, START } from "./steps";

export { CHECK };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "mailbox" }
  | { kind: "parcel" }
  | { kind: "hop"; index: number }
  | { kind: "row"; shardId: number }
  | { kind: "column"; height: number };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };

/**
 * The tour for a step: the whole figure first, then close-ups. `at` is the hop the learner has followed
 * to. None at the check and the honest take.
 */
export function tourFor(step: number, trace: Trace | null, at: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  const mailbox: Shot<Target> = {
    caption: "Close up: your account, the mailbox the transaction was sent from.",
    target: { kind: "mailbox" },
  };
  if (step === PICK || !trace)
    return [
      ALL,
      mailbox,
      { caption: "Close up: the transaction, a parcel that already arrived.", target: { kind: "parcel" } },
    ];
  const first = trace.hops[0]!;
  if (step === GRID)
    return [
      ALL,
      {
        caption: `Close up: block ${first.blockHeight}. It holds one chunk from every shard.`,
        target: { kind: "column", height: first.blockHeight },
      },
      {
        caption: `Close up: shard ${first.shardId}, one ribbon. It makes a chunk in every block.`,
        target: { kind: "row", shardId: first.shardId },
      },
    ];
  if (step === START)
    return [
      ALL,
      mailbox,
      {
        caption: `Close up: the first chunk, shard ${first.shardId} in block ${first.blockHeight}.`,
        target: { kind: "hop", index: 0 },
      },
    ];
  const last = trace.hops.length - 1;
  const i = step === FOLLOW ? Math.min(Math.max(at, 0), last) : last;
  const hop = trace.hops[i]!;
  return [
    ALL,
    {
      caption: `Close up: step ${i + 1}, on shard ${hop.shardId} in block ${hop.blockHeight}.`,
      target: { kind: "hop", index: i },
    },
    ...(i > 0
      ? [{ caption: "Close up: where it started.", target: { kind: "hop", index: 0 } } as Shot<Target>]
      : []),
  ];
}
