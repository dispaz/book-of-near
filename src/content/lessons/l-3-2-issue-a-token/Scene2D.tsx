/**
 * Lesson 3.2, flat view: the same page as the 3D book scene, drawn in SVG with the same layout
 * (layout3d.ts): your mailbox with its token coins, the minting stamp, the friend's mailbox with its
 * storage padlock, and at step 5 the relayer and the signed parcel. Every object is a pick, as in 3D.
 * Only draws the shared state from useToken.
 */
import type { SceneProps } from "../../../app/types";
import { SvgPickable } from "../../../scene-kit/svg";
import { SvgMailbox, SvgParcel, SvgStamp } from "../../../scene-kit/svg/objects";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";
import { FRIEND as FRIEND_ID } from "./ft";
import { FIGURE, FRIEND, ME, PADLOCK, PARCEL_END, PARCEL_START, partsAt, RELAYER, STAMP } from "./layout3d";
import { describe, Facts, pickLabel, short } from "./parts";
import { CHECK, HOOK, MINT, TRAP } from "./steps";
import type { Token } from "./useToken";

export const ACCENT = STAGE_ACCENTS[3];

const SCALE = 70;
const W = (FIGURE.maxX - FIGURE.minX) * SCALE;
const H = (FIGURE.maxZ - FIGURE.minZ) * SCALE;
const px = (x: number) => (x - FIGURE.minX) * SCALE;
const pz = (z: number) => (z - FIGURE.minZ) * SCALE;

/** Coins drawn beside a mailbox: one per 250 tokens, at most 5, at least 1 while it holds any. */
export const coinsFor = (n: number) => (n <= 0 ? 0 : Math.max(1, Math.min(5, Math.round(n / 250))));

export default function Scene2D({ t, reducedMotion, mode }: { t: Token; reducedMotion: boolean; mode: SceneProps["mode"] }) {
  if (t.step >= CHECK) return null;
  return (
    <div
      className={`tok${reducedMotion ? " still" : ""}`}
      data-testid="token-scene"
      data-scene-state={t.state}
      data-view="2d"
      data-mode={mode}
    >
      <div className="tok-2d">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={describe(t)}>
          <Figure t={t} />
        </svg>
      </div>
      <Facts t={t} />
    </div>
  );
}

function Figure({ t }: { t: Token }) {
  const parts = partsAt(t.step);
  const sel = (o: string) => t.picked?.what === o;
  const delivered = t.relayed > 0;
  const parcelAt = delivered ? PARCEL_END : PARCEL_START;
  return (
    <g>
      <SvgMailbox
        x={px(ME[0])}
        y={pz(ME[2]) + 50}
        size={124}
        name={short(t.parent?.id ?? "your account", 18)}
        note={t.minted ? `${t.myBalance} ${t.symbol}` : undefined}
        color={ACCENT}
        coins={coinsFor(t.myBalance)}
        pickLabel={pickLabel(t, "me")}
        onPick={() => t.pick("me")}
        selected={sel("me")}
      />
      {parts.includes("stamp") ? (
        <g data-explain={t.step === HOOK || t.step === MINT ? "stamp" : undefined}>
          <SvgPickable
            label={pickLabel(t, "stamp")}
            onPick={() => t.pick("stamp")}
            selected={sel("stamp")}
            focus={[px(STAMP[0]) - 40, pz(STAMP[2]) - 40, 80, 90]}
          >
            <rect
              x={px(STAMP[0]) - 8}
              y={pz(STAMP[2]) - 34}
              width={16}
              height={30}
              rx={4}
              className="tok-bar"
            />
            <SvgStamp x={px(STAMP[0])} y={pz(STAMP[2]) + 12} size={46} color={ACCENT} />
            <text x={px(STAMP[0])} y={pz(STAMP[2]) + 52} textAnchor="middle" className="tok-svg-label small">
              {t.minted ? `${t.symbol} · ${t.supply.toLocaleString("en-US")}` : `mint ${t.symbol}`}
            </text>
          </SvgPickable>
        </g>
      ) : null}
      {parts.includes("friend") ? (
        <SvgMailbox
          x={px(FRIEND[0])}
          y={pz(FRIEND[2]) + 50}
          size={110}
          name={FRIEND_ID}
          note={t.registered ? `${t.friendBalance} ${t.symbol}` : undefined}
          color={ACCENT}
          coins={coinsFor(t.friendBalance * 5)}
          flag={t.friendBalance > 0}
          state={t.registered ? "ok" : "pending"}
          pickLabel={pickLabel(t, "friend")}
          onPick={() => t.pick("friend")}
          selected={sel("friend")}
        />
      ) : null}
      {parts.includes("padlock") ? <Padlock t={t} selected={sel("padlock")} /> : null}
      {parts.includes("relayer") ? (
        <SvgMailbox
          x={px(RELAYER[0])}
          y={pz(RELAYER[2]) + 40}
          size={92}
          name="relayer"
          note="pays gas"
          color={ACCENT}
        />
      ) : null}
      {parts.includes("parcel") ? (
        <g data-explain="parcel">
          <SvgParcel
            x={px(parcelAt[0])}
            y={pz(parcelAt[2]) + 20}
            size={70}
            color={ACCENT}
            to={short(t.tokenId ?? "token", 16)}
            stamped={delivered || t.busy === "gasless"}
            state={t.capped ? "failed" : "ok"}
            name="signed delegate action"
            pickLabel={pickLabel(t, "parcel")}
            onPick={() => t.pick("parcel")}
            selected={sel("parcel")}
          />
        </g>
      ) : null}
    </g>
  );
}

/** The storage padlock: red and shut until the friend is registered, then open. */
function Padlock({ t, selected }: { t: Token; selected: boolean }) {
  const x = px(PADLOCK[0]);
  const y = pz(PADLOCK[2]);
  const open = !!t.registered;
  const red = t.step >= TRAP && !open && !!t.refused;
  return (
    <g data-explain="padlock">
      <SvgPickable label={pickLabel(t, "padlock")} onPick={() => t.pick("padlock")} selected={selected} focus={[x - 30, y - 44, 60, 80]}>
        <g className="tok-svg-padlock">
          <path
            d={open ? `M${x - 12},${y - 6} v-16 a12,12 0 0 1 24,0 v-6` : `M${x - 12},${y - 6} v-12 a12,12 0 0 1 24,0 v12`}
            fill="none"
          />
          <rect
            x={x - 18}
            y={y - 6}
            width={36}
            height={28}
            rx={5}
            fill={open ? ACCENT : red ? "var(--red)" : "var(--card)"}
          />
        </g>
        <text x={x} y={y + 40} textAnchor="middle" className="tok-svg-label small">
          {open ? "registered" : red ? "not registered" : "storage"}
        </text>
      </SvgPickable>
    </g>
  );
}
