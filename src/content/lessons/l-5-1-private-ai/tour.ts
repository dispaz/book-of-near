/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { CHECK, ENCLAVE, HONEST, HOOK, PROMPT, QUOTE } from "./steps";

export { CHECK, HONEST };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "terminal" }
  | { kind: "server" }
  | { kind: "enclave" }
  | { kind: "root" }
  | { kind: "quote" }
  | { kind: "seal" };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const shot = (kind: Exclude<Target["kind"], "all">, caption: string): Shot<Target> => ({
  caption: `Close up: ${caption}`,
  target: { kind },
});

export function tourFor(step: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  switch (step) {
    case HOOK:
      return [
        ALL,
        shot("server", "an ordinary cloud server. It reads your prompt in plain memory."),
        shot("enclave", "a hardware enclave. Its memory is sealed by the chip."),
      ];
    case ENCLAVE:
      return [ALL, shot("root", "root access, the admin who can read any normal memory.")];
    case PROMPT:
      return [ALL, shot("terminal", "your terminal, where the prompt starts.")];
    case QUOTE:
      return [ALL, shot("quote", "the attestation quote, signed by the chip.")];
    default:
      return [
        ALL,
        shot("quote", "the quote you check."),
        shot("seal", "Intel's root certificate, where the chain of signatures ends."),
      ];
  }
}
