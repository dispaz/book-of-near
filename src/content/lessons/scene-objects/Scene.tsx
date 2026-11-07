import { lazy, Suspense } from "react";
import type { SceneProps } from "../../../app/types";
import { COLORS } from "../../../scene-kit/theme";
import { SvgCoin, SvgKey, SvgLabel, SvgStage } from "../../../scene-kit/svg";
import { SvgAppScreen, SvgMailbox, SvgParcel, SvgScroll, SvgTaggedKey } from "../../../scene-kit/svg/objects";
import { ACCOUNTS, DESCRIPTION, ITEMS, PARCELS, SCROLLS } from "./gallery";

const Scene3D = lazy(() => import("./Scene3D"));

export default function Scene({ step, view, flat, reducedMotion }: SceneProps) {
  if (view === "3d")
    return (
      <Suspense fallback={<p>Loading the 3D scene…</p>}>
        <Scene3D step={step} flat={flat} reducedMotion={reducedMotion} />
      </Suspense>
    );
  return (
    <SvgStage
      state={`step:${step}`}
      description={DESCRIPTION[step] ?? ""}
      reducedMotion={reducedMotion}
      viewBox="0 0 900 460"
    >
      {step === 0
        ? ACCOUNTS.map((a, i) => (
            <SvgMailbox
              key={a.name}
              x={120 + i * 220}
              y={330}
              name={a.name}
              note={a.note}
              state={a.state}
              flag={a.flag}
              coins={a.coins}
            />
          ))
        : null}
      {step === 1
        ? PARCELS.map((p, i) => (
            <g key={p.label}>
              <SvgParcel
                x={120 + i * 220}
                y={380}
                to="shop.ana.testnet"
                stamped={p.stamped}
                open={p.open}
                state={p.state}
                items={ITEMS}
              />
              <SvgLabel x={120 + i * 220} y={420} variant="small">
                {p.label}
              </SvgLabel>
            </g>
          ))
        : null}
      {step === 2
        ? SCROLLS.map((s, i) => (
            <SvgScroll
              key={s.label}
              x={180 + i * 220}
              y={360}
              size={130}
              name="counter"
              note={s.label}
              running={s.running}
              state={s.state}
            />
          ))
        : null}
      {step === 3 ? (
        <>
          <SvgKey x={120} y={220} name="full access" />
          <SvgTaggedKey x={330} y={200} tag="counter.ana" share={0.5} name="function call" />
          <SvgTaggedKey x={540} y={200} tag="counter.ana" share={0.2} state="gone" name="revoked" />
          <SvgCoin x={700} y={220} color={COLORS.gold} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <SvgAppScreen x={300} y={330} size={140} name="Counter app" />
          <SvgAppScreen x={600} y={330} size={140} name="Counter app" note="hacked" state="failed" />
        </>
      ) : null}
    </SvgStage>
  );
}
