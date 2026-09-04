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
const UNIT_CIRCLE_14 = new THREE.CircleGeometry(1, 14);
const UNIT_CIRCLE_20 = new THREE.CircleGeometry(1, 20);

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

  const distantWarmth = new THREE.DirectionalLight(0xd17754, 0.17);
  distantWarmth.position.set(18, 12, -60);
  distantWarmth.target.position.set(0, 4, 18);
  scene.add(distantWarmth, distantWarmth.target);
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

  const patchMaterial = materials.road.clone();
  patchMaterial.color.set(0x4b4e4d);
  patchMaterial.roughness = 0.48;
  const random = seededRandom(21903);
  for (let index = 0; index < 13; index += 1) {
    const patch = new THREE.Mesh(UNIT_CIRCLE_14, patchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = random() * Math.PI;
    patch.scale.set(0.45 + random() * 1.25, 0.16 + random() * 0.48, 1);
    patch.position.set((random() - 0.5) * 9.8, 0.028, -50 + random() * 100);
    root.add(patch);
  }

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

  const puddleMaterial = new THREE.MeshStandardMaterial({
    color: 0x202b2d,
    roughness: 0.08,
    metalness: 0.28,
    envMapIntensity: 1.8,
  });
  for (let index = 0; index < 22; index += 1) {
    const puddle = new THREE.Mesh(UNIT_CIRCLE_20, puddleMaterial);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = random() * Math.PI;
    puddle.scale.set(0.35 + random() * 1.7, 0.15 + random() * 0.52, 1);
    puddle.position.set((random() - 0.5) * 11.7, 0.052, -50 + random() * 100);
    root.add(puddle);
  }

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

function addLamp(root, materials, side, z, index, glowTexture, isQuest) {
  const x = side * 9.45;
  addCylinder(root, UNIT_CYLINDER_8, materials.blackMetal, [0.11, 5.35, 0.11], [x, 2.72, z]);
  addBox(root, materials.metal, [1.65, 0.1, 0.11], [x - side * 0.76, 5.22, z], { rotation: [0, 0, side * -0.08] });
  addBox(root, materials.blackMetal, [0.78, 0.24, 0.42], [x - side * 1.58, 5.06, z], { castShadow: true });
  const lampColor = index % 4 === 3 ? 0xa8d0cb : 0xffb16e;
  const emissive = new THREE.MeshStandardMaterial({
    color: lampColor,
    emissive: lampColor,
    emissiveIntensity: 2.2,
    roughness: 0.32,
  });
  addBox(root, emissive, [0.56, 0.055, 0.27], [x - side * 1.58, 4.91, z]);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: lampColor,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.position.set(x - side * 1.58, 4.83, z);
  sprite.scale.set(2.1, 2.1, 1);
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
  const lampPositions = [-43, -27, -10, 8, 25, 42];
  lampPositions.forEach((z, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    addLamp(root, materials, side, z, index, glowTexture, isQuest);
  });

  for (const side of [-1, 1]) {
    for (let z = -44; z <= 44; z += 8.8) {
      addCylinder(root, UNIT_CYLINDER_8, materials.paintedMetal, [0.095, 0.82, 0.095], [side * 7.0, 0.49, z]);
      addCylinder(root, UNIT_CYLINDER_8, materials.blackMetal, [0.13, 0.08, 0.13], [side * 7.0, 0.89, z]);
    }
  }

  const propData = [
    [-10.25, 36, 'bin'], [10.1, 29, 'crate'], [-10.0, 13, 'crate'], [10.05, -17, 'bin'],
    [-10.2, -33, 'cabinet'], [10.15, -42, 'crate'], [-9.95, -7, 'cabinet'],
  ];
  propData.forEach(([x, z, type], index) => {
    if (type === 'bin') {
      addBox(root, materials.paintedMetal, [0.9, 1.2, 0.95], [x, 0.72, z], { castShadow: true });
      addBox(root, materials.blackMetal, [0.98, 0.12, 1.02], [x, 1.36, z], { rotation: [0, 0, index % 2 ? 0.04 : -0.04] });
      for (const wheel of [-0.3, 0.3]) {
        addCylinder(root, UNIT_CYLINDER_16, materials.rubber, [0.12, 0.08, 0.12], [x + 0.46 * Math.sign(x), 0.2, z + wheel], [0, 0, Math.PI / 2]);
      }
    } else if (type === 'cabinet') {
      addBox(root, materials.metal, [0.58, 1.55, 1.18], [x, 0.9, z], { castShadow: true });
      addBox(root, materials.blackMetal, [0.08, 1.24, 0.88], [x - Math.sign(x) * 0.33, 0.94, z]);
      for (let y = 0.48; y <= 1.35; y += 0.22) {
        addBox(root, materials.paintedMetal, [0.07, 0.055, 0.68], [x - Math.sign(x) * 0.39, y, z]);
      }
    } else {
      addBox(root, materials.concreteDark, [0.72, 0.62, 1.1], [x, 0.44, z], { castShadow: true });
      addBox(root, materials.paintedMetal, [0.76, 0.05, 1.14], [x, 0.77, z]);
      addBox(root, materials.blackMetal, [0.04, 0.64, 1.15], [x - Math.sign(x) * 0.39, 0.46, z]);
    }
  });
}

function addVendingMachine(root, materials, side, z, color) {
  const x = side * 10.25;
  const body = new THREE.Group();
  body.position.set(x, 1.18, z);
  addBox(body, materials.paintedMetal, [0.8, 2.36, 1.18], [0, 0, 0], { castShadow: true });
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.5),
    emissive: color,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  });
  addBox(body, lightMaterial, [0.055, 1.25, 0.84], [-side * 0.43, 0.32, 0]);
  addBox(body, materials.darkGlass, [0.06, 0.72, 0.62], [-side * 0.47, 0.5, 0]);
  for (let row = -0.18; row <= 0.72; row += 0.3) {
    addBox(body, materials.blackMetal, [0.065, 0.035, 0.62], [-side * 0.5, row, 0]);
  }
  addBox(body, materials.blackMetal, [0.08, 0.28, 0.55], [-side * 0.48, -0.76, 0]);
  root.add(body);
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
  addVendingMachine(root, materials, -1, 28.5, 0x4ca7a3);
  addVendingMachine(root, materials, 1, 3.7, 0xc26a49);
  addVendingMachine(root, materials, -1, -21.5, 0xa84c63);
  addSideAlleys(root, materials);
  addHeroBillboard(root, materials);
  addSkybridge(root, materials);
  addOverheadCables(root, materials);
  addFarTransit(root, materials, renderer);
  addDistantCity(root, materials);
  batchStaticMeshes(
    root,
    [UNIT_BOX, UNIT_CYLINDER_8, UNIT_CYLINDER_16, UNIT_CYLINDER_32, UNIT_PLANE, UNIT_CIRCLE_14, UNIT_CIRCLE_20],
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
