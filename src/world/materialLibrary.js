import * as THREE from 'three';

const TEXTURES = {
  facadeMixed: {
    color: new URL('../assets/materials/facade-mixed-use.webp', import.meta.url).href,
  },
  facadeIndustrial: {
    color: new URL('../assets/materials/facade-industrial.webp', import.meta.url).href,
  },
  facadeCapsule: {
    color: new URL('../assets/materials/facade-capsule-hotel.webp', import.meta.url).href,
  },
  facadeRepair: {
    color: new URL('../assets/materials/facade-repair-works.webp', import.meta.url).href,
  },
  wardwatch: {
    color: new URL('../assets/materials/wardwatch-billboard.webp', import.meta.url).href,
  },
  vendingDrinks: {
    color: new URL('../assets/materials/vending-drinks-front.webp', import.meta.url).href,
  },
  vendingEssentials: {
    color: new URL('../assets/materials/vending-essentials-front.webp', import.meta.url).href,
  },
  municipalService: {
    color: new URL('../assets/materials/municipal-service-front.webp', import.meta.url).href,
  },
  posterTransit: {
    color: new URL('../assets/materials/poster-transit.webp', import.meta.url).href,
  },
  posterMaintenance: {
    color: new URL('../assets/materials/poster-maintenance.webp', import.meta.url).href,
  },
  posterProvisions: {
    color: new URL('../assets/materials/poster-provisions.webp', import.meta.url).href,
  },
  posterStorm: {
    color: new URL('../assets/materials/poster-storm.webp', import.meta.url).href,
  },
  asphalt: {
    color: new URL('../assets/materials/asphalt-albedo.webp', import.meta.url).href,
    height: new URL('../assets/materials/asphalt-height.webp', import.meta.url).href,
  },
  roadReflections: {
    color: new URL('../assets/materials/wet-road-reflections.webp', import.meta.url).href,
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

function loadClampedTexture(loader, renderer, url, colorTexture, isQuest) {
  const texture = loadTexture(loader, renderer, url, [1, 1], colorTexture, isQuest);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
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
  const roadReflections = loadClampedTexture(loader, renderer, TEXTURES.roadReflections.color, true, isQuest);
  const sidewalk = surfacePair(loader, renderer, 'sidewalk', [1.5, 19], isQuest);
  const concrete = surfacePair(loader, renderer, 'concrete', [2.2, 5.4], isQuest);
  const brick = surfacePair(loader, renderer, 'brick', [2.7, 5.2], isQuest);
  const shutter = surfacePair(loader, renderer, 'shutter', [1.2, 1.4], isQuest);
  const facadeMixed = loadTexture(loader, renderer, TEXTURES.facadeMixed.color, [1, 1], true, isQuest);
  const facadeIndustrial = loadTexture(loader, renderer, TEXTURES.facadeIndustrial.color, [1, 1], true, isQuest);
  const facadeCapsule = loadTexture(loader, renderer, TEXTURES.facadeCapsule.color, [1, 1], true, isQuest);
  const facadeRepair = loadTexture(loader, renderer, TEXTURES.facadeRepair.color, [1, 1], true, isQuest);
  const wardwatch = loadClampedTexture(loader, renderer, TEXTURES.wardwatch.color, true, isQuest);
  const vendingDrinks = loadClampedTexture(loader, renderer, TEXTURES.vendingDrinks.color, true, isQuest);
  const vendingEssentials = loadClampedTexture(loader, renderer, TEXTURES.vendingEssentials.color, true, isQuest);
  const municipalService = loadClampedTexture(loader, renderer, TEXTURES.municipalService.color, true, isQuest);
  const posterTransit = loadClampedTexture(loader, renderer, TEXTURES.posterTransit.color, true, isQuest);
  const posterMaintenance = loadClampedTexture(loader, renderer, TEXTURES.posterMaintenance.color, true, isQuest);
  const posterProvisions = loadClampedTexture(loader, renderer, TEXTURES.posterProvisions.color, true, isQuest);
  const posterStorm = loadClampedTexture(loader, renderer, TEXTURES.posterStorm.color, true, isQuest);

  const materials = {
    vendingDrinks: new THREE.MeshStandardMaterial({
      map: vendingDrinks,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.2,
      envMapIntensity: 0.82,
    }),
    vendingEssentials: new THREE.MeshStandardMaterial({
      map: vendingEssentials,
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.17,
      envMapIntensity: 0.78,
    }),
    municipalService: new THREE.MeshStandardMaterial({
      map: municipalService,
      color: 0xffffff,
      roughness: 0.57,
      metalness: 0.42,
      envMapIntensity: 0.92,
    }),
    posterTransit: new THREE.MeshStandardMaterial({
      map: posterTransit,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    }),
    posterMaintenance: new THREE.MeshStandardMaterial({
      map: posterMaintenance,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    }),
    posterProvisions: new THREE.MeshStandardMaterial({
      map: posterProvisions,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    }),
    posterStorm: new THREE.MeshStandardMaterial({
      map: posterStorm,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
    }),
    wardwatchScreen: new THREE.MeshStandardMaterial({
      map: wardwatch,
      emissiveMap: wardwatch,
      emissive: 0xffffff,
      emissiveIntensity: 0.78,
      roughness: 0.28,
      metalness: 0.06,
      envMapIntensity: 0.45,
    }),
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
    facadeCapsule: new THREE.MeshStandardMaterial({
      map: facadeCapsule,
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.14,
      envMapIntensity: 0.88,
    }),
    facadeRepair: new THREE.MeshStandardMaterial({
      map: facadeRepair,
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.08,
      envMapIntensity: 0.7,
    }),
    road: new THREE.MeshStandardMaterial({
      ...asphalt,
      roughnessMap: asphalt.bumpMap,
      emissiveMap: roadReflections,
      emissive: 0xffffff,
      emissiveIntensity: isQuest ? 0.14 : 0.17,
      color: 0x6b7072,
      bumpScale: 0.06,
      roughness: 0.76,
      metalness: 0.02,
      envMapIntensity: 1.35,
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
