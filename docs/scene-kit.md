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
| `<InkStage view flat reducedMotion state description status? onMiss? backdrop? page?>` | Canvas wrapper: paper ground (or `backdrop`, e.g. a `BookBackdrop`), camera rig, orbit, overlay. Exposes `data-scene-state={state}`, `data-view`, `data-camera="moving"\|"still"` and, during the pop-up, `data-pop="turn"\|"rise"\|"fill"` on `.sk-stage`. `status` is a handwritten, `aria-live` note top right. A new `page` (e.g. the step) turns the page and pops the figure up again. |
| `<BookScene …>`, `useFreeFrame`, `useTour`, `<TourControls>` | **The standard 3D lesson view** (`docs/book-scene.md`): `InkStage` on an open book with the step printed on the left page, a page turn per step and a camera tour. Build new 3D views with this, not bare `InkStage`. |
| `<BookBackdrop spread heads? folios? caption?>` | An open pop-up book on a table, in a blurred cosy room (`Room.tsx`: painted, pre-blurred walls, floor and ceiling sized by the pure `roomFor` in `roomLayout.ts`), for the scene to stand on (pages at y = 0). Size it with `spreadFor` (spine at x = 0) or `spreadBeside` (figure on the right page, left page free for print). Objects cast hatched ink shadows; a page curls over when `InkStage`'s `page` changes. |
| `<PrintOnPage block el place onInView>` | Prints an HTML element on the left page (`textBlock(spread)`), following it in perspective; reports when the block leaves the screen so the caller can lay the words out normally again. Used with the app's `SpreadContext`. |
| `<AccountBlock name color? size? coins? note?>` | Rounded ink block with soft shadow and a name label. |
| `<ContractBlock name …>` | Block with a lid and a `{ code }` plate. |
| `<ShardSlab name length? depth?>` | Long slab; label at its left end. |
| `<ChainBlock name …>` | Three linked blocks: another blockchain. |
| `<Key name? rotation?>`, `<Coin color?>` | Ink-outlined objects: a gold key; a NEAR coin (NEAR green, NEAR mark on both faces, `nearMark.ts`). |
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

**Pop-up book.** `pop.ts` is the timeline (fold flat → page turns → outlines rise → hatching fills in),
`PopUp.tsx` drives it. The fill is the `REVEAL` uniform shared by all ink materials; each stage writes it
every frame before it renders, so stages never see each other's value. No turn or pop-up under reduced
motion. A scene can add controls to the stage bar (e.g. lesson 0.1's tour play button) through `BarSlot`.

**Colours.** Objects follow the ink rule: paper white, black outlines, the stage accent for meaning.
The book backdrop is the exception: its gold cloth cover, navy ribbon, sage felt mat, ash table and warm
window light are the setting, not part of the drawing, and stay the same on every stage. Print on the
page uses the stage accent darkened with ink.

## Scene objects

One shape per concept (account = mailbox, transaction = parcel with a stamp, contract = scroll, function-call
key = key with a tag, app = screen), each with a `state` and a 2D twin: see `docs/scene-objects.md`. New
lessons use these, not the blocks above; the blocks stay until stage 0 moves over.

## SVG primitives

`SvgStage` (same `state`, `description`, `status`, `reducedMotion`, plus `note` and `viewBox`),
`SvgAccountBlock`, `SvgContractBlock`, `SvgShardSlab`, `SvgChainBlock`, `SvgKey`, `SvgCoin`,
`SvgTraveller`, `SvgLabel`, `SvgPickable`. Pickables are `role="button"` with the same names as in 3D,
so the same tests drive both.

## Building a lesson scene

Most lessons offer a 2D and a 3D view of one shared state (see `docs/lesson-template.md`, "Two views"). The 3D view is a book scene: the primitives above inside `<BookScene>` (see `docs/book-scene.md`; `npm run new-lesson -- … --book` scaffolds one). The 2D view uses the SVG primitives. `SceneProps.view` says which to draw.


1. Put the scene's state in a small hook with no three.js (see `scene-kit-demo/demo.ts`), with pure
   helpers unit tested. Derive the end state of each step from `step`, so jumping to a step via the URL
   shows the right picture.
2. `Scene.tsx` holds the hook and the step actions (`<SceneAction>`, Check, Honest take) and draws
   `view === "3d" ? <Scene3D …/> : <Scene2D …/>`. `Scene3D` is lazy (`React.lazy(() => import("./Scene3D"))`)
   and renders a `<BookScene>` with 3D primitives; the 2D view uses the SVG primitives. Both use the same
   `state` string.
3. Manifest: `views: ["2d", "3d"]`, `scene: () => import("./Scene")`. (The kit demo is the older
   3D-first shape: `needsWebGL: true` plus a `fallback` component.)
4. E2E: assert on `[data-scene-state]`; pick with the labelled buttons; wait for
   `.sk-stage[data-camera="still"]` before clicking on canvas coordinates.

## Fallback and motion rules

- No WebGL (or `?webgl=0`): the lesson page shows the manifest `fallback` (SVG kit). Without one it shows
  the captions as text. The stage-bar captions and "Read as text" are the same in every mode.
- A scene that throws shows the fallback too (`SceneBoundary`).
- Reduced motion: no tweening anywhere. Camera, travellers and state jump to their end states; the
  hint pulse stops. The 3D scene still shows (it is static), and the text version stays available.
