/**
 * 3D view of lesson 0.2: seed words → private key → public key → address as objects on the paper.
 * It draws the shared state from useWallet and adds no facts of its own. Loaded lazily (three.js).
 *
 * Security: the private key is only ever shown through `shownSecret` (masked unless revealed), and only
 * in DOM labels that live in memory. Nothing here writes to storage or draws keys into textures.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { BackSide, type Group } from "three";
import {
  Anchor,
  COLORS,
  INK,
  InkStage,
  isPickable,
  Key,
  Label,
  Outline,
  Pickable,
  SoftShadow,
  Traveller,
  ViewOffset,
  easeInOut,
  frameCamera,
  inset,
  useInk,
  useStage,
  type PickMotion,
  type Vec3,
  useAnimatedFrame,
} from "../../../scene-kit";
import { CONVERT_STAGES, STEP, type Wallet } from "./useWallet";
import {
  addressHeight,
  describe3d,
  drawnFor,
  labelsFor,
  objectsFor,
  shorten,
  shotFor,
  POS,
  reactionsFor,
  type Drawn,
  type Reaction,
  type Shown,
} from "./wallet3d";
import { shownSecret } from "./wallet";
import type { Measured } from "./frame";

const ACCENT = COLORS.orange;
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
/** Progress of `t` through the window a..b, eased. */
const seg = (t: number, a: number, b: number) => easeInOut(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * A 0..1 clock that restarts whenever `trigger` changes (not on mount, so switching views mid-lesson
 * shows the end state). Under reduced motion it stays at 1.
 */
function useTween(trigger: unknown, seconds: number, reducedMotion: boolean) {
  const t = useRef(1);
  const start = useRef<number | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    t.current = reducedMotion ? 1 : 0;
    start.current = null;
  }, [trigger, reducedMotion]);
  // The clock drives the motions that read it: it asks for frames until it reaches 1.
  useAnimatedFrame(({ clock }) => {
    if (t.current >= 1) return false;
    start.current ??= clock.elapsedTime;
    t.current = Math.min(1, (clock.elapsedTime - start.current) / seconds);
    return t.current < 1;
  });
  return t;
}

type Clock = ReturnType<typeof useTween>;

// ---------- pick animations (rule 10a): each object's own, replacing the kit's hop ----------

/** A motion over `seconds`: `pose` gets the linear progress 0..1 and poses the object. */
const motion =
  (seconds: number, pose: (o: Parameters<PickMotion>[0], u: number) => void): PickMotion =>
  (o, t) => {
    const u = Math.min(1, t / seconds);
    pose(o, u);
    return u < 1;
  };
const bump = (u: number) => Math.sin(u * Math.PI);

/** The key turns once, as in a lock (step 2: its cover lifts with the reveal). */
const keyTurn = motion(0.8, (o, u) => {
  o.position.y += 0.4 * bump(u);
  o.rotation.y += 2 * Math.PI * easeInOut(u);
});
/** The key rises, tips and presses down: it stamps the seal (step 6). */
const keyStamp = motion(0.9, (o, u) => {
  const up = seg(u, 0, 0.45);
  const down = seg(u, 0.45, 0.7);
  const back = seg(u, 0.7, 1);
  o.position.y += 0.9 * up - 1.05 * down + 0.15 * back;
  o.rotation.z -= 0.45 * (up - down);
});
/** The word tiles nod toward the key they rebuild. */
const wordsNod = motion(0.6, (o, u) => {
  o.position.y += 0.3 * bump(u);
  o.rotation.x += 0.25 * bump(u);
});
/** An address block jumps and flips end over end to show its rule. */
const blockFlip = motion(0.8, (o, u) => {
  o.position.y += 1.6 * bump(u);
  o.rotation.x += 2 * Math.PI * easeInOut(u);
});
/** The message card squashes flat and springs back (a letter changes). */
const cardSquash = motion(0.45, (o, u) => {
  const s = bump(u);
  o.scale.y *= 1 - 0.6 * s;
  o.scale.x *= 1 + 0.12 * s;
  o.scale.z *= 1 + 0.12 * s;
});
/** The bin rocks as the keys and words drop into it. */
const binRock = motion(0.9, (o, u) => {
  o.rotation.z += 0.22 * Math.sin(u * 4 * Math.PI) * (1 - u);
  o.position.y += 0.15 * bump(u);
});

/** Whether a pick does anything at all (an action, a hint or a detail). */
const reacts = (r: Reaction, onPick?: () => void) => isPickable({ ...r, onPick });

export default function Scene3D({
  w,
  step,
  reducedMotion,
  flat,
  measured,
}: {
  w: Wallet;
  step: number;
  reducedMotion: boolean;
  flat: boolean;
  /** The free part of the screen between the cards and the note; the picture is fitted there. */
  measured: Measured | null;
}) {
  const { frame, width, height } = measured ?? {
    frame: { left: 0, top: 0, right: 1280, bottom: 800 },
    width: 1280,
    height: 800,
  };
  // A small free area (phones) shows only the names that matter in this step.
  const compact = frame.right - frame.left < 300 || frame.bottom - frame.top < 200;
  const drawn = drawnFor(step, { ack: w.ack, alive: !!w.keys && !w.cleared });
  const shot = shotFor(step, drawn, compact, frame.bottom - frame.top >= frame.right - frame.left);
  const inner = inset(frame, shot.reserve);
  // Fetch the handwriting font for 3D labels now, before any key exists. Otherwise it may load right
  // after Generate and show up in the panel's "network requests since Generate" count.
  useEffect(() => {
    document.fonts?.load("600 21px Caveat").catch(() => undefined);
  }, []);
  return (
    <InkStage
      view={frameCamera(shot.focus, inner, width, height, 0.9)}
      flat={flat}
      reducedMotion={reducedMotion}
      state={w.state}
      description={describe3d(w.focus, step === STEP.verify ? w.verdict : null, w.cleared)}
      minDistance={3}
      maxDistance={140}
    >
      <ViewOffset frame={inner} reducedMotion={reducedMotion} />
      <World w={w} step={step} drawn={drawn} reducedMotion={reducedMotion} compact={compact} />
    </InkStage>
  );
}

/** Which labels the current step shows (see labelsFor). */
const ShownContext = createContext<Shown>(labelsFor(0, false));

function World({
  w,
  step,
  drawn,
  reducedMotion,
  compact,
}: {
  w: Wallet;
  step: number;
  drawn: Drawn;
  reducedMotion: boolean;
  compact: boolean;
}) {
  const { keys, cleared } = w;
  // The words fold into the key, and the key casts the public key: on Generate and on every rebuild.
  const fold = useTween(`${keys ? keys.publicKey : ""}#${w.rebuilds}`, 2.4, reducedMotion);
  // Throwing the keys away sends words and keys into the bin.
  const bin = useTween(cleared, 1.3, reducedMotion);
  const alive = !!keys || cleared;
  const shown = labelsFor(step, compact);
  const objects = objectsFor(step);
  const r = reactionsFor(step, {
    keys: !!keys,
    cleared,
    message: !!w.message.trim(),
    signed: !!w.signed,
    stale: !!w.signed && w.signed.message !== w.message,
    rebuilt: !!w.rebuilt,
    addressDone: w.convert >= CONVERT_STAGES,
    flipped: w.flipped,
    verdict: w.verdict,
  });

  return (
    <ShownContext.Provider value={shown}>
      {drawn === "warning" ? <WarningSign /> : null}
      {drawn === "ghosts" ? (
        <Ghosts
          reaction={r.ghost}
          hint={
            cleared
              ? null
              : step === STEP.generate
                ? "Press Generate"
                : w.needsKeys
                  ? "No keys on this page"
                  : null
          }
        />
      ) : null}

      {alive && shown.pipeline && drawn !== "warning" ? (
        <>
          {objects.words ? <Words w={w} step={step} fold={fold} bin={bin} reaction={r.words} /> : null}
          {objects.key ? <PrivateKey w={w} step={step} fold={fold} bin={bin} reaction={r.key} /> : null}
          {objects.lock ? <PublicKey w={w} step={step} fold={fold} bin={bin} /> : null}
          <Arrows show={!!keys} address={w.convert >= CONVERT_STAGES} step={step} />
        </>
      ) : null}
      {objects.address ? <AddressBlock w={w} step={step} reaction={r.address} /> : null}
      {step === STEP.compare && keys ? <OtherAddresses w={w} reactions={[r.eth, r.named]} /> : null}
      {(step === STEP.sign || step === STEP.verify) && keys ? (
        <MessageCard w={w} step={step} reaction={r.card} />
      ) : null}
      {step === STEP.custody || cleared ? <Bin w={w} step={step} reaction={r.bin} /> : null}
    </ShownContext.Provider>
  );
}

/** Moves a group every frame: fold in from the key, or fly into the bin. Hidden once binned. */
function useBinned(home: Vec3, bin: Clock, cleared: boolean) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (cleared) {
      const u = seg(bin.current, 0, 1);
      g.position.set(
        lerp(home[0], POS.bin[0], u),
        lerp(home[1], POS.bin[1] + 0.6, u) + Math.sin(u * Math.PI) * 2,
        lerp(home[2], POS.bin[2], u),
      );
      g.scale.setScalar(Math.max(0.001, 1 - u * 0.85));
      g.visible = bin.current < 1;
      return;
    }
    g.visible = true;
    g.position.set(...home);
    g.scale.setScalar(1);
  });
  return ref;
}

function WarningSign() {
  const ink = useInk(ACCENT);
  const black = useInk(INK);
  return (
    <group position={[0, 1.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={ink}>
        <cylinderGeometry args={[1.4, 1.4, 0.3, 3]} />
        <Outline />
      </mesh>
      <mesh position={[0, 0.12, 0.17]} material={black}>
        <boxGeometry args={[0.18, 0.62, 0.04]} />
      </mesh>
      <mesh position={[0, -0.38, 0.17]} material={black}>
        <boxGeometry args={[0.18, 0.18, 0.04]} />
      </mesh>
      <SoftShadow position={[0, -1.5, 0.2]} size={[3, 1.2]} />
      <Anchor name="warning" position={[-0.5, 0, 0.2]} />
      <Label position={[0, -2.1, 0.9]}>No keys yet: read the warning</Label>
    </group>
  );
}

/** Empty places where the words, keys and address will appear. */
function Ghosts({ hint, reaction }: { hint: string | null; reaction: Reaction }) {
  const paper = useInk(COLORS.paper);
  const spots: [Vec3, string][] = [
    [POS.words, "seed words"],
    [POS.key, "private key"],
    [POS.lock, "public key"],
    [POS.address, "address"],
  ];
  return (
    <>
      {spots.map(([p, name]) => {
        const place = (
          <mesh position={[0, 0.03, 0]} material={paper}>
            <boxGeometry args={[1.8, 0.06, 1.2]} />
            <Outline />
          </mesh>
        );
        return (
          <group key={name} position={p}>
            {/* Rule 10a: an empty place says "not yet" instead of ignoring the click. */}
            {reacts(reaction) ? (
              <Pickable label={`Empty place: ${name}`} anchor={[0, 0.2, 0]} {...reaction}>
                {place}
              </Pickable>
            ) : (
              place
            )}
            <Label position={[0, 0.35, 0]} variant="small">
              {name}
            </Label>
          </group>
        );
      })}
      {hint ? (
        <Label position={[2.6, 0.3, 0]} variant="hint">
          {hint}
        </Label>
      ) : null}
    </>
  );
}

const TILE: [number, number, number] = [1.05, 0.14, 0.46];

/** The 12 seed words as tiles in a 3 × 4 grid. */
function Words({
  w,
  step,
  fold,
  bin,
  reaction,
}: {
  w: Wallet;
  step: number;
  fold: Clock;
  bin: Clock;
  reaction: Reaction;
}) {
  const paper = useInk(COLORS.paper);
  const ref = useBinned(POS.words, bin, w.cleared);
  const tiles = useRef<(Group | null)[]>([]);
  const words = w.keys?.phrase.split(" ") ?? Array.from({ length: 12 }, () => "");
  const shown = useContext(ShownContext);
  // The word names hide while the tiles fly, so the labels do not smear across the picture.
  const [folding, setFolding] = useState(false);
  const showWords = shown.wordList && !!w.keys && !folding;
  const home = (i: number): Vec3 => [((i % 3) - 1) * 1.25, TILE[1] / 2, (Math.floor(i / 3) - 1.5) * 0.62];
  // Where the key sits, seen from the words group.
  const into: Vec3 = [POS.key[0] - POS.words[0], 0.9, POS.key[2] - POS.words[2]];

  useFrame(() => {
    const T = fold.current;
    if (T < 1 !== folding) setFolding(T < 1);
    tiles.current.forEach((g, i) => {
      if (!g) return;
      const h = home(i);
      // 0..0.45: each tile flies into the key, a little after the one before it.
      const go = seg(T, i * 0.012, 0.3 + i * 0.012);
      if (T < 0.45) {
        g.position.set(
          lerp(h[0], into[0], go),
          lerp(h[1], into[1], go) + Math.sin(go * Math.PI),
          lerp(h[2], into[2], go),
        );
        g.scale.setScalar(Math.max(0.001, 1 - go * 0.8));
      } else {
        // 0.7..0.95: the words are still there afterwards. Rebuilding never uses them up.
        g.position.set(...h);
        g.scale.setScalar(Math.max(0.001, seg(T, 0.7, 0.95)));
      }
    });
  });

  const body = (
    <group>
      {words.map((word, i) => (
        <group
          key={i}
          ref={(g) => {
            tiles.current[i] = g;
          }}
          position={home(i)}
        >
          <mesh material={paper}>
            <boxGeometry args={TILE} />
            <Outline />
          </mesh>
          {showWords && word ? (
            <Label position={[0, 0.12, 0]} variant="small">
              {`${i + 1}. ${word}`}
            </Label>
          ) : null}
        </group>
      ))}
      <SoftShadow position={[0, 0, 0.2]} size={[3.6, 3]} />
      {w.keys && shown.words ? <Label position={[0, 0.9, -1.6]}>12 seed words</Label> : null}
      {w.keys && !w.cleared ? <Anchor name="words" position={[0, 0.3, 0]} /> : null}
    </group>
  );
  // The pick nods the tiles; a rebuild also replays the fold, which flies them into the key.
  const rebuild = step === STEP.seed && w.keys ? w.rebuild : undefined;
  const live = !!w.keys && !w.cleared;
  return (
    <group ref={ref} position={POS.words}>
      {live && reacts(reaction, rebuild) ? (
        <Pickable
          label={rebuild ? "Seed words: rebuild the key" : "Seed words"}
          onPick={rebuild}
          anchor={[0, 0.3, 0]}
          pickMotion={wordsNod}
          {...reaction}
        >
          {body}
        </Pickable>
      ) : (
        body
      )}
    </group>
  );
}

/** The private key: a gold key under a paper cover that lifts only while the learner reveals it. */
function PrivateKey({
  w,
  step,
  fold,
  bin,
  reaction,
}: {
  w: Wallet;
  step: number;
  fold: Clock;
  bin: Clock;
  reaction: Reaction;
}) {
  const paper = useInk(COLORS.paper);
  const keyRef = useRef<Group>(null);
  const cover = useRef<Group>(null);
  const ref = useBinned(POS.key, bin, w.cleared);
  const reveal = w.showSecret && !!w.keys;
  const { reducedMotion } = useStage();
  useAnimatedFrame((_, dt) => {
    let moving = false;
    const T = fold.current;
    // The key appears as the words land in it, and pulses once.
    const k = keyRef.current;
    if (k) {
      const appear = T >= 1 ? 1 : seg(T, 0.2, 0.36);
      k.scale.setScalar(
        Math.max(0.001, appear * (1 + 0.25 * Math.sin(Math.PI * clamp01((T - 0.34) / 0.16)))),
      );
    }
    const c = cover.current;
    if (c) {
      const goal = reveal ? 1 : 0;
      const cur = c.userData.u ?? goal;
      const u =
        reducedMotion || Math.abs(goal - cur) < 0.01 ? goal : cur + (goal - cur) * Math.min(1, dt * 8);
      c.userData.u = u;
      c.position.y = 0.8 + u * 1.4;
      c.scale.setScalar(Math.max(0.001, 1 - u));
      c.visible = u < 0.99;
      moving = u !== goal;
    }
    return moving;
  });
  const shown = useContext(ShownContext);
  // Same masking as the panel: the value is hidden until the learner presses Show.
  const secret = w.keys ? shownSecret(w.keys, w.showSecret) : "";
  const body = (
    <>
      <group ref={keyRef} position={[0, 0.8, 0]}>
        <group scale={1.25}>
          <Key />
        </group>
      </group>
      {/* The cover hides the key's teeth, the secret part. The ring stays visible. */}
      <group ref={cover} position={[0.4, 0.8, 0]}>
        <RoundedBox args={[1.45, 0.8, 0.5]} radius={0.06} smoothness={1} material={paper}>
          <Outline threshold={20} />
        </RoundedBox>
      </group>
      <SoftShadow position={[0, 0, 0.2]} size={[2.6, 1.2]} />
      {w.keys && !w.cleared ? (
        <>
          {/* The key pair (step 2) and who holds it (step 8). */}
          <Anchor name="keys" position={[0, 0.8, 0]} />
          <Anchor name="custody" position={[0, 0.8, 0]} />
        </>
      ) : null}
      {w.keys && shown.key ? (
        <>
          <Label position={[0, 1.75, 0]}>Private key · secret</Label>
          {shown.values ? (
            <Label position={[0, 0.05, 0.9]} variant="small">
              {w.showSecret ? shorten(secret, 24) : secret}
            </Label>
          ) : null}
        </>
      ) : null}
    </>
  );
  // Step 2 turns the key (its cover lifts with the reveal); step 6 stamps the seal with it.
  const pick =
    step === STEP.generate
      ? {
          label: w.showSecret ? "Hide the private key" : "Show the private key",
          onPick: w.toggleSecret,
          motion: keyTurn,
        }
      : step === STEP.sign
        ? { label: "Sign with the private key", onPick: w.doSign, motion: keyStamp }
        : { label: "Private key", onPick: undefined, motion: keyTurn };
  const live = !!w.keys && !w.cleared;
  return (
    <group ref={ref} position={POS.key}>
      {live && reacts(reaction, pick.onPick) ? (
        <Pickable
          label={pick.label}
          selected={step === STEP.generate && w.showSecret}
          onPick={pick.onPick}
          anchor={[0, 0.8, 0]}
          pickMotion={pick.motion}
          {...reaction}
        >
          {body}
        </Pickable>
      ) : (
        body
      )}
    </group>
  );
}

/** The public key: a padlock the private key casts. Anyone may hold it; it checks signatures. */
function PublicKey({ w, step, fold, bin }: { w: Wallet; step: number; fold: Clock; bin: Clock }) {
  const paper = useInk(COLORS.paper);
  const shown = useContext(ShownContext);
  const black = useInk(INK);
  const lock = useRef<Group>(null);
  const from: Vec3 = [POS.key[0] - POS.lock[0], 0, POS.key[2] - POS.lock[2]];
  const ref = useBinned(POS.lock, bin, w.cleared);
  useFrame(() => {
    const g = lock.current;
    if (!g) return;
    // 0.45..0.8: the padlock slides out of the key to its own place.
    const u = fold.current >= 1 ? 1 : seg(fold.current, 0.45, 0.8);
    g.position.set(lerp(from[0], 0, u), Math.sin(u * Math.PI) * 1.2, lerp(from[2], 0, u));
    g.scale.setScalar(Math.max(0.001, seg(fold.current >= 1 ? 1 : fold.current, 0.42, 0.55)));
  });
  return (
    <group ref={ref} position={POS.lock}>
      <group ref={lock}>
        <RoundedBox
          args={[1.2, 0.95, 0.6]}
          radius={0.08}
          smoothness={1}
          position={[0, 0.48, 0]}
          material={paper}
        >
          <Outline threshold={20} />
        </RoundedBox>
        <mesh position={[0, 0.95, 0]} material={black}>
          <torusGeometry args={[0.36, 0.08, 10, 24, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.5, 0.31]} rotation={[Math.PI / 2, 0, 0]} material={black}>
          <cylinderGeometry args={[0.1, 0.1, 0.03, 16]} />
        </mesh>
      </group>
      <SoftShadow position={[0, 0, 0.2]} size={[2.2, 1.1]} />
      {w.keys && shown.lock ? (
        <>
          <Label position={[0, 1.85, 0]}>
            {w.rebuilt && step === STEP.seed ? "Public key · same again" : "Public key · shared"}
          </Label>
          {shown.values ? (
            <Label position={[0, 0.05, 0.9]} variant="small">
              {shorten(w.keys.publicKey, 24)}
            </Label>
          ) : null}
        </>
      ) : null}
    </group>
  );
}

/** Arrows between the objects, named after the step that links them. */
function Arrows({ show, address, step }: { show: boolean; address: boolean; step: number }) {
  const black = useInk(INK);
  const shown = useContext(ShownContext);
  if (!show) return null;
  // Only between objects that stand on the paper in this step.
  const o = objectsFor(step);
  const links: [Vec3, Vec3, string][] = [];
  if (o.words && o.key) links.push([POS.words, POS.key, "SLIP-10 path"]);
  if (o.key && o.lock) links.push([POS.key, POS.lock, "ed25519"]);
  if (address && o.lock && o.address) links.push([POS.lock, POS.address, "write as hex"]);
  return (
    <>
      {links.map(([a, b, name]) => {
        const z0 = a[2] + 1.0;
        const z1 = b[2] - 0.9;
        const mid = (z0 + z1) / 2;
        return (
          <group key={name}>
            <mesh position={[0, 0.03, mid]} material={black}>
              <boxGeometry args={[0.07, 0.04, z1 - z0]} />
            </mesh>
            <mesh position={[0, 0.06, z1]} rotation={[Math.PI / 2, 0, 0]} material={black}>
              <coneGeometry args={[0.16, 0.34, 12]} />
            </mesh>
            {shown.arrow === name ? <Label position={[1.25, 0.1, mid]}>{name}</Label> : null}
          </group>
        );
      })}
    </>
  );
}

/** An inked block whose height can grow (the address being written). */
function GrowBlock({ height, color, size = 1.5 }: { height: number; color: string; size?: number }) {
  const ink = useInk(color, true);
  const { reducedMotion } = useStage();
  const ref = useRef<Group>(null);
  useAnimatedFrame((_, dt) => {
    const g = ref.current;
    if (!g) return false;
    const cur = g.scale.y;
    const next =
      reducedMotion || Math.abs(height - cur) < 0.005 ? height : cur + (height - cur) * Math.min(1, dt * 6);
    g.scale.y = Math.max(0.001, next);
    return next !== height;
  });
  return (
    <group ref={ref} scale={[1, Math.max(0.001, height), 1]}>
      <RoundedBox args={[size, 1, size]} radius={0.06} smoothness={1} position={[0, 0.5, 0]} material={ink}>
        <Outline mode="hull" thickness={0.03} />
        <Outline threshold={20} />
      </RoundedBox>
    </group>
  );
}

const CONVERT_LABELS = ["", "public key (base58)", "32 bytes, 0–255", "64 hex characters"];

/** The address: the public key turned into a block of hex. In step 5 it stands with the other styles. */
function AddressBlock({ w, step, reaction }: { w: Wallet; step: number; reaction: Reaction }) {
  const paper = useInk(COLORS.paper);
  const shown = useContext(ShownContext);
  const { keys, convert } = w;
  const done = convert >= CONVERT_STAGES && !!keys;
  const writing = !!keys && convert > 0 && convert < CONVERT_STAGES;
  const show = !!keys && (done || writing || step === STEP.address);
  if (!show) return null;
  const height = done ? addressHeight(64) : writing ? (addressHeight(64) * convert) / CONVERT_STAGES : 0.001;
  const compare = step === STEP.compare;
  const flipped = w.flipped[1];
  const block = (
    <>
      <mesh position={[0, 0.03, 0]} material={paper}>
        <boxGeometry args={[1.9, 0.06, 1.9]} />
        <Outline />
      </mesh>
      <GrowBlock height={height} color={ACCENT} />
    </>
  );
  return (
    <>
      <group position={POS.address}>
        <SoftShadow position={[0, 0, 0.3]} size={[2.8, 1.8]} />
        <Anchor name="address" position={[0, Math.max(0.3, height / 2), 0]} />
        {keys && !w.cleared && reacts(reaction, compare ? () => w.flip(1) : undefined) ? (
          <Pickable
            label={compare ? "NEAR implicit account block" : "Address block"}
            selected={compare && flipped}
            onPick={compare ? () => w.flip(1) : undefined}
            anchor={[0, 1, 0]}
            pickMotion={blockFlip}
            {...reaction}
          >
            {block}
          </Pickable>
        ) : (
          block
        )}
        {done ? (
          shown.address ? (
            <>
              <Label
                position={[0, addressHeight(64) + 0.6, 0]}
                variant={compare && shown.compact ? "small" : "hand"}
              >
                {compare ? "NEAR implicit · 64" : "Implicit account address"}
              </Label>
              {shown.values ? (
                <Label position={[0, 0.05, 1.3]} variant="small">
                  {shorten(keys.implicitAccount, compare ? 14 : 22)}
                </Label>
              ) : null}
              {compare && flipped && !shown.compact ? (
                <Label position={[0, -0.2, 1.9]}>public key in hex</Label>
              ) : null}
            </>
          ) : null
        ) : writing ? (
          <Label position={[0, 2.6, 0]}>{`writing: ${CONVERT_LABELS[convert] ?? ""}`}</Label>
        ) : (
          <Label position={[0, 0.5, 0]}>address goes here</Label>
        )}
      </group>
      {keys && (writing || (convert === 0 && step === STEP.address)) ? (
        <Traveller
          to={convert === 0 ? [POS.lock[0], 1.2, POS.lock[2]] : [POS.address[0], 0.4, POS.address[2]]}
          arc={1.6}
          duration={0.6}
          color={ACCENT}
          glow={convert > 0}
        >
          <mesh visible={convert > 0}>
            <boxGeometry args={[0.5, 0.12, 0.34]} />
            <meshBasicMaterial color={ACCENT} />
          </mesh>
        </Traveller>
      ) : null}
    </>
  );
}

const OTHERS = [
  {
    i: 0,
    x: -3.2,
    pick: "Ethereum address block",
    name: "Ethereum · 42",
    len: 42,
    rule: "hash, last 20 bytes",
    color: COLORS.paper,
  },
  {
    i: 2,
    x: 3.2,
    pick: "NEAR named account block",
    name: "NEAR named · 11",
    len: 11,
    rule: "a readable name",
    color: COLORS.paper,
  },
] as const;

/**
 * Step 5: the Ethereum address and a named account stand next to your implicit account. Each block is
 * as tall as its address is long (characters); picking one shows its rule, like the panel's cards.
 */
function OtherAddresses({ w, reactions }: { w: Wallet; reactions: [Reaction, Reaction] }) {
  const shown = useContext(ShownContext);
  return (
    <>
      {OTHERS.map((o, k) => (
        <group key={o.pick} position={[o.x, 0, POS.address[2]]}>
          <SoftShadow position={[0, 0, 0.3]} size={[2.6, 1.6]} />
          {/* The note starts with Ethereum, and this block stands nearest to it (2D points at its Address box). */}
          {o.i === 0 ? <Anchor name="addresses" position={[0, addressHeight(o.len) / 2, 0]} /> : null}
          <Pickable
            label={o.pick}
            selected={w.flipped[o.i]}
            onPick={() => w.flip(o.i)}
            anchor={[0, 0.6, 0]}
            pickMotion={blockFlip}
            {...reactions[k]}
          >
            <GrowBlock height={addressHeight(o.len)} color={o.color} />
          </Pickable>
          <Label position={[0, addressHeight(o.len) + 0.6, 0]} variant={shown.compact ? "small" : "hand"}>
            {o.name}
          </Label>
          {shown.values ? (
            <Label position={[0, 0.05, 1.3]} variant="small">
              {o.i === 0 ? shorten(w.ethAddress, 14) : "ana.testnet"}
            </Label>
          ) : null}
          {w.flipped[o.i] && !shown.compact ? <Label position={[0, -0.2, 1.9]}>{o.rule}</Label> : null}
        </group>
      ))}
      {shown.compact ? null : (
        <Label position={[0, 0, POS.address[2] + 3]}>taller block = longer address</Label>
      )}
    </>
  );
}

/** Steps 6 and 7: the message card. Signing stamps a seal on it; verifying checks the seal. */
function MessageCard({ w, step, reaction }: { w: Wallet; step: number; reaction: Reaction }) {
  const paper = useInk(COLORS.paper);
  const { signed, verdict } = w;
  const verifying = step === STEP.verify;
  const text = verifying ? w.checkMessage : w.message;
  const result = verifying ? verdict : null;
  const shown = useContext(ShownContext);
  const card = (
    <>
      <mesh position={[0, 0.05, 0]} material={paper}>
        <boxGeometry args={[2.4, 0.1, 1.6]} />
        <Outline />
      </mesh>
      {[-0.35, 0, 0.35].map((z) => (
        <mesh key={z} position={[-0.25, 0.11, z]}>
          <boxGeometry args={[1.5, 0.01, 0.05]} />
          <meshBasicMaterial color={INK} transparent opacity={0.25} />
        </mesh>
      ))}
    </>
  );
  return (
    <>
      <group position={POS.card}>
        <SoftShadow position={[0, 0, 0.2]} size={[3.4, 2.2]} />
        <Anchor name={verifying ? "check" : "message"} position={[-0.6, 0.15, 0]} />
        {reacts(reaction, verifying && signed ? w.tamper : undefined) ? (
          <Pickable
            label={verifying && signed ? "Change one letter on the card" : "Message card"}
            onPick={verifying && signed ? w.tamper : undefined}
            anchor={[0, 0.2, 0]}
            pickMotion={cardSquash}
            {...reaction}
          >
            {card}
          </Pickable>
        ) : (
          card
        )}
        <Label position={[0, 1.4, -0.2]}>{verifying ? "Message to check" : "Message"}</Label>
        {shown.values ? (
          <Label position={[0, 0.05, 1.25]} variant="small">
            {`“${shorten(text, 26)}”`}
          </Label>
        ) : null}
        {result === "pass" ? (
          <Label position={[0, 2.35, -0.2]} variant="hint">
            ✓ Signature matches
          </Label>
        ) : result === "fail" ? (
          <Label position={[0, 2.35, -0.2]} variant="hint">
            ✗ Does not match
          </Label>
        ) : null}
        {signed && !verifying && signed.message !== w.message ? (
          <Label position={[0, 2.35, -0.2]}>changed: press Sign again</Label>
        ) : null}
      </group>
      <Seal w={w} verifying={verifying} />
    </>
  );
}

/** The signature as a seal. It travels from the private key to the card; a failed check cracks it red. */
function Seal({ w, verifying }: { w: Wallet; verifying: boolean }) {
  const { signed } = w;
  const result = verifying ? w.verdict : null;
  const color = result === "pass" ? COLORS.green : result === "fail" ? COLORS.red : ACCENT;
  const ink = useInk(color);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const cracked = result === "fail";
  const { reducedMotion } = useStage();
  const shown = useContext(ShownContext);
  useAnimatedFrame((_, dt) => {
    let moving = false;
    for (const [g, side] of [
      [left.current, -1],
      [right.current, 1],
    ] as const) {
      if (!g) continue;
      const goal = cracked ? 1 : 0;
      const cur: number = g.userData.u ?? goal;
      const u =
        reducedMotion || Math.abs(goal - cur) < 0.01 ? goal : cur + (goal - cur) * Math.min(1, dt * 7);
      g.userData.u = u;
      g.position.x = side * (0.2 + u * 0.22);
      g.rotation.z = -side * u * 0.35;
      if (u !== goal) moving = true;
    }
    return moving;
  });
  const at: Vec3 = signed ? [POS.card[0] + 0.7, 0.2, POS.card[2]] : [POS.key[0], 1.2, POS.key[2]];
  return (
    <Traveller to={at} arc={2.2} duration={1} color={ACCENT} glow={!!signed}>
      <group visible={!!signed}>
        {[left, right].map((r, k) => (
          <group key={k} ref={r} position={[k ? 0.2 : -0.2, 0, 0]}>
            <mesh position={[0, 0.09, 0]} material={ink}>
              <boxGeometry args={[0.38, 0.18, 0.78]} />
              <Outline />
            </mesh>
          </group>
        ))}
        {signed && shown.values ? (
          <Label position={[0, 0.75, 0]} variant="small">
            {`signature ${shorten(signed.signature, 10)}`}
          </Label>
        ) : null}
      </group>
    </Traveller>
  );
}

/** Step 8: the bin. Throwing the keys away drops the words and both keys into it. */
function Bin({ w, step, reaction }: { w: Wallet; step: number; reaction: Reaction }) {
  const ink = useInk(COLORS.slab);
  const black = useInk(INK);
  const body: ReactNode = (
    <>
      <mesh position={[0, 0.6, 0]} material={ink}>
        <cylinderGeometry args={[0.95, 0.75, 1.2, 28, 1, true]} />
        <Outline mode="hull" thickness={0.03} />
      </mesh>
      {/* The inside of the bin, so it reads as open. */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.94, 0.74, 1.19, 28, 1, true]} />
        <meshBasicMaterial color="#5b5566" side={BackSide} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} material={black}>
        <circleGeometry args={[0.74, 28]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={black}>
        <torusGeometry args={[0.95, 0.04, 8, 32]} />
      </mesh>
    </>
  );
  const canThrow = step === STEP.custody && !!w.keys && !w.cleared;
  return (
    <group position={POS.bin}>
      <SoftShadow position={[0, 0, 0.2]} size={[2.4, 1.4]} />
      {reacts(reaction, canThrow ? w.throwAway : undefined) ? (
        <Pickable
          label={canThrow ? "Drop the keys in the bin" : "Bin"}
          onPick={canThrow ? w.throwAway : undefined}
          anchor={[0, 0.8, 0]}
          pickMotion={binRock}
          {...reaction}
        >
          {body}
        </Pickable>
      ) : (
        body
      )}
      {w.cleared ? <Anchor name="custody" position={[0, 0.8, 0]} /> : null}
      <Label position={[0, 2.5, 0]}>{w.cleared ? "Keys thrown away" : "Bin"}</Label>
    </group>
  );
}
