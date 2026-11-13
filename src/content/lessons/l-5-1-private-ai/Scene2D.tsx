/**
 * Lesson 5.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout.ts). Your terminal on the left; an ordinary server (open, its memory readable) at the back and
 * the sealed enclave in front; root access (a key) between them; the attestation quote (a slip) and
 * Intel's root certificate (a seal) on the right. Every object is a pick, as in 3D. Only draws the shared
 * state from usePrivateAi.
 */
import type { SceneProps } from "../../../app/types";
import { SvgLabel, SvgPickable } from "../../../scene-kit/svg";
import {
  SvgAppScreen,
  SvgParcel,
  SvgReceiptSlip,
  SvgStamp,
  SvgTaggedKey,
} from "../../../scene-kit/svg/objects";
import { COLORS } from "../../../scene-kit/theme";
import stage from "../../stages/5-enclave/stage";
import { ENCLAVE, FIGURE, PROMPT_AT, QUOTE, ROOT, SEAL, SERVER, TERMINAL } from "./layout";
import { Facts } from "./parts";
import { describe, PICK_LABELS, type Obj } from "./tutor";
import {
  CHECK,
  ENCLAVE as ENCLAVE_STEP,
  HOOK,
  PROMPT,
  QUOTE as QUOTE_STEP,
  VERIFY,
  type PrivateAi,
} from "./usePrivateAi";

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
  m: PrivateAi;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (m.step >= CHECK) return null;
  return (
    <div
      className={`pai${reducedMotion ? " still" : ""}`}
      data-testid="pai-scene"
      data-scene-state={m.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="pai-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(m)}>
          <Page m={m} />
        </svg>
      </div>
      <Facts m={m} />
    </div>
  );
}

function Page({ m }: { m: PrivateAi }) {
  const { step } = m;
  const sel = (o: Obj) => m.picked?.what === o;
  // A "not yet" pick shakes the object. Two class names in turn, so a second click shakes it again.
  const shake = (o: Obj) =>
    m.picked?.what === o && m.picked.reaction.hint ? ` pai-shake${m.picked.n % 2}` : "";
  // The object's own pick animation (scene.css, as in 3D), replayed on every pick.
  const pickAnim = (o: Obj) =>
    m.picked?.what === o && !m.picked.reaction.hint ? ` pai-pick-${o}${m.picked.n % 2}` : "";
  const cls = (o: Obj) => `${shake(o)}${pickAnim(o)}`.trim() || undefined;
  const prompt = m.asked !== null ? PROMPT_AT.enclave : PROMPT_AT.home;
  const sealed = m.verified;
  return (
    <g>
      {/* ---------- an ordinary cloud server: open, its memory readable ---------- */}
      <g data-explain={step === HOOK ? "server" : undefined} className={cls("server")}>
        <SvgPickable
          label={PICK_LABELS.server}
          selected={sel("server")}
          onPick={() => m.pick("server")}
          focus={[px(SERVER[0]) - 70, pz(SERVER[2]) - 74, 140, 112]}
        >
          <SvgServer x={px(SERVER[0])} y={pz(SERVER[2])} read={m.dumped} />
        </SvgPickable>
      </g>

      {/* ---------- the hardware enclave: sealed ---------- */}
      <g data-explain={step === ENCLAVE_STEP ? "enclave" : undefined} className={cls("enclave")}>
        <SvgPickable
          label={PICK_LABELS.enclave}
          selected={sel("enclave")}
          onPick={() => m.pick("enclave")}
          focus={[px(ENCLAVE[0]) - 70, pz(ENCLAVE[2]) - 78, 140, 116]}
        >
          <SvgEnclave x={px(ENCLAVE[0])} y={pz(ENCLAVE[2])} holds={m.answered} attested={sealed} />
        </SvgPickable>
      </g>

      {/* ---------- root access ---------- */}
      <g className={cls("root")}>
        <SvgTaggedKey
          x={px(ROOT[0]) + 20}
          y={pz(ROOT[2]) - 8}
          tag={m.dumped ? "read: 1 of 2" : "root"}
          share={m.dumped ? 0.5 : 1}
          color={ACCENT}
          name="root access"
          onPick={() => m.pick("root")}
          pickLabel={PICK_LABELS.root}
          selected={sel("root")}
        />
      </g>

      {/* ---------- your terminal ---------- */}
      <g data-explain={step === PROMPT ? "terminal" : undefined} className={cls("terminal")}>
        <SvgAppScreen
          x={px(TERMINAL[0])}
          y={pz(TERMINAL[2]) + 40}
          size={96}
          name="your terminal"
          color={ACCENT}
          onPick={() => m.pick("terminal")}
          pickLabel={PICK_LABELS.terminal}
          selected={sel("terminal")}
        />
      </g>

      {/* Your prompt: a parcel, by your terminal until it is sent, then sealed inside the enclave. */}
      {step >= PROMPT ? (
        <g
          className="pai-move"
          style={{ transform: `translate(${px(prompt[0])}px, ${pz(prompt[2]) + 20}px)` }}
          aria-hidden="true"
        >
          <SvgParcel
            x={0}
            y={0}
            size={34}
            color={ACCENT}

            stamped={m.asked !== null}
            name="your prompt"
          />
        </g>
      ) : null}

      {/* ---------- the attestation quote ---------- */}
      <g data-explain={step === QUOTE_STEP ? "quote" : undefined} className={cls("quote")}>
        <SvgReceiptSlip
          x={px(QUOTE[0])}
          y={pz(QUOTE[2]) + 24}
          size={58}
          color={ACCENT}
          label={m.attestation ? `${m.attestation.source} quote` : "no quote yet"}
          fate={sealed ? "done" : "idle"}
          state={m.attestation ? "ok" : "pending"}
          onPick={() => m.pick("quote")}
          pickLabel={PICK_LABELS.quote}
          selected={sel("quote")}
        />
      </g>

      {/* ---------- Intel's root certificate: a seal ---------- */}
      <g data-explain={step === VERIFY ? "seal" : undefined} className={cls("seal")}>
        <SvgPickable
          label={PICK_LABELS.seal}
          selected={sel("seal")}
          onPick={() => m.pick("seal")}
          focus={[px(SEAL[0]) - 46, pz(SEAL[2]) - 52, 92, 96]}
        >
          <SvgStamp x={px(SEAL[0])} y={pz(SEAL[2])} size={44} color={sealed ? ACCENT : COLORS.slab} />
          <SvgLabel x={px(SEAL[0])} y={pz(SEAL[2]) + 44} variant="small">
            Intel root
          </SvgLabel>
        </SvgPickable>
      </g>
    </g>
  );
}

/** An ordinary cloud server: a box with its lid open, the lines of memory inside readable. */
function SvgServer({ x, y, read }: { x: number; y: number; read: boolean }) {
  return (
    <g>
      <rect x={x - 56} y={y - 30} width={112} height={56} rx={6} className="pai-box" />
      <path d={`M${x - 56},${y - 30} l14,-28 h84 l14,28`} className="pai-lid" />
      {[0, 1, 2].map((k) => (
        <line
          key={k}
          x1={x - 40}
          x2={x + (k === 2 ? 10 : 40)}
          y1={y - 14 + k * 12}
          y2={y - 14 + k * 12}
          className="pai-plain"
        />
      ))}
      {read ? (
        <text x={x} y={y - 64} className="pai-svg-note mid">
          plain text
        </text>
      ) : null}
      <SvgLabel x={x} y={y + 48} variant="small">
        ordinary server
      </SvgLabel>
    </g>
  );
}

/** The enclave: a chip with a sealed perimeter in the accent and a lock. */
function SvgEnclave({ x, y, holds, attested }: { x: number; y: number; holds: boolean; attested: boolean }) {
  return (
    <g>
      <rect
        x={x - 58}
        y={y - 58}
        width={116}
        height={92}
        rx={10}
        className={`pai-perimeter${attested ? " on" : ""}`}
      />
      <rect x={x - 42} y={y - 44} width={84} height={64} rx={4} className="pai-chip" />
      {[-30, -10, 10, 30].map((d) => (
        <g key={d} className="pai-pins">
          <line x1={x + d} x2={x + d} y1={y - 52} y2={y - 44} />
          <line x1={x + d} x2={x + d} y1={y + 20} y2={y + 28} />
        </g>
      ))}
      <rect x={x - 11} y={y - 14} width={22} height={18} rx={3} className="pai-lock" />
      <path d={`M${x - 7},${y - 14} v-6 a7,7 0 0 1 14,0 v6`} className="pai-shackle" />
      {holds ? (
        <text x={x} y={y + 50} className="pai-svg-note mid">
          your prompt, sealed
        </text>
      ) : null}
      <SvgLabel x={x} y={y - 66} variant="small">
        enclave (Intel TDX)
      </SvgLabel>
    </g>
  );
}
