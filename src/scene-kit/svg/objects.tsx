/**
 * The scene objects in 2D (docs/scene-objects.md): the SVG twins of objects3d.tsx, with the same
 * silhouettes, states and pick labels. No three.js. `ObjectIcon` draws the same shapes small, for the
 * headers of HTML cards, so a 2D card and its 3D object read as the same thing.
 */
import type { ReactNode } from "react";
import { COLORS, INK, CARD } from "../theme";
import { markTransform, NEAR_MARK } from "../nearMark";
import {
  itemSlots,
  ledgerDims,
  lookOf,
  ribbonNotch,
  ribbonOutline,
  signerNodeDims,
  slipDims,
  type ObjectLook,
  type ObjectState,
} from "../objects";
import { SvgCoin, SvgLabel, SvgPickable, SvgShadow, type SvgPickProps } from "./index";

type Fate = "idle" | "done" | "undone" | "failed" | "skipped";

const FILL: Record<Fate, string> = {
  idle: CARD,
  done: COLORS.greenTint,
  undone: COLORS.slab,
  failed: COLORS.redTint,
  skipped: COLORS.slab,
};
const MARK: Record<Fate, string> = { idle: "", done: "✓", undone: "↺", failed: "✗", skipped: "–" };

/** Stroke and fill for a part in a given look. */
function ink(look: ObjectLook, own?: string) {
  const fill = look.fill === null ? "none" : look.struck ? COLORS.slab : (own ?? look.fill);
  return {
    fill,
    stroke: INK,
    strokeWidth: 2.5,
    strokeLinejoin: "round" as const,
    strokeDasharray: look.dashed ? "6 5" : undefined,
  };
}

function Marks({ look, x, y, size }: { look: ObjectLook; x: number; y: number; size: number }) {
  const h = size / 2;
  if (look.cross)
    return (
      <g stroke={COLORS.red} strokeWidth={size * 0.12} strokeLinecap="round">
        <line x1={x - h} y1={y - h} x2={x + h} y2={y + h} />
        <line x1={x + h} y1={y - h} x2={x - h} y2={y + h} />
      </g>
    );
  if (look.struck)
    return (
      <line
        x1={x - h}
        y1={y + h * 0.4}
        x2={x + h}
        y2={y - h * 0.4}
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
    );
  return null;
}

function pick(p: SvgPickProps, name: string, focus: [number, number, number, number], node: ReactNode) {
  if (!p.onPick) return node;
  return (
    <SvgPickable label={p.pickLabel ?? name} selected={p.selected} onPick={p.onPick} focus={focus}>
      {node}
    </SvgPickable>
  );
}

interface SvgObjectProps extends SvgPickProps {
  /** Middle of the object's base. */
  x: number;
  y: number;
  state?: ObjectState;
  color?: string;
}

/** Cuts long text to `max` characters with an ellipsis. */
function short(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ---------- account: a mailbox ----------

export function SvgMailbox({
  x,
  y,
  name,
  note,
  size = 90,
  color = COLORS.orange,
  coins = 0,
  flag = false,
  state = "ok",
  ...p
}: SvgObjectProps & { name: string; note?: string; size?: number; coins?: number; flag?: boolean }) {
  const look = lookOf(state, color);
  const post = size * 0.42;
  const body = size * 0.24;
  const w = size * 0.8;
  const r = size * 0.28;
  const top = y - post - body;
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 4} y={y + 3} w={size * 0.9} />}
      <rect x={x - size * 0.05} y={y - post} width={size * 0.1} height={post} {...ink(look, CARD)} />
      {/* Side view: a box with a round roof, the door on the right. */}
      <path
        d={`M${x - w / 2},${y - post} v${-body} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${body} z`}
        {...ink(look)}
      />
      <rect
        x={x - w * 0.3}
        y={top - r * 0.2}
        width={w * 0.6}
        height={body * 0.7}
        rx="3"
        {...ink(look, CARD)}
      />
      {/* Flag. */}
      <g transform={`rotate(${flag && state === "ok" ? 0 : 90} ${x + w / 2 - 6} ${y - post - body / 2})`}>
        <line
          x1={x + w / 2 - 6}
          y1={y - post - body / 2}
          x2={x + w / 2 - 6}
          y2={top - r - 6}
          stroke={INK}
          strokeWidth="3"
        />
        <rect x={x + w / 2 - 6} y={top - r - 8} width="16" height="10" {...ink(look, COLORS.red)} />
      </g>
      {Array.from({ length: coins }, (_, k) => (
        <SvgCoin key={k} x={x + w * 0.75} y={y - 6 - k * 8} />
      ))}
      <Marks look={look} x={x} y={top + body / 2 - r / 2} size={w * 0.7} />
      <SvgLabel x={x} y={top - r - 16}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return pick(p, name, [x - w / 2 - 10, top - r - 36, w + 30, post + body + r + 42], node);
}

// ---------- signature: a stamp ----------

export function SvgStamp({
  x,
  y,
  size = 24,
  color = COLORS.orange,
  broken = false,
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
  broken?: boolean;
}) {
  const h = size * 1.15;
  return (
    <g>
      <rect
        x={x - size / 2}
        y={y - h / 2}
        width={size}
        height={h}
        fill={broken ? COLORS.red : color}
        stroke={INK}
        strokeWidth="2"
        strokeDasharray="3 2"
      />
      <rect x={x - size * 0.35} y={y - h * 0.35} width={size * 0.7} height={h * 0.7} fill={CARD} />
      <circle
        cx={x + size * 0.28}
        cy={y + size * 0.2}
        r={size * 0.36}
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      {broken ? (
        <line
          x1={x - size / 2}
          y1={y + h / 2}
          x2={x + size / 2}
          y2={y - h / 2}
          stroke={INK}
          strokeWidth="3"
        />
      ) : null}
    </g>
  );
}

// ---------- transaction: a parcel ----------

export interface SvgParcelItem {
  key: string;
  text: string;
  fate: Fate;
}

export function SvgParcel({
  x,
  y,
  size = 80,
  color = COLORS.orange,
  to,
  stamped = false,
  stampBroken = false,
  open = false,
  items = [],
  maxItems = 4,
  state = "ok",
  name = "transaction",
  ...p
}: SvgObjectProps & {
  size?: number;
  to?: string;
  stamped?: boolean;
  /** The parcel was changed after it was stamped: the signature no longer matches. */
  stampBroken?: boolean;
  open?: boolean;
  items?: SvgParcelItem[];
  maxItems?: number;
  name?: string;
}) {
  const look = lookOf(state, COLORS.kraft);
  const w = size * 1.3;
  const h = size * 0.8;
  const top = y - h;
  const slots = open ? itemSlots(items.length, maxItems, 0.36) : [];
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 4} y={y + 3} w={w * 1.1} />}
      <rect x={x - w / 2} y={top} width={w} height={h} rx="3" {...ink(look)} />
      {open ? (
        <>
          <path
            d={`M${x - w / 2},${top} l${-w * 0.22},${-h * 0.32} h${w * 0.4} l${w * 0.04},${h * 0.32} z`}
            {...ink(look)}
          />
          <path
            d={`M${x + w / 2},${top} l${w * 0.22},${-h * 0.32} h${-w * 0.4} l${-w * 0.04},${h * 0.32} z`}
            {...ink(look)}
          />
        </>
      ) : (
        <rect x={x - size * 0.07} y={top} width={size * 0.14} height={h} {...ink(look, color)} />
      )}
      {to ? (
        <>
          <rect
            x={x - w * 0.46}
            y={top + h * 0.38}
            width={w * 0.6}
            height={h * 0.36}
            rx="2"
            {...ink(look, CARD)}
          />
          <text
            x={x - w * 0.16}
            y={top + h * 0.6}
            textAnchor="middle"
            fontFamily="DM Sans, sans-serif"
            fontSize="8"
            fontWeight="700"
            fill={INK}
          >
            {short(`to ${to}`, 18)}
          </text>
        </>
      ) : null}
      {stamped && !look.dashed ? (
        <SvgStamp x={x + w * 0.3} y={top + h * 0.3} size={size * 0.24} color={color} broken={stampBroken} />
      ) : null}
      {slots.map((s, i) => {
        const it = items[i]!;
        const cy = top - 20 - s.y * 60;
        return (
          <g key={it.key}>
            <rect
              x={x - w * 0.48}
              y={cy - 11}
              width={w * 0.96}
              height="22"
              rx="3"
              fill={FILL[it.fate]}
              stroke={INK}
              strokeWidth="2"
            />
            <text
              x={x}
              y={cy + 4}
              textAnchor="middle"
              fontFamily="DM Sans, sans-serif"
              fontSize="11"
              fontWeight="700"
              fill={INK}
            >
              {`${i + 1} ${it.text}${MARK[it.fate] ? ` ${MARK[it.fate]}` : ""}`}
            </text>
          </g>
        );
      })}
      <Marks look={look} x={x} y={top + h / 2} size={h * 0.8} />
    </g>
  );
  return pick(p, name, [x - w / 2 - 10, top - 10, w + 20, h + 20], node);
}

// ---------- contract: a scroll ----------

export function SvgScroll({
  x,
  y,
  name,
  note,
  size = 90,
  color = COLORS.contract,
  running = false,
  state = "ok",
  ...p
}: SvgObjectProps & { name: string; note?: string; size?: number; running?: boolean }) {
  const look = lookOf(state, color);
  const w = size * 0.78;
  const top = y - size;
  const roll = size * 0.08;
  const gx = x + w * 0.24;
  const gy = y - size * 0.24;
  const g = size * 0.13;
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 4} y={y + 3} w={size} />}
      <rect x={x - w / 2} y={top + roll} width={w} height={size - roll * 2} {...ink(look, CARD)} />
      {[top + roll, y - roll].map((cy) => (
        <rect
          key={cy}
          x={x - w * 0.57}
          y={cy - roll}
          width={w * 1.14}
          height={roll * 2}
          rx={roll}
          {...ink(look)}
        />
      ))}
      {look.dashed
        ? null
        : [0.26, 0.4, 0.54].map((f, i) => (
            <line
              key={f}
              x1={x - w * 0.36}
              x2={x + w * (i === 2 ? 0 : 0.3)}
              y1={top + size * f}
              y2={top + size * f}
              stroke={INK}
              strokeWidth="2.5"
            />
          ))}
      <g className={running ? "sk-gear spin" : "sk-gear"} style={{ transformOrigin: `${gx}px ${gy}px` }}>
        {Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * 360;
          return (
            <rect
              key={k}
              x={gx + g * 0.9}
              y={gy - g * 0.18}
              width={g * 0.45}
              height={g * 0.36}
              transform={`rotate(${a} ${gx} ${gy})`}
              {...ink(look, COLORS.gold)}
            />
          );
        })}
        <circle cx={gx} cy={gy} r={g} {...ink(look, COLORS.gold)} />
        <circle cx={gx} cy={gy} r={g * 0.35} fill={CARD} stroke={INK} strokeWidth="2" />
      </g>
      <Marks look={look} x={x} y={top + size / 2} size={w * 0.8} />
      <SvgLabel x={x} y={top - 12}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return pick(p, name, [x - w * 0.6 - 6, top - 34, w * 1.2 + 12, size + 40], node);
}

// ---------- function-call key: a key with a tag ----------

export function SvgTaggedKey({
  x,
  y,
  tag,
  share = 1,
  color = COLORS.gold,
  state = "ok",
  name,
  ...p
}: SvgObjectProps & { tag: string; share?: number; name?: string }) {
  const look = lookOf(state, color);
  const keyColor = look.struck ? COLORS.slab : color;
  const bar = Math.max(0, Math.min(1, share));
  const node = (
    <g>
      <circle cx={x - 26} cy={y} r="14" fill="none" stroke={INK} strokeWidth="11" />
      <circle cx={x - 26} cy={y} r="14" fill="none" stroke={keyColor} strokeWidth="6" />
      <path
        d={`M${x - 12},${y - 4} h44 v8 h-6 v7 h-6 v-7 h-6 v7 h-6 v-7 h-20 z`}
        fill={keyColor}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1={x - 26} y1={y + 14} x2={x - 30} y2={y + 34} stroke={INK} strokeWidth="1.5" />
      <rect x={x - 70} y={y + 34} width="80" height="34" rx="3" fill={CARD} stroke={INK} strokeWidth="2" />
      <text
        x={x - 30}
        y={y + 48}
        textAnchor="middle"
        fontFamily="DM Sans, sans-serif"
        fontSize="9"
        fontWeight="700"
        fill={INK}
      >
        {tag.slice(0, 16)}
      </text>
      <rect x={x - 64} y={y + 55} width="68" height="7" fill={COLORS.slab} stroke={INK} strokeWidth="1" />
      {bar > 0 ? <rect x={x - 64} y={y + 55} width={68 * bar} height="7" fill={color} /> : null}
      <Marks look={look} x={x - 10} y={y + 20} size={50} />
      {name ? (
        <SvgLabel x={x} y={y - 26}>
          {name}
        </SvgLabel>
      ) : null}
    </g>
  );
  return name ? pick(p, name, [x - 76, y - 24, 120, 98], node) : node;
}

// ---------- app: a screen on a stand ----------

export function SvgAppScreen({
  x,
  y,
  name,
  note,
  size = 90,
  color = COLORS.blue,
  state = "ok",
  ...p
}: SvgObjectProps & { name: string; note?: string; size?: number }) {
  const look = lookOf(state, color);
  const w = size * 0.95;
  const h = size * 0.62;
  const stand = size * 0.28;
  const top = y - stand - h;
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 4} y={y + 3} w={size} />}
      <rect x={x - w * 0.25} y={y - 5} width={w * 0.5} height="5" {...ink(look, CARD)} />
      <rect x={x - 4} y={y - stand} width="8" height={stand} {...ink(look, CARD)} />
      <rect x={x - w / 2} y={top} width={w} height={h} rx="5" {...ink(look, INK)} />
      <rect x={x - w * 0.45} y={top + h * 0.08} width={w * 0.9} height={h * 0.16} {...ink(look)} />
      <rect x={x - w * 0.45} y={top + h * 0.26} width={w * 0.9} height={h * 0.66} {...ink(look, CARD)} />
      {look.dashed
        ? null
        : [0.42, 0.58, 0.74].map((f, i) => (
            <line
              key={f}
              x1={x - w * 0.36}
              x2={x + w * (i === 2 ? 0 : 0.3)}
              y1={top + h * f}
              y2={top + h * f}
              stroke={COLORS.slab}
              strokeWidth="5"
            />
          ))}
      <Marks look={look} x={x} y={top + h / 2} size={h * 0.8} />
      <SvgLabel x={x} y={top - 12}>
        {note ? `${name} · ${note}` : name}
      </SvgLabel>
    </g>
  );
  return pick(p, name, [x - w / 2 - 10, top - 34, w + 20, h + stand + 40], node);
}

// ---------- receipt: a delivery slip ----------

/** A receipt (2D twin of `ReceiptSlip`): a slip, an accent stripe, a folded corner. (x, y) is its base. */
export function SvgReceiptSlip({
  x,
  y,
  size = 40,
  color = COLORS.pink,
  refund = false,
  fate = "idle",
  label,
  state = "ok",
  ...p
}: SvgObjectProps & { size?: number; refund?: boolean; fate?: Fate; label?: string }) {
  const look = lookOf(state, color);
  const d = slipDims(size);
  const w = d.width;
  const h = d.height;
  const f = d.fold;
  const top = y - h;
  const left = x - w / 2;
  const mark = refund ? "↩" : MARK[fate];
  const tag = [label, mark].filter(Boolean).join(" ");
  const name = p.pickLabel ?? (refund ? "Refund receipt" : "Receipt");
  const node = (
    <g>
      <path
        d={`M${left},${top} h${w - f} l${f},${f} v${h - f} h${-w} z`}
        {...ink(look, FILL[fate])}
        strokeWidth={2}
      />
      <path d={`M${left + w - f},${top} v${f} h${f}`} fill="none" stroke={INK} strokeWidth={1.5} />
      <rect
        x={left + 3}
        y={top + h * 0.18}
        width={w - f - 6}
        height={h * 0.16}
        {...ink(look, refund ? COLORS.slab : (look.fill ?? color))}
        strokeWidth={1}
      />
      {look.dashed ? null : (
        <g stroke={COLORS.slab} strokeWidth={h * 0.08}>
          <line x1={left + w * 0.15} x2={left + w * 0.85} y1={top + h * 0.55} y2={top + h * 0.55} />
          <line x1={left + w * 0.15} x2={left + w * 0.7} y1={top + h * 0.75} y2={top + h * 0.75} />
        </g>
      )}
      <Marks look={look} x={x} y={top + h / 2} size={h * 0.8} />
      {tag ? (
        <SvgLabel x={x} y={top - 6} variant="small">
          {tag}
        </SvgLabel>
      ) : null}
    </g>
  );
  return pick(p, name, [left - 4, top - 18, w + 8, h + 22], node);
}

// ---------- gas refund: a coin coming back ----------

/**
 * A gas refund (2D twin of `RefundCoin`): a NEAR coin (NEAR green, the NEAR mark on its face, like every
 * coin) with a return mark (↩) on its tag. (x, y) is its base.
 */
export function SvgRefundCoin({
  x,
  y,
  size = 40,
  color = COLORS.near,
  label,
  ...p
}: SvgPickProps & { x: number; y: number; size?: number; color?: string; label?: string }) {
  const rx = size / 2;
  const ry = size * 0.3;
  const cy = y - ry - 3;
  const tag = [label, "↩"].filter(Boolean).join(" ");
  const node = (
    <g>
      <ellipse cx={x} cy={cy + 4} rx={rx} ry={ry} fill={color} stroke={INK} strokeWidth={2} />
      <ellipse cx={x} cy={cy} rx={rx} ry={ry} fill={color} stroke={INK} strokeWidth={2} />
      <path d={NEAR_MARK.path} fill={INK} transform={markTransform(x, cy, rx * 0.7, 0.42)} />
      <SvgLabel x={x} y={cy - ry - 6} variant="small">
        {tag}
      </SvgLabel>
    </g>
  );
  return pick(p, p.pickLabel ?? "Gas refund", [x - rx - 4, cy - ry - 22, 2 * rx + 8, 2 * ry + 30], node);
}

// ---------- shard: a ribbon ----------

/** A shard (2D twin of `ShardRibbon`): a ribbon along x with a swallowtail notch, its name at that end. */
export function SvgShardRibbon({
  x,
  y,
  length,
  width,
  name,
  color = COLORS.slab,
  children,
  ...p
}: SvgPickProps & {
  x: number;
  y: number;
  length: number;
  width: number;
  name: string;
  color?: string;
  /** What lies on the ribbon (a row of chunks), in the same coordinates: part of the ribbon's pick. */
  children?: ReactNode;
}) {
  const pts = ribbonOutline(length, width).map(([px, pz]) => `${x + px},${y + pz}`);
  const notch = ribbonNotch(length, width);
  const node = (
    <g>
      <polygon points={pts.join(" ")} fill={color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <SvgLabel x={x - length / 2 + notch + 4} y={y + 4} variant="small" anchor="start">
        {name}
      </SvgLabel>
      {children}
    </g>
  );
  return pick(p, name, [x - length / 2 - 2, y - width / 2 - 2, length + 4, width + 4], node);
}

// ---------- chain signatures: a signing node ----------

/** 2D twin of `SignerNode`: a figure behind a desk, the key share on the desk (coloured when `lit`). */
export function SvgSignerNode({
  x,
  y,
  size = 60,
  color = COLORS.orange,
  lit = false,
  name = "signing node",
  state = "ok",
  ...p
}: SvgObjectProps & { size?: number; lit?: boolean; name?: string }) {
  const look = lookOf(state, CARD);
  const d = signerNodeDims(size);
  const deskTop = y - d.desk.height;
  const bodyTop = deskTop - d.body.height * 0.75;
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 2} y={y + 2} w={size * 0.8} />}
      <path
        d={`M${x - d.body.radius},${deskTop + 2} L${x - d.body.radius * 0.8},${bodyTop} h${d.body.radius * 1.6} L${x + d.body.radius},${deskTop + 2} z`}
        {...ink(look, CARD)}
      />
      <circle cx={x} cy={bodyTop - d.head} r={d.head} {...ink(look, CARD)} />
      <rect
        x={x - d.desk.width / 2}
        y={deskTop}
        width={d.desk.width}
        height={d.desk.height}
        rx="2"
        {...ink(look, COLORS.slab)}
      />
      <rect
        x={x - d.share[0] / 2}
        y={deskTop - 5}
        width={d.share[0]}
        height={5}
        rx="1"
        {...ink(look, lit ? color : CARD)}
        strokeWidth={1.8}
      />
      <Marks look={look} x={x} y={deskTop} size={d.desk.width * 0.7} />
    </g>
  );
  return pick(
    p,
    name,
    [x - size * 0.45, bodyTop - d.head * 2 - 4, size * 0.9, y - bodyTop + d.head * 2 + 8],
    node,
  );
}

// ---------- blockchain: a row of linked block pages ----------

/** 2D twin of `Ledger`: block pages in a row, linked by a string, their top edge in the chain's colour. */
export function SvgLedger({
  x,
  y,
  name,
  size = 50,
  pages = 3,
  edge = COLORS.slab,
  state = "ok",
  showName = true,
  ...p
}: SvgObjectProps & { name: string; size?: number; pages?: number; edge?: string; showName?: boolean }) {
  const look = lookOf(state, CARD);
  const d = ledgerDims(size, pages);
  const xs = Array.from({ length: pages }, (_, i) => x - d.length / 2 + d.width / 2 + i * d.pitch);
  const top = y - d.height;
  const node = (
    <g>
      {look.dashed ? null : <SvgShadow x={x + 3} y={y + 3} w={d.length * 1.05} />}
      <polyline
        points={xs.map((px) => `${px},${top + d.height * 0.3}`).join(" ")}
        fill="none"
        stroke={INK}
        strokeWidth="2"
      />
      {xs.map((px) => (
        <g key={px}>
          <rect x={px - d.width / 2} y={top} width={d.width} height={d.height} rx="2" {...ink(look, CARD)} />
          <rect x={px - d.width / 2} y={top} width={d.width} height={d.edge} rx="2" {...ink(look, edge)} />
          {[0.45, 0.6, 0.75].map((t) => (
            <line
              key={t}
              x1={px - d.width * 0.3}
              x2={px + d.width * 0.3}
              y1={top + d.height * t}
              y2={top + d.height * t}
              stroke={INK}
              strokeWidth="1.4"
            />
          ))}
        </g>
      ))}
      {showName ? (
        <SvgLabel x={x} y={top - 10}>
          {name}
        </SvgLabel>
      ) : null}
    </g>
  );
  return pick(p, name, [x - d.length / 2 - 8, top - 34, d.length + 16, d.height + 42], node);
}

// ---------- another chain's ground: a marked area on the page ----------

/**
 * 2D twin of `ChainArea`: a tinted area in a dashed ink border, the chain's block pages along its back
 * edge and its name printed at the front edge. (x, y) is the top-left corner; one pick for the whole.
 */
export function SvgChainArea({
  x,
  y,
  width,
  height,
  name,
  color = COLORS.slab,
  blocks = 4,
  blockSize = 46,
  ...p
}: SvgObjectProps & {
  width: number;
  height: number;
  name: string;
  blocks?: number;
  blockSize?: number;
}) {
  const node = (
    <g data-testid="chain-area" data-name={name}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="10"
        fill={color}
        fillOpacity={0.14}
        stroke={INK}
        strokeWidth="2"
        strokeDasharray="9 6"
      />
      <SvgLedger
        x={x + width / 2}
        y={y + blockSize + 14}
        name={name}
        size={blockSize}
        pages={blocks}
        edge={color}
        showName={false}
      />
      <SvgLabel x={x + width / 2} y={y + height - 10} variant="small">
        {name}
      </SvgLabel>
    </g>
  );
  return pick(p, name, [x, y, width, height], node);
}

// ---------- small icons for HTML cards ----------

export type IconKind = "mailbox" | "parcel" | "stamp" | "scroll" | "key" | "tagged-key" | "coin" | "app";

/** A small drawing of a scene object, for the header of an HTML card. Decorative: hidden from readers. */
export function ObjectIcon({ kind, size = 22, color }: { kind: IconKind; size?: number; color?: string }) {
  const c =
    color ??
    (kind === "parcel"
      ? COLORS.kraft
      : kind === "scroll"
        ? COLORS.contract
        : kind === "coin"
          ? COLORS.near
          : COLORS.gold);
  const s = { fill: c, stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round" as const };
  let body: ReactNode;
  switch (kind) {
    case "mailbox":
      body = (
        <>
          <rect x="10.5" y="13" width="3" height="10" {...s} fill={CARD} />
          <path d="M3,13 v-4 a4,4 0 0 1 4,-4 h10 a4,4 0 0 1 4,4 v4 z" {...s} fill={color ?? COLORS.orange} />
          <rect x="18" y="3" width="2" height="7" fill={INK} />
          <rect x="18" y="2.5" width="5" height="3" {...s} fill={COLORS.red} strokeWidth={1} />
        </>
      );
      break;
    case "parcel":
      body = (
        <>
          <rect x="2.5" y="7" width="19" height="14" rx="1" {...s} />
          <rect x="10.5" y="7" width="3" height="14" {...s} fill={color ?? COLORS.orange} strokeWidth={1} />
          <rect
            x="15"
            y="9"
            width="4.5"
            height="5"
            {...s}
            fill={COLORS.orange}
            strokeWidth={1}
            strokeDasharray="1.5 1"
          />
        </>
      );
      break;
    case "stamp":
      body = (
        <>
          <rect
            x="5"
            y="3"
            width="14"
            height="17"
            {...s}
            fill={color ?? COLORS.orange}
            strokeDasharray="2 1.5"
          />
          <rect x="8" y="6" width="8" height="11" fill={CARD} />
          <circle cx="15" cy="15" r="5" fill="none" stroke={INK} strokeWidth="1.4" />
        </>
      );
      break;
    case "scroll":
      body = (
        <>
          <rect x="5" y="4" width="14" height="16" {...s} fill={CARD} />
          <rect x="3" y="2" width="18" height="3.5" rx="1.75" {...s} />
          <rect x="3" y="18.5" width="18" height="3.5" rx="1.75" {...s} />
          <line x1="7.5" x2="15" y1="9" y2="9" stroke={INK} strokeWidth="1.4" />
          <line x1="7.5" x2="12" y1="12" y2="12" stroke={INK} strokeWidth="1.4" />
          <circle cx="15" cy="14.5" r="2.6" {...s} fill={COLORS.gold} strokeWidth={1.2} />
        </>
      );
      break;
    case "key":
    case "tagged-key":
      body = (
        <>
          <circle cx="7" cy="9" r="4" fill="none" stroke={INK} strokeWidth="3.4" />
          <circle cx="7" cy="9" r="4" fill="none" stroke={c} strokeWidth="1.6" />
          <path
            d="M11,7.8 h10 v2.4 h-1.6 v2.4 h-1.8 v-2.4 h-1.6 v2.4 h-1.8 v-2.4 h-3.2 z"
            {...s}
            strokeWidth={1.2}
          />
          {kind === "tagged-key" ? (
            <>
              <line x1="6" y1="13" x2="5" y2="16" stroke={INK} strokeWidth="1" />
              <rect x="1.5" y="16" width="9" height="6" rx="1" fill={CARD} stroke={INK} strokeWidth="1.2" />
            </>
          ) : null}
        </>
      );
      break;
    case "app":
      body = (
        <>
          <rect x="2.5" y="3" width="19" height="14" rx="2" {...s} fill={INK} />
          <rect x="4" y="4.5" width="16" height="3" fill={color ?? COLORS.blue} />
          <rect x="4" y="8" width="16" height="7.5" fill={CARD} />
          <rect x="10.5" y="17" width="3" height="3.5" fill={CARD} stroke={INK} strokeWidth="1.2" />
          <rect x="7" y="20.5" width="10" height="2" fill={CARD} stroke={INK} strokeWidth="1.2" />
        </>
      );
      break;
    case "coin":
      body = (
        <>
          <ellipse cx="12" cy="14" rx="9" ry="4" {...s} />
          <ellipse cx="12" cy="11.5" rx="9" ry="4" {...s} />
          <path d={NEAR_MARK.path} fill={INK} transform={markTransform(12, 11.5, 6.4, 0.5)} />
        </>
      );
      break;
  }
  return (
    <svg
      className="sk-icon"
      data-object={kind}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
