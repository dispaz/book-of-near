import { describe, expect, it } from "vitest";
import { Object3D } from "three";
import { parseNear } from "../../../chain/units";
import { ACCOUNT, BUILD, FEE, FINAL, SEND, SIGN } from "./useTransaction";
import { MOTIONS, reactionsFor, type ReactionInput } from "./reactions";

const ME = "cf4342372b583606057805490c97d4778bc4ac444a76f32154634558ab57c3c5";
const BUILT = { receiverId: "book-of-near.testnet", nonce: 7n, blockHash: "Hash1111" };
const SIGNED = { hash: "8kQ3demoHash" };
const at = (over: Partial<ReactionInput>): ReactionInput => ({
  step: ACCOUNT,
  me: { accountId: ME },
  receiver: "book-of-near.testnet",
  selfSend: false,
  senderNow: parseNear("5"),
  receiverNow: parseNear("100"),
  amount: null,
  built: null,
  signed: null,
  events: {},
  busy: null,
  error: null,
  canBuild: false,
  canSign: false,
  canSend: false,
  nodeName: "a demo node (simulated in your browser)",
  ...over,
});

describe("reactionsFor: the device (build)", () => {
  it("says 'not yet' before the Build step", () => {
    expect(reactionsFor(at({ step: ACCOUNT })).device).toEqual({
      hint: "Not yet: you build the transaction on step 2.",
    });
  });
  it("builds on the Build step", () => {
    expect(reactionsFor(at({ step: BUILD, canBuild: true })).device).toEqual({ act: true });
  });
  it("shows the built fields once built", () => {
    const r = reactionsFor(at({ step: FEE, built: BUILT, amount: parseNear("0.01") }));
    expect(r.device).toEqual({
      detail: "Built on your device: transfer 0.01 NEAR to book-of-near.testnet, nonce 7.",
    });
  });
  it("asks to build first when a later step was opened directly", () => {
    expect(reactionsFor(at({ step: SIGN })).device.hint).toBe("Build the transaction first (step 2).");
  });
});

describe("reactionsFor: the key (sign)", () => {
  it("says build first while nothing is built", () => {
    expect(reactionsFor(at({ step: BUILD })).key).toEqual({ hint: "Build the transaction first (step 2)." });
  });
  it("says 'not yet' when built but before the Sign step", () => {
    expect(reactionsFor(at({ step: FEE, built: BUILT })).key).toEqual({
      hint: "Not yet: you sign on step 4.",
    });
  });
  it("signs on the Sign step", () => {
    expect(reactionsFor(at({ step: SIGN, built: BUILT, canSign: true })).key).toEqual({ act: true });
  });
  it("shows the transaction ID once signed", () => {
    expect(reactionsFor(at({ step: SEND, built: BUILT, signed: SIGNED })).key).toEqual({
      detail: "Signed on your device with your private key. Transaction ID: 8kQ3demoHash.",
    });
  });
});

describe("reactionsFor: the RPC node (send)", () => {
  it("says sign first while unsigned", () => {
    expect(reactionsFor(at({ step: SEND, built: BUILT })).node).toEqual({
      hint: "Sign the transaction first (step 4).",
    });
  });
  it("says 'not yet' when signed but before the Send step", () => {
    expect(reactionsFor(at({ step: SIGN, built: BUILT, signed: SIGNED })).node).toEqual({
      hint: "Not yet: you send on step 5.",
    });
  });
  it("sends on the Send step", () => {
    expect(reactionsFor(at({ step: SEND, signed: SIGNED, canSend: true })).node).toEqual({ act: true });
  });
  it("tells where it went once broadcast", () => {
    const events = { broadcast: { phase: "broadcast", atMs: 250 } } as unknown as ReactionInput["events"];
    expect(reactionsFor(at({ step: FINAL, signed: SIGNED, events })).node).toEqual({
      detail: "Passed to the validators by a demo node (simulated in your browser).",
    });
  });
  it("stays pickable while sending", () => {
    expect(reactionsFor(at({ step: SEND, signed: SIGNED, busy: "send" })).node).toEqual({
      detail: "Sending…",
    });
  });
});

describe("reactionsFor: the accounts", () => {
  it("show who they are and what they hold", () => {
    const r = reactionsFor(at({}));
    expect(r.sender).toEqual({ detail: "Your practice account cf4342…c3c5: 5 NEAR." });
    expect(r.receiver).toEqual({ detail: "The app's return account book-of-near.testnet: 100 NEAR." });
  });
  it("name a send to yourself", () => {
    expect(reactionsFor(at({ selfSend: true, receiver: ME })).receiver.detail).toBe(
      "The same account: you send to yourself.",
    );
  });
});

describe("MOTIONS", () => {
  it("each plays, moves the object, then settles back to rest", () => {
    for (const [name, motion] of Object.entries(MOTIONS)) {
      const o = new Object3D();
      expect(motion(o, 0.1), name).toBe(true);
      const moved =
        o.position.length() > 0.001 ||
        Math.abs(o.rotation.z) + Math.abs(o.rotation.x) > 0.001 ||
        o.scale.y !== 1;
      expect(moved, name).toBe(true);
      const rest = new Object3D();
      expect(motion(rest, 5), name).toBe(false);
      expect(rest.position.length(), name).toBe(0);
      expect(rest.scale.y, name).toBe(1);
    }
  });
});
