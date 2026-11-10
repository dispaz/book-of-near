import { createContext } from "react";

/**
 * How a lesson's 3D view should appear. `grow`: the learner just saw the 2D page (the book opened, or
 * they switched from 2D), so the 3D scene starts as a flat drawing seen from above and rises into 3D.
 * Lives outside the scene kit so the app shell can provide it without loading three.js.
 */
export const IntroContext = createContext<{ grow: boolean }>({ grow: false });

/**
 * The lesson a scene belongs to (its id), or null outside a lesson page. Scenes key what they keep in
 * memory across mounts by it (the learner's own camera, scene-kit/viewMemory.ts): unlike the URL, it is
 * known when the scene mounts and is the same under every router.
 */
export const LessonIdContext = createContext<string | null>(null);

/**
 * A 3D view that stands on an open book can print the step on the book's left page (wide screens).
 * `page` is the lesson page's `.book-page` element (the step heading and note); while the view calls
 * `setPrinted(true)` the lesson page lays it out as print (no boxes, no arrows) and the view places
 * that element on the page.
 */
export const SpreadContext = createContext<{
  page: HTMLElement | null;
  setPrinted: (on: boolean) => void;
}>({ page: null, setPrinted: () => undefined });
