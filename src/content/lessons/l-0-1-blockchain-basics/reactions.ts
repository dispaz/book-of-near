/**
 * How lesson 0.1's clickable 3D objects react (docs/book-scene.md rule 10a; the "Reactions" table in
 * docs/lessons/stage-0/0.1.md): what a pick does at each step, the "not yet" hints, the details shown
 * after a step, and each object's own pick animation. Pure, so it is unit tested.
 */
import type { Object3D } from "three";
import { PEOPLE, shortHash, START, type Balances, type Block } from "./ledger";
import { BLOCKS, CHECK, HASH, HONEST, LINKS, SEND, TAMPER } from "./useLedgerLesson";

/** "Balances: Ana 7, Ben 8, Cora 0": what a ledger shows when picked after its step. */
export const balancesDetail = (bal: Balances) =>
  `Balances: ${PEOPLE.map((p) => `${p} ${bal[p]}`).join(", ")}`;

/** A block's contents, its hash and the hash it stores, in one line. */
export function blockDetail(b: Block, hash: string): string {
  if (b.height === 0)
    return `Block #0, the genesis block: ${PEOPLE.map((p) => `${p} ${START[p]}`).join(", ")}, hash ${shortHash(hash)}`;
  return `Block #${b.height}: ${b.text}, hash ${shortHash(hash)}, previous hash ${shortHash(b.prev)}`;
}

/**
 * What picking a block does at a step. `open` opens it (steps 3 and 4; with `detail` once step 3 is
 * done), `peek` opens it at the honest take, `detail` shows its line, `not-yet` shakes with `hint`.
 * Block #1 at the tamper step has no pick: its amount field is the action there, and its edit ring is
 * then the only ring under it.
 */
export type BlockPick =
  | { kind: "open"; detail?: true }
  | { kind: "peek" }
  | { kind: "detail" }
  | { kind: "not-yet"; hint: string }
  | { kind: "none" };

export function blockPick(step: number, height: number, sent: boolean): BlockPick {
  if (step === SEND)
    return { kind: "not-yet", hint: sent ? "Press Next to open the block" : "Send the transaction first" };
  if (step === BLOCKS) return { kind: "open" };
  if (step === HASH) return { kind: "open", detail: true };
  if (step === TAMPER) return height === 1 ? { kind: "none" } : { kind: "detail" };
  if (step === LINKS || step === CHECK) return { kind: "detail" };
  if (step === HONEST) return { kind: "peek" };
  return { kind: "none" };
}

export const NOTEBOOK_PICK_SECONDS = 0.7;
export const BLOCK_PICK_SECONDS = 0.8;

/** 0 → 1 → 0 over the pick, eased at both ends. */
const swell = (t: number, seconds: number) => Math.sin(Math.PI * Math.min(1, t / seconds));

/**
 * A notebook's pick: it slides forward and tilts up towards the reader, showing its ledger lines, then
 * settles back. Adds to the hover pose the kit has already set.
 */
export function notebookMotion(o: Object3D, t: number): boolean {
  const k = swell(t, NOTEBOOK_PICK_SECONDS);
  o.position.z += 0.4 * k;
  o.position.y += 0.15 * k;
  o.rotation.x -= 0.28 * k;
  return t < NOTEBOOK_PICK_SECONDS;
}

/**
 * A block's pick: it lifts up and unfolds (tips back and widens a little) to show what is inside, then
 * lands again. Adds to the hover pose the kit has already set.
 */
export function blockMotion(o: Object3D, t: number): boolean {
  const k = swell(t, BLOCK_PICK_SECONDS);
  o.position.y += 0.55 * k;
  o.rotation.x -= 0.35 * k;
  o.scale.x *= 1 + 0.12 * k;
  o.scale.z *= 1 + 0.12 * k;
  return t < BLOCK_PICK_SECONDS;
}
