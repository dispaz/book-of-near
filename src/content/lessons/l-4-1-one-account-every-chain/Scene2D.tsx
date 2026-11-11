/**
 * Lesson 4.1, flat view: the same page as the 3D book scene, drawn from above in SVG with the same plan
 * (layout3d.ts) and the same scene objects. The NEAR side: your mailbox and the signer contract in a ring
 * of signing nodes. The Ethereum side: a marked area (`SvgChainArea`) with its chain of blocks, the
 * derived address and, from step 5, the delivered transaction. Step 4's signing is a lighter version of
 * the 3D one: pulses along the lines to the nodes, share dots flying in, the nodes filling. Every object
 * is a pick, as in 3D. Only draws the shared state from useChainSig.
 */
import type { CSSProperties } from "react";
import type { SceneProps } from "../../../app/types";
import {
  SvgChainArea,
  SvgMailbox,
  SvgParcel,
  SvgScroll,
  SvgSignerNode,
} from "../../../scene-kit/svg/objects";
import {
  beamPoints,
  ETH_AREA,
  ETH_BLOCKS,
  ETH_MAILBOX,
  FIGURE,
  NEAR_MAILBOX,
  nodeSpots,
  PARCEL_AT,
  PARCEL_WAIT,
  RING_CENTER,
  RING_RADIUS,
  SIGNER,
} from "./layout3d";
import { describe, ETH_AREA_NAME, parcelAt, ACCENT } from "./page";
import { Facts, pickLabels } from "./parts";
import { isWaiting, sharesIn, shortHex, shortName, slipsShown } from "./signing";
import { CHECK, HOOK, PREPARE, SIGN, VERIFY, type ChainSig } from "./useChainSig";

/** SVG units per world unit. */
const SCALE = 64;
const PAD_TOP = 64;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE + PAD_TOP;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE + PAD_TOP;
/** The parcel is drawn this far below its plan spot (its base), and this big. */
const PARCEL_DY = 26;
const PARCEL_SIZE = 44;
const PARCEL_H = PARCEL_SIZE * 0.8;
/** Where the share dots gather: on the waiting parcel's lid. */
const STACK = { x: px(PARCEL_WAIT[0]), y: pz(PARCEL_WAIT[2]) + PARCEL_DY - PARCEL_H - 6 };

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
      data-sign-anim={cs.anim}
      data-parcel={cs.step >= PREPARE ? parcelAt(cs) : undefined}
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
  const { step, account, result } = cs;
  const waiting = isWaiting(cs.phase);
  const parcel = PARCEL_AT[parcelAt(cs)];
  const spots = nodeSpots();
  const beam = beamPoints()
    .map(([x, , z]) => `${px(x)},${pz(z)}`)
    .join(" ");
  const shares = step === SIGN ? sharesIn(cs.anim, cs.lit) : 0;
  const slips = slipsShown(cs.anim) && !!result;
  const area = {
    x: px(ETH_AREA.minX),
    y: pz(ETH_AREA.minZ),
    w: (ETH_AREA.maxX - ETH_AREA.minX) * SCALE,
    h: (ETH_AREA.maxZ - ETH_AREA.minZ) * SCALE,
  };
  const ring = { x: px(RING_CENTER[0]), y: pz(RING_CENTER[2]) };
  return (
    <g>
      {/* ---------- the Ethereum side: its own area on the page ---------- */}
      <g data-explain={step === HOOK ? "ethereum" : undefined}>
        <SvgChainArea
          x={area.x}
          y={area.y}
          width={area.w}
          height={area.h}
          name={ETH_AREA_NAME}
          color={ACCENT}
          blocks={ETH_BLOCKS}
          blockSize={46}
          onPick={() => cs.pick("ethereum")}
          pickLabel={pickLabels.ethereum}
          selected={cs.picked === "ethereum"}
        />
      </g>

      {/* ---------- the NEAR side ---------- */}
      {/* The ring: where the signing nodes stand round the signer contract. */}
      <ellipse
        cx={ring.x}
        cy={ring.y}
        rx={RING_RADIUS * SCALE}
        ry={RING_RADIUS * SCALE}
        className={`csg-ring${waiting ? " busy" : ""}`}
        data-explain={step === SIGN ? "ring" : undefined}
      />
      {cs.anim === "work" ? (
        <g aria-hidden="true" data-testid="sign-fx">
          <circle cx={ring.x} cy={ring.y} r={RING_RADIUS * SCALE} className="csg-pulse" />
          {spots.map((s, i) => (
            <line
              key={i}
              x1={ring.x}
              y1={ring.y}
              x2={px(s.position[0])}
              y2={pz(s.position[2])}
              className="csg-spoke"
            />
          ))}
        </g>
      ) : null}
      {account && step >= 1 ? <polyline points={beam} className="csg-beam" fill="none" /> : null}

      {spots.map((s, i) => (
        <g key={i} className={cs.anim === "work" && i >= cs.lit ? "csg-node busy" : "csg-node"}>
          <SvgSignerNode
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
        </g>
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

      {/* The derived address, inside the Ethereum area: dashed until derived, then it grows. */}
      <g
        data-explain={step === 1 || step === VERIFY ? "address" : undefined}
        data-testid="eth-address-object"
        className={account ? "csg-grow" : undefined}
        key={account?.address ?? "none"}
      >
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
      {step === VERIFY && cs.recovered ? (
        <>
          <text
            x={area.x + 12}
            y={pz(ETH_MAILBOX[2]) + 58}
            className="csg-svg-note strong"
            data-testid="recovered-mark"
          >
            {cs.match ? "recovered signer = this address ✓" : "recovered: another address ✗"}
          </text>
          <text
            x={area.x + area.w / 2}
            y={area.y + area.h - 30}
            className="csg-svg-note mid"
            data-testid="not-sent-mark"
          >
            Not sent to Sepolia: 0 ETH for gas
          </text>
        </>
      ) : null}

      {/* Step 4's shares: one dot per node that has answered, flying to the parcel in the ring. */}
      {shares > 0 ? (
        <g aria-hidden="true">
          {Array.from({ length: shares }, (_, i) => {
            const s = spots[i]!;
            const at = { x: STACK.x + ((i % 2) - 0.5) * 26, y: STACK.y - Math.floor(i / 2) * 8 };
            const style = {
              "--fx": `${px(s.position[0]) - at.x}px`,
              "--fy": `${pz(s.position[2]) - at.y}px`,
            } as CSSProperties;
            return (
              <rect
                key={i}
                x={at.x - 6}
                y={at.y - 3.5}
                width={12}
                height={7}
                rx={1.5}
                className="csg-chip"
                style={style}
              />
            );
          })}
        </g>
      ) : null}
      {cs.anim === "sealed" ? (
        <circle cx={STACK.x} cy={STACK.y} r={26} className="csg-flash" aria-hidden="true" />
      ) : null}

      {/* The Ethereum transaction: packed by your mailbox, signed in the ring, delivered to Ethereum. */}
      {step >= PREPARE ? (
        <g
          className="csg-parcel"
          style={{ transform: `translate(${px(parcel[0])}px, ${pz(parcel[2]) + PARCEL_DY}px)` }}
          data-explain={step === PREPARE ? "parcel" : undefined}
        >
          <SvgParcel
            x={0}
            y={0}
            size={PARCEL_SIZE}
            color={ACCENT}
            to="Sepolia"
            stamped={slips}
            state={cs.prepared ? "ok" : "pending"}
            onPick={() => cs.pick("parcel")}
            pickLabel={pickLabels.parcel}
            selected={cs.picked === "parcel"}
          />
          {slips && result ? (
            <g data-testid="rsv-slips" aria-hidden="true">
              {["r", "s", `v ${result.signature.yParity}`].map((text, k) => {
                const x = (k - 1) * 21;
                const y = -PARCEL_H - 26;
                return (
                  <g key={k} className="csg-slip" transform={`rotate(${(k - 1) * 7} ${x} ${y + 20})`}>
                    <rect x={x - 9.5} y={y} width={19} height={20} rx={2} />
                    <text x={x} y={y + 14}>
                      {text}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}
        </g>
      ) : null}
    </g>
  );
}
