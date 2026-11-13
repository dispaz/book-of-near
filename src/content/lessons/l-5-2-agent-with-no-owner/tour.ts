/**
 * The camera tour of each step's figure (3D view, the play button in the stage bar): two or three shots,
 * each with a caption. It only moves the camera; it never acts for the learner. Pure, unit tested.
 */
import type { Shot } from "../../../scene-kit/bookLayout";
import { ATTACK, BOOT, CHECK, HOOK, REGISTER } from "./steps";

export { CHECK };

/** What a tour shot looks at. */
export type Target =
  | { kind: "all" }
  | { kind: "laptop" }
  | { kind: "key" }
  | { kind: "enclave" }
  | { kind: "contract" }
  | { kind: "signer" }
  | { kind: "eth" };

const ALL: Shot<Target> = { caption: "The whole page.", target: { kind: "all" } };
const shot = (kind: Exclude<Target["kind"], "all">, caption: string): Shot<Target> => ({
  caption: `Close up: ${caption}`,
  target: { kind },
});

export function tourFor(step: number): Shot<Target>[] {
  if (step >= CHECK) return [];
  switch (step) {
    case HOOK:
      return [ALL, shot("laptop", "the developer's laptop. The bot's key sits in a file on it.")];
    case BOOT:
      return [ALL, shot("enclave", "the enclave, where the agent makes its own key.")];
    case REGISTER:
      return [
        ALL,
        shot("enclave", "the agent, with its quote."),
        shot("contract", "the agent contract, which checks the quote."),
      ];
    case ATTACK:
      return [
        ALL,
        shot("key", "the developer's own key."),
        shot("contract", "the agent contract, which only answers registered agents."),
      ];
    default:
      return [
        ALL,
        shot("signer", "the signing network. The agent contract is the caller."),
        shot("eth", "the contract's Ethereum address."),
      ];
  }
}
