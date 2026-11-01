import type { LessonManifest } from "../../../app/types";
import Fallback from "./Fallback";

/** Developer demo of the scene kit (issue #3). Hidden from menus; open /lesson/scene-kit-demo. */
export default {
  id: "scene-kit-demo",
  stage: 0,
  order: 99,
  title: "Scene kit demo",
  status: "ready",
  needsChain: false,
  hidden: true,
  needsWebGL: true,
  summary: "Two accounts and a coin, to try the 3D scene kit.",
  steps: [
    { caption: "This block is an account. An account is a named place that holds coins. Ana's holds one." },
    { caption: "Click a block to select it. Drag to turn the camera. Use Flat view to look from above." },
    { caption: "Your turn: send Ana's coin to Ben.", action: { label: "Send coin", gate: true } },
    { caption: "The coin moved. Ben's account holds it now, and Ana's is empty." },
  ],
  scene: () => import("./Scene"),
  fallback: Fallback,
} satisfies LessonManifest;
