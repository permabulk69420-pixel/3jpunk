# 3JPUNK

An expandable WebXR cyberpunk street prototype built for standalone Meta Quest 3.

The first slice is **Rain District 03**: one dense city block, four distinct building shells, wet-road reflections, procedural rain, street steam, skyline depth, a service skybridge, detailed storefronts and spatially correct smooth locomotion. The road, paving, masonry and shutter surfaces use project-owned, AI-generated source materials compressed into Quest-friendly WebP textures.

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

- `mori-pharmacy`
- `kuroda-works`
- `nami-eatery`
- `echo-capsules`

At runtime, a future building can be dropped into a slot with:

```js
await window.__3JPUNK__.replaceBuilding('mori-pharmacy', './models/mori.glb');
```

Replacement GLBs should use metre scale, +Y up, local -Z forward, positive identity scale and Three.js-compatible PBR materials. `restoreBuilding(slotId)` brings the procedural shell back.

## Deployment

Every push to `main` builds the Vite project and deploys `dist/` through GitHub Actions to GitHub Pages. A separate visual-QA workflow captures fixed street, bridge and alley views in real Chrome/WebGL and stores them as the `3jpunk-render-previews` workflow artifact. HTTPS is required for immersive WebXR outside local development.
