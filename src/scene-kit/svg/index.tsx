/**
 * Flat SVG version of the scene kit, for browsers without WebGL. Same primitives as the 3D kit,
 * drawn in ink on paper. No three.js here: lesson manifests may import this for their `fallback`.
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { arcPoint, easeInOut } from "../motion";
import { COLORS, INK, PAPER } from "../theme";
import "../scene-kit.css";

type XY = readonly [number, number];

const SvgContext = createContext({ reducedMotion: false });

export interface SvgStageProps {
  /** Short machine-readable state, exposed as `data-scene-state` (same format as the 3D scene). */
  state: string;
  /** What the drawing shows, in one sentence, for screen readers. */
  description: string;
  reducedMotion: boolean;
  status?: string;
  /** A short line above the drawing, for example why the flat version is showing. */
  note?: string;
  viewBox?: string;
  children: ReactNode;
}

/** The SVG stage: paper background, ink defs, status note. Mirrors <InkStage>. */
export function SvgStage({
  state,
  description,
  reducedMotion,
  status,
  note,
  viewBox = "0 0 800 500",
  children,
}: SvgStageProps) {
  return (
    <div className="sk-svg-stage" data-scene-state={state} data-view="svg">
      <SvgContext.Provider value={{ reducedMotion }}>
        <svg viewBox={viewBox} role="group" aria-label={description} preserveAspectRatio="xMidYMid meet">
          <defs>
            <pattern
              id="sk-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="1.4" strokeOpacity="0.35" />
            </pattern>
          </defs>
          {children}
        </svg>
      </SvgContext.Provider>
      {note ? <p className="sk-note">{note}</p> : null}
      <p className="sk-status" data-testid="scene-status" aria-live="polite">
        {status ?? ""}
      </p>
    </div>
  );
}

export interface SvgPickProps {
  onPick?: () => void;
  pickLabel?: string;
  selected?: boolean;
}

/** Makes its children a button: click, Enter or Space picks it. */
export function SvgPickable({
  label,
  selected = false,
  onPick,
  focus,
  children,
}: {
  label: string;
  selected?: boolean;
  onPick: () => void;
  /** Box for the focus ring: x, y, width, height. */
  focus: [number, number, number, number];
  children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };
  return (
    <g
      className="sk-svg-pick"
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={onPick}
      onKeyDown={onKey}
    >
      {children}
      <rect
        className="sk-svg-focus"
        x={focus[0]}
        y={focus[1]}
        width={focus[2]}
        height={focus[3]}
        rx="12"
        fill="none"
      />
    </g>
  );
}

function maybePick(p: SvgPickProps, name: string, focus: [number, number, number, number], node: ReactNode) {
  if (!p.onPick) return node;
  return (
    <SvgPickable label={p.pickLabel ?? name} selected={p.selected} onPick={p.onPick} focus={focus}>
      {node}
    </SvgPickable>
  );
}

/** Handwritten (or small caps) text. */
export function SvgLabel({
  x,
  y,
  variant = "hand",
  anchor = "middle",
  children,
}: {
  x: number;
  y: number;
  variant?: "hand" | "small";
  anchor?: "start" | "middle" | "end";
  children: string;
}) {
  return variant === "hand" ? (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily="Caveat, cursive"
      fontSize="24"
      fontWeight="600"
      fill={INK}
    >
      {children}
    </text>
  ) : (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily="DM Sans, sans-serif"
      fontSize="12"
      fontWeight="700"
      letterSpacing="1"
      fill="#5d5a68"
    >
      {children.toUpperCase()}
    </text>
  );
}

/** An inked box seen from the front, with a darker hatched side for depth. */
function SvgBox({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const d = Math.min(14, w * 0.15);
  return (
    <g>
      <path
        d={`M${x + w},${y} l${d},${-d} v${h} l${-d},${d} z`}
        fill={color}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d={`M${x + w},${y} l${d},${-d} v${h} l${-d},${d} z`} fill="url(#sk-hatch)" />
      <path
        d={`M${x},${y} l${d},${-d} h${w} l${-d},${d} z`}
        fill={color}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x={x} y={y} width={w} height={h} rx="6" fill={color} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

/** Ink blot under an object. */
export function SvgShadow({ x, y, w }: { x: number; y: number; w: number }) {
  return <ellipse cx={x} cy={y} rx={w / 2} ry={w / 9} fill={INK} opacity="0.12" />;
}

function SelectRing({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={w * 0.7}
      ry={w * 0.16}
      fill={color}
      fillOpacity="0.45"
      stroke={INK}
      strokeWidth="2.5"
    />
  );
}

interface SvgBlockProps extends SvgPickProps {
  /** Centre of the block's base. */
  x: number;
  y: number;
  name: string;
  note?: string;
  color?: string;
  size?: number;
  coins?: number;
}

/** An account: a named place that holds coins. (x, y) is the middle of its base. */
export function SvgAccountBlock({
  x,
  y,
  name,
  note,
  color = COLORS.orange,
  size = 90,
  coins = 0,
  ...p
}: SvgBlockProps) {
  const lift = p.selected ? 8 : 0;
  const top = y - size - lift;
  const body = (
    <g>
      {p.selected ? (
        <SelectRing x={x} y={y} w={size} color={color} />
      ) : (
        <SvgShadow x={x + 6} y={y + 4} w={size * 1.3} />
      )}
      <SvgBox x={x - size / 2} y={top} w={size} h={size} color={color} />
      {Array.from({ length: coins }, (_, k) => (
        <SvgCoin key={k} x={x} y={top - 10 - k * 8} />
      ))}
      <SvgLabel x={x} y={top - 44 - coins * 8}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return maybePick(p, name, [x - size / 2 - 10, top - 64, size + 30, size + 74], body);
}

/** A contract: an account that also holds code. */
export function SvgContractBlock({
  x,
  y,
  name,
  note,
  color = COLORS.contract,
  size = 90,
  ...p
}: Omit<SvgBlockProps, "coins">) {
  const lift = p.selected ? 8 : 0;
  const top = y - size - lift;
  const body = (
    <g>
      {p.selected ? (
        <SelectRing x={x} y={y} w={size} color={color} />
      ) : (
        <SvgShadow x={x + 6} y={y + 4} w={size * 1.3} />
      )}
      <SvgBox x={x - size / 2} y={top} w={size} h={size} color={color} />
      <rect
        x={x - size / 2 - 5}
        y={top - 8}
        width={size + 10}
        height="10"
        rx="3"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect
        x={x - size * 0.3}
        y={top + size * 0.32}
        width={size * 0.6}
        height={size * 0.32}
        rx="4"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2"
      />
      <SvgLabel x={x} y={top + size * 0.54} variant="small">
        {"{ code }"}
      </SvgLabel>
      <SvgLabel x={x} y={top - 22}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return maybePick(p, name, [x - size / 2 - 10, top - 20, size + 30, size + 30], body);
}

/** A shard: one long slab of the chain. (x, y) is its left end, middle. */
export function SvgShardSlab({
  x,
  y,
  name,
  length = 540,
  depth = 70,
  color = COLORS.slab,
  ...p
}: SvgPickProps & { x: number; y: number; name: string; length?: number; depth?: number; color?: string }) {
  const body = (
    <g>
      <rect
        x={x}
        y={y - depth / 2}
        width={length}
        height={depth}
        rx="10"
        fill={p.selected ? COLORS.orange : color}
        fillOpacity={p.selected ? 0.5 : 1}
        stroke={INK}
        strokeWidth="2.5"
      />
      <SvgLabel x={x - 10} y={y + 4} variant="small" anchor="end">
        {name}
      </SvgLabel>
    </g>
  );
  return maybePick(p, name, [x - 6, y - depth / 2 - 6, length + 12, depth + 12], body);
}

/** Another blockchain: three linked blocks. (x, y) is the middle of its base. */
export function SvgChainBlock({
  x,
  y,
  name,
  note,
  color = COLORS.chain,
  ...p
}: Omit<SvgBlockProps, "coins" | "size">) {
  const body = (
    <g>
      {p.selected ? (
        <SelectRing x={x} y={y} w={110} color={color} />
      ) : (
        <SvgShadow x={x + 4} y={y + 4} w={150} />
      )}
      {[-48, 0, 48].map((dx) => (
        <SvgBox key={dx} x={x + dx - 18} y={y - 36} w={36} h={36} color={color} />
      ))}
      {[-24, 24].map((dx) => (
        <rect key={dx} x={x + dx - 6} y={y - 20} width="12" height="4" fill={INK} />
      ))}
      <SvgLabel x={x} y={y - 54}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return maybePick(p, name, [x - 80, y - 76, 160, 86], body);
}

/** A coin seen from slightly above. */
export function SvgCoin({ x = 0, y = 0, color = COLORS.gold }: { x?: number; y?: number; color?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 3} rx="20" ry="8" fill={color} stroke={INK} strokeWidth="2.5" />
      <ellipse cx={x} cy={y} rx="20" ry="8" fill={color} stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

/** A key lying on its side. (x, y) is its middle. */
export function SvgKey({
  x,
  y,
  color = COLORS.gold,
  name,
  ...p
}: SvgPickProps & { x: number; y: number; color?: string; name?: string }) {
  const body = (
    <g>
      <circle cx={x - 26} cy={y} r="14" fill="none" stroke={INK} strokeWidth="11" />
      <circle cx={x - 26} cy={y} r="14" fill="none" stroke={color} strokeWidth="6" />
      <path
        d={`M${x - 12},${y - 4} h44 v8 h-6 v7 h-6 v-7 h-6 v7 h-6 v-7 h-20 z`}
        fill={color}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {name ? (
        <SvgLabel x={x} y={y - 26}>
          {name}
        </SvgLabel>
      ) : null}
    </g>
  );
  return name ? maybePick(p, name, [x - 46, y - 24, 92, 48], body) : body;
}

/**
 * Something that travels between objects. It sits at `to`; when `to` changes it hops along an arc
 * and then calls `onArrive` (also on first placement, like the 3D Traveller). Under reduced motion
 * it jumps at once. Draw children around (0, 0).
 */
export function SvgTraveller({
  to,
  arc = 80,
  duration = 1.2,
  color = COLORS.orange,
  onArrive,
  children,
}: {
  to: XY;
  arc?: number;
  duration?: number;
  color?: string;
  onArrive?: () => void;
  children: ReactNode;
}) {
  const { reducedMotion } = useContext(SvgContext);
  const g = useRef<SVGGElement>(null);
  const pos = useRef<[number, number] | null>(null);
  const arrive = useRef(onArrive);
  useLayoutEffect(() => {
    arrive.current = onArrive;
  });
  const [x, y] = to;

  useLayoutEffect(() => {
    const el = g.current;
    if (!el) return;
    const place = (px: number, py: number) => {
      pos.current = [px, py];
      el.setAttribute("transform", `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    };
    const from = pos.current;
    if (from && from[0] === x && from[1] === y) return;
    if (!from || reducedMotion) {
      place(x, y);
      arrive.current?.();
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / (duration * 1000));
      // SVG y grows downwards, so the hop goes up with a negative height.
      const [px, , pz] = arcPoint([from[0], 0, from[1]], [x, 0, y], 0, easeInOut(u));
      place(px, pz - Math.sin(easeInOut(u) * Math.PI) * arc);
      if (u < 1) raf = requestAnimationFrame(tick);
      else arrive.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [x, y, reducedMotion, arc, duration]);

  return (
    <g ref={g}>
      <circle r="30" fill={color} opacity="0.22" />
      {children}
    </g>
  );
}
