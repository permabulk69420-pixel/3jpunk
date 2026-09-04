import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const _headQuaternion = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _beforeTurn = new THREE.Vector3();
const _afterTurn = new THREE.Vector3();

function applyDeadzone(value, deadzone = 0.14) {
  if (Math.abs(value) <= deadzone) return 0;
  const remapped = (Math.abs(value) - deadzone) / (1 - deadzone);
  return Math.sign(value) * remapped;
}

function stickAxes(source) {
  const axes = source?.gamepad?.axes;
  if (!axes?.length) return [0, 0];
  if (axes.length >= 4) return [axes[2] ?? 0, axes[3] ?? 0];
  return [axes[0] ?? 0, axes[1] ?? 0];
}

export class LocomotionSystem {
  constructor({ renderer, scene, camera, rig, colliders, bounds, domElement, onModeChange }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.rig = rig;
    this.colliders = colliders;
    this.bounds = bounds;
    this.domElement = domElement;
    this.onModeChange = onModeChange;
    this.controllers = [];
    this.sources = new Map();
    this.keys = new Set();
    this.isDesktopExploring = false;
    this.playerRadius = 0.34;
    this.walkSpeed = 3.25;
    this.sprintSpeed = 5.6;
    this.turnRate = THREE.MathUtils.degToRad(102);
    this.pitch = 0.075;
    this.yaw = 0;
    this.#configureControllers();
    this.#bindDesktopControls();
    this.#bindSessionEvents();
  }

  #configureControllers() {
    const modelFactory = new XRControllerModelFactory();
    const rayMaterial = new THREE.LineBasicMaterial({
      color: 0x70f6ff,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
    });
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1.8),
    ]);

    for (let index = 0; index < 2; index += 1) {
      const controller = this.renderer.xr.getController(index);
      const grip = this.renderer.xr.getControllerGrip(index);
      const ray = new THREE.Line(rayGeometry, rayMaterial.clone());
      ray.name = `controller-${index}-ray`;
      controller.add(ray);
      grip.add(modelFactory.createControllerModel(grip));
      controller.addEventListener('connected', (event) => {
        const handedness = event.data.handedness || `controller-${index}`;
        this.sources.set(handedness, event.data);
      });
      controller.addEventListener('disconnected', (event) => {
        const handedness = event.data?.handedness || `controller-${index}`;
        this.sources.delete(handedness);
      });
      this.rig.add(controller, grip);
      this.controllers.push({ controller, grip, ray });
    }
  }

  #bindDesktopControls() {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.isDesktopExploring = document.pointerLockElement === this.domElement;
      document.body.classList.toggle('is-exploring', this.isDesktopExploring);
      this.onModeChange?.(this.isDesktopExploring ? 'desktop' : 'idle');
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.isDesktopExploring || this.renderer.xr.isPresenting) return;
      this.yaw -= event.movementX * 0.00185;
      this.pitch -= event.movementY * 0.0016;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.18, 1.18);
      this.rig.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    });
  }

  #bindSessionEvents() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      document.body.classList.remove('is-exploring');
      if (document.pointerLockElement) document.exitPointerLock();
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.onModeChange?.('vr');
      if (this.renderer.xr.setFoveation) this.renderer.xr.setFoveation(1);
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.camera.position.set(0, 1.68, 0);
      this.camera.rotation.set(this.pitch, 0, 0);
      this.onModeChange?.('idle');
      this.sources.clear();
    });
  }

  enterDesktop() {
    if (this.renderer.xr.isPresenting) return;
    this.domElement.requestPointerLock?.();
  }

  update(deltaSeconds) {
    if (this.renderer.xr.isPresenting) {
      this.#updateXR(deltaSeconds);
    } else if (this.isDesktopExploring) {
      this.#updateDesktop(deltaSeconds);
    }
  }

  #updateXR(deltaSeconds) {
    let left = this.sources.get('left');
    let right = this.sources.get('right');
    const session = this.renderer.xr.getSession();
    if ((!left || !right) && session) {
      for (const source of session.inputSources) {
        if (source.handedness === 'left') left = source;
        if (source.handedness === 'right') right = source;
      }
    }

    const [strafeRaw, forwardRaw] = stickAxes(left);
    const [turnRaw] = stickAxes(right);
    const strafe = applyDeadzone(strafeRaw);
    const forward = -applyDeadzone(forwardRaw);
    const turn = applyDeadzone(turnRaw, 0.18);

    this.#move(strafe, forward, this.walkSpeed, deltaSeconds);
    if (turn !== 0) this.#turn(-turn * this.turnRate * deltaSeconds);
  }

  #updateDesktop(deltaSeconds) {
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const keyTurn = Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ'));
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      ? this.sprintSpeed
      : this.walkSpeed;
    this.#move(strafe, forward, speed, deltaSeconds);
    if (keyTurn) {
      this.yaw -= keyTurn * this.turnRate * deltaSeconds;
      this.rig.rotation.y = this.yaw;
    }
  }

  #move(strafe, forward, speed, deltaSeconds) {
    if (strafe === 0 && forward === 0) return;
    this.camera.getWorldQuaternion(_headQuaternion);
    _forward.set(0, 0, -1).applyQuaternion(_headQuaternion);
    _forward.y = 0;
    if (_forward.lengthSq() < 0.001) _forward.set(0, 0, -1);
    _forward.normalize();
    _right.set(1, 0, 0).applyQuaternion(_headQuaternion);
    _right.y = 0;
    _right.normalize();
    _delta.copy(_forward).multiplyScalar(forward).addScaledVector(_right, strafe);
    if (_delta.lengthSq() > 1) _delta.normalize();
    _delta.multiplyScalar(speed * deltaSeconds);
    this.#moveWithCollisions(_delta);
  }

  #turn(angle) {
    this.camera.getWorldPosition(_beforeTurn);
    this.rig.rotateY(angle);
    this.camera.getWorldPosition(_afterTurn);
    this.rig.position.x += _beforeTurn.x - _afterTurn.x;
    this.rig.position.z += _beforeTurn.z - _afterTurn.z;
    this.#clampToBounds();
    this.yaw = this.rig.rotation.y;
  }

  #moveWithCollisions(delta) {
    const currentX = this.rig.position.x;
    const currentZ = this.rig.position.z;
    const nextX = THREE.MathUtils.clamp(currentX + delta.x, this.bounds.minX, this.bounds.maxX);
    const nextZ = THREE.MathUtils.clamp(currentZ + delta.z, this.bounds.minZ, this.bounds.maxZ);

    if (!this.#collides(nextX, currentZ)) this.rig.position.x = nextX;
    if (!this.#collides(this.rig.position.x, nextZ)) this.rig.position.z = nextZ;
  }

  #collides(x, z) {
    return this.colliders.some((collider) => (
      x + this.playerRadius > collider.minX
      && x - this.playerRadius < collider.maxX
      && z + this.playerRadius > collider.minZ
      && z - this.playerRadius < collider.maxZ
    ));
  }

  #clampToBounds() {
    this.rig.position.x = THREE.MathUtils.clamp(this.rig.position.x, this.bounds.minX, this.bounds.maxX);
    this.rig.position.z = THREE.MathUtils.clamp(this.rig.position.z, this.bounds.minZ, this.bounds.maxZ);
  }
}
