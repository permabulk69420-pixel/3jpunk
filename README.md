# 3JPUNK

An expandable WebXR cyberpunk street prototype built for standalone Meta Quest 3.

The first slice is **Rain District 03**: one dense city block, four distinct building shells, wet-road reflections, procedural rain, street steam, skyline depth, a skybridge, neon storefronts and spatially correct smooth locomotion.

## Controls

| Mode | Control | Action |
| --- | --- | --- |
| Quest VR | Left stick | Head-relative smooth movement |
| Quest VR | Right stick | Smooth turning around the headset position |
| Desktop | WASD / arrows | Move |
| Desktop | Mouse | Look |
| Desktop | Q / E | Turn |
| Desktop | Shift | Move faster |
| Desktop | Escape | Release pointer lock |

The WebXR session requests `local-floor` with optional bounded-floor and hand-tracking support. The world uses metres, +Y up and -Z forward.

## Run locally

```bash
npm install
npm run dev
```

Production check:

```bash
npm run check
npm run build
```

## Building replacement path

Each procedural building is a named, replaceable slot with a `GLB_ANCHOR__<slot-id>` node. The current slots are:

- `kiba-exchange`
- `vanta-clinic`
- `parallax-arcade`
- `synko-hotel`

At runtime, a future building can be dropped into a slot with:

```js
await window.__3JPUNK__.replaceBuilding('kiba-exchange', './models/kiba.glb');
```

Replacement GLBs should use metre scale, +Y up, local -Z forward, positive identity scale and Three.js-compatible PBR materials. `restoreBuilding(slotId)` brings the procedural shell back.

## Deployment

Every push to `main` builds the Vite project and deploys `dist/` through GitHub Actions to GitHub Pages. HTTPS is required for immersive WebXR outside local development.
