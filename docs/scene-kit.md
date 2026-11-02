# Scene kit

The shared kit for interactive lesson scenes, in the ink style of `docs/prototype/ink-stage.html`.
Live demo: `/lesson/scene-kit-demo` (hidden from menus). Source: `src/content/lessons/scene-kit-demo/`.

## Two halves

| Folder | What | Loads |
| --- | --- | --- |
| `src/scene-kit/` (`index.ts`) | 3D kit: three.js + @react-three/fiber + drei | Only from a lazy `Scene.tsx` (`scene: () => import("./Scene")`) |
| `src/scene-kit/svg/` | Flat SVG kit with the same primitives | Eagerly, from the manifest's `fallback` |

Never import `src/scene-kit` (the 3D half) from a manifest, the app shell or the SVG kit. The e2e test
"no 3D code loads on the contents page" checks that `WebGLRenderer` is not in the JS loaded on `/`.
`motion.ts` and `theme.ts` hold the pure maths and colours shared by both halves.

## 3D primitives

| Component | Notes |
| --- | --- |
| `<InkStage view flat reducedMotion state description status? onMiss?>` | Canvas wrapper: paper ground, camera rig, orbit, overlay. Exposes `data-scene-state={state}`, `data-view` and `data-camera="moving"\|"still"` on `.sk-stage`. `status` is a handwritten, `aria-live` note top right. |
| `<AccountBlock name color? size? coins? note?>` | Rounded ink block with soft shadow and a name label. |
| `<ContractBlock name …>` | Block with a lid and a `{ code }` plate. |
| `<ShardSlab name length? depth?>` | Long slab; label at its left end. |
| `<ChainBlock name …>` | Three linked blocks: another blockchain. |
| `<Key name? rotation?>`, `<Coin>` | Gold objects with ink outlines. |
| `<Traveller to arc? duration? color? onArrive?>{children}</Traveller>` | Sits at `to`; when `to` changes it hops along an arc with a glow and trail, then calls `onArrive`. Instant under reduced motion. `onArrive` also fires on first placement, so a scene can open a gate from it safely. |
| `<Label position variant?>` | HTML label (Caveat; `small` caps; `hint` pill) that follows a 3D point. |
| `<Outline mode? threshold? width?>` | Child of a mesh: `edges` (hard edges) or `hull` (silhouette for curved shapes). |
| `<SoftShadow>`, `<Glow>`, `useInk(color, faceted?)`, `inkMaterial()` | Building blocks for new objects. |

**Picking.** Pass `onPick` (plus `selected`, `pickLabel`) to any block. A click is a pointer that moved
less than 6 px; a longer move is an orbit drag. Each pickable also gets an invisible, focusable HTML
button named `pickLabel` that sits on the object: keyboard and screen-reader users (and Playwright) pick
with it (`getByRole("button", { name: "Ben's account" }).press("Enter")`). It turns visible on focus.

**Camera.** Give `InkStage` one `CameraView` (`{ position, target }`) per step. The rig eases there
(jumps under reduced motion). `flat` looks straight down at the same target and turns off rotation.
Orbit has no pan and clamped distance/angle; once the learner drags, the rig lets go until the step
changes. Narrow screens pull the camera back automatically (`fitView`).

## SVG primitives

`SvgStage` (same `state`, `description`, `status`, `reducedMotion`, plus `note` and `viewBox`),
`SvgAccountBlock`, `SvgContractBlock`, `SvgShardSlab`, `SvgChainBlock`, `SvgKey`, `SvgCoin`,
`SvgTraveller`, `SvgLabel`, `SvgPickable`. Pickables are `role="button"` with the same names as in 3D,
so the same tests drive both.

## Building a lesson scene

Most lessons offer a 2D and a 3D view of one shared state (see `docs/lesson-template.md`, "Two views"). The 3D view uses the primitives above inside `<InkStage>`; the 2D view uses the SVG primitives. `SceneProps.view` says which to draw.


1. Put the scene's state in a small hook with no three.js (see `scene-kit-demo/demo.ts`), with pure
   helpers unit tested. Derive the end state of each step from `step`, so jumping to a step via the URL
   shows the right picture.
2. `Scene.tsx` renders `<InkStage>` with 3D primitives; `Fallback.tsx` renders `<SvgStage>` with the SVG
   ones. Both use the hook, the same `state` string and `<SceneAction>` for step buttons.
3. Manifest: `needsWebGL: true`, `scene: () => import("./Scene")`, `fallback: Fallback`.
4. E2E: assert on `[data-scene-state]`; pick with the labelled buttons; wait for
   `.sk-stage[data-camera="still"]` before clicking on canvas coordinates.

## Fallback and motion rules

- No WebGL (or `?webgl=0`): the lesson page shows the manifest `fallback` (SVG kit). Without one it shows
  the captions as text. The stage-bar captions and "Read as text" are the same in every mode.
- A scene that throws shows the fallback too (`SceneBoundary`).
- Reduced motion: no tweening anywhere. Camera, travellers and state jump to their end states; the
  hint pulse stops. The 3D scene still shows (it is static), and the text version stays available.
