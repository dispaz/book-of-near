import { lazy, Suspense, useEffect, useId, useRef, type ReactNode } from "react";
import type { SceneProps } from "../../../app/types";
import { SceneAction } from "../../../ui/SceneAction";
import { Check, HonestTake, type CheckQuestion } from "../../../lesson-kit";
import { NEAR_PATH, newPhrase, shownSecret, type PracticeKeyPair } from "./wallet";
import { CONVERT_STAGES, STEP, useWallet, type Verdict, type Wallet } from "./useWallet";
import { WalletArt } from "./WalletArt";
import { useFreeFrame } from "./frame";
import "./wallet.css";

// The 3D view loads only when the learner picks it, so 2D never downloads three.js.
const Scene3D = lazy(() => import("./Scene3D"));

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: 'A website asks you to paste your seed phrase to "verify your wallet". What should you do?',
    options: [
      { text: "Close the page. Real wallets never need your seed phrase on a website.", correct: true },
      {
        text: "Paste it; the site only reads it.",
        why: "Whoever sees the phrase can rebuild your keys and take your funds.",
      },
      {
        text: "Paste only the first six words.",
        why: "That leaks half your secret and still helps an attacker.",
      },
    ],
  },
  {
    prompt: "You change one letter of a signed message. What happens when someone verifies it?",
    options: [
      { text: "Verification fails, because the signature no longer matches the message.", correct: true },
      {
        text: "It still passes, because the public key is the same.",
        why: "The check covers the message too, not only the key.",
      },
      { text: "The signature updates itself.", why: "Only the private key can make a new signature." },
      { text: "The private key is revealed.", why: "Verifying never exposes the private key." },
    ],
  },
  {
    prompt: "What is a NEAR implicit account address?",
    options: [
      { text: "The 32-byte ed25519 public key written as 64 hex characters.", correct: true },
      {
        text: "The last 20 bytes of the Keccak-256 hash of the public key.",
        why: "That is the Ethereum rule.",
      },
      { text: "A readable name like ana.testnet.", why: "That is a named account." },
      {
        text: "The seed phrase joined with dashes.",
        why: "The seed phrase is secret and is never an address.",
      },
    ],
  },
];

export default function Scene({ step, goTo, setGate, reducedMotion, mode, view, flat }: SceneProps) {
  // One state for both views: switching 2D and 3D keeps every key, value and gate.
  const w = useWallet({ step, setGate, reducedMotion, mode });
  const { keys, signed, verdict, cleared } = w;
  const rootRef = useRef<HTMLDivElement>(null);
  // The free part of the screen, so the 3D picture sits between the cards instead of under them.
  const measured = useFreeFrame(rootRef, [step, view]);

  // Keep each new result in view: on phones the panel is short and scrolls.
  useEffect(() => {
    const panel = rootRef.current?.querySelector<HTMLElement>(".wallet-panel");
    const el = panel?.querySelector<HTMLElement>("[data-reveal]");
    if (!panel || !el) return;
    const p = panel.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.bottom > p.bottom) panel.scrollTop += r.bottom - p.bottom + 12;
  }, [step, w.rebuilt, w.convert, signed, verdict, cleared]);

  const panelTitle = step === STEP.warning ? "Read this first" : "Practice wallet";
  const showPanel = step < STEP.check;

  return (
    <div
      ref={rootRef}
      className={`wallet-scene view-${view}`}
      data-scene-state={w.state}
      data-mode={mode}
      // 3D on tablets: no room beside the picture, so the step note stays docked (StepNote reads this).
      // 2D has its own column for the drawing; under 1100px the drawing is hidden and the note docks anyway.
      data-notes={view === "3d" && measured && !measured.noteRoom ? "dock" : undefined}
    >
      {view === "3d" ? (
        <Suspense fallback={<p className="visually-hidden">Loading the 3D view…</p>}>
          <Scene3D w={w} step={step} reducedMotion={reducedMotion} flat={flat} measured={measured} />
        </Suspense>
      ) : (
        <WalletArt
          focus={w.focus}
          verdict={step === STEP.verify ? verdict : null}
          reducedMotion={reducedMotion}
        />
      )}
      {showPanel ? (
        <section className="lesson-panel wallet-panel" aria-label={panelTitle} data-step={step}>
          <h2 className="panel-title">{panelTitle}</h2>
          <PanelBody w={w} step={step} goTo={goTo} mode={mode} />
        </section>
      ) : null}

      {step === STEP.generate && !keys ? (
        <SceneAction onClick={w.generate} disabled={!w.ack}>
          Generate
        </SceneAction>
      ) : null}
      {step === STEP.seed && keys ? <SceneAction onClick={w.rebuild}>Rebuild from words</SceneAction> : null}
      {step === STEP.address && keys && w.convert === 0 ? (
        <SceneAction onClick={w.startConvert}>Turn it into an address</SceneAction>
      ) : null}
      {step === STEP.sign && keys ? (
        <SceneAction onClick={w.doSign} disabled={!w.message.trim()}>
          Sign
        </SceneAction>
      ) : null}
      {step === STEP.verify && keys && signed ? <SceneAction onClick={w.doVerify}>Verify</SceneAction> : null}
      {step === STEP.custody && keys && !cleared ? (
        <SceneAction onClick={w.throwAway}>Throw the keys away</SceneAction>
      ) : null}

      {step === STEP.check ? <Check questions={QUESTIONS} passed={w.passed} onPass={w.pass} /> : null}
      {step === STEP.honest ? (
        <HonestTake
          comparedWith="Ethereum"
          strengths={[
            "Readable names and new keys. A NEAR named account like ana.near is easy to remember and share, and one account can hold several keys. If a key leaks, you can swap it and keep the account. On Ethereum a normal address comes from one key, so a leaked key means moving to a new address.",
            "Address without a transaction. An implicit account address can be made fully offline from a key pair, like an Ethereum address.",
            "Standard seed phrases. NEAR uses BIP-39 words and its registered number 397, so the same words rebuild the same key in any NEAR wallet that follows the standards.",
          ]}
          weaknesses={[
            "Implicit addresses are long and unreadable. 64 hex characters are easy to mistype, and an implicit account must receive NEAR before it can sign anything.",
            "Two account styles to learn. Beginners meet hex accounts, named accounts and Ethereum-style 0x accounts on one chain.",
            "The seed phrase is a single point of failure. Lose it and the keys are gone; leak it and they are stolen. This is true on Bitcoin and Ethereum too. The same words in an Ethereum wallet give a different address, because the key type and path differ.",
          ]}
        />
      ) : null}
    </div>
  );
}

/** The panel's content for the current step. Both views show it. */
function PanelBody({
  w,
  step,
  goTo,
  mode,
}: {
  w: Wallet;
  step: number;
  goTo: (n: number) => void;
  mode: SceneProps["mode"];
}) {
  const { keys, signed, cleared } = w;
  if (step === STEP.warning) return <WarningCard ack={w.ack} onAck={w.acknowledge} />;
  if (w.needsKeys)
    return (
      <div className="w-empty">
        <p>
          <strong>No practice keys on this page right now.</strong> We never save them, so they are gone after
          a reload or after you throw them away.
        </p>
        <button className="btn" onClick={() => goTo(STEP.generate)}>
          Make new keys
        </button>
      </div>
    );
  if (step === STEP.generate) {
    if (!w.ack)
      return (
        <div className="w-empty">
          <p>
            <strong>Read the warning first.</strong> Generate stays locked until you tick the box.
          </p>
          <button className="btn" onClick={() => goTo(STEP.warning)}>
            Go to the warning
          </button>
        </div>
      );
    if (!keys) return <p className="w-hint">Press Generate below. Your keys will appear here.</p>;
    return (
      <>
        <Throwaway docsExample={w.isDocsExample} />
        <KeyRow
          icon="key"
          title="Private key"
          note="Secret. It signs."
          testId="secret-key"
          value={shownSecret(keys, w.showSecret)}
          masked={!w.showSecret}
          extra={
            <button className="w-link" aria-pressed={w.showSecret} onClick={w.toggleSecret}>
              {w.showSecret ? "Hide private key" : "Show private key"}
            </button>
          }
        />
        <KeyRow
          icon="lock"
          title="Public key"
          note="Share it. It checks signatures."
          testId="public-key"
          value={keys.publicKey}
        />
        <p className="w-offline">
          <span className="w-badge">Offline</span> Made in this browser. Network requests since you pressed
          Generate: <strong data-testid="network-count">{w.requests}</strong>
        </p>
        <button className="w-link" onClick={() => w.loadKeys(newPhrase(), false)}>
          {mode === "demo" && w.isDocsExample ? "Make a random key instead" : "Make another random key"}
        </button>
      </>
    );
  }
  if (step === STEP.seed && keys)
    return (
      <>
        <Throwaway docsExample={w.isDocsExample} compact />
        <div className="w-paper">
          <p className="w-paper-head">
            <span className="w-label">Seed phrase · 12 words (BIP-39)</span>
            <span className="w-stamp">Practice only</span>
          </p>
          <ol className="w-words" data-testid="seed-words">
            {keys.phrase.split(" ").map((word, i) => (
              <li key={i}>{word}</li>
            ))}
          </ol>
          <p className="w-small">
            Path <code>{NEAR_PATH}</code> → ed25519 key
          </p>
        </div>
        {w.rebuilt ? (
          <p className="w-result ok" role="status" data-reveal>
            <span aria-hidden="true">✓ </span>Rebuilt from the words. Same public key:{" "}
            <code data-testid="rebuilt-key">{w.rebuilt}</code>
          </p>
        ) : (
          <p className="w-hint">Press Rebuild from words. The browser turns the 12 words back into keys.</p>
        )}
      </>
    );
  if (step === STEP.address && keys)
    return (
      <AddressSteps
        keys={keys}
        stage={w.convert}
        converting={w.converting}
        onSkip={w.skipConvert}
        copied={w.copied}
        onCopy={w.copy}
      />
    );
  if (step === STEP.compare && keys)
    return (
      <CompareCards flipped={w.flipped} onFlip={w.flip} eth={w.ethAddress} implicit={keys.implicitAccount} />
    );
  if (step === STEP.sign && keys)
    return (
      <>
        <Throwaway docsExample={w.isDocsExample} compact />
        <label className="w-field">
          <span className="w-label">Message</span>
          <input value={w.message} maxLength={80} onChange={(e) => w.setMessage(e.target.value)} />
        </label>
        {signed ? (
          <div className="w-result ok" role="status" data-reveal>
            <p>
              <span aria-hidden="true">✓ </span>Signed with your private key. Signature (64 bytes, base58):
            </p>
            <code className="w-mono" data-testid="signature">
              {signed.signature}
            </code>
            {signed.message !== w.message ? (
              <p className="w-small">You changed the message. Press Sign again to sign the new text.</p>
            ) : null}
          </div>
        ) : (
          <p className="w-hint">Press Sign. Your private key turns this message into a signature.</p>
        )}
      </>
    );
  if (step === STEP.verify && keys)
    return signed ? (
      <VerifyBox
        signed={signed}
        publicKey={keys.publicKey}
        checkMessage={w.checkMessage}
        onChange={w.changeCheckMessage}
        onTamper={w.tamper}
        verdict={w.verdict}
        saw={w.saw}
      />
    ) : (
      <div className="w-empty">
        <p>Sign a message first.</p>
        <button className="btn" onClick={() => goTo(STEP.sign)}>
          Go to signing
        </button>
      </div>
    );
  if (step === STEP.custody)
    return cleared ? (
      <p className="w-result ok" role="status" data-reveal>
        <span aria-hidden="true">✓ </span>Keys and words are gone from this page. Nothing was saved, so nobody
        can get them back. Not even you. That is self-custody.
      </p>
    ) : (
      <>
        <div className="w-custody">
          <p className="w-big">Who holds the key holds the account.</p>
          <ul>
            <li>Nobody can freeze your key.</li>
            <li>Nobody can reset it for you.</li>
            <li>Lose the words, lose the keys.</li>
          </ul>
        </div>
        <p className="w-hint">Press Throw the keys away. They are only practice keys.</p>
      </>
    );
  return null;
}

function WarningCard({ ack, onAck }: { ack: boolean; onAck: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="w-warning">
      <p className="w-warning-sign" aria-hidden="true">
        !
      </p>
      <h3 id={id}>Never type a real seed phrase into any website. This one included.</h3>
      <p>
        A <strong>seed phrase</strong> is a list of words that can rebuild your keys. Here you will only make
        throwaway practice keys. They stay in this page and vanish when you leave.
      </p>
      <label className="w-ack">
        <input type="checkbox" checked={ack} onChange={(e) => onAck(e.target.checked)} />
        <span>I understand: these keys are for practice only</span>
      </label>
    </div>
  );
}

function Throwaway({ docsExample, compact = false }: { docsExample: boolean; compact?: boolean }) {
  return (
    <div className={`w-throwaway${compact ? " compact" : ""}`}>
      <p>
        <strong>Throwaway practice key.</strong> Never send money to it.
      </p>
      {docsExample && !compact ? (
        <p className="w-small">
          This example is printed in NEAR&apos;s docs, so anyone can use it. Never put funds on it.
        </p>
      ) : null}
    </div>
  );
}

function KeyRow({
  icon,
  title,
  note,
  value,
  testId,
  masked = false,
  extra,
}: {
  icon: "key" | "lock";
  title: string;
  note: string;
  value: string;
  testId: string;
  masked?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="w-keyrow">
      <svg
        viewBox="0 0 40 40"
        className="w-icon"
        role="img"
        aria-label={icon === "key" ? "A key" : "A padlock"}
      >
        {icon === "key" ? (
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="13" cy="20" r="7" fill="var(--accent)" />
            <path d="M20 20h15M30 20v6M35 20v4" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M13 18v-5a7 7 0 0 1 14 0v5" />
            <rect x="9" y="18" width="22" height="16" rx="3" fill="#fff" />
            <circle cx="20" cy="26" r="2" fill="currentColor" />
          </g>
        )}
      </svg>
      <div className="w-keytext">
        <p className="w-label">
          {title} <span className="w-note">· {note}</span>
        </p>
        <code className={`w-mono${masked ? " masked" : ""}`} data-testid={testId}>
          {value}
        </code>
        {extra}
      </div>
    </div>
  );
}

function AddressSteps({
  keys,
  stage,
  converting,
  onSkip,
  copied,
  onCopy,
}: {
  keys: PracticeKeyPair;
  stage: number;
  converting: boolean;
  onSkip: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const bytes = Array.from(keys.publicBytes);
  const rows = [
    { label: "1. Public key (base58)", value: keys.publicKey },
    { label: "2. Decode: 32 numbers (bytes), each 0–255", value: bytes.join(" ") },
    {
      label: "3. Write each byte as 2 hex characters (0–9, a–f)",
      value: bytes.map((b) => b.toString(16).padStart(2, "0")).join(" "),
    },
  ];
  return (
    <>
      <ol className="w-convert">
        {rows.map((r, i) => (
          <li key={i} className={stage > i ? "shown" : "pending"} aria-hidden={stage > i ? undefined : true}>
            <p className="w-label">{r.label}</p>
            <code className="w-mono">{stage > i ? r.value : "…"}</code>
          </li>
        ))}
      </ol>
      {stage >= CONVERT_STAGES ? (
        <div className="w-result ok" role="status" data-reveal>
          <p className="w-label">4. Join them: your implicit account (64 characters)</p>
          <button className="w-address" onClick={onCopy} title="Copy address">
            <code data-testid="implicit-account">{keys.implicitAccount}</code>
          </button>
          <p className="w-small">
            {copied ? "Copied. " : "Tap it to copy. "}It becomes a real account only after someone sends it
            some NEAR.
          </p>
        </div>
      ) : converting ? (
        <button className="w-link" onClick={onSkip}>
          Skip the animation
        </button>
      ) : (
        <p className="w-hint">Press Turn it into an address. Watch the public key become hex.</p>
      )}
    </>
  );
}

function CompareCards({
  flipped,
  onFlip,
  eth,
  implicit,
}: {
  flipped: boolean[];
  onFlip: (i: number) => void;
  eth: string;
  implicit: string;
}) {
  const cards = [
    {
      chain: "Ethereum",
      name: "Ethereum address",
      short: "Ethereum",
      front: eth,
      testId: "eth-address",
      length: "42 characters",
      rule: "Hash the public key with Keccak-256, keep the last 20 bytes, write 0x and 40 hex. Shown from a separate practice Ethereum key (a different key type, secp256k1).",
    },
    {
      chain: "NEAR",
      name: "NEAR implicit account",
      short: "implicit account",
      front: implicit,
      testId: "implicit-front",
      length: "64 characters",
      rule: "No hashing: your whole 32-byte public key in hex. Yours, from step 4.",
    },
    {
      chain: "NEAR",
      name: "NEAR named account",
      short: "named account",
      front: "ana.testnet",
      testId: "named-front",
      length: "11 characters",
      rule: "A readable name. It can hold several keys and change them later. Stage 1 creates one. (ana.testnet is only an example.)",
    },
  ];
  const left = flipped.filter((f) => !f).length;
  return (
    <>
      <div className="w-cards">
        {cards.map((c, i) => (
          <div key={c.name} className={`w-card${flipped[i] ? " flipped" : ""}`}>
            <p className="w-card-head">
              <span className="w-chain">{c.chain}</span> {c.name.replace(/^(Ethereum|NEAR) /, "")}
              <span className="w-len">{c.length}</span>
            </p>
            <code className="w-mono" data-testid={c.testId}>
              {c.front}
            </code>
            {flipped[i] ? <p className="w-card-rule">{c.rule}</p> : null}
            <button className="w-link" aria-expanded={flipped[i]} onClick={() => onFlip(i)}>
              {flipped[i] ? `Hide the ${c.short} rule` : `Show the ${c.short} rule`}
            </button>
          </div>
        ))}
      </div>
      <p className="w-hint" aria-live="polite">
        {left ? `Show each rule. ${left} to go.` : "All three rules seen. Compare the lengths."}
      </p>
    </>
  );
}

function VerifyBox({
  signed,
  publicKey,
  checkMessage,
  onChange,
  onTamper,
  verdict,
  saw,
}: {
  signed: { message: string; signature: string };
  publicKey: string;
  checkMessage: string;
  onChange: (v: string) => void;
  onTamper: () => void;
  verdict: Verdict;
  saw: { pass: boolean; fail: boolean };
}) {
  return (
    <>
      <p className="w-small">
        Signature <code className="w-mono inline">{signed.signature.slice(0, 16)}…</code> · public key{" "}
        <code className="w-mono inline">{publicKey.slice(0, 18)}…</code>
      </p>
      <label className="w-field">
        <span className="w-label">Message to check</span>
        <input value={checkMessage} maxLength={80} onChange={(e) => onChange(e.target.value)} />
      </label>
      {saw.pass && !saw.fail ? (
        <button className="w-link" onClick={onTamper}>
          Change one letter for me
        </button>
      ) : null}
      <div role="status" data-reveal aria-live="polite">
        {verdict === "pass" ? (
          <p className="w-result ok">
            <span aria-hidden="true">✓ </span>Signature matches this message.
            {!saw.fail ? " Now change one letter in the message and press Verify again." : ""}
          </p>
        ) : verdict === "fail" ? (
          <p className="w-result bad">
            <span aria-hidden="true">✗ </span>Signature does not match this message.
            {saw.pass ? " One changed letter is enough to break it." : " Try the original message too."}
          </p>
        ) : (
          <p className="w-hint">
            {saw.pass ? "Change one letter, then press Verify." : "Press Verify to check the signature."}
          </p>
        )}
      </div>
    </>
  );
}
