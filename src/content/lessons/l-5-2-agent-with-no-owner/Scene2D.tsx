/**
 * Lesson 5.2, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts). The developer's laptop and key on the left; the agent's enclave and the agent contract in
 * the middle; the signing network and the contract's Ethereum address on the right. Every object is a
 * pick, as in 3D. Only draws the shared state from useAgent.
 */
import type { SceneProps } from "../../../app/types";
import { SvgPickable } from "../../../scene-kit/svg";
import {
  SvgAppScreen,
  SvgMailbox,
  SvgParcel,
  SvgScroll,
  SvgSignerNode,
  SvgTaggedKey,
} from "../../../scene-kit/svg/objects";
import stage from "../../stages/5-enclave/stage";
import { SvgEnclave } from "../../stages/5-enclave/SvgEnclave";
import { describe, PICK_LABELS, short, type Obj } from "./agent";
import { CONTRACT, ENCLAVE, ETH, FIGURE, KEY, LAPTOP, NODES, REQUEST_AT, SIGNER } from "./layout";
import { Facts } from "./parts";
import { ATTACK, BOOT, CHECK, HOOK, REGISTER, RUN, type AgentLesson } from "./useAgent";

const ACCENT = stage.accent;
/** SVG units per world unit. */
const SCALE = 64;
const PAD_TOP = 56;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;

export default function Scene2D({
  m,
  reducedMotion,
  mode,
}: {
  m: AgentLesson;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`nao${reducedMotion ? " still" : ""}`}
      data-testid="nao-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="nao-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

function Page({ m }: { m: AgentLesson }) {
  const { step } = m;
  const sel = (o: Obj) => m.picked?.what === o;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) =>
    m.picked?.what === o && m.picked.reaction.hint ? ` nao-shake${m.picked.n % 2}` : "";
  // The object's own pick animation (scene.css, as in 3D), replayed on every pick.
  const pickAnim = (o: Obj) =>
    m.picked?.what === o && !m.picked.reaction.hint ? ` nao-pick-${o}${m.picked.n % 2}` : "";
  const cls = (o: Obj) => `${shake(o)}${pickAnim(o)}`.trim() || undefined;
  const req =
    m.run.status === "done"
      ? REQUEST_AT.signer
      : m.run.status === "running"
        ? REQUEST_AT.contract
        : REQUEST_AT.home;
  const signed = m.run.status === "done";
  return (
    <g>
      {/* ---------- the developer's laptop, with the bot's .env ---------- */}
      <g data-explain={step === HOOK ? "laptop" : undefined} className={cls("laptop")}>
        <SvgAppScreen
          x={px(LAPTOP[0])}
          y={pz(LAPTOP[2]) + 40}
          size={96}
          name={m.envOpen ? "laptop · .env open" : "developer's laptop"}
          color={ACCENT}
          onPick={() => m.pick("laptop")}
          pickLabel={PICK_LABELS.laptop}
          selected={sel("laptop")}
        />
      </g>

      {/* ---------- the developer's key ---------- */}
      <g data-explain={step === ATTACK ? "key" : undefined} className={cls("key")}>
        <SvgTaggedKey
          x={px(KEY[0]) + 20}
          y={pz(KEY[2]) - 8}
          tag={m.devRefused ? "refused" : "developer"}
          share={m.devRefused ? 0 : 1}
          color={ACCENT}
          name="developer's key"
          state={m.devRefused ? "failed" : "ok"}
          onPick={() => m.pick("key")}
          pickLabel={PICK_LABELS.key}
          selected={sel("key")}
        />
      </g>

      {/* ---------- the agent's enclave ---------- */}
      <g data-explain={step === BOOT ? "enclave" : undefined} className={cls("enclave")}>
        <SvgPickable
          label={PICK_LABELS.enclave}
          selected={sel("enclave")}
          onPick={() => m.pick("enclave")}
          focus={[px(ENCLAVE[0]) - 70, pz(ENCLAVE[2]) - 78, 140, 116]}
        >
          <SvgEnclave
            x={px(ENCLAVE[0])}
            y={pz(ENCLAVE[2])}
            lit={m.registered}
            label="the agent's enclave"
            note={m.agent ? `agent ${short(m.agent.accountId, 4)}` : undefined}
          />
        </SvgPickable>
      </g>

      {/* ---------- the agent contract ---------- */}
      <g data-explain={step === REGISTER ? "contract" : undefined} className={cls("contract")}>
        <SvgScroll
          x={px(CONTRACT[0])}
          y={pz(CONTRACT[2]) + 40}
          size={80}
          name="agent contract"
          note={m.registered ? "1 agent" : undefined}
          running={m.run.status === "running"}
          color={ACCENT}
          onPick={() => m.pick("contract")}
          pickLabel={PICK_LABELS.contract}
          selected={sel("contract")}
        />
      </g>

      {/* ---------- the signing network ---------- */}
      <g data-explain={step === RUN ? "signer" : undefined} className={cls("signer")}>
        <SvgPickable
          label={PICK_LABELS.signer}
          selected={sel("signer")}
          onPick={() => m.pick("signer")}
          focus={[px(SIGNER[0]) - 82, pz(SIGNER[2]) - 70, 164, 144]}
        >
          {NODES.map((n, i) => (
            <SvgSignerNode key={i} x={px(n[0])} y={pz(n[2]) + 24} size={44} lit={signed} color={ACCENT} />
          ))}
          <text x={px(SIGNER[0])} y={pz(SIGNER[2]) + 66} className="pai-svg-note mid">
            signing network
          </text>
        </SvgPickable>
      </g>

      {/* ---------- the contract's Ethereum address ---------- */}
      <g className={cls("eth")}>
        <SvgMailbox
          x={px(ETH[0])}
          y={pz(ETH[2]) + 30}
          size={70}
          name={signed ? short(m.run.status === "done" ? m.run.address : "", 4) : "Ethereum address"}
          flag={signed}
          color={ACCENT}
          onPick={() => m.pick("eth")}
          pickLabel={PICK_LABELS.eth}
          selected={sel("eth")}
        />
      </g>

      {/* The agent's signing request: a parcel from the enclave to the contract to the signer. */}
      {step >= RUN ? (
        <g
          className="nao-move"
          style={{ transform: `translate(${px(req[0])}px, ${pz(req[2]) + 20}px)` }}
          aria-hidden="true"
        >
          <SvgParcel x={0} y={0} size={30} color={ACCENT} stamped={signed} name="a signing request" />
        </g>
      ) : null}
    </g>
  );
}
