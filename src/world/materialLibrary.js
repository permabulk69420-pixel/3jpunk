import * as THREE from 'three';

const TEXTURES = {
  asphalt: {
    color: new URL('../assets/materials/asphalt-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/asphalt-height.webp', import.meta.url).href,
  },
  concrete: {
    color: new URL('../assets/materials/facade-concrete-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/facade-concrete-height.webp', import.meta.url).href,
  },
  brick: {
    color: new URL('../assets/materials/dark-brick-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/dark-brick-height.webp', import.meta.url).href,
  },
  shutter: {
    color: new URL('../assets/materials/rolling-shutter-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/rolling-shutter-height.webp', import.meta.url).href,
  },
  sidewalk: {
    color: new URL('../assets/materials/sidewalk-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/sidewalk-height.webp', import.meta.url).href,
  },
};

function loadTexture(loader, renderer, url, repeat, colorTexture = false) {
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function surfacePair(loader, renderer, key, repeat) {
  return {
    map: loadTexture(loader, renderer, TEXTURES[key].color, repeat, true),
    bumpMap: loadTexture(loader, renderer, TEXTURES[key].height, repeat, false),
  };
}

export function createMaterialLibrary(renderer) {
  const loader = new THREE.TextureLoader();
  const asphalt = surfacePair(loader, renderer, 'asphalt', [2.2, 17]);
  const sidewalk = surfacePair(loader, renderer, 'sidewalk', [1.5, 19]);
  const concrete = surfacePair(loader, renderer, 'concrete', [2.2, 5.4]);
  const brick = surfacePair(loader, renderer, 'brick', [2.7, 5.2]);
  const shutter = surfacePair(loader, renderer, 'shutter', [1.2, 1.4]);

  const materials = {
    road: new THREE.MeshPhysicalMaterial({
      ...asphalt,
      color: 0x72777b,
      bumpScale: 0.075,
      roughness: 0.31,
      metalness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.55,
    }),
    sidewalk: new THREE.MeshPhysicalMaterial({
      ...sidewalk,
      color: 0x767976,
      bumpScale: 0.085,
      roughness: 0.48,
      metalness: 0.03,
      clearcoat: 0.52,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.15,
    }),
    concrete: new THREE.MeshStandardMaterial({
      ...concrete,
      color: 0x8d918b,
      bumpScale: 0.15,
      roughness: 0.68,
      metalness: 0.03,
    }),
    concreteDark: new THREE.MeshStandardMaterial({
      ...concrete,
      color: 0x555b58,
      bumpScale: 0.13,
      roughness: 0.73,
      metalness: 0.04,
    }),
    brick: new THREE.MeshStandardMaterial({
      ...brick,
      color: 0x77716c,
      bumpScale: 0.18,
      roughness: 0.72,
      metalness: 0.02,
    }),
    shutter: new THREE.MeshStandardMaterial({
      ...shutter,
      color: 0x80878d,
      bumpScale: 0.16,
      roughness: 0.4,
      metalness: 0.64,
      envMapIntensity: 1.2,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x222a2d,
      roughness: 0.35,
      metalness: 0.82,
      envMapIntensity: 1.25,
    }),
    blackMetal: new THREE.MeshStandardMaterial({
      color: 0x080b0d,
      roughness: 0.3,
      metalness: 0.9,
      envMapIntensity: 1.4,
    }),
    paintedMetal: new THREE.MeshStandardMaterial({
      color: 0x394549,
      roughness: 0.48,
      metalness: 0.61,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0x665044,
      roughness: 0.42,
      metalness: 0.7,
    }),
    curb: new THREE.MeshStandardMaterial({
      color: 0x5b615f,
      roughness: 0.5,
      metalness: 0.05,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x182729,
      roughness: 0.13,
      metalness: 0.12,
      transmission: 0.2,
      thickness: 0.08,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.8,
    }),
    darkGlass: new THREE.MeshPhysicalMaterial({
      color: 0x071013,
      roughness: 0.2,
      metalness: 0.38,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.4,
    }),
    warmWindow: new THREE.MeshStandardMaterial({
      color: 0x3f2f24,
      emissive: 0xffb266,
      emissiveIntensity: 1.65,
      roughness: 0.28,
      metalness: 0.05,
    }),
    coolWindow: new THREE.MeshStandardMaterial({
      color: 0x17272a,
      emissive: 0x8dc5bd,
      emissiveIntensity: 0.62,
      roughness: 0.25,
      metalness: 0.08,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x090a0a, roughness: 0.76, metalness: 0.05 }),
  };

  Object.values(materials).forEach((material) => {
    material.name = `3JPUNK_${material.type}`;
  });
  return materials;
}
