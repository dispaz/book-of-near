import { describe, expect, it, vi } from "vitest";
import { trackPress } from "./pressTracker";

function pointer(type: string, pointerId: number, clientX: number, clientY: number) {
  return Object.assign(new Event(type), { pointerId, clientX, clientY });
}

describe("trackPress", () => {
  it("reports how far the pointer travelled and ends on release", () => {
    const target = new EventTarget();
    const move = vi.fn();
    const end = vi.fn();
    trackPress(target, { pointerId: 1, clientX: 0, clientY: 0 }, { move, end });
    target.dispatchEvent(pointer("pointermove", 2, 50, 0)); // another pointer: ignored
    target.dispatchEvent(pointer("pointermove", 1, 3, 4));
    expect(move).toHaveBeenLastCalledWith(5);
    target.dispatchEvent(pointer("pointerup", 1, 3, 4));
    expect(end).toHaveBeenCalledTimes(1);
    target.dispatchEvent(pointer("pointermove", 1, 30, 40));
    expect(move).toHaveBeenCalledTimes(1);
  });

  it("stop() removes every listener: an object that unmounts mid-press leaks nothing", () => {
    const target = new EventTarget();
    const remove = vi.spyOn(target, "removeEventListener");
    const move = vi.fn();
    const end = vi.fn();
    const stop = trackPress(target, { pointerId: 1, clientX: 0, clientY: 0 }, { move, end });
    stop();
    expect(remove).toHaveBeenCalledTimes(3);
    target.dispatchEvent(pointer("pointermove", 1, 3, 4));
    target.dispatchEvent(pointer("pointerup", 1, 3, 4));
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    stop(); // twice is harmless
    expect(remove).toHaveBeenCalledTimes(3);
  });
});
