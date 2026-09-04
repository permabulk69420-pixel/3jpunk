import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import './style.css';
import { createCyberCity } from './world/createCyberCity.js';
import { createNeonEnvironment } from './world/proceduralTextures.js';
import { AtmosphereSystem, CityAudio } from './systems/AtmosphereSystem.js';
import { LocomotionSystem } from './systems/LocomotionSystem.js';

const viewport = document.querySelector('#viewport');
const intro = document.querySelector('#intro');
const loading = document.querySelector('#loading');
const desktopButton = document.querySelector('#desktop-button');
const soundButton = document.querySelector('#sound-toggle');
const statusLabel = document.querySelector('#status-label');
const modeLabel = document.querySelector('#mode-label');
const vrButtonSlot = document.querySelector('#vr-button-slot');
const captureMode = new URLSearchParams(window.location.search).get('capture');

const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090a);
scene.fog = new THREE.FogExp2(0x182123, isQuest ? 0.015 : 0.0125);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 340);
camera.position.set(0, 1.68, 0);
camera.rotation.x = 0.035;

const playerRig = new THREE.Group();
playerRig.name = 'PLAYER_RIG';
playerRig.position.set(0, 0, 43.5);
playerRig.add(camera);
scene.add(playerRig);

const renderer = new THREE.WebGLRenderer({
  antialias: !isQuest,
  alpha: false,
  powerPreference: 'high-performance',
  depth: true,
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isQuest ? 1 : 1.35));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = isQuest ? 1.22 : 1.25;
renderer.shadowMap.enabled = !isQuest;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(isQuest ? 0.9 : 1.05);
viewport.appendChild(renderer.domElement);

if (captureMode) {
  document.body.classList.add('is-capture');
  const captureViews = {
    street: { position: [1.2, 0, 43.5], yaw: 0.035, pitch: 0.045 },
    bridge: { position: [-3.8, 0, 21], yaw: -0.17, pitch: 0.08 },
    alley: { position: [1.6, 0, 8.5], yaw: 0.72, pitch: 0.025 },
  };
  const view = captureViews[captureMode] || captureViews.street;
  playerRig.position.set(...view.position);
  playerRig.rotation.y = view.yaw;
  camera.rotation.x = view.pitch;
}

const environmentTarget = createNeonEnvironment(renderer);
scene.environment = environmentTarget.texture;
const city = createCyberCity({ scene, renderer, isQuest });
const atmosphere = new AtmosphereSystem(scene, camera, { isQuest });
const audio = new CityAudio();

function setMode(mode) {
  if (mode === 'vr') {
    intro.classList.add('is-hidden');
    modeLabel.textContent = 'IMMERSIVE LINK';
    statusLabel.textContent = 'QUEST TRACKING ACTIVE';
  } else if (mode === 'desktop') {
    intro.classList.add('is-hidden');
    modeLabel.textContent = 'STREET FEED';
    statusLabel.textContent = 'POINTER LOCKED';
  } else {
    if (!renderer.xr.isPresenting) intro.classList.remove('is-hidden');
    modeLabel.textContent = 'STREET FEED';
    statusLabel.textContent = isQuest ? 'QUEST 3 READY' : 'DISTRICT ONLINE';
  }
}

const locomotion = new LocomotionSystem({
  renderer,
  scene,
  camera,
  rig: playerRig,
  colliders: city.colliders,
  bounds: city.bounds,
  domElement: renderer.domElement,
  onModeChange: setMode,
});

const vrButton = VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
});
vrButton.setAttribute('aria-label', 'Enter immersive VR');
vrButtonSlot.appendChild(vrButton);

desktopButton.addEventListener('click', () => locomotion.enterDesktop());
renderer.domElement.addEventListener('click', () => {
  if (intro.classList.contains('is-hidden') && !renderer.xr.isPresenting) locomotion.enterDesktop();
});

soundButton.addEventListener('click', async () => {
  try {
    const enabled = await audio.toggle();
    soundButton.textContent = enabled ? 'AMBIENCE ON' : 'AMBIENCE OFF';
    soundButton.setAttribute('aria-pressed', String(enabled));
  } catch (error) {
    console.warn('Audio could not be started.', error);
    soundButton.textContent = 'AUDIO UNAVAILABLE';
  }
});

renderer.xr.addEventListener('sessionstart', () => {
  intro.classList.add('is-hidden');
  document.querySelector('#vignette').style.display = 'none';
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
});

renderer.xr.addEventListener('sessionend', () => {
  document.querySelector('#vignette').style.display = '';
  intro.classList.remove('is-hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isQuest ? 1 : 1.35));
});

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  statusLabel.textContent = 'RENDER LINK LOST — RELOAD';
});

const clock = new THREE.Clock();
let readySignalled = false;

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  locomotion.update(delta);
  atmosphere.update(delta, elapsed);
  city.animated.forEach((update) => update(elapsed, delta));

  if (!captureMode && !renderer.xr.isPresenting && !locomotion.isDesktopExploring) {
    camera.rotation.y = Math.sin(elapsed * 0.12) * 0.012;
    camera.rotation.x = 0.035 + Math.sin(elapsed * 0.19) * 0.005;
  }

  renderer.render(scene, camera);

  if (!readySignalled) {
    readySignalled = true;
    window.__3JPUNK_READY__ = true;
    statusLabel.textContent = isQuest ? 'QUEST 3 READY' : 'DISTRICT ONLINE';
    requestAnimationFrame(() => loading.classList.add('is-ready'));
  }
});

window.__3JPUNK__ = Object.freeze({
  scene,
  camera,
  playerRig,
  renderer,
  city,
  buildingSlots: city.assetRegistry.listSlots(),
  replaceBuilding: (...args) => city.assetRegistry.replaceBuilding(...args),
  restoreBuilding: (slotId) => city.assetRegistry.restoreProcedural(slotId),
});

console.info(
  '[3JPUNK] Rain District online.',
  `${city.slots.length} replaceable building slots.`,
  isQuest ? 'Quest profile active.' : 'Desktop profile active.',
);
