/**
 * Lesson 5.1 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: your terminal (an app
 * screen) on the left; an ordinary cloud server (a box with its lid open, its memory readable) at the
 * back and the hardware enclave (a chip inside a sealed perimeter) in front; root access (a key) between
 * them; the attestation quote (a slip) and Intel's root certificate (a seal) on the right. Your prompt is
 * a parcel that goes into the enclave. Every object reacts (rule 10a, the script's "Reactions" table).
 * Only draws the shared state from usePrivateAi. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import type { Object3D } from "three";
import {
  Anchor,
  AppScreen,
  BookScene,
  COLORS,
  focusOf,
  inset,
  INK,
  Label,
  Outline,
  Parcel,
  Pickable,
  ReceiptSlip,
  SoftShadow,
  spreadBeside,
  spreadFor,
  Stamp,
  swell,
  TaggedKey,
  textBlock,
  Traveller,
  useFreeFrame,
  useInk,
  type Focus,
  type PickMotion,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import stage from "../../stages/5-enclave/stage";
import { ENCLAVE, FIGURE, PROMPT_AT, QUOTE, ROOT, SEAL, SERVER, TERMINAL } from "./layout";
import { Facts } from "./parts";
import { describe, PICK_LABELS, type Obj, type Reaction } from "./tutor";
import { CHECK, PROMPT } from "./steps";
import { tourFor, type Target } from "./tour";
import type { PrivateAi } from "./usePrivateAi";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 5", "Ask a private AI and verify it"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Two places your prompt can go",
  "Fig. 2  Root tries both memories",
  "Fig. 3  Your prompt, sealed in the enclave",
  "Fig. 4  The chip's signed quote",
  "Fig. 5  Checked up to Intel's root",
  "Fig. 6  Private AI on NEAR",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);

const AT: Record<Exclude<Target["kind"], "all">, Vec3> = {
  terminal: TERMINAL,
  server: SERVER,
  enclave: ENCLAVE,
  root: ROOT,
  quote: QUOTE,
  seal: SEAL,
};

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target): Focus {
  if (t.kind === "all") return { ...WHOLE, elevation: 36, azimuth: -14 };
  const p = AT[t.kind];
  return { center: [p[0], 0.7, p[2]], width: 2.6, depth: 2.4, height: 1.8, elevation: 28, azimuth: -14 };
}

// ---------- each object's own pick animation (Pickable's `pickMotion`) ----------

/** They add to the pose Pickable hands over, return true while they play and leave no offset after. */
const MOTIONS: Record<Obj, PickMotion> = {
  /** The terminal tilts forward, like leaning in to send. */
  terminal(o: Object3D, t: number) {
    const T = 0.6;
    if (t >= T) return false;
    o.rotation.x += 0.3 * swell(t, T);
    return true;
  },
  /** The server rocks: nothing stops anyone reading it. */
  server(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    o.rotation.z += 0.1 * Math.sin((t / T) * Math.PI * 2) * (1 - t / T);
    return true;
  },
  /** The enclave pulses twice: its sealed perimeter at work. */
  enclave(o: Object3D, t: number) {
    const T = 0.8;
    if (t >= T) return false;
    o.scale.multiplyScalar(1 + 0.08 * Math.abs(Math.sin((t / T) * Math.PI * 2)));
    return true;
  },
  /** The root key lunges at the enclave and bounces back. */
  root(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    o.position.x -= 0.5 * swell(t, T);
    o.position.z += 0.5 * swell(t, T);
    return true;
  },
  /** The quote slip lifts and turns over, like unfolding it to read. */
  quote(o: Object3D, t: number) {
    const T = 0.8;
    if (t >= T) return false;
    o.position.y += 0.5 * swell(t, T);
    o.rotation.y += Math.PI * 2 * Math.min(1, t / T);
    return true;
  },
  /** The seal stamps down once. */
  seal(o: Object3D, t: number) {
    const T = 0.5;
    if (t >= T) return false;
    o.position.y += 0.4 * swell(t, T / 2) - 0.1 * swell(Math.max(0, t - T / 2), T / 2);
    return true;
  },
};

/** Pickable props for one object (rule 10a): its step action, a "not yet" hint or a detail. */
const pickFor = (r: Reaction, act: () => void) => ({
  onPick: r.act ? act : undefined,
  disabledHint: r.hint,
  detail: r.detail,
});

export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: PrivateAi;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = m;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  return (
    <div
      ref={root}
      className={`book-scene pai-book${summary ? " summary" : ""}`}
      data-testid="pai-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Ask a private AI and verify it, in 3D"
    >
      <BookScene
        page={step}
        sheet={sheet}
        spread={print ? SPREAD.print : SPREAD.docked}
        heads={print ? undefined : HEADS}
        caption={FIGURES[sheet]}
        text={print ? TEXT : null}
        focus={WHOLE}
        frame={inset(frame, { top: 24, bottom: 16 })}
        size={size}
        shots={tourFor(step)}
        shotFocus={shotFocus}
        flat={flat}
        reducedMotion={reducedMotion}
        state={m.state}
        description={summary ? "The book is open at the enclave page." : describe(m)}
        status={m.verify.status === "running" ? "checking the quote's signatures" : undefined}
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel pai-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

function Figure({ m, compact }: { m: PrivateAi; compact: boolean }) {
  const { step, reactions: r } = m;
  const props = (o: Obj) => ({
    ...pickFor(r[o], () => m.act(o)),
    pickMotion: MOTIONS[o],
    pickLabel: PICK_LABELS[o],
  });
  const sealed = m.verified;
  return (
    <group>
      {/* ---------- your terminal ---------- */}
      <AppScreen position={TERMINAL} size={1.6} name="your terminal" color={ACCENT} {...props("terminal")} />
      <Anchor name="terminal" position={[TERMINAL[0], 1.4, TERMINAL[2]]} />

      {/* ---------- an ordinary cloud server: lid open, memory readable ---------- */}
      <Pickable
        label={PICK_LABELS.server}
        anchor={[0, 0.6, 0]}
        {...pickFor(r.server, () => m.act("server"))}
        pickMotion={MOTIONS.server}
      >
        <group position={SERVER}>
          <OpenServer read={m.dumped} compact={compact} />
        </group>
      </Pickable>
      <Anchor name="server" position={[SERVER[0], 1.2, SERVER[2]]} />

      {/* ---------- the hardware enclave ---------- */}
      <Pickable
        label={PICK_LABELS.enclave}
        anchor={[0, 0.6, 0]}
        {...pickFor(r.enclave, () => m.act("enclave"))}
        pickMotion={MOTIONS.enclave}
      >
        <group position={ENCLAVE}>
          <EnclaveBox attested={sealed} holds={m.answered} compact={compact} />
        </group>
      </Pickable>
      <Anchor name="enclave" position={[ENCLAVE[0], 1.1, ENCLAVE[2]]} />

      {/* ---------- root access ---------- */}
      <TaggedKey
        position={[ROOT[0], 0.5, ROOT[2]]}
        color={ACCENT}
        tag={m.dumped ? "read 1 of 2" : "root"}
        share={m.dumped ? 0.5 : 1}
        name="root access"
        {...props("root")}
      />

      {/* Your prompt: a parcel by your terminal, then sealed inside the enclave. */}
      {step >= PROMPT ? (
        <Traveller
          to={m.asked !== null ? PROMPT_AT.enclave : PROMPT_AT.home}
          arc={1.2}
          duration={0.9}
          color={ACCENT}
        >
          <Parcel size={0.6} color={ACCENT} stamped={m.asked !== null} state="ok" />
        </Traveller>
      ) : null}

      {/* ---------- the attestation quote ---------- */}
      <ReceiptSlip
        position={QUOTE}
        size={0.95}
        color={ACCENT}
        label={m.attestation ? `${m.attestation.source} quote` : undefined}
        fate={sealed ? "done" : "idle"}
        state={m.attestation ? "ok" : "pending"}
        {...props("quote")}
      />
      <Anchor name="quote" position={[QUOTE[0], 1.1, QUOTE[2]]} />

      {/* ---------- Intel's root certificate: a seal ---------- */}
      <Pickable
        label={PICK_LABELS.seal}
        anchor={[0, 0.7, 0]}
        {...pickFor(r.seal, () => m.act("seal"))}
        pickMotion={MOTIONS.seal}
      >
        <group position={SEAL}>
          <SoftShadow position={[0, 0, 0.1]} size={[1, 0.6]} />
          <Stamp
            position={[0, 0.42, 0]}
            rotation={[-0.25, 0, 0]}
            size={0.7}
            color={sealed ? ACCENT : COLORS.slab}
          />
          {compact ? null : (
            <Label position={[0, 1.2, 0]} variant="small">
              Intel root
            </Label>
          )}
        </group>
      </Pickable>
      <Anchor name="seal" position={[SEAL[0], 1.0, SEAL[2]]} />
    </group>
  );
}

/** An ordinary cloud server: a box with its lid tipped open and lines of memory showing on top. */
function OpenServer({ read, compact }: { read: boolean; compact: boolean }) {
  const paper = useInk(COLORS.paper);
  const ink = useInk(INK);
  const lid = useInk(COLORS.slab);
  return (
    <group>
      <SoftShadow position={[0, 0, 0.2]} size={[2.2, 1.4]} />
      <mesh position={[0, 0.35, 0]} material={paper}>
        <boxGeometry args={[1.8, 0.7, 1.1]} />
        <Outline />
      </mesh>
      {/* Lines of memory in plain text, on the open top. */}
      {[-0.28, 0, 0.28].map((z, i) => (
        <mesh key={z} position={[i === 2 ? -0.2 : 0, 0.71, z]} material={ink}>
          <boxGeometry args={[i === 2 ? 0.9 : 1.3, 0.02, 0.07]} />
        </mesh>
      ))}
      {/* The lid, tipped open at the back. */}
      <mesh position={[0, 0.95, -0.72]} rotation={[-1.1, 0, 0]} material={lid}>
        <boxGeometry args={[1.8, 0.06, 0.9]} />
        <Outline />
      </mesh>
      {compact ? null : (
        <Label position={[0, 0.05, 0.95]} variant="small">
          {read ? "ordinary server · plain text" : "ordinary server"}
        </Label>
      )}
    </group>
  );
}

/** The enclave: a dark chip with pins, a padlock on top, inside a perimeter that lights once attested. */
function EnclaveBox({ attested, holds, compact }: { attested: boolean; holds: boolean; compact: boolean }) {
  const chip = useInk(INK);
  const pin = useInk(COLORS.slab);
  const accent = useInk(ACCENT);
  const rim = useInk(attested ? ACCENT : COLORS.paper);
  return (
    <group>
      <SoftShadow position={[0, 0, 0.2]} size={[2.4, 1.8]} />
      {/* The sealed perimeter: a low wall all round. */}
      {(
        [
          [0, -0.85, 2.0, 0.12],
          [0, 0.85, 2.0, 0.12],
          [-1.0, 0, 0.12, 1.82],
          [1.0, 0, 0.12, 1.82],
        ] as const
      ).map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, 0.12, z]} material={rim}>
          <boxGeometry args={[w, 0.24, d]} />
          <Outline />
        </mesh>
      ))}
      {/* The chip and its pins. */}
      <mesh position={[0, 0.2, 0]} material={chip}>
        <boxGeometry args={[1.2, 0.25, 1.0]} />
        <Outline />
      </mesh>
      {[-0.4, -0.13, 0.13, 0.4].map((x) =>
        [-0.58, 0.58].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.12, z]} material={pin}>
            <boxGeometry args={[0.08, 0.06, 0.16]} />
          </mesh>
        )),
      )}
      {/* A padlock on the chip. */}
      <mesh position={[0, 0.48, 0]} material={accent}>
        <boxGeometry args={[0.38, 0.3, 0.2]} />
        <Outline />
      </mesh>
      <mesh position={[0, 0.66, 0]} material={chip}>
        <torusGeometry args={[0.12, 0.035, 8, 20, Math.PI]} />
      </mesh>
      {compact ? null : (
        <Label position={[0, 0.05, 1.2]} variant="small">
          {holds ? "enclave · your prompt, sealed" : "enclave (Intel TDX)"}
        </Label>
      )}
    </group>
  );
}
