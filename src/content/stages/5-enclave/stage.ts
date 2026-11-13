import type { StageManifest } from "../../../app/types";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";

// docs/lessons/stage-5/README.md.
export default {
  id: 5,
  name: "Enclave",
  title: "User-owned AI and privacy",
  accent: STAGE_ACCENTS[5],
  intro:
    "Ask an AI that runs inside a sealed chip, then check the chip's signed proof yourself. Next: an agent that holds keys with no human owner.",
} satisfies StageManifest;
