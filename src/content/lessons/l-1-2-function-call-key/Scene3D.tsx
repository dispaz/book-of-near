/**
 * Lesson 1.2 in 3D: your account (a contract block holding the counter), the agent, and the places it
 * might aim at. The agent's key is a gold key that hops to whatever it tries to reach; the chain's answer
 * hangs over it. It only draws the shared state from useKeyLesson. Loaded lazily from Scene.tsx, so the
 * 2D view never downloads three.js.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  AccountBlock,
  Anchor,
  COLORS,
  ContractBlock,
  InkStage,
  Key,
  Label,
  Traveller,
  ViewOffset,
  frameCamera,
  inset,
} from "../../../scene-kit";
import { useMediaQuery } from "../../../ui/hooks";
import { near, REASON_TEXT, short } from "./key";
import { AGENT, HOME, OTHER, SIZE, THIEF, keyAt, shot } from "./layout3d";
import type { Lesson } from "./useKeyLesson";

export default function Scene3D({
  lesson,
  flat,
  reducedMotion,
}: {
  lesson: Lesson;
  flat: boolean;
  reducedMotion: boolean;
}) {
  const { keyState, aim, attempts, left, initial, counter, me } = lesson;
  const [picked, setPicked] = useState<"agent" | "home" | "thief" | "other" | null>(null);
  const phone = useMediaQuery("(max-width: 899px)");
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const frame = inset({ left: 0, top: 0, right: size.width, bottom: size.height }, { top: size.status });
  const view = frameCamera(shot(phone), frame, size.width, size.height, 0.92, { nearFit: true });

  const last = attempts[attempts.length - 1];
  const answer =
    aim && last && keyState === "active" ? (last.ok ? "accepted" : `refused: ${last.reason ?? "no"}`) : null;
  const revoked = keyState === "revoked";
  const allowance =
    keyState === "active" && left !== null && initial !== null
      ? `allowance ${near(left)} of ${near(initial)} NEAR`
      : revoked
        ? "key deleted"
        : "no agent key yet";
  const target = revoked ? null : aim;

  const description = [
    `Your account ${me ? short(me.accountId) : ""} with a counter contract at ${counter}`,
    `the agent, the attacker.testnet account and the testnet registrar contract.`,
    keyState === "none"
      ? "The agent has no key yet."
      : revoked
        ? "The agent's key has been deleted."
        : `The agent's limited key has ${left !== null ? near(left) : "some"} NEAR of allowance left.`,
    last && !last.ok ? `The chain refused the last attempt: ${last.reason ?? last.message}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={box} className="kl-3d-box">
      <InkStage
        view={view}
        flat={flat}
        reducedMotion={reducedMotion}
        state={lesson.state}
        status={lesson.status ?? ""}
        description={description}
        onMiss={() => setPicked(null)}
        minDistance={3}
        maxDistance={140}
      >
        <ViewOffset frame={frame} reducedMotion={reducedMotion} />
        <AccountBlock
          position={AGENT}
          size={SIZE}
          color={COLORS.blue}
          name="the agent"
          pickLabel="The agent"
          selected={picked === "agent"}
          onPick={() => setPicked((p) => (p === "agent" ? null : "agent"))}
        />
        <ContractBlock
          position={HOME}
          size={SIZE}
          color={COLORS.orange}
          name="your account"
          note={keyState === "none" ? undefined : `counter ${counter}`}
          pickLabel="Your account with the counter contract"
          selected={picked === "home"}
          onPick={() => setPicked((p) => (p === "home" ? null : "home"))}
        />
        <Anchor name="account" position={[HOME[0] - SIZE * 0.4, SIZE * 0.6, HOME[2]]} />
        <Anchor name="counter" position={[HOME[0], SIZE * 0.5, HOME[2] + SIZE / 2]} />
        <Label position={[HOME[0], SIZE + 1.9, HOME[2]]} variant="hint">
          {allowance}
        </Label>
        <AccountBlock
          position={THIEF}
          size={SIZE}
          color={COLORS.red}
          name="attacker.testnet"
          pickLabel="The attacker's account"
          selected={picked === "thief"}
          onPick={() => setPicked((p) => (p === "thief" ? null : "thief"))}
        />
        <Anchor name="log" position={[THIEF[0], SIZE * 0.5, THIEF[2]]} />
        <ContractBlock
          position={OTHER}
          size={SIZE}
          color={COLORS.contract}
          name="testnet registrar"
          pickLabel="Another contract: the testnet registrar"
          selected={picked === "other"}
          onPick={() => setPicked((p) => (p === "other" ? null : "other"))}
        />
        {picked ? (
          <Label
            position={[
              (picked === "agent" ? AGENT : picked === "home" ? HOME : picked === "thief" ? THIEF : OTHER)[0],
              0.25,
              3.4,
            ]}
            variant="hint"
          >
            {picked === "agent"
              ? "a script that signs with the limited key"
              : picked === "home"
                ? "your account: holds the counter contract and your full-access key"
                : picked === "thief"
                  ? "an account the agent should never pay"
                  : "a contract the key is not allowed to call"}
          </Label>
        ) : null}

        {keyState !== "none" ? (
          <Traveller to={keyAt(target)} arc={2.6} duration={0.9} color={COLORS.gold}>
            <Key
              color={revoked ? COLORS.slab : COLORS.gold}
              rotation={revoked ? [0, 0.4, -1.4] : [0, 0.3, -0.2]}
              name={revoked ? "revoked" : "agent's key"}
            />
            <Anchor name="keycard" position={[0, 0.2, 0]} />
            {answer ? (
              <Label position={[0, -0.9, 1.2]} variant="small">
                {answer}
              </Label>
            ) : null}
          </Traveller>
        ) : (
          <Anchor name="keycard" position={[AGENT[0] + 1.1, 1.1, AGENT[2]]} />
        )}
        {last && !last.ok && last.reason && aim && keyState === "active" ? (
          <Label position={[0, 0.25, 3.4]} variant="hint">
            {REASON_TEXT[last.reason] ?? last.message}
          </Label>
        ) : null}
      </InkStage>
    </div>
  );
}

/** The size of the 3D window and the height of its status line, kept up to date as the layout changes. */
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
