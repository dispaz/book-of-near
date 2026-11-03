/**
 * 3D scene kit. Pulls in three.js: import it only from a lazy Scene module (manifest `scene: () =>
 * import("./Scene")`), never from a manifest or the app shell. The flat fallback kit is in ./svg.
 */
export { InkStage, type InkStageProps } from "./InkStage";
export { BookBackdrop, type BookBackdropProps, type BookPrint } from "./BookBackdrop";
export {
  BOOK,
  curlProfile,
  pageHeight,
  spreadBeside,
  spreadFor,
  textBlock,
  type Spread,
  type TextBlock,
} from "./book";
export { PrintOnPage } from "./PrintOnPage";
export { homography, matrix3d } from "./homography";
export { POP, popState } from "./pop";
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
export {
  focusOf,
  fovFor,
  frameCamera,
  inset,
  pullBackFor,
  viewOffset,
  type Box,
  type Focus,
  type Frame,
  type Reserve,
} from "./framing";
export { ViewOffset } from "./ViewOffset";
