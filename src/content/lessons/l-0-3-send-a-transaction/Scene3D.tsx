/**
 * Lesson 0.3 in 3D: the transaction as an envelope that is built on your device, sealed by your key,
 * handed to an RPC node, dropped into a new block on the chain and locked when final. It only draws
 * the shared state from useTransaction: every move follows a real phase event from the chain.
 * Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Line } from "@react-three/drei";
import type { Group } from "three";
import {
  AccountBlock,
  Anchor,
  Coin,
  COLORS,
  InkStage,
  INK,
  Key,
  Label,
  Outline,
  Pickable,
  SoftShadow,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  useInk,
  useStage,
  type Vec3,
  useAnimatedFrame,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { duration, near, short, TRANSFER_FEE } from "./tx";
import { BUILD, FEE, SEND, SIGN, type Light, type Tx } from "./useTransaction";
import {
  ACCT,
  CHAIN_Z,
  CUBE,
  DESK,
  GAP,
  NEW_BLOCK,
  NODE,
  NODE_H,
  OLD_BLOCKS,
  RECEIVER,
  SENDER,
  shotFor,
} from "./layout3d";

/** Where the envelope rests after each phase. */
const ENVELOPE_AT: Record<"none" | Light, Vec3> = {
  none: [DESK[0], 0.3, DESK[2]],
  built: [DESK[0], 0.3, DESK[2]],
  signed: [DESK[0], 0.3, DESK[2]],
  broadcast: [NODE[0], NODE_H + 0.02, NODE[2]],
  included: [NEW_BLOCK[0], CUBE + 0.02, CHAIN_Z],
  final: [NEW_BLOCK[0], CUBE + 0.02, CHAIN_Z],
};

export default function Scene3D({
  tx,
  flat,
  reducedMotion,
}: {
  tx: Tx;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const { step, lit, events, me, receiver, selfSend } = tx;
  const [picked, setPicked] = useState<"me" | "receiver" | null>(null);
  const phone = useMediaQuery("(max-width: 899px)");
  // Fit the step's objects into the 3D window, whatever its size (desktop, tablet, phone).
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  const view = frameCamera(shotFor(step, phone), frame, size.width, size.height, 0.92, { nearFit: true });
  // On a phone's small window, the overview hides the object names so the balances stay readable.
  const quiet = phone && !(step >= BUILD && step <= SEND);
  const phase: "none" | Light = lit.final
    ? "final"
    : lit.included
      ? "included"
      : lit.broadcast
        ? "broadcast"
        : lit.signed
          ? "signed"
          : lit.built
            ? "built"
            : "none";
  const amount = tx.shownAmount !== null ? near(tx.shownAmount) : null;
  const failed = !!tx.failedAt;
  const latest = events.final ?? events.included ?? events.broadcast;
  const coinMoved = !!events.included;

  const description = [
    `Your practice account${tx.senderNow !== null ? ` with ${near(tx.senderNow)}` : ""}`,
    `the receiver${tx.receiverNow !== null ? ` with ${near(tx.receiverNow)}` : ""}`,
    `your device, an RPC node and a chain of blocks.`,
    phase === "none"
      ? "The transaction is not built yet."
      : `The transaction (${amount ?? "a transfer"}) is ${
          {
            built: "built",
            signed: "signed",
            broadcast: "at the RPC node",
            included: "in a new block",
            final: "final",
          }[phase]
        }${failed ? ", and sending failed" : ""}.`,
  ].join(", ");

  return (
    <div ref={box} className="stx-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={tx.state}
        status={tx.status ?? ""}
        description={description}
        onMiss={() => setPicked(null)}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />
        {/* The two accounts. The coin is the amount you typed; it moves only when a block includes the transfer. */}
        <AccountBlock
          position={SENDER}
          size={ACCT}
          name={tx.senderNow !== null ? balance(tx.senderNow, tx.stage) : "…"}
          pickLabel="Your practice account"
          selected={picked === "me"}
          onPick={() => setPicked((p) => (p === "me" ? null : "me"))}
        />
        <Label position={[SENDER[0], 0.25, SENDER[2] + ACCT / 2 + 0.45]} variant="small">
          {phone || !me ? "you" : `you · ${short(me.accountId, 6, 4)}`}
        </Label>
        {/* Where the step notes point (the 2D view marks its cards and lights with the same names). */}
        <Anchor name="account" position={[SENDER[0] - ACCT * 0.3, ACCT * 0.6, SENDER[2]]} />
        <Anchor name="sign" position={[DESK[0] - 1.2, 0.75, DESK[2] - 0.3]} />
        <Anchor name="rpc" position={[NODE[0], NODE_H * 0.6, NODE[2]]} />
        <Anchor name="block" position={[NEW_BLOCK[0], CUBE / 2, CHAIN_Z]} />
        <Anchor name="final" position={[NEW_BLOCK[0], CUBE / 2, CHAIN_Z]} />
        <AccountBlock
          position={RECEIVER}
          size={ACCT}
          color={COLORS.blue}
          name={selfSend ? "you again" : tx.receiverNow !== null ? near(tx.receiverNow) : "…"}
          pickLabel="Receiver account"
          selected={picked === "receiver"}
          onPick={() => setPicked((p) => (p === "receiver" ? null : "receiver"))}
        />
        <Label position={[RECEIVER[0], 0.25, RECEIVER[2] + ACCT / 2 + 0.45]} variant="small">
          {phone || !receiver ? "receiver" : short(receiver, 10, 6)}
        </Label>
        {picked ? (
          <Label
            position={[
              picked === "me" ? SENDER[0] : RECEIVER[0],
              0.25,
              (picked === "me" ? SENDER : RECEIVER)[2] + 1.6,
            ]}
            variant="hint"
          >
            {picked === "me"
              ? `your practice account ${me ? short(me.accountId, 6, 4) : ""}`
              : selfSend
                ? "the same account: you send to yourself"
                : `the app's return account ${receiver ? short(receiver, 10, 6) : ""}`}
          </Label>
        ) : null}
        {amount ? (
          <Traveller
            to={coinMoved ? [RECEIVER[0], ACCT + 0.08, RECEIVER[2]] : [SENDER[0], ACCT + 0.08, SENDER[2]]}
            arc={2.4}
            duration={1}
            color={COLORS.gold}
          >
            <Coin />
            <Label position={[0, -0.55, ACCT / 2 + 0.05]} variant="small">
              {amount}
            </Label>
          </Traveller>
        ) : null}

        {/* Your device: where the transaction is built and signed, with no network. */}
        <Desk
          onPick={tx.canBuild ? tx.build : undefined}
          hint={step === BUILD && !tx.built ? "press Build" : undefined}
          quiet={quiet}
        />
        <group position={[DESK[0] - 1.2, 0.75, DESK[2] - 0.3]} scale={0.6}>
          <Key
            rotation={[0, -0.5, tx.signed ? -1.3 : -0.3]}
            name={step === SIGN ? "your private key" : undefined}
            pickLabel="Sign with your private key"
            onPick={tx.canSign ? tx.sign : undefined}
          />
        </group>

        {/* The RPC node: a server that passes the transaction into the network. */}
        <RpcNode
          onPick={tx.canSend ? tx.send : undefined}
          failed={failed && phase === "broadcast"}
          quiet={quiet}
        />

        {/* The chain: blocks in a row; a new one arrives with your transaction inside. */}
        <Chain
          included={events.included ? `#${events.included.blockHeight}` : null}
          final={!!events.final}
          quiet={quiet}
        />

        {/* The transaction itself. */}
        <Traveller
          to={ENVELOPE_AT[phase]}
          arc={phase === "included" ? 3 : 2.2}
          duration={0.9}
          glow={phase !== "none"}
        >
          <Envelope sealed={!!tx.signed} failed={failed} blank={phase === "none"} />
          <Anchor name="tx" position={[0, 0.15, 0]} />
          <Anchor name="fee" position={[0, 0.15, 0]} />
          {/* The explorer shows this transaction; 2D points at the explorer card instead. */}
          <Anchor name="explorer" position={[0, 0.15, 0]} />
          <EnvelopeLabels tx={tx} amount={amount} phase={phase} failed={failed} phone={phone} />
        </Traveller>

        {/* Stopwatch: the time of the latest real phase event, from the moment you pressed Send. */}
        {step >= SEND && latest ? (
          <Label position={phone ? [-2.4, 0.3, -1.5] : [NEW_BLOCK[0], 2.45, CHAIN_Z]} variant="hint">
            {events.final
              ? `stopwatch: final in ${duration(events.final.atMs)}`
              : `stopwatch: +${duration(latest.atMs)}`}
          </Label>
        ) : null}
      </InkStage>
    </div>
  );
}

/**
 * The size of the 3D window and the height of its status line (one or two lines), kept up to date as
 * the layout or the status changes. The picture is fitted below the status line.
 */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 640, height: 400, status: 40 });
  const measure = useRef<() => void>(() => undefined);
  measure.current = () => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth || 640;
    const height = el.clientHeight || 400;
    const s = el.querySelector<HTMLElement>(".sk-status");
    const status = s?.textContent ? s.offsetTop + s.offsetHeight + 6 : 12;
    setSize((p) =>
      p.width === width && p.height === height && p.status === status ? p : { width, height, status },
    );
  };
  // After every render (the status text may have changed), and whenever the window resizes.
  useLayoutEffect(() => measure.current());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** "≈ 4.98955 NEAR" while gas is held, the plain balance otherwise (same as the 2D cards). */
function balance(value: bigint, stage: Tx["stage"]): string {
  return `${stage === "included" ? "≈ " : ""}${near(value)}`;
}

// ---------- labels riding on the envelope ----------

function EnvelopeLabels({
  tx,
  amount,
  phase,
  failed,
  phone,
}: {
  tx: Tx;
  amount: string | null;
  phase: "none" | Light;
  failed: boolean;
  phone: boolean;
}) {
  const { step, built, signed } = tx;
  if (failed)
    return (
      <Label position={[0, 0.75, 0]} variant="hint">
        {"not sent: see the message"}
      </Label>
    );
  if (step === BUILD) {
    if (!built)
      return (
        <Label position={[0, 0.55, 0]} variant="small">
          {"empty transaction"}
        </Label>
      );
    // The fields appear as soon as the chain has built the transaction (all of them in the facts card).
    if (phone)
      return <Label position={[0, 0.6, 0]} variant="small">{`built: transfer ${amount ?? ""}`}</Label>;
    return (
      <>
        <Label position={[0, 1.55, 0]} variant="small">{`to ${short(built.receiverId, 10, 6)}`}</Label>
        <Label position={[0, 1.2, 0]} variant="small">{`transfer ${amount ?? ""}`}</Label>
        <Label position={[0, 0.85, 0]} variant="small">{`nonce ${built.nonce.toString()}`}</Label>
        <Label position={[0, 0.5, 0]} variant="small">{`block hash ${short(built.blockHash, 6, 4)}`}</Label>
      </>
    );
  }
  if (step === FEE && built)
    return <Label position={[0, 0.6, 0]} variant="small">{`fee about ${near(TRANSFER_FEE)}`}</Label>;
  if (step === SIGN && signed && !phone)
    return <Label position={[0, 0.6, 0]} variant="small">{`sealed · ID ${short(signed.hash, 6, 4)}`}</Label>;
  if (phase === "none") return null;
  return (
    <Label position={[0, 0.6, 0]} variant="small">
      {amount ?? "transfer"}
    </Label>
  );
}

// ---------- objects made for this lesson ----------

/** The transaction: a paper envelope. A seal (your signature) appears once it is signed. */
function Envelope({ sealed, failed, blank }: { sealed: boolean; failed: boolean; blank: boolean }) {
  const paper = useInk(failed ? "#f4c9c4" : COLORS.paper);
  const seal = useInk(COLORS.orange);
  return (
    <group>
      <mesh position={[0, 0.06, 0]} material={paper}>
        <boxGeometry args={[1.2, 0.12, 0.82]} />
        <Outline />
      </mesh>
      <Line
        points={[
          [-0.58, 0.125, -0.39],
          [0, 0.125, 0.06],
          [0.58, 0.125, -0.39],
        ]}
        color={INK}
        lineWidth={blank ? 1 : 1.8}
        dashed={blank}
        dashSize={0.08}
        gapSize={0.06}
      />
      {sealed ? (
        <Pop>
          <mesh position={[0, 0.15, 0.06]} material={seal}>
            <cylinderGeometry args={[0.17, 0.17, 0.06, 28]} />
            <Outline mode="hull" thickness={0.025} />
            <Outline />
          </mesh>
        </Pop>
      ) : null}
    </group>
  );
}

/** A low slab: your device. Pick it to build the transaction on the Build step. */
function Desk({ onPick, hint, quiet }: { onPick?: () => void; hint?: string; quiet: boolean }) {
  const ink = useInk(COLORS.slab);
  const slab = (
    <group>
      <mesh position={[0, 0.15, 0]} material={ink}>
        <boxGeometry args={[1.8, 0.3, 1.3]} />
        <Outline />
      </mesh>
      {quiet ? null : (
        <Label position={[0, 0.3, 0.95]} variant="small">
          your device
        </Label>
      )}
      {hint ? (
        <Label position={[0, 1.75, 0]} variant="hint">
          {hint}
        </Label>
      ) : null}
    </group>
  );
  return (
    <group position={DESK}>
      <SoftShadow position={[0, 0, 0.2]} size={[2.7, 1.9]} />
      {onPick ? (
        <Pickable label="Build the transaction" onPick={onPick} anchor={[0, 0.4, 0]}>
          {slab}
        </Pickable>
      ) : (
        slab
      )}
    </group>
  );
}

/** A server tower with an antenna. Pick it to send on the Send step. */
function RpcNode({ onPick, failed, quiet }: { onPick?: () => void; failed: boolean; quiet: boolean }) {
  const body = useInk(failed ? "#f4c9c4" : COLORS.contract);
  const dark = useInk(INK);
  const tower = (
    <group>
      <mesh position={[0, NODE_H / 2, 0]} material={body}>
        <boxGeometry args={[1, NODE_H, 1]} />
        <Outline />
      </mesh>
      {[0.4, 0.7, 1].map((y) => (
        <mesh key={y} position={[0, y, 0.51]} material={dark}>
          <boxGeometry args={[0.6, 0.06, 0.02]} />
        </mesh>
      ))}
      {[0.28, 0.48].map((r) => (
        <mesh key={r} position={[0.3, NODE_H - 0.02, 0.3]} rotation={[0, Math.PI / 4, 0]} material={dark}>
          <torusGeometry args={[r, 0.03, 6, 24, Math.PI]} />
        </mesh>
      ))}
      {quiet ? null : (
        <Label position={[0, 0.05, 0.85]} variant="small">
          RPC node
        </Label>
      )}
    </group>
  );
  return (
    <group position={NODE}>
      <SoftShadow position={[0, 0, 0.3]} size={[2.1, 1.4]} />
      {onPick ? (
        <Pickable label="Send to the RPC node" onPick={onPick} anchor={[0, NODE_H / 2, 0]}>
          {tower}
        </Pickable>
      ) : (
        tower
      )}
    </group>
  );
}

/** The chain: older blocks linked in a row. Your block drops in on Included and gets a lock on Final. */
function Chain({ included, final, quiet }: { included: string | null; final: boolean; quiet: boolean }) {
  const old = useInk(COLORS.chain);
  const fresh = useInk(COLORS.orange);
  const link = useInk(INK);
  const xs = included ? [...OLD_BLOCKS, NEW_BLOCK[0]] : OLD_BLOCKS;
  return (
    <group>
      <SoftShadow position={[0.4, 0, CHAIN_Z + 0.3]} size={[7.5, 1.6]} />
      {OLD_BLOCKS.map((x) => (
        <mesh key={x} position={[x, CUBE / 2, CHAIN_Z]} material={old}>
          <boxGeometry args={[CUBE, CUBE, CUBE]} />
          <Outline />
        </mesh>
      ))}
      {xs.slice(1).map((x) => (
        <mesh key={x} position={[x - GAP / 2, CUBE / 2, CHAIN_Z]} material={link}>
          <boxGeometry args={[GAP - CUBE + 0.1, 0.08, 0.08]} />
        </mesh>
      ))}
      {quiet ? null : (
        <Label position={[OLD_BLOCKS[0]!, 0.05, CHAIN_Z + 0.95]} variant="small">
          the chain
        </Label>
      )}
      {included ? (
        <group position={NEW_BLOCK}>
          <Drop>
            <mesh position={[0, CUBE / 2, 0]} material={fresh}>
              <boxGeometry args={[CUBE, CUBE, CUBE]} />
              <Outline />
            </mesh>
          </Drop>
          <Label position={[0, 0.05, 0.95]} variant="small">{`block ${included}`}</Label>
          {final ? (
            <Pop>
              <Lock position={[0, 0.45, CUBE / 2 + 0.1]} />
            </Pop>
          ) : null}
        </group>
      ) : null}
    </group>
  );
}

/** A padlock: the block is final and will never change. */
function Lock({ position }: { position: Vec3 }) {
  const gold = useInk(COLORS.gold);
  return (
    <group position={position}>
      <mesh material={gold}>
        <boxGeometry args={[0.5, 0.4, 0.16]} />
        <Outline />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={gold}>
        <torusGeometry args={[0.15, 0.045, 8, 20, Math.PI]} />
        <Outline mode="hull" thickness={0.02} />
      </mesh>
    </group>
  );
}

// ---------- tiny motions (end state at once under reduced motion) ----------

/** Falls into place from above when it first appears. */
function Drop({ children }: { children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  useLayoutEffect(() => {
    if (g.current) g.current.position.y = reducedMotion ? 0 : 2.4;
  }, [reducedMotion]);
  useAnimatedFrame((_, dt) => {
    const o = g.current;
    if (!o || o.position.y <= 0) return false;
    o.position.y = Math.max(0, o.position.y - dt * 6);
    return o.position.y > 0;
  });
  return <group ref={g}>{children}</group>;
}

/** Grows from nothing to full size when it first appears. */
function Pop({ children }: { children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  useLayoutEffect(() => {
    g.current?.scale.setScalar(reducedMotion ? 1 : 0.01);
  }, [reducedMotion]);
  useAnimatedFrame((_, dt) => {
    const o = g.current;
    if (!o || o.scale.x >= 1) return false;
    o.scale.setScalar(Math.min(1, o.scale.x + dt * 4));
    return o.scale.x < 1;
  });
  return <group ref={g}>{children}</group>;
}
