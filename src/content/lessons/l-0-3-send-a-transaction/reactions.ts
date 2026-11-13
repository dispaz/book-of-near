/**
 * What each clickable 3D object does when picked (docs/book-scene.md rule 10a, the script's "Reactions"
 * table in docs/lessons/stage-0/0.3.md): its step action (`act`), a "not yet" hint, or a detail once its
 * step is done. Every object always has one of the three, so it stays pickable (and its pick animation is
 * never cut short) while the state moves on. Pure, no three.js at run time.
 */
import type { Object3D } from "three";
import { swell } from "../../../scene-kit/reaction";
import { near, short } from "./tx";
import { BUILD, SEND, SIGN, type Tx } from "./useTransaction";

export type ReactionInput = Pick<
  Tx,
  | "step"
  | "selfSend"
  | "senderNow"
  | "receiverNow"
  | "amount"
  | "busy"
  | "canBuild"
  | "canSign"
  | "canSend"
  | "nodeName"
  | "receiver"
> & {
  me: { accountId: string } | null;
  built: { receiverId: string; nonce: bigint; blockHash: string } | null;
  signed: { hash: string } | null;
  events: { broadcast?: unknown };
  error: unknown;
};

/** One object's reaction. `act` means the pick runs the step action. */
export type Reaction = { act?: true; hint?: string; detail?: string };

export type Reactions = Record<"sender" | "receiver" | "device" | "key" | "node", Reaction>;

export function reactionsFor(tx: ReactionInput): Reactions {
  return { sender: sender(tx), receiver: receiver(tx), device: device(tx), key: key(tx), node: node(tx) };
}

function sender(tx: ReactionInput): Reaction {
  const holds = tx.senderNow !== null ? `: ${near(tx.senderNow)}` : "";
  return { detail: `Your practice account${tx.me ? ` ${short(tx.me.accountId, 6, 4)}` : ""}${holds}.` };
}

function receiver(tx: ReactionInput): Reaction {
  if (tx.selfSend) return { detail: "The same account: you send to yourself." };
  const holds = tx.receiverNow !== null ? `: ${near(tx.receiverNow)}` : "";
  return { detail: `The app's return account${tx.receiver ? ` ${short(tx.receiver, 10, 6)}` : ""}${holds}.` };
}

/** While another action runs (it settles in a moment). */
const WAIT: Reaction = { hint: "Not yet: wait a moment." };

function device(tx: ReactionInput): Reaction {
  const b = tx.built;
  if (b)
    return {
      detail: `Built on your device: transfer ${tx.amount !== null ? near(tx.amount) : ""} to ${short(
        b.receiverId,
        10,
        6,
      )}, nonce ${b.nonce.toString()}, recent block hash ${short(b.blockHash, 6, 4)}.`,
    };
  if (tx.canBuild) return { act: true };
  if (tx.step < BUILD) return { hint: "Not yet: you build the transaction on step 2." };
  if (tx.step > BUILD) return { hint: "Build the transaction first (step 2)." };
  if (tx.busy === "build") return { detail: "Building…" };
  if (!tx.me || !tx.receiver) return { hint: "Not yet: your practice account is still loading." };
  return WAIT;
}

function key(tx: ReactionInput): Reaction {
  if (tx.signed)
    return {
      detail: `Signed on your device with your private key. Transaction ID: ${short(tx.signed.hash)}.`,
    };
  if (tx.canSign) return { act: true };
  if (!tx.built) return { hint: "Build the transaction first (step 2)." };
  if (tx.step < SIGN) return { hint: "Not yet: you sign on step 4." };
  if (tx.step > SIGN) return { hint: "Sign the transaction first (step 4)." };
  if (tx.busy === "sign") return { detail: "Signing…" };
  return WAIT;
}

function node(tx: ReactionInput): Reaction {
  if (tx.events.broadcast) return { detail: `Passed to the validators by ${tx.nodeName}.` };
  if (tx.canSend) return { act: true };
  if (!tx.signed) return { hint: "Sign the transaction first (step 4)." };
  if (tx.step < SEND) return { hint: "Not yet: you send on step 5." };
  if (tx.busy === "send") return { detail: "Sending…" };
  if (tx.error) return { hint: "Not sent: see the message." };
  if (tx.step > SEND) return { hint: "Send the transaction first (step 5)." };
  return WAIT;
}

// ---------- each object's own pick animation (Pickable's `pickMotion`) ----------

/**
 * The objects' pick animations, on the group Pickable hands over (already posed for hover and press:
 * they add to that pose). Each returns true while it plays and leaves no offset once it settles.
 */
export const MOTIONS = {
  /** An account swells once, like a breath: "this is what I hold". */
  account(o: Object3D, t: number) {
    const T = 0.6;
    if (t >= T) return false;
    const k = swell(t, T);
    o.position.y += 0.35 * k;
    o.scale.multiplyScalar(1 + 0.12 * k);
    return true;
  },
  /** The device thumps once, like a press, as the transaction is put together on it. */
  device(o: Object3D, t: number) {
    const T = 0.5;
    if (t >= T) return false;
    const k = swell(t, T);
    o.scale.y *= 1 - 0.3 * k;
    o.position.y += 0.15 * swell(t, T / 2) * (t < T / 2 ? 1 : 0);
    return true;
  },
  /** The key tips down and stamps, like pressing a seal into wax. */
  key(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    const k = swell(t, T);
    o.position.y -= 0.6 * k;
    o.rotation.z -= 0.5 * k;
    return true;
  },
  /** The RPC tower rocks once, like a mast sending a signal on. */
  node(o: Object3D, t: number) {
    const T = 0.8;
    if (t >= T) return false;
    o.rotation.z += 0.18 * Math.sin((t / T) * Math.PI * 2) * (1 - t / T);
    o.position.y += 0.25 * swell(t, T);
    return true;
  },
};
