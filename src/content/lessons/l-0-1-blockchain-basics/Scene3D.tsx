import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  Anchor,
  Coin,
  focusOf,
  frameCamera,
  InkStage,
  inset,
  Label,
  Traveller,
  ViewOffset,
  type Box,
  type Focus,
  type Frame,
  type Reserve,
  type Vec3,
} from "../../../scene-kit";
import { PEOPLE, shortHash, START, type Chain, type Person, type Tx } from "./ledger";
import { AUTO_TAMPER_NOTE, BlockDetails, COMPARE_RESULT, EditAmount, useHotLines } from "./parts";
import {
  BD,
  BH,
  BW,
  CARD_AT,
  CHAIN_Z,
  chainX,
  HashLink,
  Ledger,
  LEDGER_D,
  LEDGER_TALL,
  LEDGER_W,
  LedgerBlock,
  Slip,
  Tag,
  type PageRow,
  type TagPlace,
} from "./objects3d";
import {
  BLOCKS,
  CHECK,
  COMPARE,
  HASH,
  HONEST,
  LINKS,
  MAX_BLOCKS,
  NOTEBOOK,
  SEND,
  TAMPER,
  type LedgerLesson,
} from "./useLedgerLesson";
import "./scene.css";
import "./scene3d.css";

// ---------- layouts ----------

/**
 * Where things stand. Wide free areas get the chain in one row with cards under the blocks. Narrow ones
 * (phones, the column beside the Check) fold it into a 2 x 2 loop with cards on the sides:
 * #0 → #1 on the back row, #2 under #1, #3 beside it.
 */
/** Three ledgers in a row (along x) or a column (along z): centre-to-centre pitch, scale and depth. */
interface LedgerRow {
  pitch: number;
  scale: number;
  z: number;
  column?: boolean;
}

interface Geo {
  compact: boolean;
  /** The ledgers while they are all open (send to links). */
  ledgers: LedgerRow;
  /** The ledgers at the first step: bigger, and only one is open at a time. */
  notebooks: LedgerRow;
  block: (i: number) => Vec3;
  card: (i: number) => { at: Vec3; place: TagPlace };
  /** Pixels kept free around the objects for the cards. */
  reserve: Reserve;
  elevation: number;
  /** Copies at the compare step. */
  copies: { pitch: number; scale: number; tag: { x: number; place: TagPlace } };
}

const ROW: Geo = {
  compact: false,
  // Three open spreads (2 x LEDGER_W wide each) side by side with a gap.
  ledgers: { pitch: 4, scale: 0.9, z: -2.3 },
  // One open spread next to closed books: 1.5 x LEDGER_W from centre to centre, plus a gap.
  notebooks: { pitch: 3.8, scale: 1.15, z: 0 },
  block: (i) => [chainX(i), 0, CHAIN_Z],
  card: () => ({ at: CARD_AT, place: "below" }),
  reserve: { bottom: 70, top: 28 },
  elevation: 34,
  copies: {
    pitch: 2.4,
    scale: 0.7,
    tag: { x: chainX(3, 2.4) + 0.75, place: "right" },
  },
};

const SX = 1.55;
const SZ = 2.9;
const SNAKE: Geo = {
  compact: true,
  ledgers: { pitch: 2.1, scale: 0.5, z: -1.6 },
  // Phones stack the ledgers front to back, so each one can be big.
  notebooks: { pitch: 2.6, scale: 0.85, z: 0, column: true },
  block: (i) => [i === 0 || i === 3 ? -SX : SX, 0, 0.9 + (i >= 2 ? SZ : 0)],
  card: (i) =>
    i === 0 || i === 3
      ? { at: [-BW / 2 - 0.08, BH * 0.55, 0], place: "left" }
      : { at: [BW / 2 + 0.08, BH * 0.55, 0], place: "right" },
  reserve: { left: 100, right: 100, top: 26, bottom: 26 },
  elevation: 50,
  copies: { pitch: 2.1, scale: 0.65, tag: { x: chainX(0, 2.1) - 1.25, place: "left" } },
};

/** Copies of the chain at the compare step: one row per person. */
const ROW_Z: Record<Person, number> = { Ana: -3, Ben: 0, Cora: 3 };

/** What the camera must keep in view at each step, and the pixels to keep free for tags. */
function shotFor(step: number, g: Geo, popup = false): { focus: Focus; reserve: Reserve } {
  const shot = baseShot(step, g);
  // An opened block's pop-up card stands above it: keep room for it.
  if (popup) shot.reserve = { ...shot.reserve, top: (shot.reserve.top ?? 0) + (g.compact ? 110 : 70) };
  return shot;
}

function baseShot(step: number, g: Geo): { focus: Focus; reserve: Reserve } {
  const ledgers = (r: LedgerRow): Box =>
    r.column
      ? [
          -LEDGER_W * r.scale,
          LEDGER_W * r.scale,
          r.z - r.pitch - (LEDGER_D / 2) * r.scale,
          r.z + r.pitch + (LEDGER_D / 2) * r.scale,
          LEDGER_TALL * r.scale,
        ]
      : [
          -r.pitch - LEDGER_W * r.scale,
          r.pitch + LEDGER_W * r.scale,
          r.z - (LEDGER_D / 2) * r.scale,
          r.z + (LEDGER_D / 2) * r.scale,
          LEDGER_TALL * r.scale,
        ];
  const shelf = ledgers(g.ledgers);
  const blocks = Array.from({ length: MAX_BLOCKS }, (_, i) => g.block(i));
  const chain: Box = [
    Math.min(...blocks.map((b) => b[0])) - BW / 2,
    Math.max(...blocks.map((b) => b[0])) + BW / 2,
    Math.min(...blocks.map((b) => b[2])) - BD / 2,
    Math.max(...blocks.map((b) => b[2])) + BD / 2,
    BH,
  ];
  if (step === NOTEBOOK) {
    return { focus: focusOf([ledgers(g.notebooks)], g.compact ? 48 : 42), reserve: { bottom: 16, top: 36 } };
  }
  if (step === TAMPER && !g.compact)
    return { focus: focusOf([shelf, chain], g.elevation + 2), reserve: g.reserve };
  if (step >= SEND && step <= LINKS) {
    const az = step === BLOCKS || step === HASH ? -8 : 0;
    if (!g.compact)
      return {
        focus: focusOf([shelf, chain], g.elevation + (step === LINKS ? 2 : 0), az),
        reserve: g.reserve,
      };
    // Narrow: the first row of blocks (balances are pills above), then the whole loop once it fills up.
    if (step === LINKS) return { focus: focusOf([chain], g.elevation), reserve: g.reserve };
    const row0: Box = [chain[0], chain[1], chain[2], chain[2] + BD, BH];
    return { focus: focusOf([row0], g.elevation - 8, az), reserve: g.reserve };
  }
  if (step === COMPARE) {
    const c = g.copies;
    const left = chainX(0, c.pitch) - (BW / 2) * c.scale;
    const right = chainX(3, c.pitch) + (BW / 2) * c.scale;
    const rows: Box = [left, right, ROW_Z.Ana - 0.5, ROW_Z.Cora + 0.5, 1];
    const reserve: Reserve = g.compact ? { left: 150, top: 10, bottom: 8 } : { right: 175, top: 26 };
    return { focus: focusOf([rows], 52), reserve };
  }
  return { focus: focusOf([chain], g.elevation - 4), reserve: { ...g.reserve, top: 30 } };
}

const DESCRIPTION = [
  "Three ledgers: Ana's, Ben's and Cora's. Every ledger holds the same balances.",
  "Ana's, Ben's and Cora's ledgers, open at their balances, and the chain of blocks in front of them.",
  "The chain of blocks. Open a block to see the transaction inside.",
  "The chain of blocks, each with its hash.",
  "The chain of blocks, each linked to the one before it by that block's hash.",
  "Ben's copy of the chain. Changing block #1 breaks every later link.",
  "Three copies of the chain side by side: Ana's, Ben's and Cora's.",
  "The honest chain.",
  "The honest chain.",
];

/**
 * The 3D view of lesson 0.1: three ledgers of balances, blocks that drop onto a chain and
 * hash links that crack. It draws the same state as the 2D view (Scene2D) and shares its actions.
 */
export default function Scene3D({
  m,
  reducedMotion,
  flat,
  mode,
}: {
  m: LedgerLesson;
  reducedMotion: boolean;
  flat: boolean;
  mode: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { step } = m;
  const summary = step >= CHECK;
  const { frame, size, wide } = useFreeFrame(root, panel, summary);
  const g = frame.right - frame.left < 620 ? SNAKE : ROW;
  const shot = shotFor(
    step,
    g,
    (step === BLOCKS && m.selected !== null) || (step === HONEST && m.peek !== null),
  );
  // Narrow screens show the balances as one line of pills above the scene (not beside the hash panel).
  const strip = g.compact && step >= SEND && step <= LINKS && step !== HASH;
  const stripH = strip ? 34 : 0;
  const inner = inset({ ...frame, top: frame.top + stripH }, shot.reserve);
  const view = frameCamera(shot.focus, inner, size.width, size.height, 0.9);
  const hidden = summary && !wide; // Phones: the Check and Honest take fill the screen, as in 2D.

  // At the blocks step the opened block's slip pops up out of the block itself (see ChainBlocks).
  const details = step === HASH;
  return (
    <div
      ref={root}
      className={`bb3${g.compact ? " compact" : ""}${summary ? " summary" : ""}${reducedMotion ? " still" : ""}`}
      data-testid="ledger-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-layout={g.compact ? "loop" : "row"}
      data-mode={mode}
      role="group"
      aria-label="Toy ledger of Ana, Ben and Cora, in 3D"
    >
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={m.state}
        description={DESCRIPTION[step] ?? ""}
        status={m.status}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={inner} reducedMotion={reducedMotion} />
        {hidden ? null : <World m={m} g={g} reducedMotion={reducedMotion} />}
      </InkStage>
      <ReadablePages m={m} strip={strip} />
      {strip ? (
        <p className="bb3-balances" aria-label="Balances">
          {PEOPLE.map((p) => (
            <span key={p}>
              {p} <strong data-testid={`balance-${p}`}>{m.bal[p]}</strong>
            </span>
          ))}
          <span className="unit">coins</span>
        </p>
      ) : null}
      <div className="bb3-panel" ref={panel}>
        {details ? (
          <BlockDetails
            chain={m.chain}
            n={step === HASH ? 1 : m.selected!}
            withHash={step === HASH}
            sandbox={m.sandbox}
            onSandbox={m.setSandbox}
          />
        ) : null}
        {step === COMPARE && m.compared ? (
          <p className="bb-result" data-testid="compare-result" role="status">
            {COMPARE_RESULT}
          </p>
        ) : step === COMPARE && m.autoTampered ? (
          <p className="bb-result">{AUTO_TAMPER_NOTE}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The free part of the canvas, between the lesson's title, step card, stage bar, this view's panel and
 * its status note. Also places the panel and the status note (CSS variables on the root).
 */
function useFreeFrame(
  root: RefObject<HTMLDivElement | null>,
  panel: RefObject<HTMLDivElement | null>,
  summary: boolean,
) {
  const [m, setM] = useState({
    frame: { left: 0, top: 0, right: 1, bottom: 1 } as Frame,
    size: { width: 1, height: 1 },
    wide: true,
  });
  const measure = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    measure.current = () => {
      const el = root.current;
      const lesson = el?.closest(".lesson");
      if (!el || !lesson) return;
      const R = el.getBoundingClientRect();
      const rect = (sel: string) => lesson.querySelector(sel)?.getBoundingClientRect() ?? null;
      const title = rect(".lesson-title");
      const head = rect(".step-head");
      const dock = rect(".lesson-dock");
      const bar = rect(".stage-bar");
      const W = R.width;
      const H = R.height;
      const wide = W >= 900;
      const titleB = Math.max(title ? title.bottom - R.top : 100, head ? head.bottom - R.top : 0) + 12;
      const dockT = dock ? dock.top - R.top : H * 0.55;
      const dockR = dock ? dock.right - R.left : 416;
      const barT = bar ? bar.top - R.top : H - 72;
      let col: Frame;
      // The honest take: everything left of its panel, above the dock (the quiz step's summary page
      // covers the scene anyway).
      const side = rect(".lesson-panel");
      if (wide && summary)
        col = { left: 24, right: side ? side.left - R.left - 32 : W - 24, top: titleB, bottom: dockT - 12 };
      else if (wide) col = { left: dockR + 32, right: W - 24, top: titleB, bottom: barT - 14 };
      else col = { left: 12, right: W - 12, top: titleB, bottom: dockT - 10 };
      el.style.setProperty("--bb3-t", `${Math.round(col.top)}px`);
      el.style.setProperty("--bb3-l", `${Math.round(col.left)}px`);
      el.style.setProperty("--bb3-r", `${Math.round(W - col.right)}px`);
      el.style.setProperty("--bb3-b", `${Math.round(H - col.bottom)}px`);
      const status = el.querySelector<HTMLElement>(".sk-status");
      const sh = status?.textContent ? status.offsetHeight + 6 : 0;
      el.style.setProperty("--bb3-sh", `${sh}px`);
      const ph = panel.current?.offsetHeight ? panel.current.offsetHeight + 8 : 0;
      // Keep a band of the scene visible, even when the panel is tall.
      const bottom = Math.max(col.top + 70, col.bottom - sh - ph);
      const next = { frame: { ...col, bottom }, size: { width: W, height: H }, wide };
      setM((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure.current();
  });
  useEffect(() => {
    const el = root.current;
    const lesson = el?.closest(".lesson");
    if (!el || !lesson) return;
    const ro = new ResizeObserver(() => measure.current());
    ro.observe(el);
    for (const sel of [".lesson-title", ".step-head", ".lesson-dock", ".stage-bar", ".lesson-panel"]) {
      const t = lesson.querySelector(sel);
      if (t) ro.observe(t);
    }
    if (panel.current) ro.observe(panel.current);
    const status = el.querySelector(".sk-status");
    if (status) ro.observe(status);
    return () => ro.disconnect();
  }, [root, panel]);
  return m;
}

/** Everything in the scene for the current step. */
function World({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const { step } = m;
  // Blocks already on the chain when the view opened do not fall again; new ones drop in.
  const landed = useRef(new Set(m.chain.map((b) => b.height)));
  useEffect(() => {
    for (const b of m.chain) landed.current.add(b.height);
  });
  // Narrow screens keep the ledgers out of the way once the chain or the hash panel needs the room.
  // Phones show the balances as pills above the scene instead.
  const showLedgers = step >= SEND && step <= TAMPER && !g.compact;
  const showChain = (step >= SEND && step <= TAMPER) || step >= CHECK;
  return (
    <>
      {step === NOTEBOOK ? <Notebooks m={m} g={g} reducedMotion={reducedMotion} /> : null}
      {showLedgers ? <Ledgers m={m} g={g} reducedMotion={reducedMotion} /> : null}
      {showChain ? (
        <ChainBlocks m={m} g={g} reducedMotion={reducedMotion} drops={(h) => !landed.current.has(h)} />
      ) : null}
      {step === COMPARE ? <Copies m={m} g={g} reducedMotion={reducedMotion} /> : null}
    </>
  );
}

const rowsOf = (bal: Record<Person, number>, hot: Person[] = []): PageRow[] =>
  PEOPLE.map((q) => ({ name: q, value: bal[q], hot: hot.includes(q) }));

/** Where a person's ledger stands in a row or column. */
const ledgerAt = (p: Person, r: LedgerRow): Vec3 => {
  const k = (PEOPLE.indexOf(p) - 1) * r.pitch;
  return r.column ? [0, 0, r.z + k] : [k, 0, r.z];
};

/** Where a step's note points at the ledgers: Ana's, the one nearest the note in the margin. */
function LedgersAnchor({ r }: { r: LedgerRow }) {
  const [x, , z] = ledgerAt("Ana", r);
  return <Anchor name="ledgers" position={[x, LEDGER_TALL * r.scale * 0.55, z]} />;
}

/** The first step: three closed ledgers. Opening one shows the starting balances on its page. */
function Notebooks({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const r = g.notebooks;
  return (
    <>
      <LedgersAnchor r={r} />
      {PEOPLE.map((p) => (
        <Ledger
          key={p}
          owner={p}
          position={ledgerAt(p, r)}
          scale={r.scale}
          open={m.opened === p}
          rows={m.opened === p ? rowsOf(START) : null}
          hint={m.opened === null}
          reducedMotion={reducedMotion}
          pick={{ label: `Open ${p}'s notebook`, onPick: () => m.openNotebook(p) }}
        />
      ))}
    </>
  );
}

/** Everyone's ledger, open at the balances. A transaction changes the same lines in every copy. */
function Ledgers({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const r = g.ledgers;
  const hot = useHotLines(m.lastTx);
  // At the tamper step Ben's ledger follows his edited copy of the chain; the changed lines stay lit.
  const tamper = m.step === TAMPER;
  const benHot = PEOPLE.filter((q) => m.benBal[q] !== m.bal[q]);
  const rows = (p: Person) =>
    tamper && p === "Ben" ? rowsOf(m.benBal, benHot) : rowsOf(m.bal, tamper ? [] : hot);
  // A sent coin flies from the sender's ledger to the receiver's.
  const [flying, setFlying] = useState<{ tx: Tx; n: number } | null>(null);
  const seen = useRef(m.lastTx?.n ?? 0);
  useEffect(() => {
    const t = m.lastTx;
    if (!t || t.n === seen.current) return;
    seen.current = t.n;
    if (!reducedMotion) setFlying(t);
  }, [m.lastTx, reducedMotion]);
  const onPage = (p: Person): Vec3 => {
    const [x, , z] = ledgerAt(p, r);
    return [x + LEDGER_W * r.scale * 0.5, LEDGER_TALL * r.scale * 0.5, z];
  };
  return (
    <>
      {flying ? (
        <CoinHop
          key={flying.n}
          from={onPage(flying.tx.from)}
          to={onPage(flying.tx.to)}
          onDone={() => setFlying(null)}
        />
      ) : null}
      <LedgersAnchor r={r} />
      {PEOPLE.map((p) => (
        <Ledger
          key={p}
          owner={p}
          position={ledgerAt(p, r)}
          scale={r.scale}
          open
          rows={rows(p)}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

/**
 * The ledger pages as text, for screen readers (the pages themselves are pictures in the canvas).
 * Phones show the balances as pills instead (`strip`).
 */
function ReadablePages({ m, strip }: { m: LedgerLesson; strip: boolean }) {
  const { step } = m;
  if (step === NOTEBOOK)
    return (
      <ul className="visually-hidden" aria-label="Ledgers">
        {PEOPLE.map((p) => (
          <li key={p} data-testid={`notebook-${p}`}>
            {p}'s ledger: {m.opened === p ? PEOPLE.map((q) => `${q} ${START[q]}`).join(", ") : "closed"}
          </li>
        ))}
      </ul>
    );
  if (strip || step < SEND || step > LINKS) return null;
  return (
    <p className="visually-hidden" aria-label="Balances">
      {PEOPLE.map((p) => (
        <span key={p}>
          {p} <strong data-testid={`balance-${p}`}>{m.bal[p]}</strong> coins.{" "}
        </span>
      ))}
    </p>
  );
}

/** One coin hopping in an arc from one ledger to another, spinning as it flies. */
function CoinHop({ from, to, onDone }: { from: Vec3; to: Vec3; onDone: () => void }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Traveller to={go ? to : from} arc={2.5} duration={1.1} onArrive={() => (go ? onDone() : undefined)}>
      <SpinningCoin />
    </Traveller>
  );
}

function SpinningCoin() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x += dt * 6;
  });
  return (
    <group ref={ref}>
      <Coin />
    </group>
  );
}

/** The chain: Ben's copy at the tamper step, the honest chain otherwise. */
function ChainBlocks({
  m,
  g,
  reducedMotion,
  drops,
}: {
  m: LedgerLesson;
  g: Geo;
  reducedMotion: boolean;
  drops: (height: number) => boolean;
}) {
  const { step } = m;
  const chain = m.shown;
  const check = m.check;
  const showHash = step >= HASH;
  const showPrev = step >= LINKS;
  // The finished chain at the honest take can be explored block by block, like step 3.
  const explore = step === HONEST;
  const pickable = step === BLOCKS || step === HASH || explore;
  const selected = step === HASH ? 1 : explore ? m.peek : m.selected;
  const pickFn = explore ? m.peekBlock : m.pickBlock;
  const editing = step === TAMPER;
  const first = g.block(0);
  const second = g.block(1);
  return (
    <>
      {editing ? (
        <Label
          position={
            g.compact
              ? [(first[0] + second[0]) / 2, 1.5, first[2] - 0.9]
              : [(first[0] + second[0]) / 2, 1.05, first[2] - 0.75]
          }
        >
          Ben's copy of the chain
        </Label>
      ) : null}
      {chain.map((b, i) => {
        const ok = check.links[i]!;
        const hash = check.computed[i]!;
        const changed = hash !== m.honestHashes[i];
        const at = g.block(i);
        const card = g.card(i);
        return (
          <group key={b.height}>
            <LedgerBlock
              position={at}
              open={pickable && selected === b.height}
              bad={!ok}
              ring={editing && b.height === 1}
              hint={
                (step === BLOCKS && !m.saw1 && b.height === 1) || (editing && b.height === 1 && !m.benDiffers)
              }
              drop={drops(b.height)}
              reducedMotion={reducedMotion}
              pick={
                pickable
                  ? {
                      label: `Open block #${b.height}`,
                      selected: selected === b.height,
                      onPick: () => pickFn(b.height),
                    }
                  : undefined
              }
            >
              <Anchor name={`block-${b.height}`} position={[0, BH, 0]} />
              <Tag position={card.at} place={card.place} className={`block${!ok ? " bad" : ""}`}>
                <span className="n">#{b.height}</span>
                <span className="tx">
                  {editing && b.height === 1 && b.tx ? (
                    <EditAmount
                      from={b.tx.from}
                      to={b.tx.to}
                      value={m.tamperText}
                      target={m.tamperTo}
                      waiting={!m.benDiffers}
                      onEdit={m.editAmount}
                    />
                  ) : b.height === 0 ? (
                    "start: Ana 10, Ben 5, Cora 0"
                  ) : (
                    b.text
                  )}
                </span>
                {showPrev && b.height > 0 ? (
                  <span className={`f${ok ? "" : " bad"}`}>
                    prev <code data-testid={`block-prev-${b.height}`}>{shortHash(b.prev)}</code>
                  </span>
                ) : null}
                {showHash ? (
                  <span className={`f${changed ? " changed" : ""}`} data-explain={`hash-${b.height}`}>
                    hash <code data-testid={`block-hash-${b.height}`}>{shortHash(hash)}</code>
                  </span>
                ) : null}
              </Tag>
              {(step === BLOCKS || explore) && selected === b.height ? (
                <Slip
                  reducedMotion={reducedMotion}
                  lift={explore ? 0.9 : g.compact ? 0.3 : 2.3}
                  side={g.compact ? 0 : explore ? 0.9 : 1.4}
                >
                  <BlockPopup n={b.height} text={b.text} />
                </Slip>
              ) : null}
            </LedgerBlock>
            {i > 0 ? (
              <HashLink from={g.block(i - 1)} to={at} ok={ok} faint={!showPrev} reducedMotion={reducedMotion}>
                {showPrev ? (
                  <Tag position={[0, 0.42, 0]} place="center">
                    <span
                      className={`bb3-link${ok ? "" : " broken"}`}
                      data-testid={`link-${b.height}`}
                      data-explain={`link-${b.height}`}
                      data-link={ok ? "ok" : "broken"}
                      role="img"
                      aria-label={
                        ok
                          ? `Block #${b.height} links to block #${b.height - 1}`
                          : `Broken link: block #${b.height} stores an old hash`
                      }
                    >
                      {ok ? "✓" : "✗"}
                    </span>
                  </Tag>
                ) : null}
              </HashLink>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

/** What an opened block holds, popping up out of it on its slip. */
function BlockPopup({ n, text }: { n: number; text: string }) {
  return (
    <section className="bb3-pop" aria-label={`Block #${n}`} role="region">
      {n === 0 ? (
        <>
          <b>Block #0, the genesis block</b>
          <span>The first block. It holds the starting balances:</span>
          <code>Ana 10 · Ben 5 · Cora 0</code>
        </>
      ) : (
        <>
          <b>Inside block #{n}</b>
          <span>It stores one transaction:</span>
          <code>{text}</code>
          <span className="mute">Real blocks hold many.</span>
        </>
      )}
    </section>
  );
}

/** Three copies of the chain side by side. Ben's is the odd one out until the copies are compared. */
function Copies({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const { pitch, scale, tag } = g.copies;
  const honestTip = m.honestHashes[m.honestHashes.length - 1]!;
  return (
    <>
      {PEOPLE.map((p) => {
        const isBen = p === "Ben";
        const copy: Chain = isBen ? m.benChain : m.chain;
        const check = isBen ? m.benCheck : m.check;
        const bad = isBen && m.benDiffers && !m.compared;
        const fixed = isBen && m.compared;
        const tip = isBen ? check.computed[check.computed.length - 1]! : honestTip;
        const z = ROW_Z[p];
        // After the comparison Ben's blocks are replaced: the new ones drop in.
        const gen = fixed ? "r" : "o";
        const at = (i: number): Vec3 => [chainX(i, pitch), 0, z];
        return (
          <group key={p}>
            {copy.map((b, i) => (
              <group key={`${gen}${b.height}`}>
                <LedgerBlock
                  position={at(i)}
                  scale={scale}
                  bad={!check.links[i] || (isBen && check.computed[i] !== m.honestHashes[i])}
                  drop={fixed}
                  reducedMotion={reducedMotion}
                />
                {i > 0 ? (
                  <HashLink
                    from={at(i - 1)}
                    to={at(i)}
                    ok={check.links[i]!}
                    scale={scale}
                    reducedMotion={reducedMotion}
                  />
                ) : null}
              </group>
            ))}
            <Tag position={[tag.x, 0.3, z]} place={tag.place}>
              <span
                className={`bb3-copy${bad ? " bad" : ""}${fixed ? " fixed" : ""}`}
                data-testid={`notebook-${p}`}
                data-explain={`copy-${p}`}
                data-copy={bad ? "differs" : "matches"}
              >
                <b>{p}'s copy</b>
                <span>
                  newest hash <code>{shortHash(tip)}</code>
                </span>
                <span className="mark">{bad ? "✗ differs" : fixed ? "↺ replaced" : "✓ matches"}</span>
              </span>
            </Tag>
          </group>
        );
      })}
    </>
  );
}
