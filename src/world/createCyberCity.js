import * as THREE from 'three';
import { BuildingFactory } from './BuildingFactory.js';
import { BUILDING_SLOTS, CITY_BOUNDS, STREET_SIGNS } from './cityData.js';
import { CityAssetRegistry } from './CityAssetRegistry.js';
import { createMaterialLibrary } from './materialLibrary.js';
import { createRadialTexture, seededRandom } from './proceduralTextures.js';
import { batchStaticMeshes } from './batchStaticMeshes.js';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER_8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const UNIT_CYLINDER_16 = new THREE.CylinderGeometry(1, 1, 1, 16);
const UNIT_CYLINDER_32 = new THREE.CylinderGeometry(1, 1, 1, 32);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

function addBox(parent, material, size, position, options = {}) {
  const mesh = new THREE.Mesh(UNIT_BOX, material);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.name) mesh.name = options.name;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, geometry, material, scale, position, rotation = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addStreetFacingPanel(parent, material, size, position, side, name = '') {
  const mesh = new THREE.Mesh(UNIT_PLANE, material);
  mesh.scale.set(size[0], size[1], 1);
  mesh.position.set(...position);
  mesh.rotation.y = -side * Math.PI / 2;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function createWayfindingTexture(sign) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#111615';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#d5c9ad';
  context.fillRect(18, 18, 988, 220);
  context.fillStyle = '#202724';
  context.fillRect(27, 27, 970, 202);
  context.fillStyle = '#d3ccbb';
  context.font = '900 88px Arial Narrow, Arial, sans-serif';
  context.fillText(sign.title, 58, 116);
  context.fillStyle = '#c86b4c';
  context.font = '700 25px monospace';
  context.fillText(sign.subtitle, 62, 191);
  context.textAlign = 'right';
  context.fillStyle = '#8db0aa';
  context.font = '700 58px sans-serif';
  context.fillText(sign.local, 956, 145);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addSky(scene) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: new THREE.Color(0x020407) },
      horizon: { value: new THREE.Color(0x192428) },
      lower: { value: new THREE.Color(0x060708) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 lower;
      void main() {
        float height = normalize(vWorld).y;
        vec3 color = mix(lower, horizon, smoothstep(-0.2, 0.08, height));
        color = mix(color, zenith, smoothstep(0.08, 0.74, height));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), material);
  sky.name = 'RAIN_CLOUD_SKY';
  scene.add(sky);

  const glowTexture = createRadialTexture([
    [0, 'rgba(212,228,222,.72)'],
    [0.06, 'rgba(195,214,216,.42)'],
    [0.35, 'rgba(116,143,151,.08)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xb9c9c6,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.position.set(-82, 67, -170);
  glow.scale.set(72, 72, 1);
  scene.add(glow);
}

function addLighting(scene, isQuest) {
  const hemisphere = new THREE.HemisphereLight(0x98acb0, 0x211815, 1.15);
  hemisphere.name = 'OVERCAST_AMBIENT';
  scene.add(hemisphere);

  const cityBounce = new THREE.AmbientLight(0x71888b, 0.82);
  cityBounce.name = 'CITY_SKY_BOUNCE';
  scene.add(cityBounce);

  const moon = new THREE.DirectionalLight(0xb2c7c8, 2.0);
  moon.name = 'MOON_THROUGH_CLOUD';
  moon.position.set(-32, 62, 36);
  moon.target.position.set(0, 5, -18);
  moon.castShadow = !isQuest;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -38;
  moon.shadow.camera.right = 38;
  moon.shadow.camera.top = 50;
  moon.shadow.camera.bottom = -22;
  moon.shadow.camera.near = 5;
  moon.shadow.camera.far = 145;
  moon.shadow.bias = -0.0008;
  moon.shadow.normalBias = 0.025;
  scene.add(moon, moon.target);

}

function addRoad(root, materials) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(13.3, 116), materials.road);
  road.name = 'WET_ASPHALT';
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0;
  road.receiveShadow = true;
  root.add(road);

  const sidewalkGeometry = new THREE.BoxGeometry(4.32, 0.24, 116);
  for (const x of [-8.88, 8.88]) {
    const sidewalk = new THREE.Mesh(sidewalkGeometry, materials.sidewalk);
    sidewalk.position.set(x, 0.08, 0);
    sidewalk.receiveShadow = true;
    root.add(sidewalk);
  }
  addBox(root, materials.curb, [0.28, 0.34, 116], [-6.72, 0.11, 0]);
  addBox(root, materials.curb, [0.28, 0.34, 116], [6.72, 0.11, 0]);

  const gutterMaterial = materials.road.clone();
  gutterMaterial.color.multiplyScalar(0.52);
  gutterMaterial.roughness = 0.18;
  for (const x of [-6.43, 6.43]) {
    const gutter = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 114), gutterMaterial);
    gutter.rotation.x = -Math.PI / 2;
    gutter.position.set(x, 0.018, 0);
    root.add(gutter);
  }

  const markingMaterial = new THREE.MeshStandardMaterial({
    color: 0x77715c,
    roughness: 0.64,
    metalness: 0.02,
  });
  for (let z = -47; z <= 47; z += 8.4) {
    const marking = new THREE.Mesh(UNIT_PLANE, markingMaterial);
    marking.rotation.x = -Math.PI / 2;
    marking.scale.set(0.085, 3.2, 1);
    marking.position.set(0, 0.034, z);
    root.add(marking);
  }
  const edgeMarking = markingMaterial.clone();
  edgeMarking.color.set(0x505653);
  for (const x of [-5.55, 5.55]) {
    const line = new THREE.Mesh(UNIT_PLANE, edgeMarking);
    line.rotation.x = -Math.PI / 2;
    line.scale.set(0.075, 108, 1);
    line.position.set(x, 0.033, -2);
    root.add(line);
  }

  const crossingMaterial = markingMaterial.clone();
  crossingMaterial.color.set(0x74746b);
  for (let x = -5.7; x <= 5.7; x += 1.38) {
    const stripe = new THREE.Mesh(UNIT_PLANE, crossingMaterial);
    stripe.rotation.x = -Math.PI / 2;
    stripe.scale.set(0.72, 3.05, 1);
    stripe.position.set(x, 0.036, 46.5);
    root.add(stripe);
  }

  const random = seededRandom(21903);

  const crackMaterial = new THREE.LineBasicMaterial({ color: 0x111413 });
  const crackSegments = [];
  for (let index = 0; index < 9; index += 1) {
    const startX = (random() - 0.5) * 10;
    const startZ = -48 + random() * 96;
    const points = [];
    for (let step = 0; step < 7; step += 1) {
      points.push(new THREE.Vector3(startX + (random() - 0.5) * 0.7 + step * 0.11, 0.042, startZ + step * 0.42));
    }
    for (let step = 0; step < points.length - 1; step += 1) crackSegments.push(points[step], points[step + 1]);
  }
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crackSegments), crackMaterial));

}

function addRoadHardware(root, materials) {
  const manholeMaterial = materials.metal.clone();
  manholeMaterial.color.set(0x252b2a);
  manholeMaterial.roughness = 0.43;
  const positions = [[-2.6, 31], [2.8, 2], [-2.2, -29]];
  positions.forEach(([x, z], index) => {
    addCylinder(root, UNIT_CYLINDER_32, manholeMaterial, [0.68, 0.06, 0.68], [x, 0.055, z]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.045, 7, 28), materials.blackMetal);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.096, z);
    root.add(ring);
    for (let line = -0.3; line <= 0.3; line += 0.2) {
      addBox(root, materials.blackMetal, [0.58, 0.035, 0.04], [x, 0.098, z + line], { rotation: [0, index * 0.35, 0] });
    }
  });

  for (const side of [-1, 1]) {
    for (let z = -48; z <= 48; z += 9.6) {
      addBox(root, materials.blackMetal, [0.62, 0.045, 1.05], [side * 6.46, 0.06, z]);
      for (let offset = -0.4; offset <= 0.4; offset += 0.16) {
        addBox(root, materials.metal, [0.5, 0.026, 0.028], [side * 6.46, 0.09, z + offset]);
      }
    }
  }
}

function addLamp(root, materials, side, z, index, glowTexture, lampMaterials, isQuest) {
  const x = side * 9.45;
  addCylinder(root, UNIT_CYLINDER_16, materials.blackMetal, [0.24, 0.11, 0.24], [x, 0.15, z]);
  addCylinder(root, UNIT_CYLINDER_16, materials.metal, [0.15, 0.42, 0.15], [x, 0.42, z]);
  addCylinder(root, UNIT_CYLINDER_16, materials.blackMetal, [0.09, 4.82, 0.09], [x, 2.82, z]);
  addBox(root, materials.paintedMetal, [0.035, 0.5, 0.24], [x - side * 0.105, 1.1, z]);
  addBox(root, materials.metal, [1.78, 0.1, 0.11], [x - side * 0.81, 5.2, z], { rotation: [0, 0, side * -0.075] });
  addBox(root, materials.metal, [1.02, 0.065, 0.075], [x - side * 0.52, 4.91, z], { rotation: [0, 0, side * -0.36] });
  addBox(root, materials.blackMetal, [0.9, 0.2, 0.5], [x - side * 1.68, 5.02, z], { castShadow: true });
  addBox(root, materials.paintedMetal, [0.68, 0.08, 0.38], [x - side * 1.68, 4.91, z]);
  const lampColor = index % 4 === 3 ? 0xa8d0cb : 0xffb16e;
  const emissive = index % 4 === 3 ? lampMaterials.cool : lampMaterials.warm;
  addBox(root, emissive, [0.52, 0.045, 0.25], [x - side * 1.68, 4.855, z]);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: lampColor,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.position.set(x - side * 1.68, 4.8, z);
  sprite.scale.set(1.65, 1.65, 1);
  root.add(sprite);
  // Quest keeps the visible emissive bulb and halo, but avoids dynamic point-light
  // specular streaks that make ordinary wet surfaces read as self-illuminated.
  const hasRealLight = !isQuest && index % 2 === 0;
  if (hasRealLight) {
    const light = new THREE.PointLight(lampColor, index % 4 === 3 ? 14 : 20, 9.5, 2.2);
    light.position.copy(sprite.position);
    root.add(light);
  }
}

function addStreetFurniture(root, materials, isQuest) {
  const glowTexture = createRadialTexture([
    [0, 'rgba(255,255,255,.95)'],
    [0.08, 'rgba(255,244,220,.8)'],
    [0.3, 'rgba(255,190,120,.18)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const lampMaterials = {
    warm: new THREE.MeshStandardMaterial({
      color: 0x5e4937,
      emissive: 0xffb16e,
      emissiveIntensity: 1.85,
      roughness: 0.32,
    }),
    cool: new THREE.MeshStandardMaterial({
      color: 0x3c5654,
      emissive: 0xa8d0cb,
      emissiveIntensity: 1.55,
      roughness: 0.3,
    }),
  };
  const serviceIndicator = new THREE.MeshStandardMaterial({
    color: 0x39271a,
    emissive: 0xe68a35,
    emissiveIntensity: 1.25,
    roughness: 0.4,
  });
  const lampPositions = [-43, -27, -10, 8, 25, 42];
  lampPositions.forEach((z, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    addLamp(root, materials, side, z, index, glowTexture, lampMaterials, isQuest);
  });

  for (const side of [-1, 1]) {
    const bollardPositions = side < 0
      ? [-44, -32, -20, -8, 4, 16, 28, 40]
      : [-39, -27, -15, -3, 9, 21, 33, 45];
    bollardPositions.forEach((z) => {
      const x = side * 7.0;
      addCylinder(root, UNIT_CYLINDER_16, materials.blackMetal, [0.17, 0.08, 0.17], [x, 0.16, z]);
      addCylinder(root, UNIT_CYLINDER_16, materials.paintedMetal, [0.095, 0.7, 0.095], [x, 0.53, z]);
      addCylinder(root, UNIT_CYLINDER_16, materials.curb, [0.118, 0.055, 0.118], [x, 0.76, z]);
      addCylinder(root, UNIT_CYLINDER_16, materials.blackMetal, [0.135, 0.075, 0.135], [x, 0.9, z]);
    });
  }

  const propData = [
    [-10.25, 36, 'bin'], [10.1, 29, 'crate'], [-10.0, 13, 'crate'], [10.05, -17, 'bin'],
    [-10.2, -33, 'cabinet'], [10.15, -42, 'crate'], [-9.95, -7, 'cabinet'],
  ];
  propData.forEach(([x, z, type], index) => {
    const side = Math.sign(x);
    const frontX = x - side;
    if (type === 'bin') {
      addBox(root, materials.paintedMetal, [0.92, 1.18, 1.04], [x, 0.75, z], { castShadow: true });
      addBox(root, materials.blackMetal, [1.04, 0.15, 1.16], [x, 1.4, z], {
        rotation: [0, 0, side * (index % 2 ? 0.045 : -0.035)],
      });
      addBox(root, materials.blackMetal, [0.055, 0.22, 0.62], [frontX + side * 0.505, 1.08, z]);
      for (const railZ of [-0.37, 0.37]) {
        addBox(root, materials.metal, [0.06, 0.48, 0.055], [frontX + side * 0.49, 1.03, z + railZ]);
        addBox(root, materials.blackMetal, [0.08, 0.08, 0.19], [x, 1.31, z + railZ]);
      }
      addBox(root, materials.blackMetal, [1.0, 0.1, 1.1], [x, 0.2, z]);
      for (const wheel of [-0.3, 0.3]) {
        addCylinder(root, UNIT_CYLINDER_16, materials.rubber, [0.13, 0.09, 0.13], [x + side * 0.46, 0.16, z + wheel], [0, 0, Math.PI / 2]);
      }
    } else if (type === 'cabinet') {
      addBox(root, materials.metal, [0.72, 1.82, 1.28], [x, 1.05, z], { castShadow: true });
      addBox(root, materials.blackMetal, [0.84, 0.1, 1.4], [x, 2.0, z]);
      addBox(root, materials.blackMetal, [0.82, 0.12, 1.34], [x, 0.17, z]);
      const panelX = x - side * 0.426;
      addStreetFacingPanel(root, materials.municipalService, [1.06, 1.5], [panelX, 1.1, z], side, 'MUNICIPAL_SERVICE_PANEL');
      for (const railZ of [-0.59, 0.59]) {
        addBox(root, materials.blackMetal, [0.07, 1.64, 0.055], [x - side * 0.4, 1.1, z + railZ]);
      }
      addBox(root, serviceIndicator, [0.035, 0.055, 0.11], [x - side * 0.448, 1.72, z + 0.44]);
      addCylinder(root, UNIT_CYLINDER_16, materials.copper, [0.035, 0.9, 0.035], [x + side * 0.27, 2.46, z + 0.43]);
    } else {
      addBox(root, materials.concreteDark, [0.78, 0.66, 1.16], [x, 0.48, z], { castShadow: true });
      addBox(root, materials.paintedMetal, [0.84, 0.1, 1.22], [x, 0.86, z]);
      const caseFrontX = x - side * 0.415;
      addBox(root, materials.paintedMetal, [0.055, 0.56, 1.02], [caseFrontX, 0.49, z]);
      for (const railZ of [-0.5, 0.5]) {
        addBox(root, materials.blackMetal, [0.07, 0.62, 0.075], [caseFrontX - side * 0.015, 0.5, z + railZ]);
      }
      for (const railY of [0.29, 0.68]) {
        addBox(root, materials.blackMetal, [0.07, 0.06, 0.9], [caseFrontX - side * 0.018, railY, z]);
      }
      for (const latchZ of [-0.23, 0.23]) {
        addBox(root, materials.metal, [0.075, 0.13, 0.11], [caseFrontX - side * 0.025, 0.61, z + latchZ]);
      }
      addBox(root, materials.blackMetal, [0.38, 0.06, 0.08], [x, 0.94, z]);
    }
  });
}

function addVendingMachine(root, materials, side, z, kind, color) {
  const x = side * 10.25;
  addBox(root, materials.paintedMetal, [0.94, 2.68, 1.42], [x, 1.4, z], { castShadow: true });
  addBox(root, materials.blackMetal, [1.08, 0.13, 1.54], [x, 2.79, z]);
  addBox(root, materials.blackMetal, [1.02, 0.16, 1.48], [x, 0.16, z]);
  for (const railZ of [-0.69, 0.69]) {
    addBox(root, materials.blackMetal, [1.02, 2.48, 0.07], [x, 1.46, z + railZ]);
  }
  for (const footZ of [-0.43, 0.43]) {
    addBox(root, materials.rubber, [0.62, 0.12, 0.18], [x + side * 0.08, 0.065, z + footZ]);
  }

  const panelX = x - side * 0.526;
  const panelMaterial = kind === 'essentials' ? materials.vendingEssentials : materials.vendingDrinks;
  addStreetFacingPanel(root, panelMaterial, [1.22, 2.42], [panelX, 1.46, z], side, `VENDING_${kind.toUpperCase()}_FRONT`);

  const indicator = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.28),
    emissive: color,
    emissiveIntensity: 1.3,
    roughness: 0.34,
  });
  addBox(root, indicator, [0.032, 0.045, 0.14], [x - side * 0.548, 2.2, z + 0.47]);
}

function addSideAlleys(root, materials) {
  const floorMaterial = materials.road.clone();
  floorMaterial.color.multiplyScalar(0.7);
  const wallMaterial = materials.concreteDark.clone();
  const amber = new THREE.MeshStandardMaterial({ color: 0x8b5a35, emissive: 0xff9d4f, emissiveIntensity: 1.8 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x315f62, emissive: 0x4ea9a6, emissiveIntensity: 1.15 });

  for (const side of [-1, 1]) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 4.65), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(side * 19.05, 0.025, 0);
    root.add(floor);
    addBox(root, wallMaterial, [0.5, 8.5, 4.8], [side * 27.0, 4.25, 0], { castShadow: true });
    addBox(root, materials.blackMetal, [14.8, 0.18, 0.18], [side * 19.0, 3.7, -2.0]);
    addBox(root, materials.copper, [14.5, 0.11, 0.11], [side * 19.0, 5.1, 1.5]);
    addBox(root, materials.paintedMetal, [1.05, 2.0, 1.1], [side * 24.8, 1.1, side > 0 ? 1.3 : -1.2]);
    addBox(root, materials.blackMetal, [0.65, 0.85, 1.2], [side * 21.8, 0.55, side > 0 ? -1.15 : 1.1]);
    addBox(root, side < 0 ? amber : cyan, [0.08, 0.11, 2.7], [side * 26.72, 3.4, 0]);
  }
}

function addSkybridge(root, materials) {
  const bridge = new THREE.Group();
  bridge.name = 'SERVICE_SKYBRIDGE';
  bridge.position.set(0, 13.25, -14);
  addBox(bridge, materials.blackMetal, [24.2, 0.34, 2.75], [0, -1.35, 0], { castShadow: true });
  addBox(bridge, materials.metal, [24.2, 0.28, 2.75], [0, 1.4, 0], { castShadow: true });
  for (const z of [-1.32, 1.32]) {
    addBox(bridge, materials.metal, [23.9, 0.1, 0.12], [0, -0.65, z]);
    addBox(bridge, materials.paintedMetal, [23.9, 0.08, 0.12], [0, 0.35, z]);
    addBox(bridge, materials.blackMetal, [23.9, 0.1, 0.12], [0, 1.18, z]);
  }
  for (let x = -11.7; x <= 11.7; x += 1.95) {
    for (const z of [-1.39, 1.39]) {
      addBox(bridge, materials.blackMetal, [0.09, 2.65, 0.1], [x, 0.02, z]);
    }
  }
  const warm = new THREE.MeshStandardMaterial({ color: 0x7d5a3c, emissive: 0xffb16c, emissiveIntensity: 1.55 });
  for (const x of [-7, 0, 7]) {
    addBox(bridge, warm, [1.4, 0.06, 0.14], [x, 1.2, 0]);
  }
  root.add(bridge);
}

function addHeroBillboard(root, materials) {
  const billboard = new THREE.Group();
  billboard.name = 'WARDWATCH_HERO_BILLBOARD';

  const centerX = 3.3;
  const centerY = 10.1;
  const centerZ = -3.9;

  addBox(billboard, materials.blackMetal, [8.85, 5.25, 0.24], [centerX, centerY, centerZ], {
    castShadow: true,
    name: 'WARDWATCH_FRAME',
  });

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.3, 4.7), materials.wardwatchScreen);
  screen.name = 'WARDWATCH_SCREEN';
  screen.position.set(centerX, centerY, centerZ + 0.125);
  screen.receiveShadow = false;
  screen.userData.noBatch = true;
  billboard.add(screen);

  const frameZ = centerZ + 0.16;
  addBox(billboard, materials.metal, [8.72, 0.12, 0.13], [centerX, centerY + 2.48, frameZ]);
  addBox(billboard, materials.metal, [8.72, 0.12, 0.13], [centerX, centerY - 2.48, frameZ]);
  addBox(billboard, materials.metal, [0.12, 4.9, 0.13], [centerX - 4.3, centerY, frameZ]);
  addBox(billboard, materials.metal, [0.12, 4.9, 0.13], [centerX + 4.3, centerY, frameZ]);

  for (const y of [centerY - 1.72, centerY + 1.72]) {
    addBox(billboard, materials.blackMetal, [4.25, 0.16, 0.16], [9.65, y, centerZ - 0.05]);
    addBox(billboard, materials.paintedMetal, [0.22, 0.58, 0.52], [11.68, y, centerZ - 0.05]);
  }

  root.add(billboard);
}

function addOverheadCables(root, materials) {
  const cableMaterial = materials.rubber;
  const crossStreet = [
    [[-10.2, 8.2, 33], [0, 6.7, 33.3], [10.2, 8.6, 32.7]],
    [[-10.4, 10.8, 11], [0, 8.9, 11.4], [10.2, 10.2, 10.8]],
    [[-10.1, 9.5, -25], [0, 7.8, -25.6], [10.3, 9.9, -24.9]],
    [[-10.2, 12.1, -44], [0, 10.4, -43.5], [10.3, 11.6, -44.2]],
  ];
  crossStreet.forEach((points, index) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.027 + index * 0.004, 5, false), cableMaterial);
    root.add(cable);
  });
  for (const side of [-1, 1]) {
    for (let cableIndex = 0; cableIndex < 3; cableIndex += 1) {
      const x = side * (10.25 + cableIndex * 0.16);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 7.7 + cableIndex * 0.22, -54),
        new THREE.Vector3(x + side * 0.18, 7.1 + cableIndex * 0.21, -18),
        new THREE.Vector3(x - side * 0.15, 7.35 + cableIndex * 0.22, 18),
        new THREE.Vector3(x, 7.85 + cableIndex * 0.2, 54),
      ]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.018, 4, false), cableMaterial));
    }
  }
}

function addFarTransit(root, materials, renderer) {
  const structure = new THREE.Group();
  structure.name = 'DISTANT_ELEVATED_SERVICE_LINE';
  structure.position.z = -59;
  for (const x of [-15, 15]) {
    addBox(structure, materials.concreteDark, [2.1, 11, 2.6], [x, 5.5, 0], { castShadow: true });
    addBox(structure, materials.metal, [3.4, 0.5, 3.5], [x, 10.8, 0]);
  }
  addBox(structure, materials.blackMetal, [42, 1.2, 4.8], [0, 11.3, 0], { castShadow: true });
  addBox(structure, materials.paintedMetal, [42, 0.22, 5.4], [0, 12.0, 0]);
  for (let x = -20; x <= 20; x += 3.2) {
    addBox(structure, materials.metal, [0.16, 1.5, 5.0], [x, 11.1, 0], { rotation: [0.28 * (x % 2 ? 1 : -1), 0, 0] });
  }
  const signTexture = createWayfindingTexture(STREET_SIGNS[0]);
  signTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signTexture,
    emissiveMap: signTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.5,
    roughness: 0.45,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 2.2), signMaterial);
  sign.position.set(0, 8.55, 2.45);
  structure.add(sign);
  root.add(structure);
}

function addDistantCity(root, materials) {
  const random = seededRandom(72401);
  const count = 88;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const skylineMaterial = materials.concreteDark.clone();
  skylineMaterial.color.set(0x22292a);
  skylineMaterial.roughness = 0.82;
  const skyline = new THREE.InstancedMesh(geometry, skylineMaterial, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    const behind = index < count * 0.64;
    const z = behind ? -72 - random() * 105 : 67 + random() * 88;
    const side = random() > 0.5 ? 1 : -1;
    const x = side * (25 + random() * 82);
    const width = 5 + random() * 16;
    const depth = 6 + random() * 18;
    const height = 15 + Math.pow(random(), 0.48) * 92;
    position.set(x, height / 2 - 1, z);
    scale.set(width, height, depth);
    matrix.compose(position, quaternion, scale);
    skyline.setMatrixAt(index, matrix);
  }
  skyline.instanceMatrix.needsUpdate = true;
  skyline.name = 'FOGGED_DISTANT_CITY';
  root.add(skyline);

  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x594838, toneMapped: false });
  const windowGeometry = new THREE.BoxGeometry(0.12, 0.12, 2.0);
  for (let index = 0; index < 28; index += 1) {
    const light = new THREE.Mesh(windowGeometry, windowMaterial);
    light.position.set((random() > 0.5 ? 1 : -1) * (28 + random() * 60), 12 + random() * 50, -70 - random() * 80);
    light.rotation.y = random() * Math.PI;
    root.add(light);
  }
}

export function createCyberCity({ scene, renderer, isQuest = false }) {
  const root = new THREE.Group();
  root.name = 'LOWER_WARD_BLOCK_03';
  scene.add(root);
  const animated = [];
  const colliders = [];
  const slotGroups = new Map();
  const materials = createMaterialLibrary(renderer, { isQuest });

  addSky(scene);
  addLighting(scene, isQuest);
  addRoad(root, materials);
  addRoadHardware(root, materials);
  addStreetFurniture(root, materials, isQuest);
  addVendingMachine(root, materials, -1, 28.5, 'drinks', 0x4ca7a3);
  addVendingMachine(root, materials, 1, 3.7, 'essentials', 0xc26a49);
  addVendingMachine(root, materials, -1, -21.5, 'essentials', 0xa84c63);
  addSideAlleys(root, materials);
  addHeroBillboard(root, materials);
  addSkybridge(root, materials);
  addOverheadCables(root, materials);
  addFarTransit(root, materials, renderer);
  addDistantCity(root, materials);
  batchStaticMeshes(
    root,
    [UNIT_BOX, UNIT_CYLINDER_8, UNIT_CYLINDER_16, UNIT_CYLINDER_32, UNIT_PLANE],
    { prefix: 'district__batch' },
  );

  const factory = new BuildingFactory({ renderer, animated, materials, isQuest });
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
    materials,
  };
}
