import type { StageManifest } from "../../../app/types";
import { STAGE_ACCENTS } from "../../../scene-kit/theme";

export default {
  id: 1,
  name: "Named",
  title: "First steps on NEAR",
  accent: STAGE_ACCENTS[1],
} satisfies StageManifest;
