import { createContext, useContext } from "react";
import { COLORS } from "./theme";

export interface StageSettings {
  reducedMotion: boolean;
  flat: boolean;
  /** The stage accent (the lesson page's `--accent`): the hover ring on pickable objects. */
  accent: string;
}

export const StageContext = createContext<StageSettings>({
  reducedMotion: false,
  flat: false,
  accent: COLORS.blue,
});

/** Settings of the surrounding <InkStage>: reduced motion, flat view and the stage accent. */
export const useStage = () => useContext(StageContext);
