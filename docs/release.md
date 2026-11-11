# Releasing

Merge (or push) to the `release` branch. `.github/workflows/release.yml` then:

1. **Checks:** `npm ci`, lint, typecheck, unit tests, Worker typecheck and tests, and Playwright e2e against a production build in demo mode. If any of these fail, nothing is deployed.
2. **Version:** `scripts/release-version.mjs` picks the next `vX.Y.Z` (rules below).
3. **Build and deploy:** builds with `VITE_APP_VERSION` set, writes `dist/version.json` (`version`, `commit`, `builtAt`), and deploys `dist/` to the Cloudflare Pages project `book-of-near` as production (`--branch main`, the project's production branch, so no dashboard change is needed).
4. **Worker** (optional): runs `wrangler deploy --tag vX.Y.Z` in `worker/` when the repo variable `DEPLOY_WORKER` is `true`.
5. **Smoke test:** runs `playwright test --grep @smoke` against the live deploy URL and fetches `/version.json`.
6. **Tag and release:** pushes the git tag `vX.Y.Z` and creates a GitHub Release with generated notes.

Releases run one at a time. You can also start one by hand: Actions → Release → Run workflow.

**How to release:** fast-forward `release` to `main` and push: `git push origin main:release` (or open a PR from `main` into `release` and merge it). Creating the `release` branch for the first time is itself a push, so it runs the first release.

**If a step fails:** checks failing means nothing is deployed. If the deploy succeeds but the smoke test fails, the new build is already live in production but has no tag or GitHub Release; fix forward and push to `release` again (or redeploy the last tag with Actions → Deploy → Run workflow).

## Versioning

- `MAJOR.MINOR` come from `version` in the root `package.json`.
- `PATCH` is one more than the highest existing `vMAJOR.MINOR.*` tag, and never lower than the patch in `package.json`.
- So each release bumps the patch on its own (`v0.1.0`, `v0.1.1`, …). For a new minor or major, change `package.json` (for example to `0.2.0`) in the PR you merge to `release`. Its first release is `v0.2.0`.
- Nothing is committed back to the branch. The tag is created only after the deploy and smoke test pass.
- To see which build is live, check `https://<site>/version.json`. App code can read the version from `import.meta.env.VITE_APP_VERSION`.

## One-time setup (owner)

1. The Pages project `book-of-near` keeps `main` as its production branch (`npx wrangler pages project create book-of-near --production-branch main` if it does not exist). The workflow deploys with `--branch main`, so a release is the production deploy.
2. Create a Cloudflare API token with **Account → Cloudflare Pages → Edit**. Add **Workers Scripts → Edit** if you also deploy the Worker.
3. In GitHub → Settings → Secrets and variables → Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - Variables (optional): `VITE_CHAIN_MODE` (default `demo`), `VITE_WORKER_URL`, `VITE_RETURN_ACCOUNT_ID`, `DEPLOY_WORKER=true` (only once `worker/wrangler.toml` has a real KV namespace id and the Worker secrets are set, see `worker/README.md`).
4. Create the branch: `git push origin main:release`.
5. Optional: protect `release` (Settings → Branches) so it only changes through PRs from `main`.

## Other deploy paths

- `.github/workflows/deploy.yml` still deploys when a GitHub Release is published by hand, or from Actions → Deploy → Run workflow with any ref. The Release workflow creates its GitHub Release with `GITHUB_TOKEN`, which does not trigger other workflows, so a normal release deploys once.
- CI has no GPU, so the e2e job runs the full suite, 3D included, in software WebGL (SwiftShader) with 2 workers (45 min step limit, 60 min job). That works because 3D scenes render on demand (#44): an idle scene draws nothing, so only real motion costs CPU. Before #44 every 3D test timed out on CI and the job ran with `E2E_NO_3D=1` (WebGL off, 3D tests left out); that mode stays in `playwright.config.ts` as an opt-in fallback, and the smoke test against the live URL still uses it. Reproduce a CI run on a Mac with `E2E_GL=swiftshader E2E_WORKERS=2 npm run e2e`.
