# Plan: #1 Walking skeleton on the live URL

Status: draft, written 31 Oct 2026, before the build window opens. No code until 1 Nov 2026 00:00 UTC.
Issue: https://github.com/dispaz/book-of-near/issues/1

## Goal

A learner opens the deployed site and walks through one placeholder lesson with the stage bar (menu, back, play, caption, dots, next), in demo mode. Lessons and stages come from manifests. The repo has install, dev, typecheck, lint, unit-test and e2e commands, a Claude Code hook that runs typecheck and lint after edits, and a git hook that blocks commits with key or token patterns. The site is on Cloudflare Pages from the first working version.

Out of scope for #1 (taken by later issues): the `Chain` interface and DemoChain (#2), 3D scene kit (#3), quiz, routes, progress and table of contents (#5), lesson template and scaffolding command (#6), Worker endpoints (#7 and later).

## Stack (recommended)

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript, `strict` | One typecheck command; manifests are typed. |
| Build and dev | Vite | Fast dev server; `import.meta.glob` gives manifest discovery with no manual registry; code splitting for the 3D kit later (#3 needs "no 3D code until a scene opens"). |
| UI | React + React Router | Agents know it well, which cuts ramp-up on every later ticket. A route per lesson, as in the spec. |
| Unit tests | Vitest | Same config as Vite. |
| E2E | Playwright (Chromium only at first) | Primary seam per the spec. Add WebKit and Firefox in #32. |
| Lint and format | ESLint flat config + typescript-eslint, Prettier | |
| Package manager | npm | Nothing extra to install, which suits AI reviewers running the README. |
| Node | 22 LTS, pinned in `.nvmrc` and `engines` | |
| Fonts | `@fontsource` packages for Newsreader, Caveat, DM Sans | The prototype loads Google Fonts. Demo mode must work with no network, so fonts are bundled. |
| Hosting | Cloudflare Pages, deployed with `wrangler pages deploy dist` | Pages serves `index.html` for unknown paths when there is no `404.html`, so client routes work. |

Exact package versions are picked on 1 Nov from the current releases and written down in `docs/progress.md`.

Decided 31 Oct: React. Local deploys only. Separate Worker in `worker/` with its own `wrangler.toml` (built in #7). Cloudflare is not set up yet (see Deploy).

## Repository layout

```
package.json            scripts below
index.html
vite.config.ts
playwright.config.ts
src/
  main.tsx              router built from the registry
  app/
    registry.ts         discovers stages and lessons from manifests
    types.ts            StageManifest, LessonManifest, Step
    mode.ts             demo or testnet; demo by default (only demo works in #1)
  ui/
    StageBar.tsx        menu, back, play, caption, dots, next
    LessonPage.tsx      title, scene area, stage bar, text fallback
    Menu.tsx            stage list with lessons, grouped by stage
    ink.css             tokens taken from the prototype
  content/
    stages/
      0-blank-page/stage.ts
    lessons/
      placeholder-hello/
        manifest.ts
        Scene.tsx       2D SVG; reads the current step
e2e/
  skeleton.spec.ts
scripts/
  check-secrets.mjs     secret scanner used by the git hook
  check-secrets.test.ts
.githooks/pre-commit    runs check-secrets on staged files
.claude/settings.json   PostToolUse hook: typecheck + lint after edits
.env.example
.nvmrc
```

## Manifests and discovery

Lesson manifest (`src/content/lessons/<slug>/manifest.ts`):

```ts
export default {
  id: "placeholder-hello",        // also the route: /lesson/placeholder-hello
  stage: 0,
  order: 1,                        // position inside the stage
  title: "Hello, ledger",
  status: "ready",                 // ready | card | planned
  needsChain: false,
  steps: [
    { caption: "A ledger is a list of who owns what." },
    { caption: "Each new line is added to the end. Old lines stay." },
    { caption: "That is all a blockchain is, at heart. Next lessons show why it is hard to cheat." },
  ],
  scene: () => import("./Scene"),  // lazy, so later 3D scenes stay out of the first load
} satisfies LessonManifest;
```

Stage manifest (`src/content/stages/<n>-<slug>/stage.ts`): `{ id: 0, name: "Blank Page", title: "Crypto foundations", accent: "#ff8a3d" }`. Names and titles come from `docs/curriculum/topics.json`. Ids 5 and 6 stay reserved and are not created.

`registry.ts` calls `import.meta.glob("../content/**/manifest.ts", { eager: true })` and `.../stage.ts`, then passes the modules to a pure function `buildRegistry(stageModules, lessonModules)`. That function:
- sorts stages by id and lessons by `(stage, order)`,
- rejects duplicate lesson ids and lessons pointing at an unknown stage, throwing a clear error,
- returns the menu tree and a route table.

Because `buildRegistry` is pure, unit tests feed it fake modules. The acceptance check "a second folder appears with no other edit" is covered twice: in a unit test with fake modules, and for real with a second placeholder lesson that the e2e test finds in the menu.

## Scene contract (ready for 3D interactive lessons)

The skeleton's placeholder scene is 2D SVG, but the contract it uses is the one the 3D lessons (shards, chain signatures, the #3 scene kit) plug into. Getting it right now avoids reworking the lesson page later.

```ts
type SceneProps = {
  step: number;                       // current step, driven by the stage bar
  goTo: (step: number) => void;       // a scene may move the lesson on (e.g. after the learner clicks a shard)
  setGate: (open: boolean) => void;   // a scene can hold Next and Play until the learner does the step's action
  reducedMotion: boolean;             // scenes jump to end states instead of animating
  flat: boolean;                      // flat top-down camera mode (3D scenes only)
  mode: "demo" | "testnet";
};
```

- Steps can declare `action: { label: "Send", gate: true }`. The lesson page shows the action as an overlay button, and Next stays disabled until the scene opens the gate. This is what "something to do" in the lesson template relies on.
- `scene` in the manifest is always a lazy `import()`. A 3D scene's module pulls in Three.js; the first page load never does. The e2e test checks that no chunk containing Three.js loads on the menu or on the placeholder lesson.
- The lesson page wraps every scene in an error boundary plus a WebGL check. When WebGL is missing or the scene throws, it shows the SVG/text fallback with the same captions. The manifest can name a `fallback` component; the default is the captions list.
- The canvas area is `touch-action: none`, and orbit dragging is kept apart from clicks (a click is a pointer move under 6 px, as in the prototype), so picking works on phones.
- Testing 3D: scenes expose their clickable objects as invisible, labelled HTML buttons (or overlay buttons) so Playwright and screen readers can drive them without pixel clicking. Each scene also reports its state on a `data-scene-state` attribute for assertions.
- Recommended for #3: React Three Fiber with drei, with the prototype's ink shader and edge outlines ported over. The final choice belongs to #3; #1 only fixes the props above.

## Stage bar behaviour

Copied from `docs/prototype/ink-stage.html`, rebuilt as a React component:
- **Menu** toggles a panel listing stages and their lessons; the current lesson is bold.
- **Back** and **Next** move one step; Back is disabled on step 1, Next is disabled on the last step.
- **Play** auto-advances every ~2.2 s and becomes **Pause**; it stops on the last step. Under `prefers-reduced-motion` it still advances but scenes skip their animations.
- **Caption** is an `aria-live="polite"` region showing the current step's caption.
- **Dots** show one dot per step; clicking one jumps to it. Hidden under 560 px wide, as in the prototype.
- The current step is kept in the URL (`?step=2`) so refresh and deep links work.
- Keyboard: Left and Right arrows for back and next, Space for play. Every button has an `aria-label` and a visible focus ring.

Ink style: pale paper background, `--ink: #16141f` outlines, floating pill-shaped bar with a glassy background and 1.5 px ink border, Newsreader for captions and DM Sans for UI. Each stage sets one accent colour from its manifest.

Fallback: the placeholder scene is SVG, so it needs no WebGL. Every lesson page also renders all captions as an ordered list in a `<details>` "Read as text" block, which is the text fallback later scenes reuse.

## Commands (go into CLAUDE.md "Commands")

| Command | Does |
| --- | --- |
| `npm install` | Installs; `prepare` sets `git config core.hooksPath .githooks`. |
| `npm run dev` | Vite dev server, demo mode. |
| `npm run build` | Typecheck then production build to `dist/`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint + Prettier check. |
| `npm test` | Vitest unit tests. |
| `npm run e2e` | Playwright against a built preview (`vite preview`), installs Chromium on first run. |
| `npm run deploy` | `npm run build && wrangler pages deploy dist --project-name book-of-near`. |

"One command installs and runs the app" is `npm install && npm run dev`. The README can wrap it as `npm run start` if preferred.

## Hooks

**Claude Code hook** (`.claude/settings.json`, checked in): a `PostToolUse` hook on `Edit|Write` that runs `npm run typecheck && npm run lint` and prints failures back to the agent. Keep it quiet when both pass. If it gets slow, narrow lint to the changed file.

**Secret-blocking git hook** (`.githooks/pre-commit` → `node scripts/check-secrets.mjs --staged`): scans the staged diff (added lines only) and fails with the file and line on a match. Patterns:
- NEAR private keys: `ed25519:` or `secp256k1:` followed by 64+ base58 characters
- PEM blocks: `-----BEGIN [A-Z ]*PRIVATE KEY-----`
- 12 or 24 lowercase words that look like a BIP-39 seed phrase on a line with `seed`, `mnemonic` or `phrase`
- Generic tokens: `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{36}`, Cloudflare API tokens assigned to names like `CLOUDFLARE_API_TOKEN=`
- Any `.dev.vars` or `.env` file (not `.env.example`) being staged

An allowlist comment `secret-scan:allow` on the line skips it, for fixtures that must contain fake keys. `check-secrets.test.ts` checks each pattern with fake values and checks that clean diffs pass. The acceptance check "rejects a test commit containing a fake key" is also run by hand in a throwaway clone and recorded in the progress entry.

No dependency on gitleaks or another binary, so `npm install` is enough.

`.gitignore` gets `node_modules`, `dist`, `.dev.vars`, `.env`, `.env.*` with `!.env.example`, `test-results`, `playwright-report`, `.wrangler`.

## TDD order

Each step is red, then green, then refactor.

1. **E2E smoke (red first):** open `/`, see the menu with stage 0 and "Hello, ledger"; open it; caption 1 shows; Back disabled; Next shows caption 2; clicking dot 3 shows caption 3 and disables Next; Play advances on its own (use Playwright's clock to skip waiting).
2. **Registry unit tests:** sorting, two lessons in a stage, unknown stage error, duplicate id error.
3. **Second placeholder lesson:** add `placeholder-blocks` and extend the e2e test to find it in the menu, with no edit outside its folder.
4. **Reduced motion:** e2e with `reducedMotion: "reduce"` checks Play still works and the text fallback is present.
5. **URL step:** load `/lesson/placeholder-hello?step=2` and see caption 2.
6. **Scene contract:** the second placeholder lesson has a gated step with an action button ("Add a line"). E2E checks Next is disabled until the button is clicked. A forced scene error shows the text fallback. No Three.js chunk loads on these pages.
7. **Secret scanner unit tests,** then the hook wiring.
8. **Deploy,** then a Playwright smoke run against the live URL (`BASE_URL=https://... npm run e2e -- --grep @smoke`).

## Deploy

Cloudflare is not set up yet, so the live-URL acceptance box waits on these human steps:
1. Create a free Cloudflare account.
2. Run `npx wrangler login` in the repo (browser sign-in; the agent can't do it).
3. Create the Pages project once: `npx wrangler pages project create book-of-near --production-branch main`.

Then `npm run deploy` (local, decided) publishes `dist/`. The live URL goes in the README and CLAUDE.md. Everything else in #1 can be built and tested locally before this, so the account only blocks the last box.

## Definition of done for #1

- [ ] The live URL shows the placeholder lesson with a working stage bar and a caption per step
- [ ] Adding a second lesson folder makes it appear in the menu with no other edit (unit test + real second lesson + e2e)
- [ ] `npm install && npm run dev` runs the app; `npm run e2e` passes the smoke test
- [ ] The pre-commit hook rejects a fake key (unit tests + manual run recorded)
- [ ] The look matches the prototype: pale paper, ink outlines, floating bottom bar
- [ ] CLAUDE.md "Commands" section filled in; `.env.example` exists; progress entry appended

## Decisions (31 Oct 2026)

1. **Framework:** React.
2. **Cloudflare:** not ready; the owner sets it up (see Deploy). `book-of-near` is the intended project name.
3. **Deploys:** local `npm run deploy` only.
4. **Worker:** separate `worker/` folder with its own `wrangler.toml`, built from #7.
5. **3D interactive lessons:** the scene contract above is part of #1, so the 3D lessons fit without changing the lesson page.
