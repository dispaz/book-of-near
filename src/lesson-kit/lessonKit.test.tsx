import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Check, type CheckQuestion } from "./Check";
import { HonestTake } from "./HonestTake";

const QUESTIONS: CheckQuestion[] = [
  {
    prompt: "What does a hash do?",
    options: [
      { text: "Acts as a fingerprint", correct: true },
      { text: "Encrypts the block", why: "A hash does not hide the data." },
    ],
  },
  {
    prompt: "Can you undo a final transaction?",
    options: [
      { text: "Yes, call the bank", why: "There is no bank to call." },
      { text: "No", correct: true },
    ],
  },
];

afterEach(cleanup);

describe("Check", () => {
  it("renders each question as a keyboard-reachable radio group", () => {
    render(<Check questions={QUESTIONS} onPass={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: /What does a hash do/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("explains why a wrong answer is wrong and keeps the gate shut", () => {
    const onPass = vi.fn();
    render(<Check questions={QUESTIONS} onPass={onPass} />);
    fireEvent.click(screen.getByRole("radio", { name: "Encrypts the block" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText(/A hash does not hide the data/)).toBeInTheDocument();
    expect(onPass).not.toHaveBeenCalled();
  });

  it("asks for an answer to every question", () => {
    const onPass = vi.fn();
    render(<Check questions={QUESTIONS} onPass={onPass} />);
    fireEvent.click(screen.getByRole("radio", { name: "Acts as a fingerprint" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText("Pick an answer.")).toBeInTheDocument();
    expect(onPass).not.toHaveBeenCalled();
  });

  it("opens the gate once every answer is right", () => {
    const onPass = vi.fn();
    render(<Check questions={QUESTIONS} onPass={onPass} />);
    fireEvent.click(screen.getByRole("radio", { name: "Acts as a fingerprint" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(onPass).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/All right/);
  });

  it("clears a question's feedback when the answer changes", () => {
    render(<Check questions={QUESTIONS} onPass={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Encrypts the block" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText(/A hash does not hide the data/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Acts as a fingerprint" }));
    expect(screen.queryByText(/A hash does not hide the data/)).not.toBeInTheDocument();
  });

  it("starts passed when the gate is already open", () => {
    render(<Check questions={QUESTIONS} onPass={() => {}} passed />);
    expect(screen.getByRole("status")).toHaveTextContent(/All right/);
  });
});

describe("HonestTake", () => {
  it("lists strengths, weaknesses and the comparison chain", () => {
    render(
      <HonestTake
        strengths={["Fast finality"]}
        weaknesses={["Fewer apps", { text: "Fees may rise", unverified: true }]}
        comparedWith="Ethereum"
      />,
    );
    const card = screen.getByRole("region", { name: "Honest take" });
    expect(card).toHaveTextContent("Compared with Ethereum");
    expect(screen.getByRole("list", { name: "Strengths" })).toHaveTextContent("Fast finality");
    const weak = screen.getByRole("list", { name: "Weaknesses" });
    expect(weak).toHaveTextContent("Fewer apps");
    expect(weak).toHaveTextContent("Fees may rise (unverified)");
  });

  it("names several comparison chains", () => {
    render(<HonestTake strengths={["a"]} weaknesses={["b"]} comparedWith={["Ethereum", "Solana"]} />);
    expect(screen.getByRole("region", { name: "Honest take" })).toHaveTextContent(
      "Compared with Ethereum and Solana",
    );
  });

  it("says plainly when NEAR is not different", () => {
    render(<HonestTake strengths={["a"]} weaknesses={["b"]} comparedWith="not different" />);
    expect(screen.getByRole("region", { name: "Honest take" })).toHaveTextContent(
      "NEAR is not different here from most chains",
    );
  });
});
