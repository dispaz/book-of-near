/**
 * Lesson 1.1 in 3D: your account (a mailbox), the registrar (a contract: a scroll that runs code) and the
 * new account in a row. The new account starts as a dashed mailbox; the create transaction travels to the
 * registrar as a stamped parcel, and when the account exists a solid mailbox drops in and the 0.1 NEAR coin
 * lands in it. The compare step puts the named mailbox beside the dashed one of its hex twin. It only draws the shared state
 * from useClaim. Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Group } from "three";
import {
  Anchor,
  Coin,
  InkStage,
  Label,
  Mailbox,
  Parcel,
  Scroll,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  useStage,
  useAnimatedFrame,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { near, short } from "../l-0-3-send-a-transaction/tx";
import { HEX, ME, NAMED, NEW_ACCOUNT, OBJ, REGISTRAR, SIZE, coinAt, parcelAt, shotFor } from "./layout3d";
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
  const sending = { busy: !!busy, created: !!created };
  const coin = coinAt(sending);

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
            {/* Your practice account: a mailbox. */}
            <Mailbox
              position={ME}
              size={OBJ}
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
            {/* The registrar: a contract (a scroll that runs code) that makes .testnet names. */}
            <Scroll
              position={REGISTRAR}
              size={OBJ}
              name="testnet"
              note={phone ? undefined : "registrar"}
              running={busy}
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

            {/* The new account: a dashed mailbox until the registrar makes it. */}
            {created ? (
              <Drop>
                <Mailbox position={NEW_ACCOUNT} size={OBJ} name={created.id} flag />
              </Drop>
            ) : (
              <>
                <Mailbox position={NEW_ACCOUNT} size={OBJ} name={newName} state="pending" />
                <Label position={[NEW_ACCOUNT[0], 0.25, NEW_ACCOUNT[2] + SIZE / 2 + 0.45]} variant="small">
                  not created yet
                </Label>
              </>
            )}
            <Anchor name="name-box" position={[NEW_ACCOUNT[0], SIZE * 0.6, NEW_ACCOUNT[2]]} />

            {/* The create transaction: a stamped parcel to the registrar, carrying the 0.1 NEAR. */}
            {step >= CREATE ? (
              <Traveller to={parcelAt(sending)} arc={2.2} duration={0.9}>
                <Parcel size={0.7} stamped name="the create transaction" />
                <Label position={[0, 0.05, 0.85]} variant="small">
                  {created ? "delivered" : busy ? "on its way" : "create_account + 0.1 NEAR"}
                </Label>
              </Traveller>
            ) : null}
            {coin ? (
              <Traveller to={coin} arc={2.2} duration={0.9}>
                <Coin />
                <Label position={[0, 0.05, 0.8]} variant="small">
                  0.1 NEAR
                </Label>
              </Traveller>
            ) : null}
          </>
        ) : null}

        {step === COMPARE && created ? (
          <>
            <Mailbox position={NAMED} size={OBJ} name={created.id} />
            <Label position={[NAMED[0], 0.25, NAMED[2] + SIZE / 2 + 0.45]} variant="small">
              named · exists
            </Label>
            <Mailbox position={HEX} size={OBJ} name={short(created.hexId, 8, 6)} state="pending" />
            <Label position={[HEX[0], 0.25, HEX[2] + SIZE / 2 + 0.45]} variant="small">
              hex · not created
            </Label>
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

// ---------- motion made for this lesson ----------

/** Falls into place from above when it first appears (at once under reduced motion). */
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
