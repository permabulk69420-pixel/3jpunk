import * as THREE from 'three';

export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function textureFromCanvas(canvas, colorSpace = THREE.SRGBColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createAsphaltTextures() {
  const size = 512;
  const random = seededRandom(8801);
  const diffuseCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  diffuseCanvas.width = diffuseCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const color = diffuseCanvas.getContext('2d');
  const bump = bumpCanvas.getContext('2d');

  color.fillStyle = '#111923';
  color.fillRect(0, 0, size, size);
  bump.fillStyle = '#777';
  bump.fillRect(0, 0, size, size);

  for (let i = 0; i < 24000; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const v = Math.floor(22 + random() * 42);
    const alpha = 0.05 + random() * 0.2;
    color.fillStyle = `rgba(${v}, ${v + 5}, ${v + 11}, ${alpha})`;
    color.fillRect(x, y, 1 + random() * 2.5, 1 + random() * 2.5);
    const h = Math.floor(75 + random() * 95);
    bump.fillStyle = `rgb(${h},${h},${h})`;
    bump.fillRect(x, y, 1.2, 1.2);
  }

  for (let i = 0; i < 14; i += 1) {
    color.strokeStyle = `rgba(0, 0, 0, ${0.05 + random() * 0.08})`;
    color.lineWidth = 0.5 + random() * 1.6;
    color.beginPath();
    let x = random() * size;
    let y = random() * size;
    color.moveTo(x, y);
    for (let j = 0; j < 7; j += 1) {
      x += (random() - 0.5) * 54;
      y += (random() - 0.5) * 54;
      color.lineTo(x, y);
    }
    color.stroke();
  }

  const map = textureFromCanvas(diffuseCanvas);
  const bumpMap = textureFromCanvas(bumpCanvas, THREE.NoColorSpace);
  map.repeat.set(5, 18);
  bumpMap.repeat.copy(map.repeat);
  return { map, bumpMap };
}

export function createConcreteTexture(seed = 1, tint = '#1a2130') {
  const random = seededRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = tint;
  context.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 6000; i += 1) {
    const shade = Math.floor(20 + random() * 60);
    context.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 12}, ${0.02 + random() * 0.09})`;
    const radius = random() < 0.98 ? 1 : 2 + random() * 5;
    context.fillRect(random() * 256, random() * 256, radius, radius);
  }

  context.strokeStyle = 'rgba(0, 0, 0, 0.14)';
  context.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 256);
    context.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(256, y);
    context.stroke();
  }

  const texture = textureFromCanvas(canvas);
  texture.repeat.set(2, 6);
  return texture;
}

export function createSignTexture({
  title,
  subtitle = '',
  glyph = '',
  accent = '#62f6ff',
  accent2 = '#ff2d95',
  vertical = false,
  seed = 1,
}) {
  const width = vertical ? 256 : 768;
  const height = vertical ? 768 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const random = seededRandom(seed);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#03050b');
  gradient.addColorStop(0.5, '#0b1020');
  gradient.addColorStop(1, '#02030a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.1;
  context.strokeStyle = accent;
  context.lineWidth = 1;
  const cell = vertical ? 32 : 40;
  for (let x = 0; x < width; x += cell) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += cell) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = accent2;
  context.lineWidth = vertical ? 9 : 7;
  context.strokeRect(10, 10, width - 20, height - 20);
  context.strokeStyle = accent;
  context.lineWidth = 2;
  context.strokeRect(23, 23, width - 46, height - 46);

  const glowText = (text, x, y, font, align = 'left', color = accent) => {
    context.save();
    context.font = font;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = vertical ? 24 : 18;
    context.fillText(text, x, y);
    context.shadowBlur = 5;
    context.fillStyle = '#ecffff';
    context.fillText(text, x, y);
    context.restore();
  };

  if (vertical) {
    const letters = glyph || title;
    const chars = [...letters].slice(0, 5);
    const spacing = 112;
    const start = height * 0.5 - ((chars.length - 1) * spacing) / 2;
    chars.forEach((character, index) => {
      glowText(character, width * 0.5, start + index * spacing, '900 80px sans-serif', 'center');
    });
    context.save();
    context.translate(width - 22, height - 30);
    context.rotate(-Math.PI / 2);
    context.font = '700 20px monospace';
    context.fillStyle = accent2;
    context.textAlign = 'right';
    context.fillText(title, 0, 0);
    context.restore();
  } else {
    glowText(title, 54, height * 0.45, '900 78px Arial, sans-serif');
    context.font = '700 24px monospace';
    context.fillStyle = accent2;
    context.letterSpacing = '4px';
    context.fillText(subtitle, 58, height * 0.72);
    context.font = '800 54px sans-serif';
    context.textAlign = 'right';
    context.fillStyle = accent;
    context.globalAlpha = 0.42;
    context.fillText(glyph, width - 48, height * 0.72);
    context.globalAlpha = 1;
  }

  context.fillStyle = accent2;
  for (let i = 0; i < 18; i += 1) {
    const w = 2 + random() * (vertical ? 36 : 80);
    context.globalAlpha = 0.18 + random() * 0.32;
    context.fillRect(random() * width, random() * height, w, 1 + random() * 3);
  }
  context.globalAlpha = 1;

  const texture = textureFromCanvas(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createRadialTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = textureFromCanvas(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createReflectionStreakTexture(colorA = '#ff2d95', colorB = '#64f6ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(444);

  for (let i = 0; i < 42; i += 1) {
    const x = 20 + random() * 216;
    const width = 1 + random() * 12;
    const y = random() * 860;
    const length = 30 + random() * 165;
    const gradient = context.createLinearGradient(0, y, 0, y + length);
    const color = i % 3 === 0 ? colorB : colorA;
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.25, color);
    gradient.addColorStop(0.72, color);
    gradient.addColorStop(1, 'transparent');
    context.globalAlpha = 0.04 + random() * 0.16;
    context.fillStyle = gradient;
    context.fillRect(x, y, width, length);
  }

  context.globalAlpha = 1;
  const texture = textureFromCanvas(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createNeonEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const sky = context.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#030506');
  sky.addColorStop(0.45, '#0b1113');
  sky.addColorStop(0.76, '#233033');
  sky.addColorStop(1, '#090a09');
  context.fillStyle = sky;
  context.fillRect(0, 0, 1024, 512);

  const glows = [
    [120, '#b65f4c'],
    [340, '#5e9c99'],
    [590, '#d3915f'],
    [840, '#6f9192'],
  ];
  glows.forEach(([x, color]) => {
    const gradient = context.createRadialGradient(x, 350, 0, x, 350, 190);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.08, `${color}88`);
    gradient.addColorStop(0.45, `${color}1c`);
    gradient.addColorStop(1, 'transparent');
    context.fillStyle = gradient;
    context.fillRect(x - 200, 150, 400, 360);
  });

  const texture = textureFromCanvas(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target;
}
