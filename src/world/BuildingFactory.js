import * as THREE from 'three';
import {
  createConcreteTexture,
  createRadialTexture,
  createSignTexture,
  seededRandom,
} from './proceduralTextures.js';

const _color = new THREE.Color();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

function colorCss(hex) {
  return `#${new THREE.Color(hex).getHexString()}`;
}

function box(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material,
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.name) mesh.name = options.name;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radius, height, position, material, radialSegments = 8) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    material,
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class BuildingFactory {
  constructor({ renderer, animated }) {
    this.renderer = renderer;
    this.animated = animated;
    this.shared = {
      blackMetal: new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.28, metalness: 0.92 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x151d29, roughness: 0.42, metalness: 0.74 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x0a1b28,
        metalness: 0.12,
        roughness: 0.12,
        transmission: 0.25,
        transparent: true,
        opacity: 0.62,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
      }),
      warmInterior: new THREE.MeshBasicMaterial({ color: 0xffb36b, toneMapped: false }),
      rail: new THREE.MeshStandardMaterial({ color: 0x252f38, roughness: 0.3, metalness: 0.9 }),
    };
    this.radialGlow = createRadialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.08, 'rgba(220,250,255,.88)'],
      [0.28, 'rgba(90,220,255,.32)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
  }

  create(definition) {
    const group = new THREE.Group();
    group.name = `BUILDING_SLOT__${definition.id}`;
    group.userData = {
      type: 'building-slot',
      slotId: definition.id,
      replaceable: true,
      units: 'metres',
      forward: '-Z',
    };
    group.position.set(...definition.position);

    const random = seededRandom(definition.seed);
    const [width, height, depth] = definition.size;
    const concreteMap = createConcreteTexture(definition.seed, colorCss(definition.shell));
    concreteMap.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const shellMaterial = new THREE.MeshStandardMaterial({
      color: definition.shell,
      map: concreteMap,
      roughness: 0.72,
      metalness: 0.34,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: definition.trim,
      roughness: 0.39,
      metalness: 0.84,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({ color: definition.accent, toneMapped: false });
    const accent2Material = new THREE.MeshBasicMaterial({ color: definition.accent2, toneMapped: false });

    this.#createMassing(group, definition, shellMaterial, trimMaterial);
    this.#createFacadeGrid(group, definition, random, trimMaterial);
    this.#createStorefronts(group, definition, random, accentMaterial, accent2Material);
    this.#createSigns(group, definition, accentMaterial);
    this.#createInfrastructure(group, definition, random, trimMaterial, accentMaterial);
    this.#createRoofline(group, definition, random, trimMaterial, accent2Material);

    const anchor = new THREE.Object3D();
    anchor.name = `GLB_ANCHOR__${definition.id}`;
    anchor.userData = {
      accept: '.glb,.gltf',
      convention: '+Y up, -Z forward, metres, positive scale',
    };
    group.add(anchor);

    group.traverse((object) => {
      if (object.isMesh) {
        object.matrixAutoUpdate = true;
      }
    });
    return group;
  }

  #createMassing(group, definition, shellMaterial, trimMaterial) {
    const [width, height, depth] = definition.size;
    box(group, [width, height, depth], [0, height / 2, 0], shellMaterial, {
      name: `${definition.id}__shell`,
      receiveShadow: true,
    });

    const streetDirection = -definition.side;
    const facadeX = streetDirection * (width / 2 + 0.13);
    const baseDepth = depth - 1.2;
    box(group, [0.55, 5.5, baseDepth], [facadeX, 2.75, 0], this.shared.blackMetal);

    if (definition.profile === 'terraced') {
      box(group, [width * 0.86, 6.2, depth * 0.75], [definition.side * 0.7, height + 3.1, -2], shellMaterial);
      box(group, [width * 0.64, 4.4, depth * 0.48], [definition.side * 1.45, height + 8.4, -5], trimMaterial);
    } else if (definition.profile === 'needle') {
      box(group, [width * 0.72, 13, depth * 0.55], [definition.side * 1.1, height + 6.5, 2], shellMaterial);
      box(group, [width * 0.36, 7, depth * 0.23], [definition.side * 2.15, height + 16.5, -1], trimMaterial);
    } else if (definition.profile === 'stacked') {
      box(group, [width * 0.83, 8, depth * 0.82], [definition.side * 0.85, height + 4, 1.5], shellMaterial);
      box(group, [width * 0.65, 7, depth * 0.58], [definition.side * 1.7, height + 11.5, -3], trimMaterial);
    } else {
      box(group, [width * 0.8, 9, depth * 0.72], [definition.side * 1.05, height + 4.5, 0], shellMaterial);
      for (let i = -2; i <= 2; i += 1) {
        box(group, [0.3, height + 7, 0.45], [facadeX + definition.side * 0.08, (height + 7) / 2, i * depth * 0.12], trimMaterial);
      }
    }
  }

  #createFacadeGrid(group, definition, random, trimMaterial) {
    const [width, height, depth] = definition.size;
    const streetDirection = -definition.side;
    const facadeX = streetDirection * (width / 2 + 0.43);
    const rowStep = 3.25;
    const columnStep = 2.35;
    const rows = Math.max(4, Math.floor((height - 8) / rowStep));
    const columns = Math.max(8, Math.floor((depth - 3) / columnStep));
    const windowGeometry = new THREE.BoxGeometry(0.12, 1.38, 1.18);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x06111a,
      emissive: definition.window,
      emissiveIntensity: 1.45,
      roughness: 0.2,
      metalness: 0.72,
    });
    const darkWindowMaterial = new THREE.MeshStandardMaterial({
      color: 0x03070c,
      emissive: 0x07121d,
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.75,
    });
    const lit = [];
    const dark = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const z = -((columns - 1) * columnStep) / 2 + column * columnStep;
        const y = 8.2 + row * rowStep;
        const target = random() > 0.38 ? lit : dark;
        target.push([facadeX, y, z, 0.78 + random() * 0.22]);
      }
    }

    const makeInstances = (instances, material, name) => {
      const mesh = new THREE.InstancedMesh(windowGeometry, material, instances.length);
      mesh.name = `${definition.id}__${name}`;
      instances.forEach(([x, y, z, scale], index) => {
        _position.set(x, y, z);
        _scale.set(1, scale, 0.86 + scale * 0.14);
        _matrix.compose(_position, _quaternion, _scale);
        mesh.setMatrixAt(index, _matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    makeInstances(lit, windowMaterial, 'lit-windows');
    makeInstances(dark, darkWindowMaterial, 'dark-windows');

    const ribCount = Math.max(5, Math.floor(depth / 6));
    for (let index = 0; index < ribCount; index += 1) {
      const z = -depth / 2 + 2.1 + index * ((depth - 4.2) / Math.max(1, ribCount - 1));
      box(group, [0.3, height - 5.4, 0.26], [facadeX - streetDirection * 0.1, height / 2 + 2.4, z], trimMaterial);
    }

    for (let y = 10; y < height - 1; y += 9.75) {
      box(group, [0.34, 0.22, depth - 1.2], [facadeX - streetDirection * 0.08, y, 0], trimMaterial);
    }
  }

  #createStorefronts(group, definition, random, accentMaterial, accent2Material) {
    const [width, , depth] = definition.size;
    const streetDirection = -definition.side;
    const facadeX = streetDirection * (width / 2 + 0.72);
    const shops = Math.max(3, Math.floor(depth / 8.5));
    const shopDepth = (depth - 3) / shops;

    for (let index = 0; index < shops; index += 1) {
      const z = -depth / 2 + 1.5 + shopDepth / 2 + index * shopDepth;
      const windowWidth = shopDepth * 0.72;
      box(group, [0.18, 3.3, windowWidth], [facadeX, 2.1, z], this.shared.glass);
      box(group, [0.12, 2.85, windowWidth * 0.83], [facadeX - streetDirection * 0.18, 2.1, z], this.shared.warmInterior);
      box(group, [0.24, 0.18, windowWidth + 0.55], [facadeX + streetDirection * 0.08, 3.9, z], index % 2 ? accentMaterial : accent2Material);

      const frameMaterial = this.shared.blackMetal;
      box(group, [0.34, 4.1, 0.18], [facadeX + streetDirection * 0.09, 2.15, z - windowWidth / 2], frameMaterial);
      box(group, [0.34, 4.1, 0.18], [facadeX + streetDirection * 0.09, 2.15, z + windowWidth / 2], frameMaterial);
      box(group, [0.38, 0.22, windowWidth], [facadeX + streetDirection * 0.1, 0.48, z], frameMaterial);
      box(group, [0.38, 0.22, windowWidth], [facadeX + streetDirection * 0.1, 3.78, z], frameMaterial);

      if (random() > 0.45) {
        const canopy = box(
          group,
          [2.05, 0.18, windowWidth + 0.75],
          [facadeX + streetDirection * 1.02, 4.35, z],
          this.shared.darkMetal,
        );
        canopy.rotation.z = definition.side * -0.04;
        box(
          group,
          [1.94, 0.06, windowWidth + 0.58],
          [facadeX + streetDirection * 1.03, 4.21, z],
          index % 2 ? accentMaterial : accent2Material,
        );
      }
    }
  }

  #createSigns(group, definition, accentMaterial) {
    const [width, height, depth] = definition.size;
    const streetDirection = -definition.side;
    const facadeX = streetDirection * (width / 2 + 0.82);
    const accent = colorCss(definition.accent);
    const accent2 = colorCss(definition.accent2);
    const wideTexture = createSignTexture({
      title: definition.label,
      subtitle: definition.sublabel,
      glyph: definition.glyph,
      accent,
      accent2,
      seed: definition.seed,
    });
    wideTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const signMaterial = new THREE.MeshBasicMaterial({
      map: wideTexture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), signMaterial);
    sign.name = `${definition.id}__hero-sign`;
    sign.position.set(facadeX, Math.min(height - 4, 13.2), definition.seed % 2 ? -7 : 6);
    sign.rotation.y = definition.side < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(sign);
    box(
      group,
      [0.28, 2.8, 7.6],
      [facadeX - streetDirection * 0.09, sign.position.y, sign.position.z],
      this.shared.blackMetal,
    );

    const verticalTexture = createSignTexture({
      title: definition.label,
      glyph: definition.glyph,
      accent,
      accent2,
      vertical: true,
      seed: definition.seed + 92,
    });
    verticalTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const bladeMaterial = new THREE.MeshBasicMaterial({ map: verticalTexture, toneMapped: false, side: THREE.DoubleSide });
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6.8), bladeMaterial);
    blade.name = `${definition.id}__blade-sign`;
    blade.position.set(facadeX + streetDirection * 1.2, Math.min(height - 5, 18.5), definition.seed % 2 ? 10.5 : -10);
    box(
      group,
      [2.45, 7.15, 0.18],
      [blade.position.x, blade.position.y, blade.position.z],
      this.shared.blackMetal,
    );
    blade.position.z += 0.095;
    group.add(blade);
    const bladeBack = blade.clone();
    bladeBack.name = `${definition.id}__blade-sign-back`;
    bladeBack.position.z -= 0.19;
    bladeBack.rotation.y = Math.PI;
    group.add(bladeBack);

    const pulse = { mesh: sign, material: signMaterial, phase: (definition.seed % 100) * 0.1 };
    this.animated.push((elapsed) => {
      const flutter = Math.sin(elapsed * 11 + pulse.phase) > 0.985 ? 0.55 : 1;
      pulse.material.opacity = flutter;
      pulse.material.transparent = flutter < 1;
      accentMaterial.opacity = 0.86 + Math.sin(elapsed * 1.7 + pulse.phase) * 0.08;
      accentMaterial.transparent = true;
    });
  }

  #createInfrastructure(group, definition, random, trimMaterial, accentMaterial) {
    const [width, height, depth] = definition.size;
    const streetDirection = -definition.side;
    const facadeX = streetDirection * (width / 2 + 1.02);

    for (let index = 0; index < 4; index += 1) {
      const radius = index % 2 ? 0.11 : 0.17;
      const z = -depth * 0.35 + index * depth * 0.23;
      const pipeHeight = 5 + random() * (height * 0.42);
      const pipe = cylinder(
        group,
        radius,
        pipeHeight,
        [facadeX + streetDirection * (0.05 + index * 0.05), pipeHeight / 2 + 4.6, z],
        index === 2 ? accentMaterial : trimMaterial,
        8,
      );
      pipe.rotation.z = 0;
      for (let y = 6; y < pipeHeight + 4; y += 3.1) {
        const collar = cylinder(group, radius * 1.55, 0.12, [pipe.position.x, y, z], this.shared.blackMetal, 8);
        collar.rotation.z = 0;
      }
    }

    const units = Math.max(3, Math.floor(depth / 11));
    for (let index = 0; index < units; index += 1) {
      const z = -depth / 2 + 4 + index * ((depth - 8) / Math.max(1, units - 1));
      const y = 7.2 + ((index * 7 + definition.seed) % Math.max(8, Math.floor(height - 13)));
      box(group, [0.9, 1.5, 2.15], [facadeX, y, z], this.shared.darkMetal);
      const fan = cylinder(group, 0.62, 0.08, [facadeX + streetDirection * 0.48, y, z], this.shared.blackMetal, 16);
      fan.rotation.z = Math.PI / 2;
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const blade = box(group, [0.06, 0.88, 0.13], [fan.position.x + streetDirection * 0.05, y, z], trimMaterial);
        blade.rotation.x = (spoke * Math.PI) / 4;
      }
    }

    for (let y = 9.5; y < Math.min(height - 2, 31); y += 9) {
      const platformZ = definition.seed % 2 ? depth * 0.25 : -depth * 0.2;
      box(group, [1.65, 0.18, 5.5], [facadeX + streetDirection * 0.64, y, platformZ], this.shared.rail);
      for (let zOffset = -2.5; zOffset <= 2.5; zOffset += 1.25) {
        box(group, [0.08, 1.05, 0.08], [facadeX + streetDirection * 1.38, y + 0.58, platformZ + zOffset], this.shared.rail);
      }
      box(group, [0.08, 0.08, 5.4], [facadeX + streetDirection * 1.38, y + 1.08, platformZ], this.shared.rail);
    }
  }

  #createRoofline(group, definition, random, trimMaterial, accentMaterial) {
    const [, height, depth] = definition.size;
    const roofY = height + (definition.profile === 'needle' ? 13.2 : definition.profile === 'terraced' ? 6.4 : 8.2);
    const roofCount = 5;
    for (let index = 0; index < roofCount; index += 1) {
      const z = -depth * 0.25 + index * depth * 0.12;
      const width = 1.1 + random() * 1.2;
      box(group, [width, 0.8 + random() * 1.1, 1.2 + random() * 1.5], [definition.side * 0.5, roofY, z], trimMaterial);
    }

    const mastHeight = 6 + random() * 7;
    const mast = cylinder(group, 0.11, mastHeight, [definition.side * 0.5, roofY + mastHeight / 2, -depth * 0.05], this.shared.rail, 8);
    mast.rotation.z = 0;
    for (let index = 0; index < 3; index += 1) {
      box(
        group,
        [3.4 - index * 0.55, 0.07, 0.07],
        [definition.side * 0.5, roofY + mastHeight * (0.45 + index * 0.13), -depth * 0.05],
        index === 1 ? accentMaterial : this.shared.rail,
      );
    }

    const beaconMaterial = new THREE.SpriteMaterial({
      map: this.radialGlow,
      color: definition.accent,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const beacon = new THREE.Sprite(beaconMaterial);
    beacon.position.set(definition.side * 0.5, roofY + mastHeight, -depth * 0.05);
    beacon.scale.set(2.4, 2.4, 1);
    group.add(beacon);
    this.animated.push((elapsed) => {
      beaconMaterial.opacity = 0.42 + Math.pow(Math.max(0, Math.sin(elapsed * 2.25 + definition.seed)), 14) * 0.52;
    });
  }
}
