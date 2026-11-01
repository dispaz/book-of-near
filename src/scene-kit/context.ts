import { createContext, useContext } from "react";

export interface StageSettings {
  reducedMotion: boolean;
  flat: boolean;
}

export const StageContext = createContext<StageSettings>({ reducedMotion: false, flat: false });

/** Settings of the surrounding <InkStage>: reduced motion and flat view. */
export const useStage = () => useContext(StageContext);
