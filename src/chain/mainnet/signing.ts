import { formatNear } from "../units";
import type { MainnetWallet, SigningAction, SigningPreview, SigningRefusal, SigningRequest } from "./types";

const depositOf = (a: SigningAction) => a.deposit;

function lineFor(a: SigningAction): string {
  if (a.type === "Transfer") return `Send ${formatNear(a.deposit, 6)} NEAR.`;
  return `Call "${a.methodName}"${a.deposit > 0n ? ` and attach ${formatNear(a.deposit, 6)} NEAR` : ""}.`;
}

/** What the confirmation will show. The total is computed here from the actions, not supplied by the caller. */
export function describeSigning(kind: MainnetWallet["kind"], req: SigningRequest): SigningPreview {
  const total = req.actions.reduce((sum, a) => sum + depositOf(a), 0n);
  return {
    summary: req.summary,
    receiverId: req.receiverId,
    amountNear: formatNear(total, 6),
    lines: req.actions.map(lineFor),
    warning:
      kind === "mainnet"
        ? "This is real money on NEAR mainnet. It cannot be undone."
        : "This is a simulation in demo mode. No real money moves.",
  };
}

export type SigningOutcome = { ok: true; txHash: string } | { ok: false; reason: SigningRefusal };

/**
 * The only way to sign. Checks the request, shows the learner what it does and how much (via
 * `confirm`), and only if they say yes asks the wallet. A decline, a missing wallet or a bad
 * request never reaches the wallet.
 */
export async function signWithConfirmation(
  wallet: MainnetWallet,
  request: SigningRequest,
  confirm: (preview: SigningPreview) => Promise<boolean>,
): Promise<SigningOutcome> {
  const state = wallet.state();
  if (state.status !== "connected") return { ok: false, reason: "no-wallet" };
  if (!request.receiverId || request.actions.length === 0 || request.actions.some((a) => a.deposit < 0n))
    return { ok: false, reason: "invalid-request" };
  const total = request.actions.reduce((sum, a) => sum + depositOf(a), 0n);
  if (total > state.balance) return { ok: false, reason: "not-enough" };
  if (!(await confirm(describeSigning(wallet.kind, request)))) return { ok: false, reason: "declined" };
  const { txHash } = await wallet.signAndSend(request);
  return { ok: true, txHash };
}
