/**
 * Lesson 5.2 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: the developer's laptop
 * (an app screen, the bot's .env on it) and the developer's key on the left; the agent's enclave in front
 * and the agent contract (a scroll) at the back in the middle; the signing network (three nodes) and the
 * contract's Ethereum address (a mailbox) on the right. The agent's signing request is a parcel that
 * travels from the enclave to the contract to the signer. Every object reacts (rule 10a, the script's
 * "Reactions" table). Only draws the shared state from useAgent. Loaded lazily from Scene.tsx.
 */
import { useRef } from "react";
import type { Object3D } from "three";
import {
  Anchor,
  AppScreen,
  BookScene,
  focusOf,
  inset,
  Mailbox,
  Parcel,
  Pickable,
  Scroll,
  SignerNode,
  spreadBeside,
  spreadFor,
  swell,
  TaggedKey,
  textBlock,
  Traveller,
  useFreeFrame,
  type Focus,
  type PickMotion,
  type Vec3,
} from "../../../scene-kit";
import type { SceneProps } from "../../../app/types";
import { EnclaveBox } from "../../stages/5-enclave/EnclaveBox";
import stage from "../../stages/5-enclave/stage";
import { describe, PICK_LABELS, short, type Obj, type Reaction } from "./agent";
import { CONTRACT, ENCLAVE, ETH, FIGURE, KEY, LAPTOP, NODES, REQUEST_AT, SIGNER } from "./layout";
import { Facts } from "./parts";
import { CHECK, RUN } from "./steps";
import { tourFor, type Target } from "./tour";
import type { AgentLesson } from "./useAgent";

const ACCENT = stage.accent;
/** The page needs room in front for the names under the front objects. */
const SPREAD = {
  print: spreadBeside({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
  docked: spreadFor({ ...FIGURE, maxZ: FIGURE.maxZ + 0.3 }),
};
const TEXT = textBlock(SPREAD.print);
const HEADS: [string, string] = ["Stage 5", "An agent with no owner"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  A bot's key in a file",
  "Fig. 2  The agent makes its key in the enclave",
  "Fig. 3  The agent contract checks the quote",
  "Fig. 4  The developer, refused",
  "Fig. 5  The contract signs for its own address",
  "Fig. 6  An agent with no owner",
];

const WHOLE = focusOf([[FIGURE.minX, FIGURE.maxX, FIGURE.minZ, FIGURE.maxZ, 2.2]], 46, 0, 0.25);

const AT: Record<Exclude<Target["kind"], "all">, Vec3> = {
  laptop: LAPTOP,
  key: KEY,
  enclave: ENCLAVE,
  contract: CONTRACT,
  signer: SIGNER,
  eth: ETH,
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
  /** The laptop tilts forward, like opening a file. */
  laptop(o: Object3D, t: number) {
    const T = 0.6;
    if (t >= T) return false;
    o.rotation.x += 0.3 * swell(t, T);
    return true;
  },
  /** The developer's key lunges at the agent contract and bounces back. */
  key(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    o.position.x += 0.6 * swell(t, T);
    o.position.z -= 0.5 * swell(t, T);
    return true;
  },
  /** The enclave pulses twice: the agent at work inside. */
  enclave(o: Object3D, t: number) {
    const T = 0.8;
    if (t >= T) return false;
    o.scale.multiplyScalar(1 + 0.08 * Math.abs(Math.sin((t / T) * Math.PI * 2)));
    return true;
  },
  /** The contract scroll rises and turns a little, like unrolling to read. */
  contract(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    o.position.y += 0.35 * swell(t, T);
    o.rotation.y += 0.4 * swell(t, T);
    return true;
  },
  /** The signing nodes bob in turn, one after another. */
  signer(o: Object3D, t: number) {
    const T = 0.9;
    if (t >= T) return false;
    o.children.forEach((c, i) => {
      const k = Math.max(0, Math.min(1, (t - i * 0.2) / 0.4));
      c.position.y = 0.25 * Math.sin(k * Math.PI);
    });
    return true;
  },
  /** The mailbox hops and turns to show its flag. */
  eth(o: Object3D, t: number) {
    const T = 0.7;
    if (t >= T) return false;
    o.position.y += 0.4 * swell(t, T);
    o.rotation.y += 0.5 * swell(t, T);
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
  m: AgentLesson;
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
      className={`book-scene nao-book${summary ? " summary" : ""}`}
      data-testid="nao-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="An agent with no owner, in 3D"
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
        description={summary ? "The book is open at the agent page." : describe(m)}
        status={m.run.status === "running" ? "the agent is asking for a signature" : undefined}
        minDistance={3}
        maxDistance={140}
      >
        {summary && !wide ? null : <Figure m={m} compact={!print} />}
      </BookScene>
      <div className="book-scene-panel nao-panel" ref={panel}>
        {summary ? null : <Facts m={m} compact />}
      </div>
    </div>
  );
}

function Figure({ m, compact }: { m: AgentLesson; compact: boolean }) {
  const { step, reactions: r } = m;
  const props = (o: Obj) => ({
    ...pickFor(r[o], () => m.act(o)),
    pickMotion: MOTIONS[o],
    pickLabel: PICK_LABELS[o],
  });
  const signed = m.run.status === "done";
  const req = signed ? REQUEST_AT.signer : m.run.status === "running" ? REQUEST_AT.contract : REQUEST_AT.home;
  return (
    <group>
      {/* ---------- the developer's laptop, with the bot's .env ---------- */}
      <AppScreen
        position={LAPTOP}
        size={1.5}
        name={m.envOpen ? "laptop · .env open" : "developer's laptop"}
        color={ACCENT}
        state={m.envOpen ? "failed" : "ok"}
        {...props("laptop")}
      />
      <Anchor name="laptop" position={[LAPTOP[0], 1.4, LAPTOP[2]]} />

      {/* ---------- the developer's key ---------- */}
      <TaggedKey
        position={[KEY[0], 0.5, KEY[2]]}
        color={ACCENT}
        tag={m.devRefused ? "refused" : "developer"}
        share={m.devRefused ? 0 : 1}
        name="developer's key"
        state={m.devRefused ? "failed" : "ok"}
        {...props("key")}
      />
      <Anchor name="key" position={[KEY[0], 1.1, KEY[2]]} />

      {/* ---------- the agent's enclave ---------- */}
      <Pickable
        label={PICK_LABELS.enclave}
        anchor={[0, 0.6, 0]}
        {...pickFor(r.enclave, () => m.act("enclave"))}
        pickMotion={MOTIONS.enclave}
      >
        <group position={ENCLAVE}>
          <EnclaveBox
            lit={m.registered}
            label={
              compact ? undefined : m.agent ? `agent ${short(m.agent.accountId, 4)}` : "the agent's enclave"
            }
          />
        </group>
      </Pickable>
      <Anchor name="enclave" position={[ENCLAVE[0], 1.1, ENCLAVE[2]]} />

      {/* ---------- the agent contract ---------- */}
      <Scroll
        position={CONTRACT}
        size={1.3}
        name="agent contract"
        note={m.registered ? "1 agent" : undefined}
        running={m.run.status === "running"}
        color={ACCENT}
        {...props("contract")}
      />
      <Anchor name="contract" position={[CONTRACT[0], 1.3, CONTRACT[2]]} />

      {/* ---------- the signing network: three nodes, one pick ---------- */}
      <Pickable
        label={PICK_LABELS.signer}
        anchor={[SIGNER[0], 0.6, SIGNER[2]]}
        {...pickFor(r.signer, () => m.act("signer"))}
        pickMotion={MOTIONS.signer}
      >
        <group>
          {NODES.map((n, i) => (
            <group key={i}>
              <SignerNode position={n} rotation={0} size={0.7} lit={signed} color={ACCENT} />
            </group>
          ))}
        </group>
      </Pickable>
      <Anchor name="signer" position={[SIGNER[0], 1.2, SIGNER[2]]} />

      {/* ---------- the contract's Ethereum address ---------- */}
      <Mailbox
        position={ETH}
        size={1.3}
        name={signed && m.run.status === "done" ? short(m.run.address, 4) : "Ethereum address"}
        flag={signed}
        color={ACCENT}
        state={step >= RUN ? "ok" : "pending"}
        {...props("eth")}
      />
      <Anchor name="eth" position={[ETH[0], 1.4, ETH[2]]} />

      {/* The agent's signing request: from the enclave to the contract to the signer. */}
      {step >= RUN ? (
        <Traveller to={req} arc={1.2} duration={0.9} color={ACCENT}>
          <Parcel size={0.5} color={ACCENT} stamped={signed} state="ok" />
        </Traveller>
      ) : null}
    </group>
  );
}
