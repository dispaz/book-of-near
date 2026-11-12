import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useBoxSize } from "./useBoxSize";

function Probe({ status }: { status?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useBoxSize(ref);
  return (
    <div ref={ref}>
      {status !== undefined ? <p className="sk-status">{status}</p> : null}
      <output data-testid="size">{`${size.width}x${size.height}/${size.status}`}</output>
    </div>
  );
}

describe("useBoxSize", () => {
  afterEach(cleanup);

  it("falls back to 640 × 400 before the box has a size, with a small gap when there is no status", () => {
    render(<Probe />);
    expect(screen.getByTestId("size").textContent).toBe("640x400/12");
  });

  it("leaves room below a status line that has text", () => {
    render(<Probe status="Sent to the registrar…" />);
    // jsdom lays nothing out: the status sits at 0 with no height, plus the 6 px gap.
    expect(screen.getByTestId("size").textContent).toBe("640x400/6");
  });
});
