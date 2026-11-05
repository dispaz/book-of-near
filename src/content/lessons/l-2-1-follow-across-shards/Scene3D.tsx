/**
 * Lesson 2.1 in 3D: a grid with a slab per shard (rows) and a tile per block (columns, time running
 * left to right). The transaction's path is a line of raised markers, one per hop, with a coin that
 * hops along it as the learner follows the receipts. It only draws the shared state from
 * useShardTrace. Loaded lazily from Scene.tsx, so the 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Line } from "@react-three/drei";
import {
  Anchor,
  Coin,
  COLORS,
  InkStage,
  INK,
  Label,
  Outline,
  Pickable,
  SoftShadow,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
  useInk,
  type Vec3,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { CELL, cols, COL, gridBox, hopAt, ROW, SLAB_H, shotFor, slots } from "./layout3d";
import type { Trace } from "./trace";
import { type ShardTrace } from "./useShardTrace";

export default function Scene3D({
  st,
  trace,
  flat,
  reducedMotion,
}: {
  st: ShardTrace;
  trace: Trace;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const phone = useMediaQuery("(max-width: 899px)");
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  const view = frameCamera(shotFor(trace, phone), frame, size.width, size.height, 0.94, { nearFit: true });
  const n = cols(trace);
  const g = gridBox(trace);
  const sl = slots(trace);
  const drawn = st.drawn;
  const pos: Vec3[] = trace.hops.map((h, i) => hopAt(trace, h, sl[i]!));
  const current = pos[Math.min(Math.max(st.at, 0), pos.length - 1)]!;
  const [picked, setPicked] = useState<number | null>(null);
  const hop = st.hop;

  const description = `A grid of ${trace.shardIds.length} shards by ${n} blocks. ${
    drawn >= 0
      ? `Your transaction's path has ${drawn + 1} of ${trace.hops.length} steps drawn, now at step ${st.at + 1}: shard ${hop?.shardId}, block ${hop?.blockHeight}.`
      : "No path is drawn yet."
  }`;

  return (
    <div ref={box} className="shs-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={st.state}
        status={drawn >= 0 && hop ? `step ${st.at + 1} of ${trace.hops.length}: shard ${hop.shardId}` : ""}
        description={description}
        onMiss={() => setPicked(null)}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />
        <Anchor name="grid" position={[g.minX + 1, 0.5, 0]} />

        {/* One slab per shard, one tile per block: each tile is the chunk that shard made in that block. */}
        {trace.shardIds.map((s, row) => {
          const z = (row - (trace.shardIds.length - 1) / 2) * ROW;
          return (
            <group key={s}>
              <Slab z={z} width={n * COL + 0.2} />
              <Label position={[g.minX + 0.5, 0.1, z]} variant="small">{`shard ${s}`}</Label>
              {Array.from({ length: n }, (_, c) => (
                <Tile
                  key={c}
                  position={[(c - (n - 1) / 2) * COL, SLAB_H, z]}
                  lit={trace.hops.some(
                    (h, i) => i <= drawn && h.shardId === s && h.blockHeight === trace.firstBlock + c,
                  )}
                />
              ))}
            </group>
          );
        })}
        {Array.from({ length: n }, (_, c) => (
          <Label key={c} position={[(c - (n - 1) / 2) * COL, 0.05, g.maxZ - 0.25]} variant="small">
            {`…${String(trace.firstBlock + c).slice(-4)}`}
          </Label>
        ))}
        <SoftShadow position={[0, 0, 0.2]} size={[n * COL + 3, trace.shardIds.length * ROW + 1.4]} />

        {/* The path: a marker per hop, joined by a line, drawn only as far as the learner has come. */}
        {drawn > 0 ? (
          <Line
            points={pos.slice(0, drawn + 1).map(([x, y, z]) => [x, y + 0.45, z] as Vec3)}
            color={INK}
            lineWidth={2.2}
          />
        ) : null}
        {trace.hops.slice(0, Math.max(0, drawn + 1)).map((h, i) => (
          <Marker
            key={h.id}
            position={pos[i]!}
            label={String(i + 1)}
            current={i === st.at}
            pickLabel={`Chunk ${i + 1}: shard ${h.shardId}, block ${h.blockHeight}`}
            onPick={() => {
              st.pick(i);
              setPicked(i);
            }}
          />
        ))}
        {picked !== null && picked <= drawn ? (
          <Label position={[pos[picked]![0], 1.5, pos[picked]![2]]} variant="hint">
            {`${trace.hops[picked]!.accountId.slice(0, 22)} · shard ${trace.hops[picked]!.shardId}`}
          </Label>
        ) : null}
        {drawn >= 0 ? (
          <Traveller
            to={[current[0], current[1] + 0.95, current[2]]}
            arc={1.6}
            duration={0.8}
            color={COLORS.pink}
          >
            <Coin />
            <Anchor name="hop" position={[0, 0, 0]} />
          </Traveller>
        ) : null}
      </InkStage>
    </div>
  );
}

function Slab({ z, width }: { z: number; width: number }) {
  const ink = useInk(COLORS.slab);
  return (
    <mesh position={[0, SLAB_H / 2, z]} material={ink}>
      <boxGeometry args={[width, SLAB_H, CELL[1] + 0.12]} />
      <Outline />
    </mesh>
  );
}

/** The chunk one shard made in one block. Lit (accent) when the path passes through it. */
function Tile({ position, lit }: { position: Vec3; lit: boolean }) {
  const ink = useInk(lit ? COLORS.pink : "#fffdf7");
  return (
    <mesh position={[position[0], position[1] + 0.04, position[2]]} material={ink}>
      <boxGeometry args={[CELL[0], 0.08, CELL[1]]} />
      <Outline />
    </mesh>
  );
}

/** One hop: a small ink block with its number floating on top. Pick it to read the chunk. */
function Marker({
  position,
  label,
  current,
  pickLabel,
  onPick,
}: {
  position: Vec3;
  label: string;
  current: boolean;
  pickLabel: string;
  onPick: () => void;
}) {
  const ink = useInk(current ? COLORS.gold : COLORS.paper);
  const body = (
    <group>
      <mesh position={[0, 0.2, 0]} material={ink}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <Outline />
      </mesh>
      <Label position={[0, 0.5, 0]} variant="small">
        {label}
      </Label>
    </group>
  );
  return (
    <group position={[position[0], position[1] + 0.08, position[2]]}>
      <Pickable label={pickLabel} onPick={onPick} anchor={[0, 0.3, 0]}>
        {body}
      </Pickable>
    </group>
  );
}

/** Size of the 3D window and the height of its status line, kept up to date (as in lesson 0.3). */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 640, height: 400, status: 40 });
  const measure = useRef<() => void>(() => undefined);
  measure.current = () => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth || 640;
    const height = el.clientHeight || 400;
    const s = el.querySelector<HTMLElement>(".sk-status");
    const status = s?.textContent ? s.offsetTop + s.offsetHeight + 6 : 12;
    setSize((p) =>
      p.width === width && p.height === height && p.status === status ? p : { width, height, status },
    );
  };
  useLayoutEffect(() => measure.current());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
