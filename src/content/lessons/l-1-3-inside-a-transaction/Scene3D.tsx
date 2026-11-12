/**
 * Lesson 1.3 in 3D: the signer (a mailbox) on the left, the receiver on the right, and the transaction
 * between them as an open parcel with its action cards above it (the first action on top). It is packed
 * unstamped, stamped when signed, and hops toward the receiver when sent; each card then takes its colour:
 * done, undone, failed or never ran. A failed batch turns the parcel red. A copy sent again stays at the
 * signer with the chain's reason. It only draws the shared state from useTxLesson. Loaded lazily
 * from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useRef } from "react";
import {
  Anchor,
  COLORS,
  InkStage,
  Label,
  Mailbox,
  Parcel,
  Scroll,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  type ParcelItem,
  useBoxSize,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { shortId as short } from "../../../ui/format";
import { FATE_TEXT, SHORT_NAME } from "./batch";
import { replayShort } from "./replay";
import { MADE, MAX_ITEMS, OBJ, PARCEL, RECEIVER, SIGNER, SIZE, parcelAt, shot } from "./layout3d";
import { BREAK, BUILD, HOOK, OPEN, REPLAY, type Lesson } from "./useTxLesson";

type Slab = ParcelItem;

export default function Scene3D({
  lesson,
  flat,
  reducedMotion,
}: {
  lesson: Lesson;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const { step, me, workshop, last, worked, items, notRun } = lesson;
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
    slabs = workshop?.outcome
      ? workshop.outcome.transaction.actions.map((a, i) => ({
          key: `w${i}`,
          text: a.type === "FunctionCall" ? `call ${a.methodName}` : a.type,
          fate: "done" as const,
        }))
      : [{ key: "w", text: "call create_account", fate: workshop ? ("done" as const) : ("idle" as const) }];
  else if (shownBatch)
    slabs = shownBatch.items.map((it, i) => ({
      key: `s${it.id}`,
      text: SHORT_NAME[it.kind],
      fate: step === REPLAY ? ("idle" as const) : (shownBatch.fates[i] ?? "skipped"),
    }));
  else slabs = items.map((it) => ({ key: `b${it.id}`, text: SHORT_NAME[it.kind], fate: "idle" as const }));
  const replayed = step === REPLAY && notRun.length > 0;
  // The chain's reason for the latest copy it would not run, in a few words.
  const why = replayShort(notRun[notRun.length - 1]?.reason ?? null);
  const sent = (step === OPEN && !!workshop) || sentNow || (step === REPLAY && !replayed);
  // Signed (stamped) once it has been sent, or at the replay step, where it is the old signed copy.
  const signed = sent || step === REPLAY;

  // Back right: the account an earlier step made, kept in view.
  const made =
    step === OPEN && workshop
      ? { name: short(workshop.id, 14, 8), note: "made by this transaction" }
      : step === BREAK && worked
        ? { name: short(worked.receiver, 14, 8), note: "made earlier" }
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
    replayed ? `The copy did not run again: ${why}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const shownNonce =
    step === REPLAY && worked
      ? worked.signed.nonce
      : step === OPEN && workshop?.outcome
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
        <Mailbox
          position={SIGNER}
          size={OBJ}
          color={early ? COLORS.blue : COLORS.orange}
          name={signerName}
          note={me && !phone ? "signer" : undefined}
        />
        {early ? (
          <Scroll
            position={RECEIVER}
            size={OBJ}
            name={receiverName}
            note={phone ? undefined : "receiver"}
            running={step === OPEN && !!workshop}
          />
        ) : shownBatch?.ok ? (
          <Mailbox
            position={RECEIVER}
            size={OBJ}
            color={COLORS.blue}
            name={receiverName}
            note={phone ? undefined : "receiver"}
            flag
            coins={1}
          />
        ) : (
          <>
            <Mailbox position={RECEIVER} size={OBJ} name={receiverName} state="pending" />
            <Label position={[RECEIVER[0], 0.2, RECEIVER[2] + SIZE / 2 + 0.6]} variant="hint">
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
          <Mailbox
            position={MADE}
            size={OBJ}
            color={step === OPEN ? COLORS.orange : COLORS.blue}
            name={made.name}
            note={made.note}
          />
        ) : null}

        <Traveller to={parcelAt(sent)} arc={2.2} duration={0.9} color={COLORS.orange}>
          <Parcel
            size={PARCEL}
            open
            stamped={signed}
            state={failed ? "failed" : "ok"}
            items={slabs}
            maxItems={MAX_ITEMS}
            name="the transaction"
          />
          {slabs.some((s) => s.fate !== "idle" && s.fate !== "done") ? (
            <Label position={[0, 0.05, PARCEL * 0.9]} variant="small">
              {"↺ undone · ✗ failed · – never ran"}
            </Label>
          ) : null}
          {shownNonce !== null ? (
            <Label position={[0, 0.05, PARCEL * 0.9 + 0.4]} variant="small">
              {`nonce ${shownNonce}`}
            </Label>
          ) : null}
          <Anchor
            name={step === HOOK ? "tx" : step === BUILD ? "builder" : step === REPLAY ? "replay" : "fields"}
            position={[0, PARCEL * 0.9, 0]}
          />
        </Traveller>
        {replayed ? (
          <Label
            position={[parcelAt(false)[0], 0.05, parcelAt(false)[2] + PARCEL * 0.9 + 0.85]}
            variant="hint"
          >
            {`copy not run again: ${why}`}
          </Label>
        ) : null}
      </InkStage>
    </div>
  );
}
