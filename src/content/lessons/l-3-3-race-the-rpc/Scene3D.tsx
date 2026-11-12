/**
 * Lesson 3.3 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: the learner's mailbox
 * (their app) at the front and a counter window per RPC provider at the back, a latency bar standing
 * beside each window after the race. A window lights while it answers, goes dark with a red cross when
 * switched off and pulls its shutter when it does not keep a block. Every object is a pick that runs the
 * step's action or shows a detail. It only draws the shared state from useRace. Loaded lazily.
 */
import { useRef } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  BookScene,
  focusOf,
  INK,
  inset,
  Label,
  Mailbox,
  Outline,
  Pickable,
  RpcWindow,
  spreadBeside,
  spreadFor,
  textBlock,
  useFreeFrame,
  useInk,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import { COLORS, STAGE_ACCENTS } from "../../../scene-kit/theme";
import type { SceneProps } from "../../../app/types";
import type { RpcEndpointId } from "../../../chain/rpcEndpoints";
import { BAR, boxOf, FIGURE, LABELS, MAILBOX, partsAt, TAG_DZ, WINDOWS, windowsAt } from "./layout3d";
import { barsOf, describe, Facts, noteOf, type Bar } from "./parts";
import { nameOf } from "./race";
import { ARCHIVE, CHECK, RACE } from "./steps";
import { tourFor, type Target } from "./tour";
import type { RaceState } from "./useRace";

const ACCENT = STAGE_ACCENTS[3];
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 3", "Race the RPC nodes"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Three windows into the chain",
  "Fig. 2  One question, three round trips",
  "Fig. 3  A provider goes down",
  "Fig. 4  Failover to the next window",
  "Fig. 5  Regular and archival nodes",
  "Fig. 6  RPC nodes, failover, history",
];

/** What the camera keeps in view at a step: the parts it draws. */
function focusFor(step: number): Focus {
  return focusOf(
    partsAt(step).map((p) => boxOf(p)),
    40,
  );
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 32, azimuth: -14 };
  const [minX, maxX, minZ, maxZ, h] = boxOf(t.kind);
  return {
    center: [(minX + maxX) / 2, h / 3, (minZ + maxZ) / 2],
    width: maxX - minX + 0.6,
    depth: maxZ - minZ + 0.6,
    height: h,
    elevation: 26,
    azimuth: -14,
  };
}

export default function Scene3D({
  r,
  reducedMotion,
  flat,
  mode,
}: {
  r: RaceState;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = r;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  return (
    <div
      ref={root}
      className={`book-scene rpc-book${summary ? " summary" : ""}`}
      data-testid="rpc-scene"
      data-scene-state={r.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Race the RPC nodes, in 3D"
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
        state={r.state}
        description={summary ? "The book is open at the RPC page." : describe(r)}
        status={r.busy === "race" ? "Racing…" : r.busy ? "Asking…" : undefined}
      >
        {summary && !wide ? null : <Figure r={r} wide={wide} />}
      </BookScene>
      {/* The facts both views show (HTML), over the right page. */}
      <div className="book-scene-panel rpc-panel" ref={panel}>
        {summary ? null : <Facts r={r} compact />}
      </div>
    </div>
  );
}

function Figure({ r, wide }: { r: RaceState; wide: boolean }) {
  const ids = windowsAt(r.step);
  const bars = barsOf(r);
  return (
    <group>
      {ids.map((id) => (
        <Link key={`l-${id}`} id={id} look={r.windowLook(id)} />
      ))}
      {ids.map((id, i) => {
        const look = r.windowLook(id);
        // On narrow screens the names above would touch: every other window has its name in front.
        const front = !wide && i % 2 === 1;
        const tag = front ? [LABELS[id], noteOf(r, id)].filter(Boolean).join(" · ") : noteOf(r, id);
        const [x, , z] = WINDOWS[id];
        return (
          <group key={id}>
            <RpcWindow
              position={WINDOWS[id]}
              size={1.35}
              name={front ? "" : LABELS[id]}
              color={ACCENT}
              state={look === "down" ? "failed" : "ok"}
              lit={look === "lit"}
              shut={look === "shut"}
              selected={r.picked === id}
              pickLabel={`Counter window: ${nameOf(id)} RPC node`}
              onPick={() => r.pickWindow(id)}
            />
            {tag ? (
              <Label position={[x, 0.05, z + TAG_DZ + (front ? 0.55 : 0)]} variant="small">
                {tag}
              </Label>
            ) : null}
          </group>
        );
      })}
      {bars.map((b) => (
        <LatencyBar
          key={b.id}
          bar={b}
          first={r.raced?.winner?.endpointId === b.id}
          onPick={() => r.pickWindow(b.id)}
        />
      ))}
      <Mailbox
        position={MAILBOX}
        size={1.4}
        name="Your app"
        color={ACCENT}
        flag={r.windowLook("fastnear") === "lit" || !!r.fo?.answeredBy || !!r.hist}
        selected={r.picked === "mailbox"}
        pickLabel="Mailbox: your app and its fallback list"
        onPick={r.pickMailbox}
      />
      <Anchor name="windows" position={[WINDOWS["near-org"][0], 1.2, WINDOWS["near-org"][2]]} />
      {r.step === RACE ? (
        <Anchor name="bars" position={[WINDOWS.fastnear[0] + BAR.dx, 1.0, WINDOWS.fastnear[2]]} />
      ) : null}
      {r.step === ARCHIVE ? (
        <Anchor name="archive" position={[WINDOWS.archival[0], 1.2, WINDOWS.archival[2]]} />
      ) : null}
    </group>
  );
}

/** The line from the app to a window on the page: dashed until it answers, red when the window is off. */
function Link({ id, look }: { id: RpcEndpointId; look: string }) {
  const [x, , z] = WINDOWS[id];
  const points: Vec3[] = [
    [MAILBOX[0], 0.03, MAILBOX[2] - 0.5],
    [x, 0.03, z + 0.55],
  ];
  const live = look === "lit";
  return (
    <Line
      points={points}
      color={look === "down" ? COLORS.red : live ? ACCENT : INK}
      lineWidth={live ? 3 : 1.5}
      dashed={!live}
      dashSize={0.14}
      gapSize={0.1}
    />
  );
}

/** A latency bar: a column standing beside its window, as tall as its round trip is long. */
function LatencyBar({ bar, first, onPick }: { bar: Bar; first: boolean; onPick: () => void }) {
  const fill = useInk(first ? ACCENT : COLORS.paper);
  const [x, , z] = WINDOWS[bar.id];
  const h = Math.max(0.06, bar.share * BAR.maxHeight);
  return (
    <group position={[x + BAR.dx, 0, z]}>
      <Pickable label={`Latency bar: ${nameOf(bar.id)}, ${bar.label}`} onPick={onPick} anchor={[0, h / 2, 0]}>
        <mesh position={[0, h / 2, 0]} material={fill}>
          <boxGeometry args={[BAR.width, h, BAR.width]} />
          <Outline />
        </mesh>
      </Pickable>
      <Label position={[0, h + 0.3, 0]} variant="small">
        {bar.label}
      </Label>
    </group>
  );
}
