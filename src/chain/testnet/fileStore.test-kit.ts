/**
 * A practice-account store backed by a JSON file, for the opt-in live testnet checks (Node only).
 * Keep the file OUTSIDE the repo ($TESTNET_STORE, default: the OS temp dir): it holds a private key.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PracticeStore, StoredPracticeAccount } from "./practice";

export function fileStore(path: string): PracticeStore {
  return {
    load: () => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as StoredPracticeAccount) : null),
    save: (a) => writeFileSync(path, JSON.stringify(a, null, 1), { mode: 0o600 }),
    clear: () => rmSync(path, { force: true }),
  };
}

/** The store at $TESTNET_STORE, or the default file in the OS temp dir. */
export const testnetFileStore = () =>
  fileStore(process.env.TESTNET_STORE ?? join(tmpdir(), "bon-testnet-practice.json"));
