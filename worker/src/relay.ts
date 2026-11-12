/**
 * POST /relay { signedDelegate } → { txHash, relayerId, remaining, cap }
 *
 * Lesson 3.2's relayer (NEP-366 meta-transactions). The learner signs a `SignedDelegateAction` in the
 * browser (base64 borsh); the relayer account wraps it in its own transaction and pays the gas.
 * It only sponsors plain contract calls with at most 1 yoctoNEAR attached each (the relayer pays any
 * attached deposit) and a small gas budget, and at most `perAccountDaily` relays per learner account
 * (plus a per-address and a global daily cap), so the relayer cannot be drained.
 */
import { decodeSignedDelegateAction, type SignedDelegateAction } from "near-kit";
import { takeSlot, type CounterStore } from "./limits";

export interface RelaySender {
  relayerId: string;
  /** Wrap the signed delegate action in a transaction from the relayer and send it. Returns its hash. */
  relay(signed: SignedDelegateAction): Promise<string>;
}

export interface RelayLimits {
  perAccountDaily: number;
  perIpDaily: number;
  globalDaily: number;
}

export interface RelayDeps {
  sender: RelaySender | null;
  counters: CounterStore;
  limits: RelayLimits;
  now?: () => Date;
}

/** Most gas one sponsored meta-transaction may attach in total: 50 Tgas. */
export const MAX_RELAY_GAS = 50n * 10n ** 12n;
/** Biggest payload accepted (base64). A token transfer is a few hundred bytes. */
export const MAX_RELAY_PAYLOAD = 4096;

type Reply = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Reply => ({ status, body: { error } });

interface Decoded {
  senderId: string;
  actions: { functionCall?: { gas: bigint; deposit: bigint } }[];
}

/** Why the relayer will not sponsor this delegate action, or null when it will. */
export function relayProblem(d: Decoded): string | null {
  if (!d.actions.length) return "The delegate action has no actions.";
  let gas = 0n;
  for (const a of d.actions) {
    if (!a.functionCall) return "The relayer only pays for contract calls.";
    if (BigInt(a.functionCall.deposit) > 1n)
      return "The relayer only pays for calls with at most 1 yoctoNEAR attached.";
    gas += BigInt(a.functionCall.gas);
  }
  if (gas > MAX_RELAY_GAS) return "The relayer pays for at most 50 Tgas per meta-transaction.";
  return null;
}

export async function relay(input: unknown, ip: string, deps: RelayDeps): Promise<Reply> {
  if (!deps.sender) return fail(503, "The relayer is not set up yet.");
  const payload = (input as { signedDelegate?: unknown } | null)?.signedDelegate;
  if (typeof payload !== "string" || !payload || payload.length > MAX_RELAY_PAYLOAD)
    return fail(400, "Send { signedDelegate } as a base64 string.");
  let signed: SignedDelegateAction;
  let d: Decoded;
  try {
    signed = decodeSignedDelegateAction(payload);
    d = signed.signedDelegate.delegateAction as unknown as Decoded;
  } catch {
    return fail(400, "That is not a signed delegate action.");
  }
  const problem = relayProblem(d);
  if (problem) return fail(400, problem);

  const now = deps.now?.() ?? new Date();
  const { perAccountDaily, perIpDaily, globalDaily } = deps.limits;
  // Per learner first, so one learner reaching the cap does not use up their address's slots.
  const mine = await takeSlot(
    deps.counters,
    { perIpDaily: perAccountDaily, globalDaily },
    d.senderId,
    now,
    "relay",
  );
  if (!mine.ok)
    return fail(
      429,
      mine.reason === "ip"
        ? `The relayer has paid for ${perAccountDaily} meta-transactions for ${d.senderId} today. That is its cap, so it refused this one.`
        : "The relayer has used today's budget. Try again tomorrow.",
    );
  const addr = await takeSlot(deps.counters, { perIpDaily, globalDaily: Infinity }, ip, now, "relay-ip");
  if (!addr.ok) return fail(429, "Too many meta-transactions from this address today. Try again tomorrow.");

  const day = now.toISOString().slice(0, 10);
  const used = await deps.counters.get(`relay:ip:${day}:${d.senderId}`);
  try {
    const txHash = await deps.sender.relay(signed);
    return {
      status: 200,
      body: { txHash, relayerId: deps.sender.relayerId, remaining: Math.max(0, perAccountDaily - used), cap: perAccountDaily },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(502, `The network did not accept the meta-transaction: ${message.slice(0, 200)}`);
  }
}
