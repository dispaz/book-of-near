import { describe, expect, it } from "vitest";
import type { Focus } from "../../../scene-kit/framing";
import { itemSlots, parcelDims } from "../../../scene-kit/objects";
import { MADE, MAX_ITEMS, OBJ, PARCEL, RECEIVER, SIGNER, SIZE, parcelAt, shot } from "./layout3d";

const inside = (f: Focus, [x, , z]: readonly number[]) =>
  Math.abs(x! - f.center[0]) <= f.width / 2 + 1e-9 && Math.abs(z! - f.center[2]) <= f.depth / 2 + 1e-9;

describe("3D shot", () => {
  it("keeps the three accounts and the parcel in view, on wide screens and phones", () => {
    for (const phone of [false, true])
      for (const p of [SIGNER, RECEIVER, MADE, parcelAt(false), parcelAt(true)])
        expect(inside(shot(phone), p)).toBe(true);
  });

  it("is tall enough for an open parcel with all its cards", () => {
    const top = parcelDims(PARCEL).height + itemSlots(MAX_ITEMS, MAX_ITEMS)[0]!.y + 0.3;
    expect(shot(false).height).toBeGreaterThanOrEqual(top);
  });

  it("looks down more steeply on phones", () => {
    expect(shot(true).elevation!).toBeGreaterThan(shot(false).elevation!);
  });
});

describe("the parcel", () => {
  it("moves toward the receiver once sent", () => {
    expect(parcelAt(true)[0]).toBeGreaterThan(parcelAt(false)[0]);
  });

  it("is drawn bigger than the layout unit, like the mailboxes", () => {
    expect(OBJ).toBeGreaterThan(SIZE);
  });
});
