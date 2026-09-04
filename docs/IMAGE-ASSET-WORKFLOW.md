# Image-to-game asset workflow

This project gets its strongest visual results by splitting the work cleanly:

- The image model authors dense surface detail, weathering and graphic design.
- Three.js supplies real scale, silhouette, depth, lighting, collisions and motion.
- The Quest build displays a small number of compressed atlases on simple modular geometry.

The important shift is to ask for a **game-ready surface**, not a picture of a cyberpunk scene. A cinematic street image contains perspective, lighting and objects that cannot be mapped cleanly. A flat orthographic elevation gives the renderer useful material information.

## Facade pipeline

1. Choose a building identity before generating anything: apartments, repair works, tenement, capsule hotel, clinic, utility plant, and so on.
2. Ask for one flat, orthographic front elevation at a wide 2:1 aspect ratio.
3. Make the large-scale construction different, not just the color. Specify bay sizes, service spines, window rhythm, panel system, repairs and weathering.
4. Keep ordinary surfaces non-emissive. Allow only tiny practical indicators unless the asset is explicitly a screen or sign.
5. Reject perspective, side walls, sky, ground, people, vehicles, readable branding and large empty black areas.
6. Downscale the accepted source to `1024x512`, convert it to WebP and ship only that optimized copy.
7. Use the atlas as sRGB albedo on a normal `MeshStandardMaterial`. Geometry still provides ledges, ribs, balconies, pipes, signs and the roof silhouette.
8. Capture the fixed Quest-profile street, bridge and alley views. Adjust the asset from rendered evidence rather than from the source image alone.

### Prompt template

```text
Create a production texture atlas for a [BUILDING TYPE] exterior for a
standalone Meta Quest 3 game.

Format and camera:
- perfectly flat orthographic FRONT ELEVATION
- no perspective, side walls, ground or sky
- wide 2:1 composition
- one continuous facade filling the frame edge-to-edge
- intended to map directly onto a rectangular vertical plane

Construction identity:
- [PRIMARY STRUCTURAL SYSTEM]
- [WINDOW OR MODULE RHYTHM]
- [ONE LARGE ASYMMETRIC FEATURE]
- [TWO OR THREE SERVICE DETAILS]
- physically believable rain streaks, repairs, grime and material wear

Lighting:
- overcast nighttime diffuse illumination only
- enough albedo visibility to survive downscaling
- ordinary surfaces and windows must not glow

Exclude:
- words, logos, people, vehicles, street, signs, perspective, bloom
- bright emissive windows and large featureless dark regions
```

The words “orthographic,” “front elevation,” “edge-to-edge,” and “map directly onto a plane” do most of the technical work. The construction-identity section prevents every result from becoming the same generic tower with a different tint.

## Prop front-panel pipeline

Small street props use the same division of labour at a different scale. The image model supplies dense front-face information that would be wasteful to model individually: product packets, latches, vents, seals, fingerprints, taped repairs and printed control graphics. Shared boxes, rails, caps and feet provide the actual silhouette and parallax.

1. Generate a single straight-on, orthographic front face at the prop's real aspect ratio. Explicitly exclude side surfaces, floor, scene lighting, perspective and cast shadows.
2. Describe the construction in functional terms. A vending machine needs product bays, selection controls, payment hardware and a dispensing hatch; a service cabinet needs a door, hinges, grille, latch and conduit ports.
3. State that ordinary metal, glass, plastic, paper and products must not glow. Baked bloom in an albedo texture makes the entire prop look self-illuminated under every lighting condition.
4. Downscale tall prop panels to `512x1024` and service panels to `512x640`. Use one panel material on repeated geometry rather than creating a material per placed object.
5. Add any true light as separate tiny geometry. The current machines have one physical status LED; their generated face textures remain normal `MeshStandardMaterial` albedo.
6. Put the textured plane a few millimetres in front of the backing shell and let real casing rails cover its edges. This hides the flat-card silhouette at close VR range.

For paper graphics, one image-generation call can produce a clean 2x2 contact sheet with hard gutters. Crop the accepted quadrants into shared `384x512` WebP posters. This produces four materially different designs while avoiding per-building runtime canvas textures.

### Prop prompt pattern

```text
Create a production-ready [PROP] FRONT PANEL for a game.

- straight-on orthographic elevation, [ASPECT] portrait proportions
- rectangular face fills the canvas; zero perspective and no side surfaces
- believable functional components: [COMPONENT LIST]
- grounded wear: rain grime, seals, screws, scratches and repaired paint
- neutral frontal light with minimal baked highlights
- ordinary materials must not glow
- no scene, floor, cast shadow, people, logos or readable text
```

Naming the output a “front panel” is useful: it encourages edge-to-edge surface information instead of a product shot floating in empty space.

## Conversion

The raw generation is kept outside the deployed project. A typical conversion is:

```bash
convert source.png \
  -resize 1024x512! \
  -strip \
  -quality 78 \
  src/assets/materials/facade-name.webp
```

If a source is well designed but materially too dark in the actual ACES-lit scene, lift it once during conversion rather than compensating with emissive material values:

```bash
convert source.png \
  -resize 1024x512! \
  -gamma 1.35 \
  -strip \
  -quality 80 \
  src/assets/materials/facade-name.webp
```

Do not apply gamma automatically. Compare rendered frames first; excessive lifting destroys material range and makes concrete look self-lit.

## Runtime material rules

- Albedo textures use `THREE.SRGBColorSpace`.
- Height, roughness, normal and mask data use `THREE.NoColorSpace`.
- Quest anisotropy is capped at 4; desktop is capped at 8.
- Facades use `MeshStandardMaterial`, generally with roughness `0.58-0.72` and low metalness.
- A wall atlas is never made emissive to brighten a dark scene. Fix the atlas exposure or environmental lighting instead.
- Actual screens and signs may use the same image as `map` and `emissiveMap`, with restrained emissive intensity and no extra point light.
- Generated facade detail is backed by a small amount of real profile-specific geometry so silhouettes, parallax and shadows remain convincing in VR.

WebP file size is not GPU memory size. A `1024x512` RGBA atlas occupies roughly 2 MiB before mipmaps and roughly 2.7 MiB with a full mip chain. Four distinct facade atlases are therefore a deliberate visual-memory trade, even if each file is only 60-110 KiB on disk.

## Wet-road flow

The road avoids separate black oval puddle meshes. Its existing grayscale asphalt data is reused as both subtle bump information and a roughness map:

- lighter aggregate stays rough;
- darker organic patches become smoother and pick up the generated environment map;
- one road surface replaces dozens of puddle objects;
- a single instanced, near-neutral ripple system supplies motion near the player.

A sparse image-generated reflection atlas contributes only the broken cyan, amber and dusty-magenta pixels. It is sampled as a restrained `emissiveMap` by the existing opaque road material, so it adds no road overlay, geometry or dynamic light. The black majority of the atlas contributes nothing. This gives authored sign reflections without screen-space reflections, planar-reflection render passes or transparent full-road overlays; those alternatives are substantially more expensive on standalone Quest.

## Screen artwork

Screens are generated differently from wall atlases. Ask for a complete 16:9 graphic with a dark background, a single readable focal image, restrained highlights and no mock physical frame. The physical frame and brackets belong in geometry. In this project the Wardwatch eye artwork is used by one ordinary textured/emissive plane; it does not cast light onto nearby normal surfaces.

## Visual QA loop

Every pushed revision runs `.github/workflows/render-preview.yml`, which:

1. builds the production Vite target;
2. launches Chrome with the Quest 3/Oculus user agent;
3. uses SwiftShader WebGL to capture deterministic `street`, `bridge` and `alley` views;
4. uploads the full-resolution PNGs as `3jpunk-render-previews`.

The screenshots are not a headset frame-rate benchmark, but they catch bad UVs, black textures, over-bright emission, repeated architecture, occlusion and composition before a headset test. Headset testing remains the authority for stereo scale, comfort and performance.

## Current atlas roles

| Slot | Atlas identity | Geometry identity |
| --- | --- | --- |
| `mori-pharmacy` | mixed-use concrete apartments | balconies, conventional tank, compact roof house |
| `nami-eatery` | weathered industrial tenement | fire escape, horizontal roof vessels, drying frames |
| `kuroda-works` | brick-and-steel repair works | heavy ribs, exhaust stacks, sawtooth plant roof |
| `echo-capsules` | pale modular capsule hotel | module rails, stepped mechanical crown, antenna array |
