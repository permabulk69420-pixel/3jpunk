import * as THREE from 'three';
import { createRadialTexture, seededRandom } from '../world/proceduralTextures.js';

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _rotation = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler(-Math.PI / 2, 0, 0);

export class AtmosphereSystem {
  constructor(scene, focus, { isQuest = false } = {}) {
    this.scene = scene;
    this.focus = focus;
    this.isQuest = isQuest;
    this.random = seededRandom(7331);
    this.dropCount = isQuest ? 720 : 1250;
    this.dropState = new Float32Array(this.dropCount * 4);
    this.rippleState = [];
    this.#createRain();
    this.#createRipples();
    this.#createSteam();
  }

  #createRain() {
    const positions = new Float32Array(this.dropCount * 6);
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xb9e9ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.rain = new THREE.LineSegments(this.rainGeometry, material);
    this.rain.name = 'RAIN_FIELD';
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    for (let index = 0; index < this.dropCount; index += 1) {
      this.#resetDrop(index, true);
    }
  }

  #resetDrop(index, initial = false) {
    const offset = index * 4;
    this.dropState[offset] = (this.random() - 0.5) * 31;
    this.dropState[offset + 1] = initial ? this.random() * 21 : 17 + this.random() * 5;
    this.dropState[offset + 2] = (this.random() - 0.5) * 38;
    this.dropState[offset + 3] = 14 + this.random() * 15;
  }

  #createRipples() {
    const rippleTexture = createRadialTexture([
      [0, 'rgba(255,255,255,0)'],
      [0.5, 'rgba(122,225,255,0)'],
      [0.64, 'rgba(160,236,255,.9)'],
      [0.73, 'rgba(92,188,225,.12)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const material = new THREE.MeshBasicMaterial({
      map: rippleTexture,
      color: 0x9beaff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.rippleCount = this.isQuest ? 24 : 42;
    this.ripples = new THREE.InstancedMesh(geometry, material, this.rippleCount);
    this.ripples.name = 'RAIN_RIPPLES';
    this.ripples.frustumCulled = false;
    this.scene.add(this.ripples);
    _rotation.setFromEuler(_euler);

    for (let index = 0; index < this.rippleCount; index += 1) {
      this.rippleState.push({
        x: (this.random() - 0.5) * 20,
        z: (this.random() - 0.5) * 82,
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
    const count = this.isQuest ? 22 : 34;
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
      const offset = index * 4;
      this.dropState[offset + 1] -= this.dropState[offset + 3] * deltaSeconds;
      this.dropState[offset] -= deltaSeconds * 1.8;
      if (this.dropState[offset + 1] < 0.06) this.#resetDrop(index);
      const vertex = index * 6;
      const x = focusX + this.dropState[offset];
      const y = this.dropState[offset + 1];
      const z = focusZ + this.dropState[offset + 2];
      positions[vertex] = x;
      positions[vertex + 1] = y;
      positions[vertex + 2] = z;
      positions[vertex + 3] = x + 0.085;
      positions[vertex + 4] = y - 0.78;
      positions[vertex + 5] = z + 0.04;
    }
    this.rainGeometry.attributes.position.needsUpdate = true;

    this.rippleState.forEach((state, index) => {
      const cycle = (elapsedSeconds * state.speed + state.phase) % 1;
      const size = 0.08 + cycle * 0.68;
      _position.set(state.x, 0.027, state.z);
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
