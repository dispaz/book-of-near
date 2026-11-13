/**
 * The facts both views show in HTML (2D under the drawing, 3D in the book scene's panel): the .env file,
 * the agent's account, the contract's checks, the developer's refusals and the signing request. Same
 * words, same test ids in both.
 */
import type { ReactNode } from "react";
import { RECORDED_ATTESTATION, recordedDate } from "../../../chain/nearai";
import { PICK_LABELS, short } from "./agent";
import { AGENT_CONTRACT, AGENT_MEASUREMENTS, AGENT_PATH, DEVELOPER, EXAMPLE_PPID } from "./agentContract";
import { ATTACK, BOOT, HOOK, REGISTER, RUN, type AgentLesson } from "./useAgent";

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}

/** What is real on this page and what is a model (the honest take says the same). */
export const MODEL_NOTE =
  "A model of the reference agent contract, run in your browser with its real error texts. No agent and no agent contract run for this lesson.";
const RECORDED_ON = recordedDate(RECORDED_ATTESTATION.recordedOn!);

/** The illustration of a bot's .env file: not a real key. */
export const ENV_LINES = [
  "# bot/.env",
  "RPC_URL=https://rpc.mainnet.near.org",
  "BOT_PRIVATE_KEY=ed25519:3xQ…kP9",
];

export function Facts({ m, compact = false }: { m: AgentLesson; compact?: boolean }) {
  const { step } = m;
  return (
    <div className={`nao-facts${compact ? " compact" : ""}`}>
      {m.problem ? (
        <p className="nao-warn" role="alert" data-testid="agent-problem">
          {m.problem}
        </p>
      ) : null}

      {step === HOOK ? (
        m.envOpen ? (
          <>
            <figure className="nao-env" data-testid="env-file">
              <figcaption>The bot's .env file, on the developer's laptop</figcaption>
              <pre>{ENV_LINES.join("\n")}</pre>
            </figure>
            <p className="nao-warn">Anyone who reads this line can move the bot's funds.</p>
            <p className="nao-note">An illustration, not a real key.</p>
          </>
        ) : (
          <p className="nao-line">The bot's key sits in a file on the developer's laptop. Open it.</p>
        )
      ) : null}

      {step === BOOT ? (
        m.agent ? (
          <>
            <dl className="nao-dl">
              <Row label="Agent's account" testId="agent-account">
                <code>{short(m.agent.accountId)}</code> (implicit: the public key in hex)
              </Row>
              <Row label="Private key">stays in the enclave: never shown, never saved</Row>
              <Row label="After a restart">a new key, so a new account</Row>
            </dl>
            <p className="nao-note">
              A real ed25519 key, made just now in your browser, standing in for the enclave.
            </p>
          </>
        ) : (
          <p className="nao-line">The enclave is sealed and empty. Start the agent.</p>
        )
      ) : null}

      {step === REGISTER ? (
        m.regChecks ? (
          <>
            <ul className="nao-checks" data-testid="reg-checks">
              {m.regChecks.map((c) => (
                <li key={c.id} data-ok={c.ok ? "yes" : "no"} className={c.ok ? "ok" : "bad"}>
                  <span aria-hidden="true">{c.ok ? "✓" : "✗"}</span> {c.label}
                </li>
              ))}
            </ul>
            <dl className="nao-dl" data-testid="measurements">
              <Row label="MRTD">
                <code>{short(AGENT_MEASUREMENTS.mrtd)}</code>
              </Row>
              <Row label="RTMR0 to RTMR2">three more hashes of the platform and kernel</Row>
              <Row label="App compose hash">
                <code>{short(AGENT_MEASUREMENTS.composeHash)}</code> (changes with the agent's code)
              </Row>
              <Row label="PPID">{EXAMPLE_PPID}</Row>
            </dl>
            <p className="nao-note" data-testid="measurements-source">
              Example values: the real measurements from the NEAR AI Cloud quote recorded on {RECORDED_ON}{" "}
              (lesson 5.1). The PPID is an example. This model skips the key-provider digest. {MODEL_NOTE}
            </p>
          </>
        ) : (
          <p className="nao-line">The agent hands its quote to {AGENT_CONTRACT}. Register it.</p>
        )
      ) : null}

      {step === ATTACK ? (
        <>
          <dl className="nao-dl">
            <Row label="Sign as the developer" testId="dev-result">
              {m.devRefused ? (
                <>
                  request_signature from {DEVELOPER}: refused, <code>{m.devRefused}</code>
                </>
              ) : (
                "not tried yet"
              )}
            </Row>
            <Row label="Register a changed copy" testId="copy-result">
              {m.copy ? (
                <>
                  register_agent: refused, <code>{m.copy.error}</code>{" "}
                  {m.copy.checks
                    .filter((c) => !c.ok)
                    .map((c) => `✗ ${c.label}`)
                    .join(" ")}{" "}
                  (the app compose hash changed)
                </>
              ) : (
                "not tried yet"
              )}
            </Row>
          </dl>
          {m.attackDone ? (
            <p className="nao-ok" role="status" data-testid="attack-verdict">
              Both refused: the developer cannot sign for the agent.
            </p>
          ) : null}
          <p className="nao-note">{MODEL_NOTE}</p>
        </>
      ) : null}

      {step === RUN ? (
        m.run.status === "done" && m.call && m.agent ? (
          <>
            <dl className="nao-dl" data-testid="sign-call">
              <Row label="The agent">
                <code>{short(m.agent.accountId)}</code> calls request_signature on {AGENT_CONTRACT}
              </Row>
              <Row label="The contract">
                calls {m.call.method} on {m.call.receiver}, {m.call.deposit}
              </Row>
              <Row label="Path">{AGENT_PATH}</Row>
              <Row label="Payload">
                <code>{short(m.call.args.request.payload_v2.Ecdsa)}</code> (hash of a Sepolia transaction)
              </Row>
              <Row label="Ethereum address" testId="eth-address">
                <code>{m.run.address}</code>
              </Row>
            </dl>
            <p className="nao-note" data-testid="address-source">
              {m.network === "testnet"
                ? "The address is derived in your browser from v1.signer-prod.testnet's real root key."
                : "Demo mode: the address is derived in your browser from the demo signer's root key (the same math, a stand-in key)."}{" "}
              The call is a model: nothing was sent and no signature was made.
            </p>
          </>
        ) : (
          <p className="nao-line">
            {m.run.status === "running"
              ? "The agent is asking for a signature…"
              : "The agent is registered. Run it."}
          </p>
        )
      ) : null}

      {m.picked && !m.picked.reaction.act ? (
        <p
          className={`nao-note${m.picked.reaction.hint ? " not-yet" : ""}`}
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
