import {
  AppScreen,
  Coin,
  InkStage,
  Key,
  Label,
  Mailbox,
  Parcel,
  Scroll,
  TaggedKey,
  type CameraView,
} from "../../../scene-kit";
import { ACCOUNTS, DESCRIPTION, ITEMS, PARCELS, SCROLLS } from "./gallery";

const VIEWS: CameraView[] = [
  { position: [0, 5.5, 13], target: [0, 1.2, 0] },
  { position: [0, 6, 13], target: [0, 1.4, 0] },
  { position: [0, 4.5, 10], target: [0, 1, 0] },
  { position: [0, 5, 14], target: [0, 0.8, 0] },
  { position: [0, 4.5, 9], target: [0, 1, 0] },
];

export default function Scene3D({
  step,
  flat,
  reducedMotion,
}: {
  step: number;
  flat: boolean;
  reducedMotion: boolean;
}) {
  return (
    <InkStage
      view={VIEWS[step] ?? VIEWS[0]!}
      flat={flat}
      reducedMotion={reducedMotion}
      state={`step:${step}`}
      description={DESCRIPTION[step] ?? ""}
    >
      {step === 0
        ? ACCOUNTS.map((a, i) => (
            <Mailbox
              key={a.name}
              position={[-5.1 + i * 3.4, 0, 0]}
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
            <group key={p.label}>
              <Parcel
                position={[-5.1 + i * 3.4, 0, 0]}
                to="shop.ana"
                stamped={p.stamped}
                open={p.open}
                state={p.state}
                items={ITEMS}
              />
              <Label position={[-5.1 + i * 3.4, 0.1, 1.3]} variant="small">
                {p.label}
              </Label>
            </group>
          ))
        : null}
      {step === 2
        ? SCROLLS.map((s, i) => (
            <Scroll
              key={s.label}
              position={[-3.2 + i * 3.2, 0, 0]}
              name="counter"
              note={s.label}
              running={s.running}
              state={s.state}
            />
          ))
        : null}
      {step === 3 ? (
        <>
          <Key position={[-4.2, 1.2, 0]} name="full access" />
          <TaggedKey position={[-1.2, 1.4, 0]} tag="counter.ana" share={0.5} name="function call" />
          <TaggedKey position={[1.8, 1.4, 0]} tag="counter.ana" share={0.2} state="gone" name="revoked" />
          <Coin position={[4.4, 0.07, 0]} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <AppScreen position={[-2, 0, 0]} name="Counter app" />
          <AppScreen position={[2, 0, 0]} name="Counter app" note="hacked" state="failed" />
        </>
      ) : null}
    </InkStage>
  );
}
