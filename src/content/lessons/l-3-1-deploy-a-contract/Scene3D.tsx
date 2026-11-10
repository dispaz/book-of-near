/**
 * Lesson 3.1 in 3D: a pop-up book scene (docs/book-scene.md). On the right page: your mailbox, the
 * contract's sub-mailbox (dashed until the deploy makes it), the contract scroll with its gear, the
 * contract account's balance gauge (locked for storage vs available) and, at the failing callback, a
 * receipt slip per receipt. Every object is a pick that runs the step's action. It only draws the shared
 * state from useDeploy. Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useRef } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  BookScene,
  COLORS,
  focusOf,
  INK,
  inset,
  Label,
  Mailbox,
  Outline,
  Pickable,
  ReceiptSlip,
  Scroll,
  spreadBeside,
  spreadFor,
  textBlock,
  useFreeFrame,
  useInk,
  type Focus,
  type Vec3,
} from "../../../scene-kit";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import type { SceneProps } from "../../../app/types";
import { nearText } from "./contract";
import { boxOf, FIGURE, GAUGE, PARENT, partsAt, SCROLL, SLIPS, SUB } from "./layout3d";
import { describe, Facts, picksOf, short } from "./parts";
import { CALL, CHECK, FAIL, HOOK, WASM } from "./steps";
import { tourFor, type Target } from "./tour";
import type { Deploy } from "./useDeploy";

const ACCENT = STAGE_ACCENTS[3];
const SPREAD = { print: spreadBeside(FIGURE), docked: spreadFor(FIGURE) };
/** Where the step's words are printed on the left page. */
const TEXT = textBlock(SPREAD.print);
/** Running heads, only when the words are docked (the printed step heads the page otherwise). */
const HEADS: [string, string] = ["Stage 3", "Deploy a contract in one click"];
/** One caption per sheet (steps 0 to CHECK; the honest take shares the check's sheet). */
const FIGURES = [
  "Fig. 1  Code that lives on a name",
  "Fig. 2  The sub-account and the Wasm file",
  "Fig. 3  Deployed: the storage deposit locks",
  "Fig. 4  A change call and a view call",
  "Fig. 5  A failed call and its callback",
  "Fig. 6  Clearing state frees the deposit",
  "Fig. 7  Wasm, sub-accounts and storage staking",
];

/** What the camera keeps in view at a step: the parts it draws. */
function focusFor(step: number): Focus {
  return focusOf(
    partsAt(step).map((p) => boxOf(p)),
    44,
  );
}

/** What one tour shot looks at: low and close, turned a little. */
function shotFocus(t: Target, base: Focus): Focus {
  if (t.kind === "all") return { ...base, elevation: 34, azimuth: -14 };
  const [minX, maxX, minZ, maxZ, h] = boxOf(t.kind);
  return {
    center: [(minX + maxX) / 2, h / 3, (minZ + maxZ) / 2],
    width: maxX - minX + 0.6,
    depth: maxZ - minZ + 0.6,
    height: h,
    elevation: t.kind === "gauge" ? 40 : 26,
    azimuth: -14,
  };
}

export default function Scene3D({
  d,
  reducedMotion,
  flat,
  mode,
}: {
  d: Deploy;
  reducedMotion: boolean;
  flat: boolean;
  mode: SceneProps["mode"];
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = d;
  const summary = step >= CHECK;
  const { frame, size, wide, print } = useFreeFrame(root, panel, { summary });
  // Steps after the quiz stay on the quiz's sheet.
  const sheet = Math.min(step, CHECK);
  const focus = focusFor(step);
  return (
    <div
      ref={root}
      className={`book-scene dpc-book${summary ? " summary" : ""}`}
      data-testid="deploy-scene"
      data-scene-state={d.state}
      data-view="3d"
      data-mode={mode}
      role="group"
      aria-label="Deploy a contract, in 3D"
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
        state={d.state}
        description={summary ? "The book is open at the contract page." : describe(d)}
        status={d.status ?? undefined}
      >
        {summary && !wide ? null : <Figure d={d} />}
      </BookScene>
      {/* The facts both views show (HTML), over the right page. */}
      <div className="book-scene-panel dpc-panel" ref={panel}>
        {summary ? null : <Facts d={d} compact />}
      </div>
    </div>
  );
}

function Figure({ d }: { d: Deploy }) {
  const parts = partsAt(d.step);
  const picks = picksOf(d);
  const running = d.busy !== null && d.busy !== "read" && d.busy !== "deploy";
  const scrollNote =
    d.step === WASM || (!d.deployed && d.unrolled)
      ? d.facts.header.slice(0, 11)
      : d.deployed
        ? `count ${d.count ?? 0}`
        : undefined;
  // The post line from your account to its sub-account: an arc, dashed until the sub-account exists.
  const link: Vec3[] = Array.from({ length: 13 }, (_, k) => {
    const t = k / 12;
    return [
      PARENT[0] + 0.45 + (SUB[0] - 0.4 - PARENT[0] - 0.45) * t,
      1.25 + Math.sin(Math.PI * t) * 0.35 - 0.25 * t,
      PARENT[2] + (SUB[2] - PARENT[2]) * t,
    ];
  });
  return (
    <group>
      <Mailbox
        position={PARENT}
        size={1.7}
        name={short(d.parent?.id ?? "your account", 18)}
        color={ACCENT}
        {...picks.parent}
      />
      <Line points={link} color={INK} lineWidth={2} dashed={!d.deployed} dashSize={0.12} gapSize={0.08} />
      <Mailbox
        position={SUB}
        size={1.3}
        name="counter"
        color={ACCENT}
        state={d.deployed ? "ok" : "pending"}
        flag={d.deployed}
        {...picks.sub}
      />
      {d.step === HOOK ? <Anchor name="submailbox" position={[SUB[0], 1.1, SUB[2]]} /> : null}
      <Scroll
        position={SCROLL}
        size={1.6}
        name="counter.wasm"
        note={scrollNote}
        state={d.deployed || d.step === WASM ? "ok" : "pending"}
        running={running}
        {...picks.scroll}
      />
      {d.step === WASM || d.step === CALL ? (
        <Anchor name="scroll" position={[SCROLL[0], 1.2, SCROLL[2]]} />
      ) : null}
      {parts.includes("gauge") ? <Gauge d={d} /> : null}
      {parts.includes("slips") ? <Slips d={d} /> : null}
    </group>
  );
}

/** The contract account's balance as a flat bar: the locked part in the accent, the rest paper. */
function Gauge({ d }: { d: Deploy }) {
  const p = picksOf(d).gauge;
  const paper = useInk(COLORS.paper);
  const lockInk = useInk(ACCENT);
  const [cx, , cz] = GAUGE.center;
  const len = GAUGE.length;
  const lock = d.deployed ? Math.max(0.06, len * d.gauge.share) : 0;
  return (
    <group position={[cx, 0, cz]}>
      <Pickable label={p.pickLabel} onPick={p.onPick} anchor={[0, 0.4, 0]}>
        <mesh position={[0, 0.06, 0]} material={paper}>
          <boxGeometry args={[len, 0.12, GAUGE.depth]} />
          <Outline />
        </mesh>
        {lock > 0 ? (
          <mesh position={[-len / 2 + lock / 2, 0.1, 0]} material={lockInk}>
            <boxGeometry args={[lock, 0.14, GAUGE.depth * 0.98]} />
            <Outline />
          </mesh>
        ) : null}
      </Pickable>
      <Label position={[-len / 2 + 1.3, 0.3, -0.45]} variant="small">
        {d.deployed ? `locked ${nearText(d.gauge.lock)} NEAR` : "no account yet"}
      </Label>
      {d.deployed ? (
        <Label position={[len / 2 - 1.3, 0.3, 0.5]} variant="small">
          {`available ${nearText(d.gauge.available)} NEAR`}
        </Label>
      ) : null}
      <Anchor name="gauge" position={[-len / 2 + 0.4, 0.3, 0]} />
    </group>
  );
}

/** Step 5: one slip per receipt, ✓ or ✗, with the method's name. */
function Slips({ d }: { d: Deploy }) {
  const list = d.receipts ?? [];
  return (
    <group>
      {SLIPS.map((s, i) => {
        const r = list[i];
        const method = r ? r.method : ["call_other", "fail", "on_other_done"][i]!;
        return (
          <group key={i}>
            <ReceiptSlip
              position={s}
              size={0.75}
              color={ACCENT}
              state={r ? "ok" : "pending"}
              fate={r ? (r.ok ? "done" : "failed") : "idle"}
              label={String(i + 1)}
              pickLabel={`Receipt ${i + 1}: ${r ? r.method : "not sent yet"}${r ? (r.ok ? " worked" : " failed") : ""}`}
              onPick={() => void (d.receipts ? d.inspect() : d.failWithCallback())}
            />
            <Label position={[s[0], 0.05, s[2] + 0.45]} variant="small">
              {method}
            </Label>
          </group>
        );
      })}
      {d.step === FAIL ? <Anchor name="receipts" position={[SLIPS[1]![0], 0.6, SLIPS[1]![2]]} /> : null}
    </group>
  );
}
