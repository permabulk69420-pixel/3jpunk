import * as THREE from 'three';
import { BuildingFactory } from './BuildingFactory.js';
import { BUILDING_SLOTS, CITY_BOUNDS, SIGN_COPY } from './cityData.js';
import { CityAssetRegistry } from './CityAssetRegistry.js';
import {
  createAsphaltTextures,
  createConcreteTexture,
  createRadialTexture,
  createReflectionStreakTexture,
  createSignTexture,
  seededRandom,
} from './proceduralTextures.js';

function makeBox(parent, geometry, material, position, scale = [1, 1, 1], name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.name = name;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeCylinder(parent, geometry, material, position, rotation = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addSky(scene) {
  const geometry = new THREE.SphereGeometry(260, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x01030a) },
      horizonColor: { value: new THREE.Color(0x16243e) },
      groundColor: { value: new THREE.Color(0x02030a) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 lower = mix(groundColor, horizonColor, smoothstep(-0.2, 0.08, h));
        vec3 color = mix(lower, topColor, smoothstep(0.05, 0.72, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'NIGHT_SKY';
  scene.add(sky);

  const hazeTexture = createRadialTexture([
    [0, 'rgba(130,180,255,.76)'],
    [0.08, 'rgba(96,145,255,.34)'],
    [0.38, 'rgba(33,67,127,.12)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: hazeTexture,
    color: 0x7699ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.position.set(-74, 58, -145);
  glow.scale.set(74, 74, 1);
  scene.add(glow);
}

function addLighting(scene) {
  const hemisphere = new THREE.HemisphereLight(0x557da8, 0x160817, 0.82);
  hemisphere.name = 'CITY_AMBIENT';
  scene.add(hemisphere);

  const moon = new THREE.DirectionalLight(0x8aa9ff, 1.65);
  moon.position.set(-28, 58, 30);
  moon.target.position.set(0, 0, -18);
  moon.name = 'MOON_KEY';
  scene.add(moon, moon.target);

  const alleyFill = new THREE.DirectionalLight(0xff3a9b, 0.32);
  alleyFill.position.set(22, 16, -8);
  alleyFill.target.position.set(0, 4, 12);
  scene.add(alleyFill, alleyFill.target);
}

function addStreetSurface(root, renderer) {
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const { map: asphaltMap, bumpMap } = createAsphaltTextures();
  asphaltMap.anisotropy = maxAnisotropy;
  bumpMap.anisotropy = maxAnisotropy;
  const asphalt = new THREE.MeshPhysicalMaterial({
    color: 0x111925,
    map: asphaltMap,
    bumpMap,
    bumpScale: 0.075,
    roughness: 0.29,
    metalness: 0.66,
    clearcoat: 1,
    clearcoatRoughness: 0.17,
    envMapIntensity: 1.7,
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 104), asphalt);
  road.name = 'WET_ASPHALT';
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  road.receiveShadow = true;
  root.add(road);

  const concreteMap = createConcreteTexture(9401, '#303743');
  concreteMap.repeat.set(4, 20);
  concreteMap.anisotropy = maxAnisotropy;
  const sidewalkMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x353c48,
    map: concreteMap,
    roughness: 0.52,
    metalness: 0.28,
    clearcoat: 0.72,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.2,
  });
  const sidewalkGeometry = new THREE.BoxGeometry(3.8, 0.24, 104);
  makeBox(root, sidewalkGeometry, sidewalkMaterial, [-9.6, 0.06, 0]);
  makeBox(root, sidewalkGeometry, sidewalkMaterial, [9.6, 0.06, 0]);

  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x4a535e, roughness: 0.48, metalness: 0.38 });
  const curbGeometry = new THREE.BoxGeometry(0.28, 0.34, 104);
  makeBox(root, curbGeometry, curbMaterial, [-7.83, 0.11, 0]);
  makeBox(root, curbGeometry, curbMaterial, [7.83, 0.11, 0]);

  const reflectionTexture = createReflectionStreakTexture();
  const reflections = new THREE.Mesh(
    new THREE.PlaneGeometry(13.7, 94),
    new THREE.MeshBasicMaterial({
      map: reflectionTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  reflections.name = 'NEON_ROAD_REFLECTIONS';
  reflections.rotation.x = -Math.PI / 2;
  reflections.position.y = 0.025;
  root.add(reflections);

  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xd7c97c, transparent: true, opacity: 0.37 });
  const stripeGeometry = new THREE.PlaneGeometry(0.09, 2.9);
  for (let z = -44; z <= 44; z += 6.3) {
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.036, z);
    root.add(stripe);
  }

  const edgeLineMaterial = new THREE.MeshBasicMaterial({ color: 0x71818d, transparent: true, opacity: 0.28 });
  for (const x of [-6.9, 6.9]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 99), edgeLineMaterial);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.034, 0);
    root.add(edge);
  }

  const crosswalkMaterial = new THREE.MeshBasicMaterial({ color: 0xb7c7ca, transparent: true, opacity: 0.44 });
  for (let x = -6.4; x <= 6.4; x += 1.5) {
    const marking = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 3.7), crosswalkMaterial);
    marking.rotation.x = -Math.PI / 2;
    marking.position.set(x, 0.037, 35.5);
    root.add(marking);
  }

  const puddleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x101c28,
    transparent: true,
    opacity: 0.62,
    roughness: 0.06,
    metalness: 0.86,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.7,
  });
  const puddleGeometry = new THREE.CircleGeometry(1, 22);
  const random = seededRandom(7288);
  for (let index = 0; index < 17; index += 1) {
    const puddle = new THREE.Mesh(puddleGeometry, puddleMaterial);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = random() * Math.PI;
    puddle.scale.set(0.55 + random() * 2.2, 0.35 + random() * 0.85, 1);
    puddle.position.set((random() - 0.5) * 13.2, 0.043, -43 + random() * 86);
    root.add(puddle);
  }

  const grateMaterial = new THREE.MeshStandardMaterial({ color: 0x090d12, roughness: 0.32, metalness: 0.94 });
  const grateGeometry = new THREE.BoxGeometry(0.72, 0.045, 1.2);
  for (const x of [-7.45, 7.45]) {
    for (let z = -42; z <= 42; z += 12) {
      const grate = makeBox(root, grateGeometry, grateMaterial, [x, 0.055, z]);
      for (let line = -0.42; line <= 0.42; line += 0.21) {
        makeBox(grate, new THREE.BoxGeometry(0.76, 0.02, 0.035), new THREE.MeshBasicMaterial({ color: 0x44515b }), [0, 0.035, line]);
      }
    }
  }
}

function addStreetFurniture(root, scene, isQuest) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x121b25, roughness: 0.32, metalness: 0.88 });
  const black = new THREE.MeshStandardMaterial({ color: 0x04070c, roughness: 0.46, metalness: 0.74 });
  const poleGeometry = new THREE.CylinderGeometry(0.08, 0.12, 5.5, 8);
  const armGeometry = new THREE.BoxGeometry(1.3, 0.09, 0.09);
  const lampGeometry = new THREE.BoxGeometry(0.58, 0.16, 0.25);
  const glows = [0x54ebff, 0xff398e];
  const radial = createRadialTexture([
    [0, 'rgba(255,255,255,1)'],
    [0.07, 'rgba(255,255,255,.94)'],
    [0.25, 'rgba(100,230,255,.35)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const lampPositions = [-39, -24, -7, 10, 27, 43];
  lampPositions.forEach((z, index) => {
    for (const side of [-1, 1]) {
      const x = side * 9.15;
      makeCylinder(root, poleGeometry, metal, [x, 2.75, z]);
      const arm = makeBox(root, armGeometry, metal, [x - side * 0.58, 5.38, z]);
      arm.rotation.z = side * -0.07;
      const color = glows[(index + (side > 0 ? 1 : 0)) % 2];
      const lampMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      makeBox(root, lampGeometry, lampMaterial, [x - side * 1.16, 5.27, z]);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: radial,
        color,
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(x - side * 1.16, 5.22, z);
      sprite.scale.set(2.2, 2.2, 1);
      root.add(sprite);
      if (!isQuest && index % 2 === 0) {
        const light = new THREE.PointLight(color, 16, 10, 2);
        light.position.copy(sprite.position);
        scene.add(light);
      }
    }
  });

  const bollardGeometry = new THREE.CylinderGeometry(0.1, 0.14, 0.85, 8);
  const bollardMaterial = new THREE.MeshStandardMaterial({ color: 0x252f37, roughness: 0.34, metalness: 0.86 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x55eaff, toneMapped: false });
  for (const side of [-1, 1]) {
    for (let z = -44; z <= 44; z += 7.5) {
      makeCylinder(root, bollardGeometry, bollardMaterial, [side * 7.95, 0.48, z]);
      makeCylinder(root, new THREE.CylinderGeometry(0.145, 0.145, 0.035, 8), glowMaterial, [side * 7.95, 0.77, z]);
    }
  }

  const benchPositions = [
    [-9.5, 0.7, 15, 0],
    [9.5, 0.7, -20, Math.PI],
  ];
  benchPositions.forEach(([x, y, z, rotation]) => {
    const bench = new THREE.Group();
    bench.position.set(x, y, z);
    bench.rotation.y = rotation;
    makeBox(bench, new THREE.BoxGeometry(0.8, 0.12, 2.8), metal, [0, 0, 0]);
    makeBox(bench, new THREE.BoxGeometry(0.12, 1.05, 2.8), black, [0.38, 0.47, 0]);
    for (const offset of [-0.9, 0.9]) makeBox(bench, new THREE.BoxGeometry(0.12, 0.72, 0.12), metal, [0, -0.36, offset]);
    root.add(bench);
  });
}

function addVendingMachine(root, renderer, side, z, accent, label) {
  const group = new THREE.Group();
  group.name = `VENDING__${label}`;
  group.position.set(side * 10.6, 1.25, z);
  group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  const body = new THREE.MeshStandardMaterial({ color: 0x131925, roughness: 0.32, metalness: 0.82 });
  const black = new THREE.MeshStandardMaterial({ color: 0x020408, roughness: 0.3, metalness: 0.8 });
  makeBox(group, new THREE.BoxGeometry(1.15, 2.5, 0.78), body, [0, 0, 0]);
  const texture = createSignTexture({
    title: label,
    subtitle: 'SYNTHETIC REFRESHMENT',
    glyph: '冷',
    accent: `#${new THREE.Color(accent).getHexString()}`,
    accent2: '#ffffff',
    seed: label.length * 81,
  });
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 1.15),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  panel.position.set(0, 0.38, 0.401);
  group.add(panel);
  makeBox(group, new THREE.BoxGeometry(0.77, 0.31, 0.08), black, [0, -0.76, 0.43]);
  const light = new THREE.PointLight(accent, 4.5, 4.5, 2);
  light.position.set(0, 0.5, 1);
  group.add(light);
  root.add(group);
}

function addSkybridge(root, animated) {
  const bridge = new THREE.Group();
  bridge.name = 'SKYBRIDGE_01';
  bridge.position.set(0, 14.2, -11.5);
  const frame = new THREE.MeshStandardMaterial({ color: 0x111a25, roughness: 0.24, metalness: 0.92 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0f2c38,
    transparent: true,
    opacity: 0.42,
    transmission: 0.18,
    roughness: 0.09,
    metalness: 0.3,
    clearcoat: 1,
    side: THREE.DoubleSide,
  });
  const cyan = new THREE.MeshBasicMaterial({ color: 0x54efff, toneMapped: false, transparent: true, opacity: 0.9 });
  makeBox(bridge, new THREE.BoxGeometry(23.4, 0.35, 3.15), frame, [0, -1.5, 0]);
  makeBox(bridge, new THREE.BoxGeometry(23.4, 0.28, 3.15), frame, [0, 1.55, 0]);
  for (const z of [-1.5, 1.5]) {
    makeBox(bridge, new THREE.BoxGeometry(22.8, 2.8, 0.08), glass, [0, 0, z]);
    makeBox(bridge, new THREE.BoxGeometry(23.2, 0.08, 0.08), cyan, [0, -1.28, z + Math.sign(z) * 0.05]);
  }
  for (let x = -11; x <= 11; x += 2.2) {
    for (const z of [-1.58, 1.58]) makeBox(bridge, new THREE.BoxGeometry(0.09, 3.05, 0.12), frame, [x, 0, z]);
  }
  root.add(bridge);
  animated.push((elapsed) => {
    cyan.opacity = 0.72 + Math.sin(elapsed * 2.1) * 0.12;
  });
}

function addOverheadCables(root) {
  const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x070a0e, roughness: 0.4, metalness: 0.88 });
  const accents = [
    [[-11, 18, 28], [0, 15.2, 25], [11, 19, 22]],
    [[-11, 25, -2], [0, 20.4, 1], [11, 24, 4]],
    [[-11, 31, -34], [0, 27.5, -30], [11, 29, -27]],
  ];
  accents.forEach((points, index) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.045 + index * 0.012, 5, false), cableMaterial);
    root.add(cable);
  });

  for (const side of [-1, 1]) {
    const x = side * 11.15;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 10, -49),
      new THREE.Vector3(x + side * 0.8, 8.6, -20),
      new THREE.Vector3(x - side * 0.3, 9.2, 12),
      new THREE.Vector3(x, 10.5, 49),
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.035, 5, false), cableMaterial));
  }
}

function addHolographicBillboard(root, renderer, animated) {
  const texture = createSignTexture({
    title: 'RAIN DISTRICT',
    subtitle: 'LOWER CITY // SECTOR 03',
    glyph: '雨の街',
    accent: '#64f6ff',
    accent2: '#ff2d95',
    seed: 991,
  });
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const billboard = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 3.8), material);
  billboard.name = 'RAIN_DISTRICT_HOLO';
  billboard.position.set(0, 9.2, -54);
  root.add(billboard);
  const glow = new THREE.PointLight(0x5aeaff, 24, 22, 2);
  glow.position.set(0, 8.5, -49);
  root.add(glow);
  animated.push((elapsed) => {
    const scan = Math.sin(elapsed * 6.7);
    material.opacity = scan > 0.965 ? 0.38 : 0.72 + Math.sin(elapsed * 1.25) * 0.07;
    billboard.position.y = 9.2 + Math.sin(elapsed * 0.55) * 0.08;
  });
}

function addDistantCity(root) {
  const random = seededRandom(21807);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x07101c, roughness: 0.72, metalness: 0.35 });
  const count = 72;
  const skyline = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const back = index < count / 2;
    const z = back ? -70 - random() * 75 : 60 + random() * 80;
    const side = random() > 0.5 ? 1 : -1;
    const x = side * (22 + random() * 70);
    const width = 8 + random() * 18;
    const depth = 8 + random() * 18;
    const height = 18 + Math.pow(random(), 0.56) * 88;
    position.set(x, height / 2 - 1, z);
    scale.set(width, height, depth);
    matrix.compose(position, quaternion, scale);
    skyline.setMatrixAt(index, matrix);
  }
  skyline.instanceMatrix.needsUpdate = true;
  skyline.name = 'DISTANT_SKYLINE';
  root.add(skyline);

  const aerialMaterial = new THREE.MeshBasicMaterial({ color: 0x17395c, transparent: true, opacity: 0.18, toneMapped: false });
  const aerialGeometry = new THREE.BoxGeometry(0.18, 0.12, 3.5);
  for (let index = 0; index < 16; index += 1) {
    const light = new THREE.Mesh(aerialGeometry, aerialMaterial);
    light.position.set((random() - 0.5) * 120, 18 + random() * 48, -55 - random() * 78);
    light.rotation.y = random() * Math.PI;
    root.add(light);
  }
}

function addFacadeLightBeams(root) {
  const beamGeometry = new THREE.CylinderGeometry(0.5, 4.2, 20, 16, 1, true);
  const beams = [
    [-10.4, 10, 9, 0xff2d95],
    [10.4, 10, -29, 0x58efff],
    [-10.4, 10, -38, 0x8666ff],
  ];
  beams.forEach(([x, y, z, color]) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.022,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const beam = new THREE.Mesh(beamGeometry, material);
    beam.position.set(x, y, z);
    beam.rotation.z = x < 0 ? -0.15 : 0.15;
    root.add(beam);
  });
}

function addMarketDetails(root, renderer) {
  addVendingMachine(root, renderer, -1, 31, 0xff378f, 'KOLA');
  addVendingMachine(root, renderer, 1, 6, 0x5defff, 'AQUA');
  addVendingMachine(root, renderer, -1, -17, 0x8d6aff, 'VOID');

  const shutter = new THREE.MeshStandardMaterial({ color: 0x242b34, roughness: 0.5, metalness: 0.78 });
  const warning = new THREE.MeshBasicMaterial({ color: 0xffc05a, toneMapped: false });
  const cabinetGeometry = new THREE.BoxGeometry(0.72, 1.6, 1.2);
  for (const [x, z, rotation] of [[-10.75, 5, 0], [10.75, 29, Math.PI], [-10.75, -42, 0]]) {
    const cabinet = makeBox(root, cabinetGeometry, shutter, [x, 0.92, z]);
    cabinet.rotation.y = rotation;
    for (let y = -0.45; y <= 0.45; y += 0.18) makeBox(cabinet, new THREE.BoxGeometry(0.76, 0.035, 0.92), warning, [0, y, 0.61]);
  }

  const posterTexture = createSignTexture({
    title: SIGN_COPY[1][0],
    subtitle: SIGN_COPY[1][1],
    glyph: '記憶',
    accent: '#ff447f',
    accent2: '#72f5ff',
    vertical: true,
    seed: 234,
  });
  posterTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 4.2),
    new THREE.MeshBasicMaterial({ map: posterTexture, toneMapped: false, side: THREE.DoubleSide }),
  );
  poster.position.set(-10.92, 3.15, -2.4);
  poster.rotation.y = Math.PI / 2;
  root.add(poster);
}

export function createCyberCity({ scene, renderer, isQuest = false }) {
  const root = new THREE.Group();
  root.name = 'RAIN_DISTRICT_03';
  scene.add(root);
  const animated = [];
  const colliders = [];
  const slotGroups = new Map();

  addSky(scene);
  addLighting(scene);
  addStreetSurface(root, renderer);
  addStreetFurniture(root, scene, isQuest);
  addSkybridge(root, animated);
  addOverheadCables(root);
  addHolographicBillboard(root, renderer, animated);
  addDistantCity(root);
  addFacadeLightBeams(root);
  addMarketDetails(root, renderer);

  const factory = new BuildingFactory({ renderer, animated });
  BUILDING_SLOTS.forEach((definition) => {
    const building = factory.create(definition);
    root.add(building);
    slotGroups.set(definition.id, building);
    const [x, , z] = definition.position;
    const [width, , depth] = definition.size;
    colliders.push({
      id: definition.id,
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
    });
  });

  const assetRegistry = new CityAssetRegistry(slotGroups);
  return {
    root,
    animated,
    colliders,
    bounds: CITY_BOUNDS,
    assetRegistry,
    slots: BUILDING_SLOTS,
  };
}
