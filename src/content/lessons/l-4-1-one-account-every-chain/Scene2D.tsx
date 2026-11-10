/**
 * Lesson 4.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout3d.ts) and the same scene objects: your NEAR mailbox, the signer contract in a ring of signing
 * nodes, three chains as rows of block pages, the derived Ethereum address (a mailbox) and the Ethereum
 * transaction (a parcel). Every object is a pick, as in 3D. Only draws the shared state from useChainSig.
 */
import type { SceneProps } from "../../../app/types";
import {
  SvgLedger,
  SvgMailbox,
  SvgParcel,
  SvgScroll,
  SvgSignerNode,
} from "../../../scene-kit/svg/objects";
import { COLORS } from "../../../scene-kit/theme";
import { beamPoints, ETH_MAILBOX, FIGURE, LEDGERS, NEAR_MAILBOX, nodeSpots, RING_CENTER, RING_RADIUS, SIGNER } from "./layout3d";
import { describe, parcelAt, ACCENT, CHAIN_NAMES } from "./page";
import { Facts, pickLabels } from "./parts";
import { shortHex, shortName } from "./signing";
import { CHECK, HOOK, PREPARE, SIGN, VERIFY, type ChainSig } from "./useChainSig";
import type { ChainKey } from "./layout3d";

/** SVG units per world unit. */
const SCALE = 64;
const PAD_TOP = 64;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;

export default function Scene2D({
  cs,
  reducedMotion,
  mode,
}: {
  cs: ChainSig;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
}) {
  if (cs.step >= CHECK) return null;
  return (
    <div
      className={`csg${reducedMotion ? " still" : ""}`}
      data-testid="csg-scene"
      data-scene-state={cs.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="csg-2d">
        {/* A group, not role="img": it holds focusable picks, and an image would hide them from readers. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(cs)}>
          <Page cs={cs} />
        </svg>
      </div>
      <Facts cs={cs} />
    </div>
  );
}

function Page({ cs }: { cs: ChainSig }) {
  const { step, account } = cs;
  const waiting = cs.phase === "sending" || cs.phase === "waiting";
  const parcel = parcelAt(cs);
  const beam = beamPoints()
    .map(([x, , z]) => `${px(x)},${pz(z)}`)
    .join(" ");
  return (
    <g>
      {/* The ring: where the signing nodes stand round the signer contract. */}
      <ellipse
        cx={px(RING_CENTER[0])}
        cy={pz(RING_CENTER[2])}
        rx={RING_RADIUS * SCALE}
        ry={RING_RADIUS * SCALE}
        className={`csg-ring${waiting ? " busy" : ""}`}
        data-explain={step === SIGN ? "ring" : undefined}
      />
      {account && step >= 1 ? <polyline points={beam} className="csg-beam" fill="none" /> : null}

      {(Object.keys(LEDGERS) as ChainKey[]).map((k) => (
        <SvgLedger
          key={k}
          x={px(LEDGERS[k][0])}
          y={pz(LEDGERS[k][2]) + 18}
          size={40}
          name={CHAIN_NAMES[k]}
          edge={k === "ethereum" ? ACCENT : COLORS.slab}
          onPick={() => cs.pick(k)}
          pickLabel={pickLabels[k]}
          selected={cs.picked === k}
        />
      ))}

      {nodeSpots().map((s, i) => (
        <SvgSignerNode
          key={i}
          x={px(s.position[0])}
          y={pz(s.position[2]) + 16}
          size={44}
          color={ACCENT}
          lit={i < cs.lit}
          name={`signing node ${i + 1}`}
          onPick={() => cs.pick("ring")}
          pickLabel={`Signing node ${i + 1}${i < cs.lit ? ", share added" : ""}`}
          selected={cs.picked === "ring"}
        />
      ))}
      <SvgScroll
        x={px(SIGNER[0])}
        y={pz(SIGNER[2]) + 6}
        size={58}
        name="signer"
        running={waiting}
        onPick={() => cs.pick("signer")}
        pickLabel={pickLabels.signer}
        selected={cs.picked === "signer"}
      />

      <g data-explain={step === HOOK ? "mailbox" : undefined}>
        <SvgMailbox
          x={px(NEAR_MAILBOX[0])}
          y={pz(NEAR_MAILBOX[2]) + 30}
          size={90}
          name={cs.me ? shortName(cs.me) : "your account"}
          color={ACCENT}
          onPick={() => cs.pick("near")}
          pickLabel={pickLabels.near}
          selected={cs.picked === "near"}
        />
      </g>
      <g data-explain={step === 1 || step === VERIFY ? "address" : undefined}>
        <SvgMailbox
          x={px(ETH_MAILBOX[0])}
          y={pz(ETH_MAILBOX[2]) + 30}
          size={76}
          name={account ? shortHex(account.address, 6, 4) : "address?"}
          color={ACCENT}
          state={account ? "ok" : "pending"}
          flag={cs.match}
          onPick={() => cs.pick("address")}
          pickLabel={pickLabels.address}
          selected={cs.picked === "address"}
        />
      </g>

      {step >= PREPARE ? (
        <g
          className="csg-parcel"
          style={{ transform: `translate(${px(parcel[0])}px, ${pz(parcel[2]) + 26}px)` }}
          data-explain={step === PREPARE ? "parcel" : undefined}
        >
          <SvgParcel
            x={0}
            y={0}
            size={44}
            color={ACCENT}
            to="Sepolia"
            stamped={!!cs.result}
            state={cs.prepared ? "ok" : "pending"}
            onPick={() => cs.pick("parcel")}
            pickLabel={pickLabels.parcel}
            selected={cs.picked === "parcel"}
          />
        </g>
      ) : null}
    </g>
  );
}
