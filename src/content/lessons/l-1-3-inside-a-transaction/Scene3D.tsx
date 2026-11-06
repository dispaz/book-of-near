/**
 * Lesson 1.3 in 3D: the signer on the left, the receiver on the right, and the transaction between them
 * as a stack of action slabs (the first action on top). When a batch is sent, the stack hops toward the
 * receiver and each slab takes its colour: done, undone, failed or never ran. A copy sent again stays
 * at the signer with the chain's reason. It only draws the shared state from useTxLesson. Loaded lazily
 * from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  AccountBlock,
  Anchor,
  COLORS,
  ContractBlock,
  InkStage,
  Label,
  Outline,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  useInk,
} from "../../../scene-kit";
import type { Vec3 } from "../../../scene-kit/motion";
import { useMediaQuery } from "../../../ui/hooks";
import { FATE_TEXT, SHORT_NAME, short, type Fate } from "./batch";
import { MADE, MAX_SLABS, RECEIVER, SIGNER, SIZE, SLAB, shot, slabY, stackAt } from "./layout3d";
import { BREAK, BUILD, HOOK, OPEN, REPLAY, type Lesson } from "./useTxLesson";

type Slab = { key: string; text: string; fate: Fate | "idle" };

const FATE_COLOR: Record<Slab["fate"], string> = {
  idle: COLORS.paper,
  done: COLORS.green,
  undone: COLORS.slab,
  failed: COLORS.red,
  skipped: COLORS.slab,
};

/** A mark after each action's name: done, undone, failed, never ran. */
const FATE_MARK: Record<Fate, string> = {
  done: "✓",
  undone: "↺",
  failed: "✗",
  skipped: "–",
};

export default function Scene3D({
  lesson,
  flat,
  reducedMotion,
}: {
  lesson: Lesson;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const { step, me, workshop, last, worked, items, refused } = lesson;
  const phone = useMediaQuery("(max-width: 899px)");
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  const view = frameCamera(shot(phone), frame, size.width, size.height, 0.92, { nearFit: true });

  // Who stands where at this step. Left: the signer. Right: the receiver of the transaction on show.
  const early = step <= OPEN;
  const signerName = early ? "your practice account" : workshop ? short(workshop.id, 14, 8) : "workshop";
  // The rows on the builder are the batch just sent: the scene shows what happened to it.
  const sentNow = !!last && last.items === items && (step === BUILD || step === BREAK);
  const shownBatch = step === REPLAY ? worked : sentNow ? last : null;
  const receiverName = early
    ? "testnet registrar"
    : shownBatch
      ? short(shownBatch.receiver, 14, 8)
      : lesson.readName?.ok
        ? short(lesson.readName.id, 14, 8)
        : "new account";

  // The stack: what the transaction carries at this step (the first action on top).
  let slabs: Slab[];
  if (step === HOOK)
    slabs = [1, 2, 3].map((n) => ({ key: `slot${n}`, text: `action ${n}`, fate: "idle" as const }));
  else if (step === OPEN)
    slabs = workshop
      ? workshop.outcome.transaction.actions.map((a, i) => ({
          key: `w${i}`,
          text: a.type === "FunctionCall" ? `call ${a.methodName}` : a.type,
          fate: "done" as const,
        }))
      : [{ key: "w", text: "call create_account", fate: "idle" }];
  else if (shownBatch)
    slabs = shownBatch.items.map((it, i) => ({
      key: `s${it.id}`,
      text: SHORT_NAME[it.kind],
      fate: step === REPLAY ? ("idle" as const) : (shownBatch.fates[i] ?? "skipped"),
    }));
  else slabs = items.map((it) => ({ key: `b${it.id}`, text: SHORT_NAME[it.kind], fate: "idle" as const }));
  const replayed = step === REPLAY && refused.length > 0;
  const sent = (step === OPEN && !!workshop) || sentNow || (step === REPLAY && !replayed);

  // Back right: the account an earlier step made, kept in view.
  const made =
    step === OPEN && workshop
      ? { name: short(workshop.id, 14, 8), note: "made by this transaction" }
      : step === BREAK && worked
        ? { name: short(worked.receiver, 14, 8), note: "made in step 3" }
        : null;

  const failed = shownBatch && !shownBatch.ok ? shownBatch : null;
  const description = [
    `On the left ${signerName}, on the right ${receiverName}.`,
    slabs.length
      ? `The transaction carries ${slabs.length} action${slabs.length === 1 ? "" : "s"}: ${slabs
          .map((s) => `${s.text}${s.fate === "idle" ? "" : ` (${FATE_TEXT[s.fate].toLowerCase()})`}`)
          .join(", ")}.`
      : "The transaction has no actions yet.",
    failed ? `${failed.receiver} was rolled back: it was not created.` : "",
    replayed ? `The copy was refused: ${refused[refused.length - 1]?.reason}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const shownNonce =
    step === REPLAY && worked
      ? worked.signed.nonce
      : step === OPEN && workshop
        ? workshop.outcome.transaction.nonce
        : shownBatch
          ? shownBatch.signed.nonce
          : null;

  return (
    <div ref={box} className="tl-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={lesson.state}
        status={lesson.status ?? ""}
        description={description}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />
        <AccountBlock
          position={SIGNER}
          size={SIZE}
          color={early ? COLORS.blue : COLORS.orange}
          name={signerName}
          note={me && !phone ? "signer" : undefined}
        />
        {early ? (
          <ContractBlock
            position={RECEIVER}
            size={SIZE}
            color={COLORS.contract}
            name={receiverName}
            note={phone ? undefined : "receiver"}
          />
        ) : shownBatch?.ok ? (
          <AccountBlock
            position={RECEIVER}
            size={SIZE}
            color={COLORS.blue}
            name={receiverName}
            note={phone ? undefined : "receiver"}
            coins={1}
          />
        ) : (
          <>
            <Ghost position={RECEIVER} />
            <Label position={[RECEIVER[0], SIZE + 0.9, RECEIVER[2]]} variant="hint">
              {failed
                ? failed.existsAfter
                  ? `${receiverName}: unchanged`
                  : `${receiverName}: rolled back, not created`
                : `${receiverName}: not created yet`}
            </Label>
          </>
        )}
        <Anchor name="result" position={[RECEIVER[0], 0.8, RECEIVER[2]]} />
        {made ? (
          <AccountBlock
            position={MADE}
            size={SIZE}
            color={step === OPEN ? COLORS.orange : COLORS.blue}
            name={made.name}
            note={made.note}
          />
        ) : null}

        <Traveller to={stackAt(sent)} arc={2.2} duration={0.9} color={COLORS.orange}>
          {slabs.slice(0, MAX_SLABS).map((s, i) => (
            <ActionSlab key={s.key} y={slabY(i, slabs.length)} fate={s.fate} text={`${i + 1} ${s.text}`} />
          ))}
          {slabs.length > MAX_SLABS ? (
            <Label position={[0, slabY(0, slabs.length) + 0.5, 0]} variant="small">
              {`+${slabs.length - MAX_SLABS} more`}
            </Label>
          ) : null}
          {slabs.some((s) => s.fate !== "idle" && s.fate !== "done") ? (
            <Label position={[0, -0.75, SLAB.d / 2 + 0.55]} variant="small">
              {"↺ undone · ✗ failed · – never ran"}
            </Label>
          ) : null}
          {shownNonce !== null ? (
            <Label position={[0, -0.3, SLAB.d / 2 + 0.55]} variant="small">
              {`nonce ${shownNonce}`}
            </Label>
          ) : null}
          <Anchor
            name={step === HOOK ? "tx" : step === BUILD ? "builder" : step === REPLAY ? "replay" : "fields"}
            position={[0, slabY(0, Math.max(1, slabs.length)) + 0.3, 0]}
          />
        </Traveller>
        {replayed ? (
          <Label position={[stackAt(false)[0], 3, stackAt(false)[2]]} variant="hint">
            {`copy refused: ${refused[refused.length - 1]?.reason ?? ""}. Nothing ran.`}
          </Label>
        ) : null}
      </InkStage>
    </div>
  );
}

/** One action of the transaction: a flat slab, coloured by what happened to it, with its name on it. */
function ActionSlab({ y, fate, text }: { y: number; fate: Slab["fate"]; text: string }) {
  const ink = useInk(FATE_COLOR[fate]);
  return (
    <group position={[0, y, 0]}>
      <mesh material={ink}>
        <boxGeometry args={[SLAB.w, SLAB.h, SLAB.d]} />
        <Outline />
      </mesh>
      <Label position={[0, 0, SLAB.d / 2 + 0.02]} variant="small">
        {fate === "idle" ? text : `${text} ${FATE_MARK[fate]}`}
      </Label>
    </group>
  );
}

/** Where an account that does not exist would stand: a flat outline on the ground. */
function Ghost({ position }: { position: Vec3 }) {
  const ink = useInk(COLORS.slab);
  return (
    <mesh position={[position[0], 0.03, position[2]]} material={ink}>
      <boxGeometry args={[SIZE, 0.06, SIZE]} />
      <Outline />
    </mesh>
  );
}

/** The size of the 3D window and the height of its status line, kept up to date as the layout changes. */
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
