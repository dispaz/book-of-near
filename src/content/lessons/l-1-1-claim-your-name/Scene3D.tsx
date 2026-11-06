/**
 * Lesson 1.1 in 3D: your account, the registrar and the new account in a row. The new account starts as
 * a dashed ghost; when the registrar creates it, a solid block drops in with its name on a label. The
 * compare step puts the named block beside the ghost of its hex twin. It only draws the shared state
 * from useClaim. Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Group } from "three";
import {
  AccountBlock,
  Anchor,
  Coin,
  ContractBlock,
  InkStage,
  INK,
  Label,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  useStage,
  type Vec3,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { near, short } from "../l-0-3-send-a-transaction/tx";
import { HEX, ME, NAMED, NEW_ACCOUNT, REGISTRAR, SIZE, shotFor } from "./layout3d";
import { COMPARE, CONCEPT, CREATE, PICK, type Claim } from "./useClaim";

export default function Scene3D({
  claim,
  flat,
  reducedMotion,
}: {
  claim: Claim;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const { step, created, me, id, free, busy } = claim;
  const phone = useMediaQuery("(max-width: 899px)");
  const [picked, setPicked] = useState<"me" | "registrar" | null>(null);
  // Fit the step's objects into the 3D window, whatever its size (desktop, tablet, phone).
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  const view = frameCamera(shotFor(step, phone), frame, size.width, size.height, 0.92, { nearFit: true });

  const myName = me ? short(me.accountId, 6, 4) : "…";
  const description =
    step === COMPARE && created
      ? `The named account ${created.id}, which exists, beside the hex id ${created.hexId}, which this key would have as an implicit account and which is not created.`
      : [
          `Your practice account ${myName}${claim.start !== null ? ` with ${near(claim.start)}` : ""}`,
          step >= CONCEPT ? "the testnet registrar" : "",
          step >= CONCEPT
            ? created
              ? `and your new account ${created.id} with ${near(created.balance)}.`
              : "and a dashed outline where your new account will be."
            : ".",
        ]
          .filter(Boolean)
          .join(", ");

  const newName = created
    ? created.id
    : id && (free || step >= CREATE)
      ? id
      : step === PICK
        ? "…"
        : "your name?";
  const coinAt: Vec3 = created
    ? [NEW_ACCOUNT[0], SIZE + 0.08, NEW_ACCOUNT[2]]
    : busy
      ? [REGISTRAR[0], SIZE + 0.08, REGISTRAR[2]]
      : [ME[0], SIZE + 0.08, ME[2]];

  return (
    <div ref={box} className="stx-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={claim.state}
        status={claim.status ?? ""}
        description={description}
        onMiss={() => setPicked(null)}
        minDistance={3}
        maxDistance={60}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />

        {step !== COMPARE ? (
          <>
            {/* Your practice account. */}
            <AccountBlock
              position={ME}
              size={SIZE}
              name={claim.start !== null ? near(claim.start) : "…"}
              pickLabel="Your practice account"
              selected={picked === "me"}
              onPick={() => setPicked((p) => (p === "me" ? null : "me"))}
            />
            <Label position={[ME[0], 0.25, ME[2] + SIZE / 2 + 0.45]} variant="small">
              {phone ? "you" : `you · ${myName}`}
            </Label>
            <Anchor name="account" position={[ME[0], SIZE * 0.6, ME[2]]} />
            {picked === "me" ? (
              <Label position={[ME[0], 0.25, ME[2] + 1.7]} variant="hint">
                {`your practice account ${me?.accountId ?? ""}`}
              </Label>
            ) : null}
          </>
        ) : null}

        {step >= CONCEPT && step !== COMPARE ? (
          <>
            {/* The registrar: a contract that makes .testnet names. Pick it on the Create step. */}
            <ContractBlock
              position={REGISTRAR}
              size={SIZE}
              name="testnet"
              pickLabel={claim.canCreate ? "Ask the registrar to create your name" : "The registrar"}
              selected={picked === "registrar"}
              onPick={
                claim.canCreate
                  ? claim.create
                  : () => setPicked((p) => (p === "registrar" ? null : "registrar"))
              }
            />
            <Anchor name="registrar" position={[REGISTRAR[0], SIZE * 0.6, REGISTRAR[2]]} />
            <Anchor name="create" position={[REGISTRAR[0], SIZE * 0.6, REGISTRAR[2]]} />
            {step === CREATE && claim.canCreate ? (
              <Label position={[REGISTRAR[0], SIZE + 1.9, REGISTRAR[2]]} variant="hint">
                press Create, or pick the registrar
              </Label>
            ) : null}
            {picked === "registrar" ? (
              <Label position={[REGISTRAR[0], 0.25, REGISTRAR[2] + 1.7]} variant="hint">
                a contract that makes accounts ending in .testnet
              </Label>
            ) : null}

            {/* The new account: a dashed ghost until the registrar makes it. */}
            {created ? (
              <Drop>
                <AccountBlock position={NEW_ACCOUNT} size={SIZE} name={created.id} />
              </Drop>
            ) : (
              <Ghost position={NEW_ACCOUNT} size={SIZE} label={newName} sub="not created yet" />
            )}
            <Anchor name="name-box" position={[NEW_ACCOUNT[0], SIZE * 0.6, NEW_ACCOUNT[2]]} />

            {/* The 0.1 NEAR deposit, on its way to the registrar and on into the new account. */}
            {step >= CREATE ? (
              <Traveller to={coinAt} arc={2.2} duration={0.9}>
                <Coin />
                <Label position={[0, -0.55, SIZE / 2 + 0.05]} variant="small">
                  0.1 NEAR
                </Label>
              </Traveller>
            ) : null}
          </>
        ) : null}

        {step === COMPARE && created ? (
          <>
            <AccountBlock position={NAMED} size={SIZE} name={created.id} />
            <Label position={[NAMED[0], 0.25, NAMED[2] + SIZE / 2 + 0.45]} variant="small">
              named · exists
            </Label>
            <Ghost position={HEX} size={SIZE} label={short(created.hexId, 8, 6)} sub="hex · not created" />
            <Anchor name="compare" position={[0, SIZE * 0.6, 0]} />
          </>
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

// ---------- objects made for this lesson ----------

/** A dashed outline of a block: an account that does not exist (yet). */
function Ghost({ position, size, label, sub }: { position: Vec3; size: number; label: string; sub: string }) {
  const h = size / 2;
  const a: Vec3[] = [
    [-h, 0, -h],
    [h, 0, -h],
    [h, 0, h],
    [-h, 0, h],
    [-h, 0, -h],
  ];
  const top = a.map(([x, , z]) => [x, size, z] as Vec3);
  const posts = a.slice(0, 4).map(([x, , z]) => [[x, 0, z] as Vec3, [x, size, z] as Vec3]);
  const dash = { color: INK, lineWidth: 1.6, dashed: true, dashSize: 0.1, gapSize: 0.08 };
  return (
    <group position={position}>
      <Line points={a} {...dash} />
      <Line points={top} {...dash} />
      {posts.map((p, i) => (
        <Line key={i} points={p} {...dash} />
      ))}
      <Label position={[0, size + 0.55, 0]} variant="small">
        {label}
      </Label>
      <Label position={[0, 0.25, size / 2 + 0.45]} variant="small">
        {sub}
      </Label>
    </group>
  );
}

/** Falls into place from above when it first appears (at once under reduced motion). */
function Drop({ children }: { children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  useLayoutEffect(() => {
    if (g.current) g.current.position.y = reducedMotion ? 0 : 2.4;
  }, [reducedMotion]);
  useFrame((_, dt) => {
    const o = g.current;
    if (!o || o.position.y <= 0) return;
    o.position.y = Math.max(0, o.position.y - dt * 6);
  });
  return <group ref={g}>{children}</group>;
}
