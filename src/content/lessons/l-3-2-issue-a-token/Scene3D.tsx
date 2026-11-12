/**
 * Lesson 3.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: your mailbox with its
 * token coins, the minting stamp, the friend's mailbox with its storage padlock, and at step 5 the
 * relayer and your signed parcel. Every object is a pick that runs the step's action, says "not yet"
 * (a shake and a hint) or shows a detail. It only draws the shared state from useToken. Loaded lazily
 * from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  inset,
  Label,
  Mailbox,
  Outline,
  Parcel,
  Pickable,
  spreadBeside,
  spreadFor,
  Stamp,
  textBlock,
  useAnimatedFrame,
  useFreeFrame,
  useInk,
  useStage,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import type { SceneProps } from "../../../app/types";
import { FRIEND as FRIEND_ID, type Obj } from "./ft";
import {
  boxOf,
  FIGURE,
  FRIEND,
  ME,
  PADLOCK,
  PARCEL_END,
  PARCEL_START,
  partsAt,
  RELAYER,
  stackBy,
  STAMP,
} from "./layout3d";
import { describe, Facts, pickLabel, short } from "./parts";
import { coinsFor } from "./Scene2D";
import { CHECK, GASLESS, HOOK, MINT, REGISTER, TRAP } from "./steps";
import { tourFor, type Target } from "./tour";
import type { Token } from "./useToken";

const ACCENT = STAGE_ACCENTS[3];
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 3", "Issue your own token"];
const FIGURES = [
  "Fig. 1  Your own token",
  "Fig. 2  Minted into your account",
  "Fig. 3  The storage trap",
  "Fig. 4  A storage deposit registers your friend",
  "Fig. 5  A relayer pays the gas",
  "Fig. 6  Tokens, storage and relayers",
];

function focusFor(step: number): Focus {
  return focusOf(
    partsAt(step).map((p) => boxOf(p)),
    44,
  );
}

function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 34, azimuth: -14 };
  const [minX, maxX, minZ, maxZ, h] = boxOf(t.kind);
  return {
    center: [(minX + maxX) / 2, h / 3, (minZ + maxZ) / 2],
    width: maxX - minX + 0.6,
    depth: maxZ - minZ + 0.6,
    height: h,
    elevation: 28,
    azimuth: -14,
  };
}

export default function Scene3D({
  t,
  reducedMotion,
  flat,
  mode,
}: {
  t: Token;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = t;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  return (
    <div
      ref={root}
      className={`book-scene tok-book${summary ? " summary" : ""}`}
      data-testid="token-scene"
      data-scene-state={t.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Issue your own token, in 3D"
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
        shotFocus={(x: Target) => shotFocus(x, focus)}
        flat={flat}
        reducedMotion={reducedMotion}
        state={t.state}
        description={summary ? "The book is open at the token page." : describe(t)}
        status={t.status ?? undefined}
      >
        {summary && !wide ? null : <Figure t={t} />}
      </BookScene>
      <div className="book-scene-panel tok-panel" ref={panel}>
        {summary ? null : <Facts t={t} compact />}
      </div>
    </div>
  );
}

/**
 * How an object answers a pick (rule 10a): a short hop when the pick did something or showed a detail,
 * a side-to-side shake when it is "not yet". `n` is the pick's number, so every pick plays again.
 * Reduced motion: neither (the selection ring and the hint still show). Renders on demand.
 */
function PickReaction({ t, o, children }: { t: Token; o: Obj; children: ReactNode }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const mine = t.picked?.what === o;
  const n = mine ? t.picked!.n : -1;
  const shake = mine && "notYet" in t.picked!.result;
  const seen = useRef(n);
  const t0 = useRef<number | null>(null);
  const kind = useRef<"hop" | "shake">("hop");
  useAnimatedFrame(({ clock }) => {
    const node = g.current;
    if (!node) return false;
    if (seen.current !== n) {
      seen.current = n;
      kind.current = shake ? "shake" : "hop";
      t0.current = n >= 0 && !reducedMotion ? clock.elapsedTime : null;
    }
    if (t0.current === null) {
      node.position.set(0, 0, 0);
      return false;
    }
    const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.45);
    if (kind.current === "shake") node.position.x = Math.sin(u * Math.PI * 6) * 0.09 * (1 - u);
    else node.position.y = Math.sin(u * Math.PI) * 0.25;
    if (u >= 1) t0.current = null;
    return u < 1;
  });
  return <group ref={g}>{children}</group>;
}

function Figure({ t }: { t: Token }) {
  const parts = partsAt(t.step);
  const sel = (o: Obj) => t.picked?.what === o;
  return (
    <group>
      <PickReaction t={t} o="me">
        <Mailbox
          position={ME}
          size={1.6}
          name={short(t.parent?.id ?? "your account", 16)}
          color={ACCENT}
          pickLabel={pickLabel(t, "me")}
          onPick={() => t.pick("me")}
          selected={sel("me")}
        />
      </PickReaction>
      {t.minted ? <TokenStack at={stackBy(ME, 1)} count={t.myBalance} symbol={t.symbol} /> : null}
      {parts.includes("stamp") ? (
        <PickReaction t={t} o="stamp">
          <MintStamp t={t} />
        </PickReaction>
      ) : null}
      {t.step === HOOK || t.step === MINT ? (
        <Anchor name="stamp" position={[STAMP[0], 1.1, STAMP[2]]} />
      ) : null}
      {parts.includes("friend") ? (
        <PickReaction t={t} o="friend">
          <Mailbox
            position={FRIEND}
            size={1.5}
            name={FRIEND_ID}
            color={ACCENT}
            flag={t.friendBalance > 0}
            pickLabel={pickLabel(t, "friend")}
            onPick={() => t.pick("friend")}
            selected={sel("friend")}
          />
        </PickReaction>
      ) : null}
      {parts.includes("friend") && t.friendBalance > 0 ? (
        <TokenStack at={stackBy(FRIEND, -1)} count={t.friendBalance} symbol={t.symbol} />
      ) : null}
      {parts.includes("padlock") ? (
        <PickReaction t={t} o="padlock">
          <Padlock t={t} />
        </PickReaction>
      ) : null}
      {t.step === TRAP || t.step === REGISTER ? (
        <Anchor name="padlock" position={[PADLOCK[0], 0.8, PADLOCK[2]]} />
      ) : null}
      {parts.includes("relayer") ? (
        <PickReaction t={t} o="relayer">
          <Mailbox
            position={RELAYER}
            size={1.2}
            name="relayer"
            color={ACCENT}
            pickLabel={pickLabel(t, "relayer")}
            onPick={() => t.pick("relayer")}
            selected={sel("relayer")}
          />
        </PickReaction>
      ) : null}
      {parts.includes("parcel") ? (
        <PickReaction t={t} o="parcel">
          <SignedParcel t={t} />
        </PickReaction>
      ) : null}
      {t.step === GASLESS ? (
        <Anchor name="parcel" position={[PARCEL_START[0], 0.9, PARCEL_START[2]]} />
      ) : null}
    </group>
  );
}

/**
 * Your token as a short stack of plain coins in the accent (no NEAR mark: another token gets another
 * face, docs/scene-objects.md), with the amount printed in front.
 */
function TokenStack({ at, count, symbol }: { at: Vec3; count: number; symbol: string }) {
  const ink = useInk(ACCENT);
  const n = coinsFor(count);
  return (
    <group position={at}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[0, 0.07 + i * 0.13, 0]} material={ink}>
          <cylinderGeometry args={[0.3, 0.3, 0.11, 28]} />
          <Outline />
        </mesh>
      ))}
      <Label position={[0, 0.05, 0.5]} variant="small">
        {`${count.toLocaleString("en-US")} ${symbol}`}
      </Label>
    </group>
  );
}

/** The minting stamp on its handle; it presses down once when the tokens are minted. */
function MintStamp({ t }: { t: Token }) {
  const { reducedMotion } = useStage();
  const handle = useInk(COLORS.kraft);
  const head = useRef<Group>(null);
  const minted = !!t.minted;
  const seen = useRef(minted);
  const t0 = useRef<number | null>(null);
  useAnimatedFrame(({ clock }) => {
    const node = head.current;
    if (!node) return false;
    if (seen.current !== minted) {
      seen.current = minted;
      t0.current = minted && !reducedMotion ? clock.elapsedTime : null;
    }
    if (t0.current === null) {
      node.position.y = 0;
      return false;
    }
    const u = Math.min(1, (clock.elapsedTime - t0.current) / 0.6);
    node.position.y = -Math.sin(u * Math.PI) * 0.35;
    if (u >= 1) t0.current = null;
    return u < 1;
  });
  return (
    <group position={STAMP}>
      <Pickable
        label={pickLabel(t, "stamp")}
        onPick={() => t.pick("stamp")}
        anchor={[0, 1.3, 0]}
        selected={t.picked?.what === "stamp"}
      >
        <group ref={head} position={[0, 0, 0]}>
          <mesh position={[0, 0.85, 0]} material={handle}>
            <cylinderGeometry args={[0.12, 0.16, 0.7, 16]} />
            <Outline />
          </mesh>
          <Stamp position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} size={0.7} color={ACCENT} />
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.72, 0.1, 0.8]} />
            <meshBasicMaterial color={ACCENT} />
            <Outline />
          </mesh>
        </group>
      </Pickable>
      <Label position={[0, 0.05, 0.75]} variant="small">
        {t.minted ? `${t.symbol} · ${t.supply.toLocaleString("en-US")}` : `mint ${t.symbol}`}
      </Label>
    </group>
  );
}

/** The storage padlock on the friend's mailbox: red and shut until registered, then open in the accent. */
function Padlock({ t }: { t: Token }) {
  const open = !!t.registered;
  const red = !open && !!t.refused;
  const body = useInk(open ? ACCENT : red ? COLORS.red : COLORS.paper);
  const metal = useInk(COLORS.paper);
  return (
    <group position={PADLOCK}>
      <Pickable
        label={pickLabel(t, "padlock")}
        onPick={() => t.pick("padlock")}
        anchor={[0, 0.9, 0]}
        selected={t.picked?.what === "padlock"}
      >
        <mesh position={[0, 0.25, 0]} material={body}>
          <boxGeometry args={[0.5, 0.42, 0.22]} />
          <Outline />
        </mesh>
        <mesh
          position={[open ? 0.12 : 0, open ? 0.62 : 0.5, 0]}
          rotation={[0, open ? 0.9 : 0, 0]}
          material={metal}
        >
          <torusGeometry args={[0.15, 0.04, 8, 24, Math.PI]} />
          <Outline />
        </mesh>
      </Pickable>
      <Label position={[0, 0.05, 0.4]} variant="small">
        {open ? "registered" : red ? "not registered" : "storage"}
      </Label>
    </group>
  );
}

/** Your signed parcel: waits beside you, glides to the friend once the relayer delivers it. */
function SignedParcel({ t }: { t: Token }) {
  const { reducedMotion } = useStage();
  const g = useRef<Group>(null);
  const at = t.relayed > 0 ? PARCEL_END : PARCEL_START;
  useAnimatedFrame(() => {
    const node = g.current;
    if (!node) return false;
    const goal: Vec3 = at;
    if (reducedMotion) {
      node.position.set(...goal);
      return false;
    }
    const dx = goal[0] - node.position.x;
    const dz = goal[2] - node.position.z;
    if (Math.hypot(dx, dz) < 0.01) {
      node.position.set(...goal);
      return false;
    }
    node.position.x += dx * 0.12;
    node.position.z += dz * 0.12;
    node.position.y = Math.min(0.6, Math.hypot(dx, dz) * 0.3);
    return true;
  });
  return (
    <group ref={g} position={PARCEL_START}>
      <Parcel
        size={0.9}
        color={ACCENT}
        to={short(t.tokenId ?? "token", 16)}
        stamped={t.relayed > 0 || t.busy === "gasless"}
        open={t.picked?.what === "parcel" && !("notYet" in t.picked.result)}
        state={t.capped ? "failed" : "ok"}
        name="signed delegate action"
        pickLabel={pickLabel(t, "parcel")}
        onPick={() => t.pick("parcel")}
        selected={t.picked?.what === "parcel"}
      />
    </group>
  );
}
