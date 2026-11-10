# Handoff: issue #22, Lesson 4.1 "One account, every chain" (WIP, paused)

Branch: `issue-22-lesson-4-1`. Paused on request to save budget. Roughly 65% done. Delete this file before the final commit.

## Done (files)

**Chain layer (everything through the Chain interface; no interface change needed)**
- `src/chain/chainSignatures.ts`: offline derivation (`deriveEvmAccount`: root key + sha3-256 tweak of `"near-mpc-recovery v0.1.0 epsilon derivation:" + account + "," + path`), `rootPublicKey(chain)` (a `viewCall` of `public_key`), `prepareEvmTransfer` (EIP-1559 Sepolia self-transfer, nonce 0, fixed fees, viem), `signRequestArgs`, `requestSignature(chain, payload, path)` (one `sign` call with 1 yocto and 30 Tgas through `callMethod`), `parseSignResponse` (`big_r.affine_point`, `s.scalar`, `recovery_id`), `finalizeEvmTransaction`, `recoverEvmSigner` (viem), and demo-only math helpers.
- `src/chain/chainSignatures.test.ts`: derivation matches the spike fixture (`testnet` + `ethereum-1` → `0x2F9e…1280`) and the contract's `derived_public_key` view (fetched 10 Nov 2026). Also tests the full demo round trip (the signature recovers to the derived address), the 1 yocto rule and timing of about 5 s. All green.
- `src/chain/demo/mpcSigner.ts`: DemoChain's stand-in for `v1.signer-prod.testnet`, with the views `public_key` and `derived_public_key` and `sign`. It uses a fixed demo root secret and answers 3 blocks later through `return_signature`.
- `src/chain/DemoChain.ts`, `src/chain/demo/contracts.ts`: new `delay` option on `ctx.functionCall` (models yield/resume). The signer is installed as a genesis account `v1.signer-prod.testnet`.
- `package.json`: `viem` pinned to `2.57.10` (released 22 Oct 2026).

**Scene kit (new objects, rows still to add to docs/scene-objects.md)**
- `src/scene-kit/objects.ts` (`signingNode`, `blockchain`, `signerNodeDims`, `ledgerDims`), `objects3d.tsx` (`SignerNode`, `Ledger`), `svg/objects.tsx` (`SvgSignerNode`, `SvgLedger`), exported from `index.ts`.

**Lesson** `src/content/lessons/l-4-1-one-account-every-chain/`
- `manifest.ts` (7 steps: hook, derive, prepare, sign, verify, check, honest take; vars `name`, `path`, `derivedEthAddress`, `signer`), `steps.ts`
- `useChainSig.ts`: the one shared state. It handles gates and setVars, and sends the evidence (`txHash`/`mpcTxHash`, `derivedEthAddress`, `path`, `signedTx`, `recoveredAddress`, `recoveredMatches`, `broadcast: "not sent…"`). It derives and packs automatically when a later step is opened from a link, and never signs for the learner. Every object can be picked.
- `signing.ts` (+test), `layout3d.ts` (+test), `tour.ts` (+test), `page.ts` (describe, parcel position, accent), `parts.tsx` (facts panel, path form), `Scene.tsx` (actions, Check, HonestTake), `Scene2D.tsx`, `Scene3D.tsx` (BookScene), `scene.css`
- `e2e/lessons/l-4-1-one-account-every-chain.spec.ts`: written, NOT yet passing (see below).

Gate status at pause: `tsc` clean, eslint clean (only 2 old warnings in CameraRig). The unit tests for the chain and the lesson pass. The full `npm test`, `npm run lint` (Prettier) and the full e2e suite were NOT run.

## Known failing / open

1. **e2e (last run: 7 passed, 11 failed)**:
   - The verify-step checks look for `{derivedEthAddress}` in the **caption**, but it is in the explain. Fix: put `{derivedEthAddress}` in step 5's caption (for example "…: does it point back to {derivedEthAddress}?"), or change the test.
   - "Objects are buttons" (2D): pressing the NEAR mailbox right after Next sometimes runs while the step is still HOOK. Wait for the step's caption before the press (it works when tried by hand).
   - 3D tests time out. **The 3D view is slow: about 92–100 ms per frame in headless swiftshader, against about 38 ms for lessons 2.1 and 0.1.** I was bisecting this (nodes and ledgers versus the rest) when I paused. Suspects: 8 `SignerNode`s × 4 `Part`s, each with drei `Edges` (fat lines); hull outlines; 3 `Ledger`s; Pickable overlays. Ideas: merge each node into fewer meshes, drop the Edges on the desk/share, lower the node count, remove the per-node `SoftShadow`. Also, in 3D the step caption updates only after the page turn (~0.5 s), so tests must wait for it.
2. 3D framing and the look are not yet checked by screenshot. In the one mid-turn shot, the objects looked small and the labels were not visible yet. Tune `FIGURE`, `WHOLE` (elevation) and the object sizes.
3. Not verified on a live network: the testnet `sign` response shape (taken from chainsig.js / spike, parsed by `parseSignResponse`), and whether `public_key` needs a `domain_id` argument on v1.signer 3.18. Only demo mode has been run.
4. The script's demo data says the derived address is `0x2F9e…1280` for `bon-practice.testnet`. In fact that address belongs to predecessor `testnet` (spike). Demo mode uses its own demo root key, so its address differs (the app says so in a demo note). Fix the script note.

## Acceptance boxes (issue #22)

- [~] An Ethereum address is derived from the practice account and shown: built, and works in 2D (manual and unit tests). The e2e is not green yet.
- [~] A Sepolia transaction is signed, or the fallback is shown clearly: signed through the Chain interface. The "not broadcast: 0 ETH" note is shown (`broadcast-note`). The e2e is not green yet.
- [~] The scene shows the request pausing until the signing network answers: `sign:waiting` state, timer, shares lighting up, and the parcel waiting in the ring. Has an e2e test; it passes in 2D, the 3D run timed out.
- [~] The completion record carries the evidence: implemented and asserted in the walk e2e (not green yet).
- [ ] An end-to-end test covers demo mode with recorded results: the spec is written; failures are listed above.

## Next steps for whoever resumes

1. Fix the 3D performance (see 1). Then check 3D screenshots at 1440×900, 1024×768 and 390×844 (2D and 3D, `bon:cover=off`) and tune the layout.
2. Fix the e2e problems (caption var, wait for the caption before picks). Run `E2E_PORT=4181 npx playwright test e2e/lessons/l-4-1-one-account-every-chain.spec.ts`, then the full suite.
3. Run `npm run lint` (Prettier may reformat), `npm test` and `npm run typecheck`.
4. Docs: add `SignerNode` and `Ledger` rows to `docs/scene-objects.md`, add the lesson to the list in `docs/book-scene.md`, fix the demo data note in `docs/lessons/stage-4/4.1.md`, and optionally add the new objects to the `scene-objects` gallery.
5. Tick the issue's boxes, add a `docs/progress.md` entry, commit with `Closes #22`, push and open a PR. Delete this HANDOFF.md first.
