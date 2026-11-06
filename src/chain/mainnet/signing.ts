import { checkFunds } from "./funds";
import { formatNear } from "../units";
import type { MainnetWallet, SigningAction, SigningPreview, SigningRefusal, SigningRequest } from "./types";

const SMALLEST_SHOWN = 10n ** 18n; // 0.000001 NEAR, the smallest amount formatNear(x, 6) can show

/** "0.5 NEAR", or "less than 0.000001 NEAR" for a tiny non-zero amount. Never "0 NEAR" for money. */
function nearText(yocto: bigint): string {
  if (yocto > 0n && yocto < SMALLEST_SHOWN) return "less than 0.000001 NEAR";
  return `${formatNear(yocto, 6)} NEAR`;
}

function argsText(args: object): string {
  const json = JSON.stringify(args) ?? "{}";
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

function lineFor(a: SigningAction): string {
  if (a.type === "Transfer") return `Send ${nearText(a.deposit)}.`;
  const attach = a.deposit > 0n ? ` and attach ${nearText(a.deposit)}` : "";
  return `Call "${a.methodName}" with ${argsText(a.args)}${attach}.`;
}

const totalOf = (req: SigningRequest) => req.actions.reduce((sum, a) => sum + a.deposit, 0n);

/** What the confirmation will show. The total is computed here from the actions, not supplied by the caller. */
export function describeSigning(kind: MainnetWallet["kind"], req: SigningRequest): SigningPreview {
  const total = totalOf(req);
  return {
    summary: req.summary,
    receiverId: req.receiverId,
    amountNear: total > 0n && total < SMALLEST_SHOWN ? "less than 0.000001" : formatNear(total, 6),
    amountText: nearText(total),
    lines: req.actions.map(lineFor),
    feeNote: "The network fee (gas) is paid on top of this amount, from the same account.",
    warning:
      kind === "mainnet"
        ? "This is real money on NEAR mainnet. It cannot be undone."
        : "This is a simulation in demo mode. No real money moves.",
  };
}

export type SigningOutcome =
  | { ok: true; txHash: string }
  | { ok: false; reason: Exclude<SigningRefusal, "failed" | "unconfirmed">; message?: undefined }
  | { ok: false; reason: "failed" | "unconfirmed"; message: string };

/** One signing at a time per wallet, from the first check until the wallet answers. */
const inFlight = new WeakSet<MainnetWallet>();

/**
 * The only way to sign. Checks the request, shows the learner what it does and how much (via
 * `confirm`), and only if they say yes asks the wallet. A decline, a missing wallet, a bad
 * request, too little money or a second signing at the same time never reaches the wallet.
 * A wallet that rejects (popup closed, network down, transaction failed) gives
 * `{ ok: false, reason: "failed", message }`; this function does not throw.
 */
export async function signWithConfirmation(
  wallet: MainnetWallet,
  request: SigningRequest,
  confirm: (preview: SigningPreview) => Promise<boolean>,
): Promise<SigningOutcome> {
  if (inFlight.has(wallet)) return { ok: false, reason: "busy" };
  inFlight.add(wallet);
  try {
    const first = precheck(wallet, request);
    if (first) return first;
    if (!(await confirm(describeSigning(wallet.kind, request)))) return { ok: false, reason: "declined" };
    // The balance may have changed while the dialog was open: read it again.
    try {
      await wallet.refresh();
    } catch {
      return {
        ok: false,
        reason: "failed",
        message: "We could not check your balance just now. Nothing was sent. Please try again.",
      };
    }
    const second = precheck(wallet, request);
    if (second) return second;
    try {
      const { txHash } = await wallet.signAndSend(request);
      if (txHash === null)
        return {
          ok: false,
          reason: "unconfirmed",
          message:
            "Your wallet did not say whether this went through. Check your wallet's history before you try again.",
        };
      return { ok: true, txHash };
    } catch (e) {
      return {
        ok: false,
        reason: "failed",
        message: e instanceof Error && e.message ? e.message : "The wallet did not finish the transaction.",
      };
    }
  } finally {
    inFlight.delete(wallet);
  }
}

/** Same rules as `checkFunds`: the amount plus the fee reserve must be covered. */
function precheck(wallet: MainnetWallet, request: SigningRequest): SigningOutcome | null {
  const state = wallet.state();
  if (state.status !== "connected") return { ok: false, reason: "no-wallet" };
  if (!request.receiverId || request.actions.length === 0 || request.actions.some((a) => a.deposit < 0n))
    return { ok: false, reason: "invalid-request" };
  if (checkFunds(state, { amount: totalOf(request) }).kind !== "enough")
    return { ok: false, reason: "not-enough" };
  return null;
}
