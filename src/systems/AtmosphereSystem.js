import * as THREE from 'three';
import { createRadialTexture, seededRandom } from '../world/proceduralTextures.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _rotation = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler(-Math.PI / 2, 0, 0);
const _rainColor = new THREE.Color(0xb7c2bf);

export class AtmosphereSystem {
  constructor(scene, focus, { isQuest = false } = {}) {
    this.scene = scene;
    this.focus = focus;
    this.isQuest = isQuest;
    this.random = seededRandom(7331);
    this.dropCount = isQuest ? 220 : 500;
    // x, y, z, fall speed, exposure length, optical strength
    this.dropState = new Float32Array(this.dropCount * 6);
    this.rippleState = [];
    this.#createRain();
    this.#createRipples();
    this.#createSteam();
  }

  #createRain() {
    const positions = new Float32Array(this.dropCount * 6);
    const colors = new Float32Array(this.dropCount * 6);
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: this.isQuest ? 0.22 : 0.25,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: true,
      fog: true,
    });
    this.rain = new THREE.LineSegments(this.rainGeometry, material);
    this.rain.name = 'RAIN_FIELD';
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    for (let index = 0; index < this.dropCount; index += 1) {
      this.#resetDrop(index, true);
    }
    this.rainGeometry.attributes.color.needsUpdate = true;
  }

  #resetDrop(index, initial = false) {
    const offset = index * 6;
    this.dropState[offset] = (this.random() - 0.5) * 30;
    this.dropState[offset + 1] = initial ? this.random() * 21 : 17 + this.random() * 5;
    this.dropState[offset + 2] = (this.random() - 0.5) * 36;

    if (initial) {
      this.dropState[offset + 3] = 11 + this.random() * 11;
      this.dropState[offset + 4] = (this.isQuest ? 0.11 : 0.14) + this.random() * (this.isQuest ? 0.25 : 0.33);
      this.dropState[offset + 5] = 0.48 + this.random() * 0.52;

      // A brighter leading bead and a dim trail give each one-pixel line a
      // water-like exposure falloff without a second pass or additive glow.
      const strength = this.dropState[offset + 5];
      const colorOffset = index * 6;
      this.rainGeometry.attributes.color.array[colorOffset] = _rainColor.r * strength;
      this.rainGeometry.attributes.color.array[colorOffset + 1] = _rainColor.g * strength;
      this.rainGeometry.attributes.color.array[colorOffset + 2] = _rainColor.b * strength;
      this.rainGeometry.attributes.color.array[colorOffset + 3] = _rainColor.r * strength * 0.34;
      this.rainGeometry.attributes.color.array[colorOffset + 4] = _rainColor.g * strength * 0.34;
      this.rainGeometry.attributes.color.array[colorOffset + 5] = _rainColor.b * strength * 0.34;
    }
  }

  #createRipples() {
    const rippleTexture = createRadialTexture([
      [0, 'rgba(255,255,255,0)'],
      [0.54, 'rgba(190,210,210,0)'],
      [0.65, 'rgba(204,220,218,.34)'],
      [0.72, 'rgba(154,178,180,.06)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const material = new THREE.MeshBasicMaterial({
      map: rippleTexture,
      color: 0xa8b8b8,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: true,
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.rippleCount = this.isQuest ? 16 : 28;
    this.ripples = new THREE.InstancedMesh(geometry, material, this.rippleCount);
    this.ripples.name = 'RAIN_RIPPLES';
    this.ripples.frustumCulled = false;
    this.scene.add(this.ripples);
    _rotation.setFromEuler(_euler);

    for (let index = 0; index < this.rippleCount; index += 1) {
      this.rippleState.push({
        x: (this.random() - 0.5) * 11.4,
        z: -3 - this.random() * 24,
        phase: this.random(),
        speed: 0.42 + this.random() * 0.85,
      });
    }
  }

  #createSteam() {
    const texture = createRadialTexture([
      [0, 'rgba(225,245,255,.4)'],
      [0.28, 'rgba(170,215,225,.22)'],
      [0.68, 'rgba(100,145,160,.07)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const count = this.isQuest ? 12 : 22;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sources = [
      [-8.7, 0.15, 12],
      [8.8, 0.15, -8],
      [-8.9, 0.15, -31],
      [8.9, 0.15, 34],
      [0.2, 0.08, -18],
    ];
    for (let index = 0; index < count; index += 1) {
      const source = sources[index % sources.length];
      positions[index * 3] = source[0] + (this.random() - 0.5) * 1.2;
      positions[index * 3 + 1] = source[1] + this.random() * 2.5;
      positions[index * 3 + 2] = source[2] + (this.random() - 0.5) * 1.2;
      phases[index] = this.random() * 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.PointsMaterial({
      map: texture,
      color: 0xb7d9df,
      size: this.isQuest ? 1.25 : 1.65,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.steam = new THREE.Points(geometry, material);
    this.steam.name = 'STREET_STEAM';
    this.steam.userData.sources = sources;
    this.scene.add(this.steam);
  }

  update(deltaSeconds, elapsedSeconds) {
    this.focus.getWorldPosition(_position);
    const focusX = _position.x;
    const focusZ = _position.z;
    const positions = this.rainGeometry.attributes.position.array;
    for (let index = 0; index < this.dropCount; index += 1) {
      const offset = index * 6;
      this.dropState[offset + 1] -= this.dropState[offset + 3] * deltaSeconds;
      this.dropState[offset] -= deltaSeconds * (0.58 + (index % 7) * 0.055);
      if (this.dropState[offset + 1] < 0.06) this.#resetDrop(index);
      const vertex = index * 6;
      const x = focusX + this.dropState[offset];
      const y = this.dropState[offset + 1];
      const z = focusZ + this.dropState[offset + 2];
      const length = this.dropState[offset + 4];
      positions[vertex] = x;
      positions[vertex + 1] = y;
      positions[vertex + 2] = z;
      positions[vertex + 3] = x + length * 0.065;
      positions[vertex + 4] = y + length;
      positions[vertex + 5] = z - length * 0.018;
    }
    this.rainGeometry.attributes.position.needsUpdate = true;

    this.rippleState.forEach((state, index) => {
      const cycle = (elapsedSeconds * state.speed + state.phase) % 1;
      const size = 0.06 + cycle * 0.58;
      let rippleZ = focusZ + state.z;
      if (rippleZ < -51) rippleZ += 100;
      if (rippleZ > 51) rippleZ -= 100;
      _position.set(THREE.MathUtils.clamp(focusX + state.x, -6.1, 6.1), 0.038, rippleZ);
      _scale.set(size, size, size);
      _matrix.compose(_position, _rotation, _scale);
      this.ripples.setMatrixAt(index, _matrix);
    });
    this.ripples.instanceMatrix.needsUpdate = true;

    const steamPositions = this.steam.geometry.attributes.position;
    const sources = this.steam.userData.sources;
    for (let index = 0; index < steamPositions.count; index += 1) {
      const source = sources[index % sources.length];
      let y = steamPositions.getY(index) + deltaSeconds * (0.28 + (index % 5) * 0.035);
      if (y > 4.4) y = source[1] + ((index * 0.17) % 0.45);
      steamPositions.setX(index, steamPositions.getX(index) + Math.sin(elapsedSeconds * 0.35 + index) * deltaSeconds * 0.025);
      steamPositions.setY(index, y);
      steamPositions.setZ(index, steamPositions.getZ(index) + Math.cos(elapsedSeconds * 0.27 + index) * deltaSeconds * 0.02);
    }
    steamPositions.needsUpdate = true;
  }
}

export class CityAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = false;
  }

  async toggle() {
    if (!this.context) this.#create();
    if (this.context.state === 'suspended') await this.context.resume();
    this.enabled = !this.enabled;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.enabled ? 0.3 : 0, now + 0.45);
    return this.enabled;
  }

  #create() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    const seconds = 3;
    const buffer = this.context.createBuffer(2, this.context.sampleRate * seconds, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let index = 0; index < data.length; index += 1) {
        const white = Math.random() * 2 - 1;
        last = last * 0.965 + white * 0.035;
        data[index] = last * 0.8 + white * 0.07;
      }
    }
    const noise = this.context.createBufferSource();
    const rainFilter = this.context.createBiquadFilter();
    const rainGain = this.context.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 3400;
    rainFilter.Q.value = 0.46;
    rainGain.gain.value = 0.52;
    noise.connect(rainFilter).connect(rainGain).connect(this.master);
    noise.start();

    const hum = this.context.createOscillator();
    const humGain = this.context.createGain();
    const humFilter = this.context.createBiquadFilter();
    hum.type = 'sawtooth';
    hum.frequency.value = 42;
    humGain.gain.value = 0.026;
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 155;
    hum.connect(humFilter).connect(humGain).connect(this.master);
    hum.start();
  }
}
