import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { InkStage, Label, Traveller, type Vec3 } from "../../../scene-kit";
import { PEOPLE, shortHash, START, type Chain, type Person, type Tx } from "./ledger";
import { AUTO_TAMPER_NOTE, BlockDetails, COMPARE_RESULT } from "./parts";
import { frameCamera, inset, viewOffset, type Focus, type Frame, type Reserve } from "./framing";
import {
  BD,
  BH,
  BW,
  CARD_AT,
  CHAIN_Z,
  chainX,
  coinTop,
  HashLink,
  LedgerBlock,
  Notebook,
  NOTEBOOK_Z,
  PEOPLE_X,
  PEOPLE_Z,
  PERSON,
  Person as PersonBlock,
  personHeight,
  SpinningCoin,
  Tag,
  type TagPlace,
} from "./objects3d";
import {
  BLOCKS,
  CHECK,
  COMPARE,
  HASH,
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
interface Geo {
  compact: boolean;
  peopleX: Record<Person, number>;
  peopleZ: number;
  person: number;
  block: (i: number) => Vec3;
  card: (i: number) => { at: Vec3; place: TagPlace };
  /** Pixels kept free around the objects for the cards. */
  reserve: Reserve;
  elevation: number;
  /** Copies at the compare step. */
  copies: { pitch: number; scale: number; personX: number | null; tag: { x: number; place: TagPlace } };
}

const ROW: Geo = {
  compact: false,
  peopleX: PEOPLE_X,
  peopleZ: PEOPLE_Z,
  person: PERSON,
  block: (i) => [chainX(i), 0, CHAIN_Z],
  card: () => ({ at: CARD_AT, place: "below" }),
  reserve: { bottom: 70, top: 28 },
  elevation: 34,
  copies: {
    pitch: 2.4,
    scale: 0.7,
    personX: chainX(0, 2.4) - 2.3,
    tag: { x: chainX(3, 2.4) + 0.75, place: "right" },
  },
};

const SX = 1.55;
const SZ = 2.9;
const SNAKE: Geo = {
  compact: true,
  peopleX: { Ana: -2.1, Ben: 0, Cy: 2.1 },
  peopleZ: -1.7,
  person: 1,
  block: (i) => [i === 0 || i === 3 ? -SX : SX, 0, 0.9 + (i >= 2 ? SZ : 0)],
  card: (i) =>
    i === 0 || i === 3
      ? { at: [-BW / 2 - 0.08, BH * 0.55, 0], place: "left" }
      : { at: [BW / 2 + 0.08, BH * 0.55, 0], place: "right" },
  reserve: { left: 100, right: 100, top: 26, bottom: 26 },
  elevation: 50,
  copies: { pitch: 2.1, scale: 0.65, personX: null, tag: { x: chainX(0, 2.1) - 1.25, place: "left" } },
};

/** Copies of the chain at the compare step: one row per person. */
const ROW_Z: Record<Person, number> = { Ana: -3, Ben: 0, Cy: 3 };

type Box = [minX: number, maxX: number, minZ: number, maxZ: number, height: number];

function focusOf(boxes: Box[], elevation: number, azimuth = 0): Focus {
  const minX = Math.min(...boxes.map((b) => b[0]));
  const maxX = Math.max(...boxes.map((b) => b[1]));
  const minZ = Math.min(...boxes.map((b) => b[2]));
  const maxZ = Math.max(...boxes.map((b) => b[3]));
  const h = Math.max(...boxes.map((b) => b[4]));
  return {
    center: [(minX + maxX) / 2, h * 0.35, (minZ + maxZ) / 2],
    width: maxX - minX,
    depth: maxZ - minZ,
    height: h,
    elevation,
    azimuth,
  };
}

/** What the camera must keep in view at each step, and the pixels to keep free for tags. */
function shotFor(step: number, g: Geo): { focus: Focus; reserve: Reserve } {
  const people: Box = [
    Math.min(...PEOPLE.map((p) => g.peopleX[p])) - g.person / 2,
    Math.max(...PEOPLE.map((p) => g.peopleX[p])) + g.person / 2,
    g.peopleZ - g.person / 2,
    g.peopleZ + g.person / 2,
    personHeight(g.person),
  ];
  const blocks = Array.from({ length: MAX_BLOCKS }, (_, i) => g.block(i));
  const chain: Box = [
    Math.min(...blocks.map((b) => b[0])) - BW / 2,
    Math.max(...blocks.map((b) => b[0])) + BW / 2,
    Math.min(...blocks.map((b) => b[2])) - BD / 2,
    Math.max(...blocks.map((b) => b[2])) + BD / 2,
    BH,
  ];
  if (step === NOTEBOOK) {
    // Notebooks always stand in a row: their pages hang underneath.
    const row: Box = [-3.6 - 0.7, 3.6 + 0.7, PEOPLE_Z - 0.65, NOTEBOOK_Z + 0.5, PERSON + 0.6];
    return { focus: focusOf([row], 32), reserve: { bottom: g.compact ? 78 : 92, top: 26 } };
  }
  if (step >= SEND && step <= LINKS) {
    const az = step === BLOCKS || step === HASH ? -8 : 0;
    if (!g.compact)
      return {
        focus: focusOf([people, chain], g.elevation + (step === LINKS ? 2 : 0), az),
        reserve: g.reserve,
      };
    // Narrow: the people and the first row of blocks, then the whole loop once it fills up.
    if (step === LINKS) return { focus: focusOf([chain], g.elevation), reserve: g.reserve };
    const row0: Box = [chain[0], chain[1], chain[2], chain[2] + BD, BH];
    const parts = step === HASH ? [row0] : [people, row0];
    return { focus: focusOf(parts, g.elevation - 8, az), reserve: g.reserve };
  }
  if (step === COMPARE) {
    const c = g.copies;
    const left = c.personX !== null ? c.personX - 0.5 : chainX(0, c.pitch) - (BW / 2) * c.scale;
    const right = chainX(3, c.pitch) + (BW / 2) * c.scale;
    const rows: Box = [left, right, ROW_Z.Ana - 0.5, ROW_Z.Cy + 0.5, 1];
    const reserve: Reserve = g.compact ? { left: 150, top: 10, bottom: 8 } : { right: 175, top: 26 };
    return { focus: focusOf([rows], 52), reserve };
  }
  return { focus: focusOf([chain], g.elevation - 4), reserve: { ...g.reserve, top: 30 } };
}

const DESCRIPTION = [
  "Ana, Ben and Cy, each with a notebook in front of them. Every notebook holds the same balances.",
  "Ana, Ben and Cy with their coins, and the chain of blocks in front of them.",
  "The chain of blocks. Open a block to see the transaction inside.",
  "The chain of blocks, each with its hash.",
  "The chain of blocks, each linked to the one before it by that block's hash.",
  "Ben's copy of the chain. Changing block #1 breaks every later link.",
  "Three copies of the chain side by side: Ana's, Ben's and Cy's.",
  "The honest chain.",
  "The honest chain.",
];

/**
 * The 3D view of lesson 0.1: people with coin stacks, notebooks, blocks that drop onto a chain and
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
  const shot = shotFor(step, g);
  // Narrow screens show the balances as one line of pills above the scene (not beside the hash panel).
  const strip = g.compact && step >= SEND && step <= LINKS && step !== HASH;
  const stripH = strip ? 34 : 0;
  const inner = inset({ ...frame, top: frame.top + stripH }, shot.reserve);
  const view = frameCamera(shot.focus, inner, size.width, size.height, 0.9);
  const hidden = summary && !wide; // Phones: the Check and Honest take fill the screen, as in 2D.

  const details = (step === BLOCKS && m.selected !== null) || step === HASH;
  return (
    <div
      ref={root}
      className={`bb3${g.compact ? " compact" : ""}${summary ? " summary" : ""}`}
      data-testid="ledger-scene"
      data-scene-state={m.state}
      data-view="3d"
      data-layout={g.compact ? "loop" : "row"}
      data-mode={mode}
      role="group"
      aria-label="Toy ledger of Ana, Ben and Cy, in 3D"
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
      const dock = rect(".lesson-dock");
      const bar = rect(".stage-bar");
      const W = R.width;
      const H = R.height;
      const wide = W >= 900;
      const titleB = (title ? title.bottom - R.top : 100) + 12;
      const dockT = dock ? dock.top - R.top : H * 0.55;
      const dockR = dock ? dock.right - R.left : 416;
      const barT = bar ? bar.top - R.top : H - 72;
      let col: Frame;
      if (wide && summary) col = { left: 16, right: dockR, top: titleB, bottom: dockT - 12 };
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
    for (const sel of [".lesson-title", ".lesson-dock", ".stage-bar"]) {
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

/** Shifts the picture so the camera's target sits in the middle of the free frame (eased). */
function ViewOffset({ frame, reducedMotion }: { frame: Frame; reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cur = useRef<{ x: number; y: number } | null>(null);
  const goal = viewOffset(frame, size.width, size.height);
  useFrame(() => {
    const c = cur.current ?? goal;
    const k = reducedMotion || !cur.current ? 1 : 0.1;
    const x = Math.abs(goal.x - c.x) < 0.5 ? goal.x : c.x + (goal.x - c.x) * k;
    const y = Math.abs(goal.y - c.y) < 0.5 ? goal.y : c.y + (goal.y - c.y) * k;
    const v = (camera as { view?: { offsetX: number; offsetY: number; fullWidth: number } | null }).view;
    if (cur.current && v && v.offsetX === x && v.offsetY === y && v.fullWidth === size.width) return;
    cur.current = { x, y };
    if ("setViewOffset" in camera)
      camera.setViewOffset(size.width, size.height, x, y, size.width, size.height);
  });
  useEffect(
    () => () => {
      if ("clearViewOffset" in camera) camera.clearViewOffset();
    },
    [camera],
  );
  return null;
}

/** Everything in the scene for the current step. */
function World({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const { step } = m;
  // Blocks already on the chain when the view opened do not fall again; new ones drop in.
  const landed = useRef(new Set(m.chain.map((b) => b.height)));
  useEffect(() => {
    for (const b of m.chain) landed.current.add(b.height);
  });
  // Narrow screens keep the people out of the way once the chain or the hash panel needs the room.
  const showPeople = step >= SEND && step <= LINKS && !(g.compact && (step === HASH || step === LINKS));
  const showChain = (step >= SEND && step <= TAMPER) || step >= CHECK;
  return (
    <>
      {step === NOTEBOOK ? <Notebooks m={m} reducedMotion={reducedMotion} /> : null}
      {showPeople ? <People m={m} g={g} reducedMotion={reducedMotion} /> : null}
      {showChain ? (
        <ChainBlocks m={m} g={g} reducedMotion={reducedMotion} drops={(h) => !landed.current.has(h)} />
      ) : null}
      {step === COMPARE ? <Copies m={m} g={g} reducedMotion={reducedMotion} /> : null}
    </>
  );
}

function Notebooks({ m, reducedMotion }: { m: LedgerLesson; reducedMotion: boolean }) {
  return (
    <>
      {PEOPLE.map((p) => (
        <group key={p}>
          <PersonBlock name={p} position={[PEOPLE_X[p], 0, PEOPLE_Z]} coins={0} />
          <Notebook
            label={`Open ${p}'s notebook`}
            position={[PEOPLE_X[p], 0, NOTEBOOK_Z]}
            open={m.opened === p}
            hint={m.opened === null}
            reducedMotion={reducedMotion}
            onOpen={() => m.openNotebook(p)}
          >
            <div className={`bb3-nb${m.opened === p ? " open" : ""}`} data-testid={`notebook-${p}`}>
              <b>{p}'s copy</b>
              {m.opened === p ? (
                PEOPLE.map((q) => (
                  <span key={q}>
                    {q} {START[q]}
                  </span>
                ))
              ) : (
                <span className="mute">closed</span>
              )}
            </div>
          </Notebook>
        </group>
      ))}
    </>
  );
}

/** Ana, Ben and Cy with their coins. A sent coin hops from one stack to the other. */
function People({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const [flying, setFlying] = useState<{ tx: Tx; n: number } | null>(null);
  const seen = useRef(m.lastTx?.n ?? 0);
  useEffect(() => {
    const t = m.lastTx;
    if (!t || t.n === seen.current) return;
    seen.current = t.n;
    if (!reducedMotion) setFlying(t);
  }, [m.lastTx, reducedMotion]);
  // While the coin is in the air, the receiver's stack waits for it.
  const stack = (p: Person) => m.bal[p] - (flying && flying.tx.to === p ? flying.tx.amount : 0);
  const top = (p: Person, coins: number) => coinTop(g.peopleX[p], g.peopleZ, g.person, coins);
  return (
    <>
      {PEOPLE.map((p) => (
        <PersonBlock
          key={p}
          name={p}
          position={[g.peopleX[p], 0, g.peopleZ]}
          size={g.person}
          coins={stack(p)}
          balance={
            g.compact ? undefined : (
              <>
                <strong data-testid={`balance-${p}`}>{m.bal[p]}</strong> coins
              </>
            )
          }
        />
      ))}
      {flying ? (
        <CoinHop
          key={flying.n}
          from={top(flying.tx.from, m.bal[flying.tx.from])}
          to={top(flying.tx.to, m.bal[flying.tx.to] - flying.tx.amount)}
          onDone={() => setFlying(null)}
        />
      ) : null}
    </>
  );
}

function CoinHop({ from, to, onDone }: { from: Vec3; to: Vec3; onDone: () => void }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Traveller to={go ? to : from} arc={3} duration={1.1} onArrive={() => (go ? onDone() : undefined)}>
      <SpinningCoin />
    </Traveller>
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
  const pickable = step === BLOCKS || step === HASH;
  const selected = step === HASH ? 1 : m.selected;
  const editing = step === TAMPER;
  const first = g.block(0);
  const second = g.block(1);
  return (
    <>
      {editing ? (
        <Label position={[(first[0] + second[0]) / 2, 1.7, first[2] - 1.5]}>Ben's copy</Label>
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
              hint={step === BLOCKS && !m.saw1 && b.height === 1}
              drop={drops(b.height)}
              reducedMotion={reducedMotion}
              pick={
                pickable
                  ? {
                      label: `Open block #${b.height}`,
                      selected: selected === b.height,
                      onPick: () => m.pickBlock(b.height),
                    }
                  : undefined
              }
            >
              <Tag position={card.at} place={card.place} className={`block${!ok ? " bad" : ""}`}>
                <span className="n">#{b.height}</span>
                <span className="tx">
                  {editing && b.height === 1 && b.tx ? (
                    <>
                      {b.tx.from}-&gt;{b.tx.to}{" "}
                      <input
                        className="bb-edit"
                        inputMode="numeric"
                        aria-label="Amount in block #1"
                        value={m.tamperText}
                        size={3}
                        onChange={(e) => m.editAmount(e.target.value)}
                      />
                    </>
                  ) : b.height === 0 ? (
                    "start: Ana 10, Ben 5, Cy 0"
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
                  <span className={`f${changed ? " changed" : ""}`}>
                    hash <code data-testid={`block-hash-${b.height}`}>{shortHash(hash)}</code>
                  </span>
                ) : null}
              </Tag>
            </LedgerBlock>
            {i > 0 ? (
              <HashLink from={g.block(i - 1)} to={at} ok={ok} faint={!showPrev} reducedMotion={reducedMotion}>
                {showPrev ? (
                  <Tag position={[0, 0.42, 0]} place="center">
                    <span
                      className={`bb3-link${ok ? "" : " broken"}`}
                      data-testid={`link-${b.height}`}
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

/** Three copies of the chain side by side. Ben's is the odd one out until the copies are compared. */
function Copies({ m, g, reducedMotion }: { m: LedgerLesson; g: Geo; reducedMotion: boolean }) {
  const { pitch, scale, personX, tag } = g.copies;
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
            {personX !== null ? (
              <PersonBlock name={p} position={[personX, 0, z]} coins={0} size={0.9} />
            ) : null}
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
