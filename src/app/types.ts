import type { ComponentType } from "react";

export type LessonStatus = "ready" | "card" | "planned";
export type ChainMode = "demo" | "testnet";
/** How a scene is drawn: flat 2D SVG, or the 3D scene kit. */
export type SceneView = "2d" | "3d";

/**
 * One step of a lesson. The caption is the step heading at the top; `explain` is the note that points at
 * the scene object named by `explainAt` (or sits in the dock when there is none).
 */
export interface Step {
  caption: string;
  explain?: string;
  /**
   * Which scene element the explanation points at: the scene marks it with `data-explain="<name>"`
   * (2D: any element; 3D: the kit's `<Anchor name>`). Wide screens draw the note beside it with an arrow.
   */
  explainAt?: string;
  /** "summary": this step's page lists every step's explanation (the check step, behind the quiz). */
  page?: "summary";
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
  /**
   * Which view to draw. Lessons with `views: ["2d", "3d"]` keep ONE state and draw it either way, so
   * switching mid-lesson keeps the learner's progress. Load the 3D view lazily so 2D never pulls in three.js.
   */
  view: SceneView;
  /** Flat top-down camera mode (3D scenes); 2D scenes may ignore it. */
  flat: boolean;
  mode: ChainMode;
  /**
   * Report values the learner chose (for example the amount they sent), so captions and texts that use
   * `{name}` placeholders show the learner's numbers instead of the manifest's defaults.
   */
  setVars?: (vars: Record<string, string>) => void;
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
  /**
   * Default values for `{name}` placeholders in captions, explains and action labels. A scene replaces
   * them with the learner's own values through `setVars`.
   */
  vars?: Record<string, string>;
  /** Lazy scene import, so 3D code never loads before a scene opens. Planned cards have none. */
  scene?: () => Promise<SceneModule>;
  /**
   * Views the scene can draw. Default ["2d"]. With both, the lesson page shows a 2D / 3D switch.
   */
  views?: SceneView[];
  /** The scene draws ONLY with WebGL (3D-only lesson): show the fallback when WebGL is missing. */
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
