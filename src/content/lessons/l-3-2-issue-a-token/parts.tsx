/**
 * What both views show in HTML (2D under the drawing, 3D in the book scene's panel): the token, the
 * refused transfer, the storage deposit, the relayer. Same words, same test ids. Also the pick labels and
 * the one-sentence description of the figure.
 */
import { bytesText, nearText } from "../l-3-1-deploy-a-contract/contract";
import { short } from "../l-3-1-deploy-a-contract/parts";
import { FRIEND, SEND_AMOUNT, tokens, type Obj } from "./ft";
import { GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";
import type { Token } from "./useToken";

export { short };

/** The pick button's name for each object, the same in 2D and 3D. */
export function pickLabel(t: Token, o: Obj): string {
  switch (o) {
    case "me":
      return `Mailbox: your account, ${t.parent ? short(t.parent.id, 30) : "…"}`;
    case "stamp":
      return t.step === MINT && !t.minted
        ? `Minting stamp: mint ${t.symbol} tokens`
        : "Minting stamp: token details";
    case "friend":
      return t.step === REGISTER && !t.registered
        ? `Mailbox: ${FRIEND}, pay its storage deposit`
        : `Mailbox: ${FRIEND}`;
    case "padlock":
      return t.step === TRAP && !t.refused
        ? `Padlock: send ${SEND_AMOUNT} ${t.symbol} to ${FRIEND}`
        : "Storage padlock";
    case "relayer":
      return `Mailbox: the relayer, ${t.relayerId}`;
    case "parcel":
      return t.step === GASLESS && !t.relayed
        ? "Parcel: sign the gasless transfer"
        : "Parcel: the signed delegate action";
  }
}

/** One sentence: what the figure shows at this step (screen readers, the 2D group label). */
export function describe(t: Token): string {
  const me = t.minted
    ? `Your mailbox holds ${tokens(t.myBalance, t.symbol)}.`
    : "Your mailbox has no tokens yet.";
  if (t.step === HOOK || t.step === MINT) return `${me} A minting stamp stands beside it.`;
  const lock = t.registered
    ? "The padlock on it is open."
    : t.refused
      ? "A red padlock hangs on it."
      : "A padlock hangs on it.";
  const friend = `${FRIEND}'s mailbox holds ${tokens(t.friendBalance, t.symbol)}. ${lock}`;
  if (t.step === GASLESS)
    return `${me} ${friend} The relayer ${t.relayed ? `delivered ${t.relayed} signed parcel${t.relayed === 1 ? "" : "s"}` : "waits for your signed parcel"}.`;
  return `${me} ${friend}`;
}

/** The one-line answer to the last pick: a "not yet" hint or a detail. */
export function PickNote({ t }: { t: Token }) {
  const r = t.picked?.result;
  if (!r || "act" in r) return null;
  const notYet = "notYet" in r;
  return (
    <p className={`tok-hint${notYet ? " notyet" : ""}`} role="status" data-testid="pick-note">
      {notYet ? r.notYet : r.detail}
    </p>
  );
}

export function Facts({ t, compact = false }: { t: Token; compact?: boolean }) {
  const { step } = t;
  return (
    <div className={`tok-facts${compact ? " compact" : ""}`} data-testid="token-facts">
      {t.error ? (
        <p className="tok-warn" role="alert">
          {t.error}
        </p>
      ) : null}
      <PickNote t={t} />
      {t.demoOnly && step >= MINT && step <= GASLESS ? (
        <p className="tok-soft" data-testid="demo-only">
          This app has no token contract for testnet yet, so this lesson runs in demo mode.
        </p>
      ) : null}
      {step === MINT || (step > MINT && step <= GASLESS && t.minted) ? <TokenFacts t={t} /> : null}
      {step === TRAP && t.refused ? <Refused t={t} /> : null}
      {step === REGISTER ? <Storage t={t} /> : null}
      {step === GASLESS ? <Relay t={t} /> : null}
    </div>
  );
}

function TokenFacts({ t }: { t: Token }) {
  if (!t.minted)
    return (
      <p className="tok-soft">
        The token will live on its own account, <code>{t.tokenId ?? "token.…"}</code>.
        {t.parent?.make ? (
          <>
            {" "}
            Your practice account is a hex id, so the lesson first makes the short name{" "}
            <code>{t.parent.id}</code> for it.
          </>
        ) : null}
      </p>
    );
  return (
    <dl className="tok-list">
      <dt>Token</dt>
      <dd>
        <strong data-testid="token-symbol">{t.minted.symbol}</strong> on <code>{t.tokenId}</code>
      </dd>
      <dt>You hold</dt>
      <dd data-testid="my-balance">{tokens(t.myBalance, t.symbol)}</dd>
      {t.step >= TRAP ? (
        <>
          <dt>{FRIEND} holds</dt>
          <dd data-testid="friend-balance">{tokens(t.friendBalance, t.symbol)}</dd>
        </>
      ) : null}
    </dl>
  );
}

function Refused({ t }: { t: Token }) {
  return (
    <p data-testid="refusal">
      <strong>Refused:</strong> {t.refused}{" "}
      <span className="tok-soft">Nothing moved. The gas for the attempt was still spent.</span>
    </p>
  );
}

function Storage({ t }: { t: Token }) {
  if (!t.registered)
    return (
      <p className="tok-soft">
        storage_deposit attaches {nearText(t.deposit)} NEAR. The token contract keeps it locked for {FRIEND}'s
        balance record.
      </p>
    );
  return (
    <section aria-label="Storage deposit" className="tok-storage">
      <div
        className="tok-gauge"
        role="img"
        aria-label={`${Math.round(t.gauge.share * 100)}% of the token contract's balance is locked for storage`}
      >
        <span className="tok-gauge-lock" style={{ width: `${Math.max(2, t.gauge.share * 100)}%` }} />
      </div>
      <dl className="tok-list">
        <dt>Registered</dt>
        <dd data-testid="registered">
          {FRIEND}, for <strong>{nearText(t.deposit)} NEAR</strong>
        </dd>
        <dt>New record</dt>
        <dd>{bytesText(t.registered.bytes)} in the token contract</dd>
        <dt>Token contract</dt>
        <dd>
          {nearText(t.gauge.lock)} NEAR locked for storage, {nearText(t.gauge.available)} NEAR available
        </dd>
      </dl>
    </section>
  );
}

function Relay({ t }: { t: Token }) {
  return (
    <dl className="tok-list" data-testid="relay-facts">
      <dt>Relayer</dt>
      <dd>
        <code>{t.relayerId}</code>
        {t.relay ? (
          <>
            {" "}
            ·{" "}
            <span data-testid="relay-left">
              {t.relay.remaining} of {t.relay.cap} left this visit
            </span>
          </>
        ) : null}
      </dd>
      {t.relayed ? (
        <>
          <dt>Delivered</dt>
          <dd data-testid="relay-delivered">
            {t.relayed} × {tokens(SEND_AMOUNT, t.symbol)}, about {t.relay?.gasTgas} Tgas paid by the relayer
            each time
          </dd>
          <dt>Your NEAR</dt>
          <dd data-testid="my-near">
            {t.myNear && t.myNear.before === t.myNear.after
              ? `unchanged: ${nearText(t.myNear.after)} NEAR`
              : t.myNear
                ? `${nearText(t.myNear.before)} → ${nearText(t.myNear.after)} NEAR`
                : "…"}
          </dd>
        </>
      ) : null}
      {t.relayRefused ? (
        <>
          <dt>Refused</dt>
          <dd data-testid="relay-refused">{t.relayRefused}</dd>
        </>
      ) : null}
    </dl>
  );
}
