import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Overlay, OverlayStore, type OverlayItem } from "./overlay";

afterEach(cleanup);

const anchor = { current: null };
const pick = (note: { kind: "hint" | "detail"; text: string } | null): OverlayItem => ({
  kind: "pick",
  label: "The coin",
  pressed: false,
  onPick: () => undefined,
  note,
});

describe("Overlay pick notes (rule 10a)", () => {
  it("keeps one empty live region per pick button and only swaps its text", () => {
    const store = new OverlayStore();
    act(() => store.set("a", pick(null), anchor));
    render(<Overlay store={store} />);
    const button = screen.getByRole("button", { name: "The coin" });
    const status = screen.getByRole("status");
    expect(status).toHaveProperty("textContent", "");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(button.getAttribute("aria-describedby")).toBe(status.id);

    act(() => store.set("a", pick({ kind: "hint", text: "Not yet" }), anchor));
    // The same node, now filled: screen readers announce the change.
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("Not yet");
    expect(status.classList.contains("hint")).toBe(true);
  });
});
