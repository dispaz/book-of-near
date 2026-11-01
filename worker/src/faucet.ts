/**
 * POST /faucet { publicKey, accountId? } → { accountId, txHash, amount }
 *
 * Creates and funds a learner's testnet practice account from the faucet account:
 * - no accountId: the implicit account of `publicKey` (64 hex characters), funded by a transfer;
 * - accountId `name.testnet`: a top-level name through `testnet.create_account`.
 * Only the learner's PUBLIC key is ever sent here.
 */
import { takeSlot, type CounterStore, type Limits } from "./limits";

export interface FaucetSender {
  /** Sends `amount` NEAR to a new implicit account. Returns the transaction hash. */
  fundImplicit(accountId: string, amount: string): Promise<string>;
  /** Creates `name.testnet` with `publicKey` and `amount` NEAR. Returns the transaction hash. */
  createNamed(accountId: string, publicKey: string, amount: string): Promise<string>;
  accountExists(accountId: string): Promise<boolean>;
}

export interface FaucetDeps {
  sender: FaucetSender | null;
  counters: CounterStore;
  limits: Limits;
  amount: string;
  now?: () => Date;
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(ALPHABET.indexOf(c));
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** `ed25519:<base58 32 bytes>` → 64-hex implicit account id, or null when malformed. */
export function implicitIdOf(publicKey: unknown): string | null {
  if (typeof publicKey !== "string" || !publicKey.startsWith("ed25519:")) return null;
  const b58 = publicKey.slice(8);
  if (!BASE58.test(b58) || b58.length > 50) return null;
  const raw = base58Decode(b58);
  if (raw.length !== 32) return null;
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}

const NAMED = /^[a-z\d]+([-_][a-z\d]+)*\.testnet$/;

type Reply = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Reply => ({ status, body: { error } });

export async function faucet(input: unknown, ip: string, deps: FaucetDeps): Promise<Reply> {
  if (!deps.sender) return fail(503, "The faucet is not set up on this server.");
  const req = (input ?? {}) as { publicKey?: unknown; accountId?: unknown };
  const implicit = implicitIdOf(req.publicKey);
  if (!implicit) return fail(400, "Send { publicKey: 'ed25519:…' }.");
  const named = req.accountId;
  if (named !== undefined && (typeof named !== "string" || named.length > 64 || !NAMED.test(named)))
    return fail(400, "accountId must look like name.testnet (lowercase letters, digits, - and _).");
  const accountId = (named as string | undefined) ?? implicit;

  // Count the attempt first, so failures and retries also use up the address's daily slots.
  const slot = await takeSlot(deps.counters, deps.limits, ip, (deps.now ?? (() => new Date()))());
  if (!slot.ok)
    return fail(
      429,
      slot.reason === "ip"
        ? "Daily limit reached for this address. Try again tomorrow, or use demo mode."
        : "The faucet has given out today's testnet NEAR. Try again tomorrow, or use demo mode.",
    );

  try {
    if (await deps.sender.accountExists(accountId)) return fail(409, "That account already exists.");
    const txHash = named
      ? await deps.sender.createNamed(accountId, req.publicKey as string, deps.amount)
      : await deps.sender.fundImplicit(accountId, deps.amount);
    return { status: 200, body: { accountId, txHash, amount: deps.amount } };
  } catch (e) {
    console.error("faucet send failed", e);
    return fail(502, "The faucet could not reach testnet. Try again later.");
  }
}
