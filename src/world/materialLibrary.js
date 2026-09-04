import * as THREE from 'three';

const TEXTURES = {
  facadeMixed: {
    color: new URL('../assets/materials/facade-mixed-use.webp', import.meta.url).href,
  },
  facadeIndustrial: {
    color: new URL('../assets/materials/facade-industrial.webp', import.meta.url).href,
  },
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

function loadTexture(loader, renderer, url, repeat, colorTexture = false, isQuest = false) {
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = Math.min(isQuest ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function surfacePair(loader, renderer, key, repeat, isQuest) {
  return {
    map: loadTexture(loader, renderer, TEXTURES[key].color, repeat, true, isQuest),
    bumpMap: loadTexture(loader, renderer, TEXTURES[key].height, repeat, false, isQuest),
  };
}

export function createMaterialLibrary(renderer, { isQuest = false } = {}) {
  const loader = new THREE.TextureLoader();
  const asphalt = surfacePair(loader, renderer, 'asphalt', [2.2, 17], isQuest);
  const sidewalk = surfacePair(loader, renderer, 'sidewalk', [1.5, 19], isQuest);
  const concrete = surfacePair(loader, renderer, 'concrete', [2.2, 5.4], isQuest);
  const brick = surfacePair(loader, renderer, 'brick', [2.7, 5.2], isQuest);
  const shutter = surfacePair(loader, renderer, 'shutter', [1.2, 1.4], isQuest);
  const facadeMixed = loadTexture(loader, renderer, TEXTURES.facadeMixed.color, [1, 1], true, isQuest);
  const facadeIndustrial = loadTexture(loader, renderer, TEXTURES.facadeIndustrial.color, [1, 1], true, isQuest);

  const materials = {
    facadeMixed: new THREE.MeshStandardMaterial({
      map: facadeMixed,
      color: 0xffffff,
      roughness: 0.68,
      metalness: 0.08,
      envMapIntensity: 0.72,
    }),
    facadeIndustrial: new THREE.MeshStandardMaterial({
      map: facadeIndustrial,
      color: 0xffffff,
      roughness: 0.64,
      metalness: 0.12,
      envMapIntensity: 0.78,
    }),
    road: new THREE.MeshStandardMaterial({
      ...asphalt,
      color: 0x6b7072,
      bumpScale: 0.06,
      roughness: 0.32,
      metalness: 0.08,
      envMapIntensity: 1.2,
    }),
    sidewalk: new THREE.MeshStandardMaterial({
      ...sidewalk,
      color: 0x767976,
      bumpScale: 0.085,
      roughness: 0.52,
      metalness: 0.03,
      envMapIntensity: 0.9,
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
    glass: new THREE.MeshStandardMaterial({
      color: 0x26383a,
      roughness: 0.2,
      metalness: 0.46,
      envMapIntensity: 1.35,
    }),
    darkGlass: new THREE.MeshStandardMaterial({
      color: 0x0d1719,
      roughness: 0.24,
      metalness: 0.52,
      envMapIntensity: 1.2,
    }),
    warmWindow: new THREE.MeshStandardMaterial({
      color: 0x3f2f24,
      emissive: 0xffb266,
      emissiveIntensity: 0.82,
      roughness: 0.28,
      metalness: 0.05,
    }),
    coolWindow: new THREE.MeshStandardMaterial({
      color: 0x17272a,
      emissive: 0x8dc5bd,
      emissiveIntensity: 0.34,
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
