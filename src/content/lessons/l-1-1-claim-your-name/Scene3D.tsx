/**
 * Lesson 1.1 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: your account (a
 * mailbox), the registrar (a contract: a scroll that runs code) and the new account in a row. The new
 * account starts as a dashed mailbox; the create transaction travels to the registrar as a stamped parcel,
 * and when the account exists a solid mailbox drops in and the 0.1 NEAR coin lands beside it. The compare
 * step puts the named mailbox beside the dashed one of its hex twin. It only draws the shared state from
 * useClaim; the facts sit in the panel over the right page. Loaded lazily from Scene.tsx, so the 2D view
 * never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  Coin,
  focusOf,
  inset,
  Label,
  Mailbox,
  Parcel,
  Scroll,
  spreadBeside,
  spreadFor,
  textBlock,
  Traveller,
  useAnimatedFrame,
  useFreeFrame,
  useStage,
  type Focus,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import { near, short } from "../l-0-3-send-a-transaction/tx";
import {
  boxOf,
  coinAt,
  FIGURE,
  HEX,
  ME,
  NAMED,
  NEW_ACCOUNT,
  OBJ,
  parcelAt,
  partsAt,
  REGISTRAR,
} from "./layout3d";
import { tourFor, type Target } from "./tour";
import { CHECK, COMPARE, CONCEPT, CREATE, PICK, type Claim } from "./useClaim";

const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 1", "Claim your name"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  An account with a hex id",
  "Fig. 2  The registrar makes .testnet names",
  "Fig. 3  Your name, before it exists",
  "Fig. 4  One transaction creates the account",
  "Fig. 5  A named account and a hex id",
  "Fig. 6  Your account, its name and the registrar",
];

/**
 * What the camera keeps in view at a step: the parts it draws. The compare step keeps the row's framing
 * (its two mailboxes stand inside it), so the page does not jump closer and cut off its edge.
 */
function focusFor(step: number): Focus {
  return focusOf(partsAt(step === COMPARE ? CREATE : step).map(boxOf), 44, 0, 0.3);
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 32, azimuth: -14 };
  const [minX, maxX, minZ, maxZ, h] = boxOf(t.kind);
  return {
    center: [(minX + maxX) / 2, h / 3, (minZ + maxZ) / 2],
    width: maxX - minX,
    depth: maxZ - minZ,
    height: h,
    elevation: 26,
    azimuth: -14,
  };
}

export default function Scene3D({
  claim,
  flat,
  reducedMotion,
  mode,
  panel: facts,
  hidden,
}: {
  claim: Claim;
  flat: boolean;
  reducedMotion: boolean;
  mode: SceneProps["mode"];
  /** The step's facts (HTML), shown over the right page. */
  panel: ReactNode;
  /** The same facts as the figure, for screen readers. */
  hidden: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = claim;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  // Steps after the quiz stay on the quiz's sheet.
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  return (
    <div
      ref={root}
      className={`book-scene cn-book${summary ? " summary" : ""}`}
      data-testid="name-scene"
      data-scene-state={claim.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Claiming a name on NEAR testnet, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={focus}
        frame={inset(frame, { top: 28, bottom: 20 })}
        size={size}
        shots={tourFor(step)}
        shotFocus={(t: Target) => shotFocus(t, focus)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={claim.state}
        description={summary ? "The book is open at your new account's page." : describe(claim)}
        status={claim.status ?? undefined}
      >
        {summary && !wide ? null : <Figure claim={claim} wide={wide} />}
      </BookScene>
      <div className="book-scene-panel cn-panel" ref={panel}>
        {summary ? null : facts}
      </div>
      <div className="visually-hidden">{hidden}</div>
    </div>
  );
}

/** One sentence: what the figure shows at this step (screen readers). */
function describe(claim: Claim): string {
  const { step, created, me } = claim;
  if (step === COMPARE && created)
    return `The named account ${created.id}, which exists, beside the hex id ${created.hexId}, which this key would have as an implicit account and which is not created.`;
  const myName = me ? short(me.accountId, 6, 4) : "…";
  return [
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
}

const tag = (x: number) => [x, 0.25, OBJ / 2 + 0.55] as [number, number, number];

function Figure({ claim, wide }: { claim: Claim; wide: boolean }) {
  const { step, created, me, id, free, busy } = claim;
  const [picked, setPicked] = useState<"me" | "registrar" | null>(null);
  const parts = partsAt(step);
  const myName = me ? short(me.accountId, 6, 4) : "…";
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
    <group>
      {parts.includes("me") ? (
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
          <Label position={tag(ME[0])} variant="small">
            {wide ? `you · ${myName}` : "you"}
          </Label>
          <Anchor name="account" position={[ME[0], OBJ * 0.45, ME[2]]} />
          {picked === "me" ? (
            <Label position={[ME[0], 0.25, ME[2] + 1.75]} variant="hint">
              {`your practice account ${me ? short(me.accountId, 10, 6) : ""}`}
            </Label>
          ) : null}
        </>
      ) : null}

      {parts.includes("registrar") ? (
        <>
          {/* The registrar: a contract (a scroll that runs code) that makes .testnet names. */}
          <Scroll
            position={REGISTRAR}
            size={OBJ}
            name="testnet"
            note={wide ? "registrar" : undefined}
            running={busy}
            pickLabel={claim.canCreate ? "Ask the registrar to create your name" : "The registrar"}
            selected={picked === "registrar"}
            onPick={
              claim.canCreate
                ? claim.create
                : () => setPicked((p) => (p === "registrar" ? null : "registrar"))
            }
          />
          <Anchor name="registrar" position={[REGISTRAR[0], OBJ * 0.45, REGISTRAR[2]]} />
          <Anchor name="create" position={[REGISTRAR[0], OBJ * 0.45, REGISTRAR[2]]} />
          {picked === "registrar" ? (
            <Label position={[REGISTRAR[0], 0.25, REGISTRAR[2] + 1.75]} variant="hint">
              a contract that makes accounts ending in .testnet
            </Label>
          ) : null}
        </>
      ) : null}

      {parts.includes("new") ? (
        <>
          {/* The new account: a dashed mailbox until the registrar makes it. */}
          {created ? (
            <Drop>
              <Mailbox position={NEW_ACCOUNT} size={OBJ} name={created.id} flag />
            </Drop>
          ) : (
            <>
              <Mailbox position={NEW_ACCOUNT} size={OBJ} name={newName} state="pending" />
              <Label position={tag(NEW_ACCOUNT[0])} variant="small">
                not created yet
              </Label>
            </>
          )}
          <Anchor name="name-box" position={[NEW_ACCOUNT[0], OBJ * 0.45, NEW_ACCOUNT[2]]} />
        </>
      ) : null}

      {/* The create transaction: a stamped parcel to the registrar, carrying the 0.1 NEAR. */}
      {parts.includes("registrar") && step >= CREATE ? (
        <Traveller to={parcelAt(sending)} arc={2.2} duration={0.9}>
          <Parcel size={0.7} stamped name="the create transaction" />
          <Label position={[0, 0.05, 0.85]} variant="small">
            {created ? "delivered" : busy ? "on its way" : "create_account + 0.1 NEAR"}
          </Label>
        </Traveller>
      ) : null}
      {parts.includes("new") && coin ? (
        <Traveller to={coin} arc={2.2} duration={0.9}>
          <Coin />
          <Label position={[0, 0.05, 0.8]} variant="small">
            0.1 NEAR
          </Label>
        </Traveller>
      ) : null}

      {parts.includes("named") && created ? (
        <>
          <Mailbox position={NAMED} size={OBJ} name={created.id} flag />
          <Label position={tag(NAMED[0])} variant="small">
            named · exists
          </Label>
          <Mailbox position={HEX} size={OBJ} name={short(created.hexId, 8, 6)} state="pending" />
          <Label position={tag(HEX[0])} variant="small">
            hex · not created
          </Label>
          <Anchor name="compare" position={[0, OBJ * 0.45, 0]} />
        </>
      ) : null}
    </group>
  );
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
