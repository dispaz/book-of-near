import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LessonManifest } from "../app/types";
import { CardDetails } from "./TopicCard";

afterEach(() => cleanup());

const planned = (extra: Partial<LessonManifest> = {}): LessonManifest => ({
  id: "l-9-9-some-lesson",
  stage: 9,
  order: 9,
  title: "Some lesson",
  status: "planned",
  needsChain: false,
  steps: [],
  ...extra,
});

// Which lessons are still planned changes as lessons land, so the "being written" state is tested here,
// on a made-up planned lesson, rather than in e2e on a real one.
describe("CardDetails", () => {
  it("a planned lesson with a summary shows its being-written state", () => {
    render(<CardDetails lesson={planned({ summary: "What it will teach." })} />);
    expect(screen.getByText("What it will teach.")).toBeTruthy();
    expect(screen.getByText(/This lesson is being written/)).toBeTruthy();
  });

  it("a planned lesson with no summary says the card is not written yet", () => {
    render(<CardDetails lesson={planned()} />);
    expect(screen.getByText(/This card is not written yet/)).toBeTruthy();
  });
});
