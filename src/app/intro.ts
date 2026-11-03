import { createContext } from "react";

/**
 * How a lesson's 3D view should appear. `grow`: the learner just saw the 2D page (the book opened, or
 * they switched from 2D), so the 3D scene starts as a flat drawing seen from above and rises into 3D.
 * Lives outside the scene kit so the app shell can provide it without loading three.js.
 */
export const IntroContext = createContext<{ grow: boolean }>({ grow: false });
