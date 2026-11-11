/**
 * The facts both views show in HTML (2D under the drawing, 3D in the book scene's panel), and the
 * path box docked with the step's buttons. Same words, same test ids in both views.
 */
import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatEther, formatGwei } from "viem";
import { ActionSlot } from "../../../ui/SceneAction";
import {
  SEPOLIA_CHAIN_ID,
  SIGN_DEPOSIT,
  SIGNER_CONTRACT,
  type RsvSignature,
} from "../../../chain/chainSignatures";
import { formatNear } from "../../../chain/units";
import { NODES, secondsLeft, shortHex, shortName } from "./signing";
import { DERIVE, HOOK, PREPARE, SIGN, VERIFY, type ChainSig, type Picked } from "./useChainSig";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** What a picked object is, in one line. */
const PICK_NOTE: Record<Exclude<Picked, null>, string> = {
  near: "Your NEAR account. It is the only account you sign in with.",
  ring: "The signing nodes. Each one holds a key share, never the whole key.",
  signer: `The signer contract, ${SIGNER_CONTRACT}. It takes sign requests and hands them to the nodes.`,
  ethereum:
    "Ethereum, here its Sepolia test network: a chain of its own. Normally you need its own wallet and private key. The address you derive lives here, as a normal Ethereum account.",
  address: "Your derived Ethereum address. NEAR controls it through the signing network.",
  parcel: "The Ethereum transaction: a transfer on Sepolia, from your derived address.",
};

export const pickLabels = {
  near: "Your NEAR account",
  ring: "The signing nodes",
  signer: "The signer contract",
  address: "Your derived Ethereum address",
  parcel: "The Ethereum transaction",
  ethereum: "Ethereum (Sepolia)",
} as const;

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

export function Facts({ cs, compact = false }: { cs: ChainSig; compact?: boolean }) {
  const { step, account, prepared, result } = cs;
  return (
    <div className={`csg-facts${compact ? " compact" : ""}`}>
      {step === HOOK ? (
        <p className="csg-line">
          One NEAR account, <strong>{cs.me ? shortName(cs.me) : "yours"}</strong>. One Ethereum address to
          control, with no Ethereum key.
        </p>
      ) : null}

      {step === DERIVE ? (
        <dl className="csg-dl">
          <Row label="NEAR account">
            <code>{cs.me ? shortName(cs.me) : "…"}</code>
          </Row>
          <Row label="Path">
            <code>{cs.path}</code>
          </Row>
          <Row label="Ethereum address" testId="eth-address">
            {account ? <code>{account.address}</code> : cs.deriving ? "working it out…" : "not derived yet"}
          </Row>
          <Row label="Cost">0 NEAR, no transaction</Row>
        </dl>
      ) : null}

      {step === PREPARE ? (
        prepared && account ? (
          <dl className="csg-dl">
            <Row label="From">
              <code>{shortHex(account.address)}</code>
            </Row>
            <Row label="To">yourself (the same address)</Row>
            <Row label="Value">{formatEther(prepared.fields.value ?? 0n)} ETH</Row>
            <Row label="Gas">
              {Number(prepared.fields.gas).toLocaleString("en")} at most{" "}
              {formatGwei(prepared.fields.maxFeePerGas ?? 0n)} gwei
            </Row>
            <Row label="Nonce">{prepared.fields.nonce}</Row>
            <Row label="Network">Sepolia (chain {SEPOLIA_CHAIN_ID})</Row>
            <Row label="Balance" testId="eth-balance">
              0 ETH (a new address)
            </Row>
            <Row label="Payload hash (32 bytes)" testId="payload">
              <code>{prepared.payload}</code>
            </Row>
          </dl>
        ) : (
          <p className="csg-line">
            From <code>{account ? shortHex(account.address) : "…"}</code>, a transfer on Sepolia. Not packed
            yet.
          </p>
        )
      ) : null}

      {step === SIGN ? (
        <>
          <dl className="csg-dl">
            <Row label="Call">
              <code>{SIGNER_CONTRACT}</code> sign()
            </Row>
            <Row label="Deposit">{String(SIGN_DEPOSIT)} yoctoNEAR</Row>
            <Row label="Path">
              <code>{cs.path}</code>
            </Row>
            {result ? (
              <>
                <Row label="NEAR transaction" testId="mpc-tx">
                  <code>{shortHex(result.txHash, 10, 6)}</code>
                </Row>
                <Row label="Fee burnt">{formatNear(result.tokensBurnt, 5)} NEAR</Row>
                <Rsv sig={result.signature} prefix="sig" />
              </>
            ) : null}
          </dl>
          <SignStatus cs={cs} />
        </>
      ) : null}

      {step === VERIFY ? (
        <>
          <dl className="csg-dl">
            {result ? <Rsv sig={result.signature} prefix="tx" /> : null}
            {cs.signed ? (
              <Row label="Signed transaction">
                <code>{shortHex(cs.signed, 12, 6)}</code>
              </Row>
            ) : null}
            <Row label="Recovered signer" testId="recovered">
              {cs.recovered ? <code>{cs.recovered}</code> : "not checked yet"}
            </Row>
            <Row label="Derived address" testId="derived">
              <code>{account?.address ?? "…"}</code>
            </Row>
          </dl>
          {cs.recovered ? (
            <p className={`csg-match${cs.match ? " ok" : " bad"}`} data-testid="match" role="status">
              {cs.match
                ? "Match: the signature was made for your derived address."
                : "No match: the signature points to another address."}
            </p>
          ) : null}
          {!cs.signed ? (
            <p className="csg-warn" role="alert">
              No signature yet. Go back one step and request it.
            </p>
          ) : null}
          {cs.recovered ? (
            <p className="csg-note" data-testid="broadcast-note">
              Not sent to Sepolia: your derived address starts with 0 ETH, and Ethereum needs ETH to pay its
              gas. These signed bytes could be broadcast once the address is funded, by a faucet or a gas
              relayer.
            </p>
          ) : null}
        </>
      ) : null}

      {cs.problem ? (
        <p className="csg-warn" role="alert" data-testid="problem">
          {cs.problem}
        </p>
      ) : null}
      {step >= DERIVE && step <= VERIFY && cs.network === "demo" ? (
        <p className="csg-note" data-testid="demo-note">
          Demo mode: the app plays the signing network with one demo key. The math is real, but no real nodes
          take part, so the address differs from your testnet one.
        </p>
      ) : null}
      {cs.picked ? (
        <p className="csg-note" data-testid="picked-note">
          {PICK_NOTE[cs.picked]}
        </p>
      ) : null}
    </div>
  );
}

/** The signature's three values, as they sit in the Ethereum transaction's signature fields. */
function Rsv({ sig, prefix }: { sig: RsvSignature; prefix: string }) {
  return (
    <>
      <Row label="r (32 bytes)" testId={`${prefix}-r`}>
        <code>{sig.r}</code>
      </Row>
      <Row label="s (32 bytes)" testId={`${prefix}-s`}>
        <code>{sig.s}</code>
      </Row>
      <Row label="v (recovery id)" testId={`${prefix}-v`}>
        <code>{sig.yParity}</code>
      </Row>
    </>
  );
}

/** The request's progress: sending, waiting (the timer and the shares), answered. */
function SignStatus({ cs }: { cs: ChainSig }) {
  const text =
    cs.phase === "sending"
      ? "Sending your request to NEAR…"
      : cs.phase === "waiting"
        ? `Waiting for the signing network… ${secondsLeft(cs.elapsed) > 0 ? `about ${secondsLeft(cs.elapsed)} s left` : "any moment now"}`
        : cs.phase === "answered" && cs.result
          ? `Signed. The answer came ${cs.result.waitBlocks} blocks after your request, ${secs(cs.result.ms)} in all.`
          : cs.phase === "failed"
            ? "No signature. Try again."
            : "Not requested yet.";
  return (
    <p className={`csg-status ${cs.phase}`} role="status" data-testid="sign-status">
      {text}
      {cs.phase === "waiting" ? (
        <span className="csg-shares" aria-hidden="true">
          {Array.from({ length: NODES }, (_, i) => (
            <i key={i} className={i < cs.lit ? "on" : ""} />
          ))}
        </span>
      ) : null}
    </p>
  );
}

/** Step 2's path box, docked above the lesson card with the step's button. */
export function PathForm({ cs }: { cs: ChainSig }) {
  const slot = useContext(ActionSlot);
  const form = (
    <form className="csg-form" aria-label="Derivation path" onSubmit={(e) => e.preventDefault()}>
      <label>
        <span>Path</span>
        <input
          value={cs.pathText}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          maxLength={80}
          aria-describedby="csg-path-hint"
          data-testid="path-input"
          onChange={(e) => cs.editPath(e.target.value)}
        />
      </label>
      <p id="csg-path-hint" className="csg-hint">
        {cs.pathCheck.ok ? "Any label works. Another path gives another address." : cs.pathCheck.why}
      </p>
    </form>
  );
  return slot ? createPortal(form, slot) : form;
}
