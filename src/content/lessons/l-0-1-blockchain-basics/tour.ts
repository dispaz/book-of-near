/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): a few shots, each
 * with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
// Type-only and from the pure module, so the unit test never loads three.js.
import type { Shot as KitShot } from "../../../scene-kit/bookLayout";
import type { Person } from "./ledger";
import { BLOCKS, COMPARE, HASH, HONEST, LINKS, NOTEBOOK, SEND, TAMPER } from "./useLedgerLesson";

export type TourTarget =
  | { kind: "all" }
  | { kind: "ledger"; who: Person }
  | { kind: "block"; i: number }
  /** The link from block i - 1 to block i. */
  | { kind: "link"; i: number }
  | { kind: "copy"; who: Person };

export type Shot = KitShot<TourTarget>;

const all = (caption: string): Shot => ({ caption, target: { kind: "all" } });

/** The tour for a step, given how many blocks are on the chain. */
export function tourFor(step: number, blocks: number): Shot[] {
  const block = (i: number, caption: string): Shot[] =>
    i < blocks ? [{ caption, target: { kind: "block", i } }] : [];
  const link = (i: number, caption: string): Shot[] =>
    i > 0 && i < blocks ? [{ caption, target: { kind: "link", i } }] : [];
  switch (step) {
    case NOTEBOOK:
      return [
        all("Three notebooks: Ana's, Ben's and Cora's."),
        { caption: "Close up: Ana's notebook.", target: { kind: "ledger", who: "Ana" } },
        { caption: "Close up: Cora's notebook, a separate copy.", target: { kind: "ledger", who: "Cora" } },
      ];
    case SEND:
      return [
        all("Every copy of the ledger holds the same balances."),
        { caption: "Close up: Ana's copy.", target: { kind: "ledger", who: "Ana" } },
        { caption: "Close up: Ben's copy changes the same way.", target: { kind: "ledger", who: "Ben" } },
      ];
    case BLOCKS:
      return [
        all("The chain: blocks added one after another."),
        ...block(0, "Close up: block #0, the genesis block."),
        ...block(1, "Close up: block #1 and the transaction inside it."),
      ];
    case HASH:
      return [
        all("Every block has its own hash."),
        ...block(1, "Close up: block #1 and its hash."),
        ...block(0, "Close up: block #0 has a different hash."),
      ];
    case LINKS:
      return [
        all("Each block points back to the one before it."),
        ...link(1, "Close up: block #1 stores the hash of block #0."),
        ...link(2, "Close up: block #2 stores the hash of block #1."),
      ];
    case TAMPER:
      return [
        all("Ben's copy of the chain."),
        ...block(1, "Close up: block #1, the block Ben edits."),
        ...link(2, "Close up: the link from block #1 to block #2."),
      ];
    case COMPARE:
      return [
        all("Three copies of the chain, side by side."),
        { caption: "Close up: Ben's copy.", target: { kind: "copy", who: "Ben" } },
        { caption: "Close up: Ana's copy.", target: { kind: "copy", who: "Ana" } },
      ];
    case HONEST:
      return [
        all("The honest chain."),
        ...block(blocks - 1, `Close up: the newest block, #${blocks - 1}.`),
        ...block(0, "Close up: block #0, where it all starts."),
      ];
    default:
      return [];
  }
}
