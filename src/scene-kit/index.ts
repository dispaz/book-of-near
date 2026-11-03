/**
 * 3D scene kit. Pulls in three.js: import it only from a lazy Scene module (manifest `scene: () =>
 * import("./Scene")`), never from a manifest or the app shell. The flat fallback kit is in ./svg.
 */
export { InkStage, type InkStageProps } from "./InkStage";
export {
  AccountBlock,
  Anchor,
  ChainBlock,
  Coin,
  ContractBlock,
  Glow,
  Key,
  Label,
  Outline,
  Pickable,
  ShardSlab,
  SoftShadow,
  useInk,
  type PickProps,
} from "./primitives";
export { Traveller } from "./Traveller";
export { CameraRig } from "./CameraRig";
export { useStage } from "./context";
export { inkMaterial, hullMaterial } from "./materials";
export { arcPoint, easeInOut, fitView, isClick, toFlat, type CameraView, type Vec3 } from "./motion";
export { COLORS, INK } from "./theme";
