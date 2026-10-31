# 03: 3D scene kit v1

**What to build:** A shared kit for interactive scenes in the ink-outline style. It provides blocks for accounts, contracts, shards and chains, keys, coins and a transaction object that travels between them. Learners can click objects (picking), orbit the camera, and drive steps with button overlays such as send, sign, approve and rewind. A camera rig moves to a preset view per step. Each scene has a flat top-down mode, an SVG and text fallback when WebGL is unavailable, and respects reduced-motion settings. The 3D code loads on demand. A demo scene shows an account block, a coin travelling to another account block, and a clickable button.

**Blocked by:** 01 (Walking skeleton on the live URL)

**Status:** ready-for-agent

**Priority:** P0

- [ ] The demo scene runs on the live URL with click picking, orbit and a button that moves a coin
- [ ] Turning off WebGL or enabling reduced motion shows the fallback with the same captions
- [ ] Switching to the flat camera mode works from a control
- [ ] A test for the demo scene passes in demo mode
- [ ] The initial page does not download the 3D code until a scene opens
