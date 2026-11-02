import type { ComponentType } from "react";

export type LessonStatus = "ready" | "card" | "planned";
export type ChainMode = "demo" | "testnet";

/** One step of a lesson. The caption shows in the stage bar; `explain` shows in the lesson card. */
export interface Step {
  caption: string;
  explain?: string;
  /**
   * Something the learner must do in this step. With `gate: true` Next stays
   * locked until the scene calls `setGate(true)`.
   */
  action?: { label: string; gate?: boolean };
}

/** Props every scene receives from the lesson page. 2D and 3D scenes share this contract. */
export interface SceneProps {
  /** Current step, 0-based. */
  step: number;
  /** Move the lesson to a step (for example after the learner clicks an object). */
  goTo: (step: number) => void;
  /** Open or close the gate of the current step. */
  setGate: (open: boolean) => void;
  /** True when the learner prefers reduced motion: jump to end states, no tweening. */
  reducedMotion: boolean;
  /** Flat top-down camera mode (3D scenes); 2D scenes may ignore it. */
  flat: boolean;
  mode: ChainMode;
  /** Attach evidence (for example `{ txHash }`) to this lesson's completion record. Never keys or seed words. */
  reportEvidence?: (evidence: Record<string, string>) => void;
}

export type SceneModule = { default: ComponentType<SceneProps> };

export interface LessonManifest {
  /** Unique id, also the route: /lesson/<id>. */
  id: string;
  stage: number;
  /** Position inside the stage. */
  order: number;
  title: string;
  status: LessonStatus;
  /** True when the lesson does something on chain (testnet in testnet mode, DemoChain in demo mode). */
  needsChain: boolean;
  /** One-line summary for cards and the table of contents. */
  summary?: string;
  steps: Step[];
  /** Lazy scene import, so 3D code never loads before a scene opens. Planned cards have none. */
  scene?: () => Promise<SceneModule>;
  /** The scene draws with WebGL: show the fallback when WebGL is missing. */
  needsWebGL?: boolean;
  /** Fallback shown when the scene cannot run. Defaults to the caption list. */
  fallback?: ComponentType<SceneProps>;
  /** Hidden lessons have routes but are left out of menus (developer placeholders). */
  hidden?: boolean;
}

export interface StageManifest {
  id: number;
  /** Short name, for example "Blank Page". */
  name: string;
  /** Descriptive title, for example "Crypto foundations". */
  title: string;
  /** The stage's single accent colour. */
  accent: string;
  intro?: string;
}

export interface StageEntry extends StageManifest {
  lessons: LessonManifest[];
}

export interface Registry {
  stages: StageEntry[];
  lessons: Map<string, LessonManifest>;
  stageOf: (lessonId: string) => StageEntry | undefined;
}
