import type { StageManifest } from "../../../app/types";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";

export default {
  id: 3,
  name: "Wasm",
  title: "Builder (optional for non-devs)",
  accent: STAGE_ACCENTS[3],
} satisfies StageManifest;
