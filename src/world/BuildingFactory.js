import * as THREE from 'three';
import { createRadialTexture, seededRandom } from './proceduralTextures.js';
import { batchStaticMeshes } from './batchStaticMeshes.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function addBox(parent, geometry, material, size, position, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.name) mesh.name = options.name;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, geometry, material, position, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (options.scale) mesh.scale.set(...options.scale);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function addInstancedBoxes(parent, geometry, material, instances, name) {
  if (!instances.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
  mesh.name = name;
  instances.forEach(({ size, position, rotation = null }, index) => {
    _position.set(...position);
    _quaternion.identity();
    if (rotation) _quaternion.setFromEuler(new THREE.Euler(...rotation));
    _scale.set(...size);
    _matrix.compose(_position, _quaternion, _scale);
    mesh.setMatrixAt(index, _matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeSignTexture({ title, subtitle, localLabel, accent, vertical = false, seed = 1 }) {
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 384 : 1024;
  canvas.height = vertical ? 768 : 256;
  const context = canvas.getContext('2d');
  const random = seededRandom(seed);
  const width = canvas.width;
  const height = canvas.height;

  context.fillStyle = '#111515';
  context.fillRect(0, 0, width, height);
  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, 'rgba(255,255,255,.025)');
  wash.addColorStop(0.45, 'rgba(0,0,0,.08)');
  wash.addColorStop(1, 'rgba(255,255,255,.018)');
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  context.fillStyle = accent;
  if (vertical) context.fillRect(18, 18, 8, height - 36);
  else context.fillRect(20, 18, width - 40, 8);
  context.strokeStyle = 'rgba(197,207,201,.3)';
  context.lineWidth = 2;
  context.strokeRect(12, 12, width - 24, height - 24);

  context.textBaseline = 'middle';
  if (vertical) {
    context.textAlign = 'center';
    context.fillStyle = '#e7e4da';
    context.font = '800 78px Arial, sans-serif';
    const chars = [...title].filter((character) => character !== ' ').slice(0, 4);
    chars.forEach((character, index) => {
      context.fillText(character, width * 0.52, 130 + index * 118);
    });
    context.save();
    context.translate(width - 34, height - 30);
    context.rotate(-Math.PI / 2);
    context.textAlign = 'left';
    context.fillStyle = accent;
    context.font = '700 25px monospace';
    context.fillText(title, 0, 0);
    context.restore();
  } else {
    context.textAlign = 'left';
    context.fillStyle = '#e9e6dc';
    context.font = '900 92px Arial Narrow, Arial, sans-serif';
    context.fillText(title, 46, 116);
    context.fillStyle = accent;
    context.font = '700 26px monospace';
    context.fillText(subtitle, 52, 196);
    context.textAlign = 'right';
    context.fillStyle = 'rgba(232,230,219,.72)';
    context.font = '700 54px sans-serif';
    context.fillText(localLabel || '', width - 48, 140);
  }

  for (let index = 0; index < 210; index += 1) {
    const value = 95 + Math.floor(random() * 80);
    context.fillStyle = `rgba(${value},${value},${value},${0.025 + random() * 0.08})`;
    context.fillRect(random() * width, random() * height, 1 + random() * 6, 1 + random() * 2);
  }
  for (let index = 0; index < 14; index += 1) {
    context.fillStyle = `rgba(0,0,0,${0.04 + random() * 0.1})`;
    context.fillRect(random() * width, random() * height, 14 + random() * 70, 1 + random() * 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export class BuildingFactory {
  constructor({ renderer, animated, materials, isQuest = false }) {
    this.renderer = renderer;
    this.animated = animated;
    this.materials = materials;
    this.isQuest = isQuest;
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.cylinder8 = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.cylinder12 = new THREE.CylinderGeometry(1, 1, 1, 12);
    this.cylinder20 = new THREE.CylinderGeometry(1, 1, 1, 20);
    this.torus = new THREE.TorusGeometry(1, 0.11, 8, 24);
    this.posterGeometry = new THREE.PlaneGeometry(0.72, 1.0);
    this.radialGlow = createRadialTexture([
      [0, 'rgba(255,255,255,.95)'],
      [0.08, 'rgba(255,245,220,.72)'],
      [0.3, 'rgba(255,178,110,.2)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  create(definition) {
    const group = new THREE.Group();
    group.name = `BUILDING_SLOT__${definition.id}`;
    group.position.set(...definition.position);
    group.userData = {
      type: 'building-slot',
      slotId: definition.id,
      replaceable: true,
      units: 'metres',
      forward: '-Z',
    };

    const random = seededRandom(definition.seed);
    const wallMaterial = this.materials[definition.material].clone();
    wallMaterial.color.offsetHSL((random() - 0.5) * 0.018, -0.02, (random() - 0.5) * 0.055);
    wallMaterial.name = `${definition.id}__wall`;

    this.#createMassing(group, definition, wallMaterial, random);
    this.#createGroundFloor(group, definition, random);
    this.#createUpperFacade(group, definition, random);
    this.#createBalconies(group, definition, random);
    this.#createInfrastructure(group, definition, random);
    this.#createSigns(group, definition);
    this.#createRoof(group, definition, wallMaterial, random);
    batchStaticMeshes(
      group,
      [this.boxGeometry, this.cylinder8, this.cylinder12, this.cylinder20, this.torus, this.posterGeometry],
      { prefix: `${definition.id}__batch`, recursive: false },
    );

    const anchor = new THREE.Object3D();
    anchor.name = `GLB_ANCHOR__${definition.id}`;
    anchor.userData = {
      accept: '.glb,.gltf',
      convention: '+Y up, -Z forward, metres, positive scale',
    };
    group.add(anchor);
    return group;
  }

  #createMassing(group, definition, wallMaterial, random) {
    const [width, height, depth] = definition.size;
    addBox(group, this.boxGeometry, wallMaterial, [width, height, depth], [0, height / 2, 0], {
      name: `${definition.id}__shell`,
      castShadow: true,
    });

    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.04);
    addBox(group, this.boxGeometry, this.materials.concreteDark, [0.3, 4.9, depth - 0.6], [facadeX, 2.45, 0]);
    addBox(group, this.boxGeometry, this.materials.metal, [0.34, 0.25, depth], [facadeX + direction * 0.06, 5.02, 0]);

    const pilasters = [];
    const bayCount = 7;
    for (let index = 0; index <= bayCount; index += 1) {
      const z = -depth / 2 + 0.8 + index * ((depth - 1.6) / bayCount);
      pilasters.push({ size: [0.34, 5.1, 0.25], position: [facadeX + direction * 0.18, 2.55, z] });
    }
    addInstancedBoxes(group, this.boxGeometry, this.materials.blackMetal, pilasters, `${definition.id}__ground-pilasters`);

    if (definition.profile === 'workshop' || definition.profile === 'capsules') {
      const heightA = definition.profile === 'capsules' ? 6.2 : 4.2;
      addBox(
        group,
        this.boxGeometry,
        wallMaterial,
        [width * 0.78, heightA, depth * 0.63],
        [definition.side * 0.45, height + heightA / 2, -2.5],
        { castShadow: true },
      );
    }
    if (definition.profile === 'capsules') {
      addBox(
        group,
        this.boxGeometry,
        this.materials.paintedMetal,
        [width * 0.5, 3.2, depth * 0.34],
        [definition.side * 1.1, height + 7.7, -6],
        { castShadow: true },
      );
    }

    const repairPatches = [];
    for (let index = 0; index < 8; index += 1) {
      const patchHeight = 0.6 + random() * 1.8;
      repairPatches.push({
        size: [0.08, patchHeight, 0.5 + random() * 1.4],
        position: [facadeX + direction * 0.2, 7 + random() * Math.max(5, height - 10), -depth * 0.43 + random() * depth * 0.86],
      });
    }
    const patchMaterial = new THREE.MeshStandardMaterial({ color: 0x505755, roughness: 0.78, metalness: 0.02 });
    addInstancedBoxes(group, this.boxGeometry, patchMaterial, repairPatches, `${definition.id}__wall-repairs`);
  }

  #createGroundFloor(group, definition, random) {
    const [width, , depth] = definition.size;
    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.2);
    const bayCount = 7;
    const baySpan = (depth - 1.7) / bayCount;
    const accent = new THREE.Color(definition.accent);
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accent.clone().multiplyScalar(0.58),
      emissive: accent,
      emissiveIntensity: 0.72,
      roughness: 0.36,
      metalness: 0.25,
    });
    const warmInterior = new THREE.MeshStandardMaterial({
      color: 0x765238,
      roughness: 0.68,
      metalness: 0.02,
    });
    const coolInterior = new THREE.MeshStandardMaterial({
      color: 0x294144,
      roughness: 0.62,
      metalness: 0.04,
    });
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x171718, roughness: 0.55, metalness: 0.35 });

    for (let index = 0; index < bayCount; index += 1) {
      const z = -depth / 2 + 0.85 + baySpan / 2 + index * baySpan;
      const type = definition.shops[index % definition.shops.length];
      const closed = type === 'shutter' || (index === 6 && random() > 0.35);
      const frameDepth = baySpan - 0.34;

      addBox(group, this.boxGeometry, this.materials.blackMetal, [0.24, 3.7, frameDepth], [facadeX, 2.42, z]);
      if (closed) {
        addBox(group, this.boxGeometry, this.materials.shutter, [0.16, 3.2, frameDepth - 0.38], [facadeX + direction * 0.15, 2.2, z]);
        addBox(group, this.boxGeometry, this.materials.metal, [0.28, 0.18, frameDepth - 0.2], [facadeX + direction * 0.22, 3.88, z]);
        const lock = addCylinder(
          group,
          this.cylinder12,
          this.materials.copper,
          [facadeX + direction * 0.34, 1.08, z + frameDepth * 0.22],
          { scale: [0.1, 0.06, 0.1], rotation: [0, 0, Math.PI / 2] },
        );
        lock.name = `${definition.id}__shutter-lock`;
      } else {
        const backing = type === 'eatery' || type === 'pharmacy' ? warmInterior : coolInterior;
        addBox(group, this.boxGeometry, backing, [0.08, 3.05, frameDepth - 0.45], [facadeX - direction * 0.03, 2.23, z]);
        addBox(group, this.boxGeometry, this.materials.glass, [0.13, 3.08, frameDepth - 0.45], [facadeX + direction * 0.23, 2.23, z]);

        const mullions = [];
        for (let split = -1; split <= 1; split += 1) {
          mullions.push({
            size: [0.22, 3.12, 0.065],
            position: [facadeX + direction * 0.31, 2.23, z + split * frameDepth * 0.25],
          });
        }
        mullions.push({ size: [0.23, 0.09, frameDepth - 0.4], position: [facadeX + direction * 0.31, 1.12, z] });
        addInstancedBoxes(group, this.boxGeometry, this.materials.blackMetal, mullions, `${definition.id}__shop-${index}-frames`);

        for (let shelf = 0; shelf < 3; shelf += 1) {
          addBox(
            group,
            this.boxGeometry,
            shelfMaterial,
            [0.11, 0.08, frameDepth * 0.42],
            [facadeX + direction * 0.04, 1.25 + shelf * 0.7, z - frameDepth * 0.18],
          );
        }
        addBox(
          group,
          this.boxGeometry,
          this.materials.blackMetal,
          [0.22, 2.7, frameDepth * 0.25],
          [facadeX + direction * 0.34, 2.03, z + frameDepth * 0.33],
        );
      }

      const hasCanopy = index % 2 === 0 || type === 'eatery' || type === 'pharmacy';
      if (hasCanopy) {
        const canopy = addBox(
          group,
          this.boxGeometry,
          index % 3 === 0 ? this.materials.shutter : this.materials.paintedMetal,
          [1.72, 0.15, frameDepth + 0.2],
          [facadeX + direction * 0.87, 4.32, z],
          { castShadow: true },
        );
        canopy.rotation.z = definition.side * 0.055;
        addBox(
          group,
          this.boxGeometry,
          this.materials.blackMetal,
          [0.12, 0.16, frameDepth + 0.28],
          [facadeX + direction * 1.72, 4.22, z],
        );
        if (!closed && (type === 'eatery' || type === 'pharmacy' || index === 3)) {
          const tube = addBox(
            group,
            this.boxGeometry,
            accentMaterial,
            [0.065, 0.065, frameDepth * 0.58],
            [facadeX + direction * 0.82, 4.08, z],
          );
          tube.name = `${definition.id}__shop-light`;
        }
      }

      if ((index + definition.seed) % 3 === 0) {
        const posterKeys = ['posterTransit', 'posterMaintenance', 'posterProvisions', 'posterStorm'];
        const posterKey = posterKeys[(definition.seed + index * 5) % posterKeys.length];
        const poster = new THREE.Mesh(this.posterGeometry, this.materials[posterKey]);
        poster.position.set(facadeX + direction * 0.37, 1.86, z - frameDepth * 0.31);
        poster.rotation.y = -definition.side * Math.PI / 2;
        group.add(poster);
      }

    }
  }

  #createUpperFacade(group, definition, random) {
    const [width, height, depth] = definition.size;
    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.13);
    const facadeHeight = Math.min(height - 0.5, 28);
    const atlasKey = definition.facadeAtlas || (definition.material === 'brick' ? 'facadeMixed' : 'facadeIndustrial');
    const facadeMaterial = this.materials[atlasKey].clone();
    facadeMaterial.color.offsetHSL((random() - 0.5) * 0.012, -0.015, (random() - 0.5) * 0.035);
    facadeMaterial.name = `${definition.id}__facade-atlas`;

    const facade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), facadeMaterial);
    facade.name = `${definition.id}__facade-detail`;
    facade.position.set(facadeX, facadeHeight * 0.5, 0);
    facade.rotation.y = direction * Math.PI / 2;
    facade.scale.set(depth - 0.7, facadeHeight, 1);
    facade.receiveShadow = true;
    group.add(facade);

    const ledgeProfiles = {
      apartments: [0.255, 0.5, 0.745],
      tenement: [0.2, 0.39, 0.58, 0.77],
      workshop: [0.34, 0.67],
      capsules: [0.205, 0.405, 0.605, 0.805],
    };
    const ledges = (ledgeProfiles[definition.profile] || ledgeProfiles.apartments)
      .map((ratio) => ratio * facadeHeight)
      .filter((y) => y > 5.5 && y < facadeHeight - 1.2)
      .map((y) => ({
        size: [0.24, 0.1, depth - 0.9],
        position: [facadeX + direction * 0.08, y, 0],
      }));
    addInstancedBoxes(group, this.boxGeometry, this.materials.paintedMetal, ledges, `${definition.id}__facade-ledges`);

    const structuralRibs = [];
    if (definition.profile === 'workshop') {
      for (const ratio of [-0.34, 0.02, 0.37]) {
        structuralRibs.push({
          size: [0.3, facadeHeight - 5.4, 0.24],
          position: [facadeX + direction * 0.16, (facadeHeight + 5.4) * 0.5, ratio * depth],
        });
      }
    } else if (definition.profile === 'capsules') {
      for (const ratio of [-0.27, 0, 0.29]) {
        structuralRibs.push({
          size: [0.25, facadeHeight - 5.2, ratio === 0 ? 0.42 : 0.18],
          position: [facadeX + direction * 0.15, (facadeHeight + 5.2) * 0.5, ratio * depth],
        });
      }
    }
    addInstancedBoxes(group, this.boxGeometry, this.materials.metal, structuralRibs, `${definition.id}__profile-ribs`);
  }

  #createBalconies(group, definition, random) {
    const [width, height] = definition.size;
    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.24);
    const levels = definition.profile === 'capsules' ? [9.6, 16.0, 22.3] : [9.5, 15.8];
    const centerZ = definition.seed % 2 ? -8.6 : 8.2;
    const platformLength = definition.profile === 'tenement' ? 7.2 : 5.5;

    levels.filter((level) => level < height - 2).forEach((level, levelIndex) => {
      const z = centerZ + (levelIndex % 2 ? 5.8 : 0);
      addBox(
        group,
        this.boxGeometry,
        this.materials.metal,
        [1.5, 0.16, platformLength],
        [facadeX + direction * 0.7, level, z],
        { castShadow: true },
      );
      const rails = [
        { size: [0.08, 0.08, platformLength], position: [facadeX + direction * 1.43, level + 1.05, z] },
        { size: [0.08, 0.06, platformLength], position: [facadeX + direction * 1.43, level + 0.52, z] },
      ];
      for (let offset = -platformLength / 2; offset <= platformLength / 2 + 0.01; offset += 0.85) {
        rails.push({ size: [0.075, 1.02, 0.075], position: [facadeX + direction * 1.43, level + 0.55, z + offset] });
      }
      addInstancedBoxes(group, this.boxGeometry, this.materials.blackMetal, rails, `${definition.id}__balcony-${levelIndex}-rails`);
      addBox(
        group,
        this.boxGeometry,
        this.materials.paintedMetal,
        [0.7, 0.62, 0.9],
        [facadeX + direction * 1.0, level + 0.4, z - platformLength * 0.28],
      );
      if (random() > 0.4) {
        addBox(
          group,
          this.boxGeometry,
          this.materials.rubber,
          [0.35, 0.55, 0.55],
          [facadeX + direction * 1.1, level + 0.36, z + platformLength * 0.3],
        );
      }
    });

    if (definition.profile === 'workshop' || definition.profile === 'tenement') {
      this.#createFireEscape(group, definition, facadeX, direction, centerZ);
    }
  }

  #createFireEscape(group, definition, facadeX, direction, centerZ) {
    const [, height] = definition.size;
    const levels = [7.2, 12.6, 18.0, 23.4].filter((level) => level < height - 1.8);
    levels.forEach((level, levelIndex) => {
      const z = centerZ - 11.5;
      addBox(group, this.boxGeometry, this.materials.blackMetal, [1.2, 0.12, 3.7], [facadeX + direction * 0.58, level, z]);
      const railParts = [];
      for (let offset = -1.7; offset <= 1.7; offset += 0.68) {
        railParts.push({ size: [0.07, 0.92, 0.07], position: [facadeX + direction * 1.15, level + 0.49, z + offset] });
      }
      railParts.push({ size: [0.07, 0.07, 3.6], position: [facadeX + direction * 1.15, level + 0.95, z] });
      addInstancedBoxes(group, this.boxGeometry, this.materials.metal, railParts, `${definition.id}__escape-${levelIndex}`);

      if (levelIndex < levels.length - 1) {
        const stepCount = 12;
        const targetLevel = levels[levelIndex + 1];
        for (let step = 0; step < stepCount; step += 1) {
          const progress = step / (stepCount - 1);
          addBox(
            group,
            this.boxGeometry,
            this.materials.metal,
            [1.04, 0.07, 0.34],
            [
              facadeX + direction * 1.0,
              level + 0.2 + progress * (targetLevel - level - 0.4),
              z - 1.35 + progress * 2.7,
            ],
          );
        }
      }
    });
  }

  #createInfrastructure(group, definition, random) {
    const [width, height, depth] = definition.size;
    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.36);
    const pipeColors = [this.materials.copper, this.materials.metal, this.materials.paintedMetal];

    for (let index = 0; index < 4; index += 1) {
      const radius = index % 2 ? 0.085 : 0.13;
      const z = -depth * 0.36 + index * depth * 0.235;
      const pipeHeight = Math.min(height - 3, 14 + random() * height * 0.45);
      addCylinder(
        group,
        this.cylinder8,
        pipeColors[index % pipeColors.length],
        [facadeX + direction * (index * 0.035), 5 + pipeHeight / 2, z],
        { scale: [radius, pipeHeight, radius] },
      );
      for (let y = 6; y < 5 + pipeHeight; y += 2.9) {
        addCylinder(
          group,
          this.cylinder8,
          this.materials.blackMetal,
          [facadeX + direction * (index * 0.035), y, z],
          { scale: [radius * 1.45, 0.11, radius * 1.45] },
        );
      }
      addBox(
        group,
        this.boxGeometry,
        this.materials.blackMetal,
        [0.42, 0.55, 0.46],
        [facadeX + direction * 0.05, 7.2 + index * 3.15, z + 0.42],
      );
    }

    const acCount = 5;
    for (let index = 0; index < acCount; index += 1) {
      const z = -depth / 2 + 4.2 + index * ((depth - 8.4) / (acCount - 1));
      const y = 8.1 + ((index * 5 + definition.seed) % Math.max(7, Math.floor(height - 12)));
      addBox(group, this.boxGeometry, this.materials.paintedMetal, [0.82, 1.18, 1.5], [facadeX + direction * 0.22, y, z], { castShadow: true });
      addBox(group, this.boxGeometry, this.materials.blackMetal, [0.12, 0.9, 1.18], [facadeX + direction * 0.68, y, z]);
      const fan = addCylinder(
        group,
        this.cylinder20,
        this.materials.metal,
        [facadeX + direction * 0.76, y, z],
        { scale: [0.38, 0.07, 0.38], rotation: [0, 0, Math.PI / 2] },
      );
      fan.name = `${definition.id}__ac-fan`;
      const grille = addCylinder(
        group,
        this.torus,
        this.materials.blackMetal,
        [facadeX + direction * 0.84, y, z],
        { scale: [0.39, 0.39, 0.39], rotation: [0, Math.PI / 2, 0] },
      );
      grille.name = `${definition.id}__ac-grille`;
      addBox(group, this.boxGeometry, this.materials.blackMetal, [0.08, 0.07, 0.8], [facadeX + direction * 0.88, y, z]);
      addBox(group, this.boxGeometry, this.materials.blackMetal, [0.08, 0.8, 0.07], [facadeX + direction * 0.88, y, z]);
    }

    const conduitY = 6.05 + (definition.seed % 3) * 0.5;
    addBox(group, this.boxGeometry, this.materials.copper, [0.1, 0.1, depth - 2], [facadeX + direction * 0.12, conduitY, 0]);
    for (let z = -depth * 0.4; z <= depth * 0.4; z += 5.8) {
      addBox(group, this.boxGeometry, this.materials.metal, [0.36, 0.52, 0.48], [facadeX + direction * 0.22, conduitY, z]);
    }
  }

  #createSigns(group, definition) {
    const [width, height, depth] = definition.size;
    const direction = -definition.side;
    const facadeX = direction * (width / 2 + 0.65);
    const accent = `#${new THREE.Color(definition.accent).getHexString()}`;
    const wideTexture = makeSignTexture({
      title: definition.label,
      subtitle: definition.sublabel,
      localLabel: definition.localLabel,
      accent,
      seed: definition.seed,
    });
    wideTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const wideMaterial = new THREE.MeshStandardMaterial({
      map: wideTexture,
      emissiveMap: wideTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.38,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });
    const signZ = definition.seed % 2 ? depth * 0.19 : -depth * 0.18;
    addBox(group, this.boxGeometry, this.materials.blackMetal, [0.24, 1.6, 5.7], [facadeX - direction * 0.16, Math.min(height - 3.2, 11.2), signZ]);
    const wide = new THREE.Mesh(new THREE.PlaneGeometry(5.35, 1.34), wideMaterial);
    wide.name = `${definition.id}__primary-sign`;
    wide.position.set(facadeX, Math.min(height - 3.2, 11.2), signZ);
    wide.rotation.y = -definition.side * Math.PI / 2;
    group.add(wide);

    const bladeTexture = makeSignTexture({
      title: definition.label,
      subtitle: definition.sublabel,
      localLabel: definition.localLabel,
      accent,
      vertical: true,
      seed: definition.seed + 101,
    });
    bladeTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const bladeMaterial = new THREE.MeshStandardMaterial({
      map: bladeTexture,
      emissiveMap: bladeTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.82,
      roughness: 0.32,
      metalness: 0.18,
      side: THREE.DoubleSide,
    });
    const bladeZ = definition.seed % 2 ? -depth * 0.32 : depth * 0.31;
    addBox(group, this.boxGeometry, this.materials.blackMetal, [1.95, 3.45, 0.18], [facadeX + direction * 0.9, 7.15, bladeZ]);
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 3.18), bladeMaterial);
    blade.name = `${definition.id}__blade-sign`;
    blade.position.set(facadeX + direction * 0.92, 7.15, bladeZ + 0.1);
    group.add(blade);

    const bracketParts = [
      { size: [1.85, 0.08, 0.08], position: [facadeX + direction * 0.78, 8.55, bladeZ] },
      { size: [1.85, 0.08, 0.08], position: [facadeX + direction * 0.78, 5.75, bladeZ] },
    ];
    addInstancedBoxes(group, this.boxGeometry, this.materials.metal, bracketParts, `${definition.id}__sign-brackets`);

    const glowMaterial = new THREE.SpriteMaterial({
      map: this.radialGlow,
      color: definition.accent,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(facadeX + direction * 1.05, 7.15, bladeZ);
    glow.scale.set(3.1, 4.5, 1);
    group.add(glow);
    this.animated.push((elapsed) => {
      const fault = Math.sin(elapsed * 8.1 + definition.seed) > 0.992 ? 0.34 : 1;
      wideMaterial.emissiveIntensity = 0.66 * fault;
      bladeMaterial.emissiveIntensity = 0.78 * fault;
      glowMaterial.opacity = 0.13 + Math.sin(elapsed * 1.2 + definition.seed) * 0.025;
    });
  }

  #createRoof(group, definition, wallMaterial, random) {
    const [width, height, depth] = definition.size;
    addBox(group, this.boxGeometry, this.materials.concreteDark, [width + 0.45, 0.72, depth + 0.45], [0, height + 0.35, 0], { castShadow: true });

    if (definition.profile === 'apartments') {
      addBox(group, this.boxGeometry, wallMaterial, [width * 0.62, 2.4, depth * 0.24], [definition.side * 0.65, height + 1.55, -depth * 0.2], { castShadow: true });
      const tankZ = depth * 0.18;
      addCylinder(
        group,
        this.cylinder20,
        this.materials.paintedMetal,
        [definition.side * 0.7, height + 2.1, tankZ],
        { scale: [1.55, 3.2, 1.55], castShadow: true },
      );
      for (let y = height + 0.9; y <= height + 3.1; y += 0.55) {
        addCylinder(group, this.cylinder20, this.materials.blackMetal, [definition.side * 0.7, y, tankZ], { scale: [1.62, 0.06, 1.62] });
      }
      const legs = [];
      for (const x of [-0.85, 0.85]) {
        for (const z of [-0.85, 0.85]) {
          legs.push({ size: [0.12, 1.6, 0.12], position: [definition.side * 0.7 + x, height + 0.1, tankZ + z] });
        }
      }
      addInstancedBoxes(group, this.boxGeometry, this.materials.blackMetal, legs, `${definition.id}__tank-legs`);
    } else if (definition.profile === 'tenement') {
      addBox(group, this.boxGeometry, wallMaterial, [width * 0.72, 2.8, depth * 0.2], [-definition.side * 0.55, height + 1.75, -depth * 0.17], { castShadow: true });
      for (const z of [-depth * 0.12, depth * 0.17]) {
        addCylinder(
          group,
          this.cylinder16,
          this.materials.paintedMetal,
          [definition.side * 0.8, height + 1.55, z],
          { scale: [0.86, 1.5, 0.86], rotation: [Math.PI / 2, 0, 0], castShadow: true },
        );
        addBox(group, this.boxGeometry, this.materials.blackMetal, [2.15, 0.12, 3.0], [definition.side * 0.8, height + 0.68, z]);
      }
      for (const x of [-2.8, 0, 2.8]) {
        addBox(group, this.boxGeometry, this.materials.metal, [0.08, 2.2, 5.4], [x, height + 1.45, depth * 0.31]);
      }
    } else if (definition.profile === 'workshop') {
      addBox(group, this.boxGeometry, this.materials.metal, [width * 0.84, 3.4, depth * 0.3], [definition.side * 0.35, height + 2.05, -depth * 0.15], { castShadow: true });
      addCylinder(
        group,
        this.cylinder16,
        this.materials.copper,
        [definition.side * 2.35, height + 4.0, depth * 0.2],
        { scale: [0.78, 3.7, 0.78], castShadow: true },
      );
      addCylinder(group, this.cylinder16, this.materials.blackMetal, [definition.side * 2.35, height + 7.65, depth * 0.2], { scale: [0.98, 0.16, 0.98] });
      addCylinder(
        group,
        this.cylinder12,
        this.materials.paintedMetal,
        [-definition.side * 1.7, height + 2.8, depth * 0.1],
        { scale: [0.38, 2.5, 0.38] },
      );
      for (let index = 0; index < 3; index += 1) {
        addBox(
          group,
          this.boxGeometry,
          index % 2 ? this.materials.paintedMetal : this.materials.blackMetal,
          [width * 0.72, 1.15, 2.3],
          [0, height + 1.05 + index * 0.34, -depth * 0.34 + index * 3.25],
          { rotation: [0, 0, definition.side * 0.16] },
        );
      }
    } else {
      addBox(group, this.boxGeometry, this.materials.paintedMetal, [width * 0.56, 4.8, depth * 0.24], [definition.side * 0.8, height + 2.75, -depth * 0.17], { castShadow: true });
      addBox(group, this.boxGeometry, this.materials.blackMetal, [width * 0.38, 2.9, depth * 0.17], [-definition.side * 1.1, height + 1.8, depth * 0.19], { castShadow: true });
      const antenna = addCylinder(
        group,
        this.torus,
        this.materials.metal,
        [-definition.side * (width * 0.28), height + 5.8, depth * 0.13],
        { scale: [1.65, 1.65, 1.65], rotation: [0, Math.PI / 2, 0] },
      );
      antenna.name = `${definition.id}__roof-array`;
      addCylinder(
        group,
        this.cylinder8,
        this.materials.copper,
        [-definition.side * (width * 0.28), height + 4.5, depth * 0.13],
        { scale: [0.08, 4.5, 0.08] },
      );
    }

    const utilityCount = definition.profile === 'workshop' ? 2 : 3;
    for (let index = 0; index < utilityCount; index += 1) {
      const z = -depth * 0.28 + index * depth * 0.18;
      addBox(
        group,
        this.boxGeometry,
        this.materials.paintedMetal,
        [0.8 + random() * 0.65, 0.65 + random() * 0.55, 1.1 + random() * 0.75],
        [definition.side * (1.4 + random()), height + 0.75, z],
      );
    }

    if (definition.profile === 'apartments' || definition.profile === 'capsules') {
      const mastHeight = 5.5 + random() * 4.5;
      addCylinder(
        group,
        this.cylinder8,
        this.materials.metal,
        [definition.side * 1.8, height + mastHeight / 2 + 0.5, -depth * 0.05],
        { scale: [0.075, mastHeight, 0.075] },
      );
      for (let index = 0; index < 3; index += 1) {
        addBox(
          group,
          this.boxGeometry,
          index === 1 ? wallMaterial : this.materials.metal,
          [2.4 - index * 0.36, 0.06, 0.06],
          [definition.side * 1.8, height + 2.7 + index * 0.72, -depth * 0.05],
        );
      }
    }
  }
}
