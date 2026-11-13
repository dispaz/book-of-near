/**
 * The facts both views show in HTML (2D under the drawing, 3D in the book scene's panel): the memory
 * root reads, the tutor's answer, the quote's parts and the checks. Same words, same test ids in both.
 */
import { useMemo, type ReactNode } from "react";
import { recordedDate } from "../../../chain/nearai";
import { CHECK_LABELS, parseTdxQuote, hexToBytes, type CheckId } from "../../../chain/nearai/tdx";
import { enclaveNoise, PICK_LABELS, PROMPTS, SERVER_RAM } from "./tutor";
import { ENCLAVE, HOOK, PROMPT, QUOTE, VERIFY, type PrivateAi } from "./usePrivateAi";

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

const short = (s: string, n = 6) => (s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
const NOISE = enclaveNoise(4);

/** What a quote holds, read from its bytes. */
function useQuoteParts(hex: string | undefined) {
  return useMemo(() => {
    if (!hex) return null;
    try {
      return parseTdxQuote(hexToBytes(hex));
    } catch {
      return null;
    }
  }, [hex]);
}

export function Facts({ m, compact = false }: { m: PrivateAi; compact?: boolean }) {
  const { step, attestation: a } = m;
  const q = useQuoteParts(a?.quote);
  return (
    <div className={`pai-facts${compact ? " compact" : ""}`}>
      {step === HOOK ? (
        <dl className="pai-dl">
          <Row label="HTTPS">protects your prompt only on the way to the server</Row>
          <Row label="Ordinary server">decrypts it into memory: its operators can read it</Row>
          <Row label="Hardware enclave">the chip keeps that memory encrypted</Row>
        </dl>
      ) : null}

      {step === ENCLAVE ? (
        m.dumped ? (
          <>
            <div className="pai-ram-pair" data-testid="ram-dump">
              <figure className="pai-ram plain">
                <figcaption>Ordinary server's memory, read as root</figcaption>
                <pre>{SERVER_RAM.join("\n")}</pre>
              </figure>
              <figure className="pai-ram sealed">
                <figcaption>Enclave's memory, read as root</figcaption>
                <pre>{NOISE.join("\n")}</pre>
              </figure>
            </div>
            <p className="pai-note">An illustration of what root would see, not a real memory dump.</p>
          </>
        ) : (
          <p className="pai-line">Root can read any normal memory on a machine. Try it on both.</p>
        )
      ) : null}

      {step === PROMPT ? (
        m.asked === null ? (
          <p className="pai-line">Pick a question below, then send it.</p>
        ) : (
          <div className="pai-chat">
            <p className="pai-q">{PROMPTS[m.asked]!.question}</p>
            <p className="pai-a" data-testid="tutor-answer" aria-live="polite">
              {m.shownAnswer}
            </p>
            <p className="pai-note" data-testid="answer-source">
              Pre-written answer, not generated live: chat with NEAR AI Cloud needs an API key, which this
              book does not ship. The quote in the next steps is real.
            </p>
          </div>
        )
      ) : null}

      {(step === QUOTE || step === VERIFY) && a ? (
        <p className="pai-note" data-testid="quote-source">
          {a.source === "recorded"
            ? `Recorded on ${recordedDate(a.recordedOn!)} from NEAR AI Cloud's public attestation endpoint; no network used now. The checks run now, in your browser.`
            : "Live: fetched just now from NEAR AI Cloud with your own nonce. The checks run in your browser."}
        </p>
      ) : null}
      {step === QUOTE || (step === VERIFY && m.verify.status !== "done") ? (
        a && q ? (
          <dl className="pai-dl" data-testid="quote-facts">
            <Row label="Model">{a.model}</Row>
            <Row label="Hardware" testId="quote-tee">
              {q.tee} quote, {q.size} bytes
            </Row>
            <Row label="Code measurement (MRTD)" testId="quote-mrtd">
              <code>{short(q.mrtd, 8)}</code>
            </Row>
            <Row label="Runtime measurements">RTMR0 to RTMR3, four more hashes</Row>
            <Row label="Report data" testId="quote-report-data">
              signing address <code>{short(a.signingAddress, 6)}</code> + nonce{" "}
              <code>{short(a.nonce, 6)}</code>
            </Row>
            <Row label="Certificates" testId="quote-certs">
              {q.certs.map((c) => c.name).join(" → ")}
            </Row>
            <Row label="GPUs">
              {a.gpus.count} NVIDIA {a.gpus.arch} evidence reports (not checked here)
            </Row>
          </dl>
        ) : (
          <p className="pai-line">{m.fetching ? "Asking NEAR AI Cloud for its quote…" : "No quote yet."}</p>
        )
      ) : null}

      {step === VERIFY && m.verify.status === "done" ? (
        <>
          <ul className="pai-checks" data-testid="verify-checks">
            {m.verify.checks.map((c) => (
              <li key={c.id} data-check={c.id} data-ok={c.ok ? "yes" : "no"} className={c.ok ? "ok" : "bad"}>
                <span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> {c.label}
              </li>
            ))}
          </ul>
          <p className={m.verified ? "pai-ok" : "pai-warn"} role="status" data-testid="verdict">
            {m.verified
              ? "Verified: a genuine Intel TDX enclave, checked in your browser."
              : "Not verified: a check failed."}
          </p>
          {m.tamper ? (
            <p className="pai-warn" data-testid="tamper-result">
              One byte changed:{" "}
              {m.tamper
                .filter((c) => !c.ok)
                .map((c) => `✗ ${CHECK_LABELS[c.id as CheckId]}`)
                .join(" ")}
            </p>
          ) : null}
          <p className="pai-note">
            Not checked here: revocation lists, the chip's firmware level (TCB), certificate dates and the
            NVIDIA GPU evidence.
          </p>
        </>
      ) : null}

      {m.notice ? (
        <p className="pai-warn" role="alert" data-testid="quote-notice">
          {m.notice}
        </p>
      ) : null}
      {m.picked && !m.picked.reaction.act ? (
        <p
          className={`pai-note${m.picked.reaction.hint ? " not-yet" : ""}`}
          data-testid="picked-note"
          data-not-yet={m.picked.reaction.hint ? "yes" : undefined}
          key={m.picked.n}
        >
          <strong>{PICK_LABELS[m.picked.what]}:</strong> {m.picked.reaction.hint ?? m.picked.reaction.detail}
        </p>
      ) : null}
    </div>
  );
}
