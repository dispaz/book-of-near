/**
 * What the Controls card says (CameraControls.tsx). Pure, unit tested. The rig (CameraRig.tsx) is what
 * makes these true: orbit, zoom and a small pan; the learner's view stays until Reset view.
 */
export interface HelpGroup {
  /** "touch" or "mouse": which hands the lines are for. */
  kind: "touch" | "mouse" | "keys";
  title: string;
  lines: { what: string; how: string }[];
}

export const MOUSE: HelpGroup = {
  kind: "mouse",
  title: "With a mouse or trackpad",
  lines: [
    { what: "Turn", how: "Drag." },
    { what: "Zoom", how: "Scroll, or pinch on a trackpad." },
    { what: "Slide", how: "Right-drag, or hold Shift and drag." },
  ],
};

export const TOUCH: HelpGroup = {
  kind: "touch",
  title: "On a touch screen",
  lines: [
    { what: "Turn", how: "Drag with one finger." },
    { what: "Zoom", how: "Pinch." },
    { what: "Slide", how: "Drag with two fingers." },
  ],
};

export const KEYS: HelpGroup = {
  kind: "keys",
  title: "With the keyboard",
  lines: [
    { what: "Objects", how: "Tab to an object, then press Enter to pick it." },
    { what: "Camera", how: "No keys. Reset view frames this step's picture." },
  ],
};

/** After the learner moves the camera, this is what happens next. */
export const KEEP_NOTE =
  "The camera stays where you leave it, step after step. Reset view puts it back on this step's picture.";

/** The groups to show, the learner's own device first; both kinds of pointer are always listed. */
export function helpFor(coarse: boolean): HelpGroup[] {
  return coarse ? [TOUCH, MOUSE, KEYS] : [MOUSE, TOUCH, KEYS];
}
