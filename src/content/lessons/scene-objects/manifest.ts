import type { LessonManifest } from "../../../app/types";

/**
 * Developer gallery of the scene objects (docs/scene-objects.md): one shape per concept, every state, in
 * 2D and 3D. Hidden from menus; open /lesson/scene-objects.
 */
export default {
  id: "scene-objects",
  stage: 0,
  order: 98,
  title: "Scene objects",
  status: "ready",
  needsChain: false,
  hidden: true,
  views: ["2d", "3d"],
  summary: "Every scene object in every state, to review the set as a whole.",
  steps: [
    { caption: "Account: a mailbox. Named, implicit (hex), not created yet (dashed), deleted." },
    { caption: "Transaction: a parcel. Packing, stamped (signed), opened to show its actions, failed." },
    { caption: "Contract: a scroll that runs code. Idle, running (the gear turns), failed." },
    {
      caption: "Keys and coins: a full-access key, a function-call key with its tag, a revoked one, a coin.",
    },
  ],
  scene: () => import("./Scene"),
} satisfies LessonManifest;
