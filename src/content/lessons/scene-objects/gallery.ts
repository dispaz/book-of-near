/** What the gallery shows at each step. Pure, shared by the 2D and 3D views. */
import type { ObjectState } from "../../../scene-kit/objects";

export type Fate = "idle" | "done" | "undone" | "failed" | "skipped";
export const ITEMS: { key: string; text: string; fate: Fate }[] = [
  { key: "a", text: "create account", fate: "done" },
  { key: "b", text: "send 0.02 NEAR", fate: "undone" },
  { key: "c", text: "add key", fate: "failed" },
  { key: "d", text: "call increment", fate: "skipped" },
];

export const ACCOUNTS: { name: string; state: ObjectState; note: string; flag?: boolean; coins?: number }[] =
  [
    { name: "ana.testnet", state: "ok", note: "named", flag: true, coins: 2 },
    { name: "7f3a…c0d9", state: "ok", note: "implicit" },
    { name: "ben.testnet", state: "pending", note: "not created" },
    { name: "old.testnet", state: "gone", note: "deleted" },
  ];

export const PARCELS: { label: string; stamped: boolean; open: boolean; state: ObjectState }[] = [
  { label: "packing", stamped: false, open: true, state: "ok" },
  { label: "signed", stamped: true, open: false, state: "ok" },
  { label: "opened", stamped: true, open: true, state: "ok" },
  { label: "failed", stamped: true, open: false, state: "failed" },
];

export const SCROLLS: { label: string; running: boolean; state: ObjectState }[] = [
  { label: "idle", running: false, state: "ok" },
  { label: "running", running: true, state: "ok" },
  { label: "failed", running: false, state: "failed" },
];

export const DESCRIPTION = [
  "Four mailboxes: a named account with its flag up and two coins, an implicit one, a dashed one that is not created, and a deleted one struck out.",
  "Four parcels: one being packed, one stamped and closed, one stamped and open with four action cards above it, and one failed with a red cross.",
  "Three scrolls with a gear on the seal: idle, running with the gear turning, and failed with a red cross.",
  "A full-access key, a function-call key with a tag and a half-full allowance gauge, a revoked one struck out, and a coin.",
];
