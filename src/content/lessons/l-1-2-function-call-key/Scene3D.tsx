/**
 * Lesson 1.2 in 3D: the Counter app (a screen) with its function-call key on a tag, your account (a
 * mailbox) with your full-access key, the counter contract on it (a scroll), the attacker's mailbox and
 * another contract. Each try is a parcel stamped with the app's key that goes to what it aims at: accepted,
 * or stopped with a red cross and the chain's reason. It only draws the shared state from useKeyLesson.
 * Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useRef, useState } from "react";
import {
  Anchor,
  AppScreen,
  COLORS,
  InkStage,
  Key,
  Label,
  Mailbox,
  Parcel,
  Scroll,
  TaggedKey,
  Traveller,
  ViewOffset,
  frameCamera,
  gaugeShare,
  inset,
  useBoxSize,
} from "../../../scene-kit";
import { ATTEMPT_LABEL, ATTEMPT_SHORT, near, REASON_TEXT, short } from "./key";
import { OBJ, layoutFor } from "./layout3d";
import { ADD, HOOK, LIMIT, type Lesson } from "./useKeyLesson";

type Pick = "app" | "home" | "counter" | "thief" | "other";

const PICK_TEXT: Record<Pick, string> = {
  app: "the Counter app: it holds its own key and signs with it",
  home: "your account: it holds your full-access key",
  counter: "the counter contract on your account: the only thing the app's key may call",
  thief: "an account the app's key should never pay",
  other: "a contract the app's key is not allowed to call",
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
  const { step, keyState, aim, attempts, left, initial, gaugeFrom, counter, me, busy } = lesson;
  const [picked, setPicked] = useState<Pick | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  // Two rows in a tall or square window (phones), short labels in a narrow one (layout3d.ts).
  const L = layoutFor(frame.right - frame.left, frame.bottom - frame.top);
  const { APP, APP_KEY, COUNTER, HOME, MY_KEY, OTHER, THIEF, HINT } = L;
  const compact = L.shortLabels;
  const view = frameCamera(L.shot, frame, size.width, size.height, 0.92, { nearFit: !L.tall });

  const last = attempts[attempts.length - 1];
  const revoked = keyState === "revoked";
  const refusedNow = !!last && !last.ok && !!last.reason;
  const allowance =
    keyState === "active" && left !== null
      ? initial !== null
        ? `${near(left)} of ${near(initial)} NEAR`
        : `${near(left)} NEAR left`
      : revoked
        ? "deleted"
        : "";
  // The app's key shows from the concept step on (as an example until it is really added).
  const showAppKey = step >= LIMIT && !(step === ADD && keyState === "none");
  const pick = (p: Pick) => ({
    selected: picked === p,
    onPick: () => setPicked((q) => (q === p ? null : p)),
  });

  const description = [
    `The Counter app on the left. Your account ${me ? short(me.accountId) : ""} in the middle, with your full-access key and the counter contract at ${counter}.`,
    "On the right the attacker.testnet account and the testnet registrar contract.",
    keyState === "none"
      ? "The app has no key yet."
      : revoked
        ? "The app's key has been deleted."
        : `The app's function-call key has ${left !== null ? near(left) : "some"} NEAR of allowance left.`,
    last
      ? last.ok
        ? `The chain accepted the last try: ${last.label}.`
        : last.reason
          ? `The chain refused the last try, ${last.label}: ${last.reason}.`
          : `The last call was included but failed: ${last.message}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={box} className="kl-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={lesson.state}
        status={lesson.status ?? ""}
        description={description}
        onMiss={() => setPicked(null)}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />

        <AppScreen
          position={APP}
          size={OBJ}
          name="Counter app"
          pickLabel="The Counter app"
          {...pick("app")}
        />
        <Mailbox
          position={HOME}
          size={OBJ}
          name={L.shortNames ? "you" : "your account"}
          pickLabel="Your account"
          {...pick("home")}
        />
        <Anchor name="account" position={[HOME[0], OBJ * 0.55, HOME[2]]} />
        {/* Your full-access key: plain, opens everything. */}
        <Key position={MY_KEY} rotation={[0, 0.25, -0.15]} />
        <Label position={L.MY_KEY_LABEL} variant="small">
          {compact ? "your key" : "your key · full access"}
        </Label>

        {step > HOOK ? (
          <Scroll
            position={COUNTER}
            size={OBJ * 0.85}
            name="counter"
            note={keyState === "none" ? "not deployed yet" : String(counter)}
            state={keyState === "none" ? "pending" : "ok"}
            running={busy === "try" && aim === "count"}
            pickLabel="The counter contract"
            {...pick("counter")}
          />
        ) : null}
        <Anchor name="counter" position={[COUNTER[0], OBJ * 0.45, COUNTER[2] + 0.3]} />

        <Mailbox
          position={THIEF}
          size={OBJ}
          color={COLORS.red}
          name={L.shortNames ? "attacker" : "attacker.testnet"}
          pickLabel="The attacker's account"
          {...pick("thief")}
        />
        <Scroll
          position={OTHER}
          size={OBJ * 0.85}
          name={L.shortNames ? "registrar" : "testnet registrar"}
          pickLabel="Another contract: the testnet registrar"
          {...pick("other")}
        />
        <Anchor name="log" position={[THIEF[0], OBJ * 0.5, THIEF[2]]} />

        {/* The app's key: a key with a tag (one contract, an allowance gauge). */}
        {showAppKey ? (
          <TaggedKey
            position={APP_KEY}
            tag="counter only"
            share={keyState === "active" ? gaugeShare(left, gaugeFrom) : keyState === "none" ? 1 : 0}
            state={revoked ? "gone" : "ok"}
          />
        ) : null}
        <Anchor name="keycard" position={[APP_KEY[0], APP_KEY[1], APP_KEY[2]]} />
        {showAppKey ? (
          <Label position={[APP_KEY[0], 0.05, APP_KEY[2] + 1.0]} variant="small">
            {keyState === "none"
              ? "a function-call key"
              : revoked
                ? "app's key · deleted"
                : compact
                  ? allowance
                  : `app's key · ${allowance}`}
          </Label>
        ) : null}

        {/* The latest try: a parcel stamped with the app's key, at what it aimed at. */}
        {last ? (
          <Traveller to={L.parcelAt(aim)} arc={2.6} duration={0.9} color={COLORS.gold}>
            <Parcel
              size={0.8}
              stamped
              color={COLORS.gold}
              state={refusedNow || (!last.ok && !last.reason) ? "failed" : "ok"}
              name="the last transaction"
            />
            <Label position={[0, 0.05, 0.75]} variant="small">
              {`${ATTEMPT_SHORT[last.intent]} · ${last.ok ? "accepted" : refusedNow ? "refused" : "failed"}`}
            </Label>
          </Traveller>
        ) : null}
        {refusedNow ? (
          <Label position={HINT} variant="hint">
            {REASON_TEXT[last.reason!] ?? last.message}
          </Label>
        ) : null}

        {picked ? (
          <Label position={[HINT[0] - (L.tall ? 0 : 0.6), HINT[1], HINT[2]]} variant="hint">
            {PICK_TEXT[picked]}
          </Label>
        ) : null}
        {busy === "try" && aim ? (
          <Label position={[APP[0], 0.05, APP[2] + 1.9]} variant="small">
            {`signing: ${ATTEMPT_LABEL[aim]}`}
          </Label>
        ) : null}
      </InkStage>
    </div>
  );
}
