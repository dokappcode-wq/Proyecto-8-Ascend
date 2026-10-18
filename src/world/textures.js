import * as THREE from 'three';

/**
 * Texturas procedurales (canvas). El prototipo no depende de recursos
 * externos: todo se genera al cargar.
 */

const cache = new Map();

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}

function toTexture(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** PRNG determinista para que los mapas sean idénticos en cada carga. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(g, size, alpha, seed) {
  const r = rng(seed);
  for (let i = 0; i < size * size * 0.06; i++) {
    const v = Math.floor(r() * 255);
    g.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
}

/** Rejilla técnica del Campo de Pruebas. 1 repetición = 1 m (líneas mayores cada 4). */
export function gridTexture(base = '#2a3038', line = '#4a5a6c', major = '#6f8fb0') {
  const key = `grid:${base}:${line}:${major}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    noise(g, s, 0.08, 3);
    g.strokeStyle = line;
    g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const p = (i * s) / 4;
      g.beginPath();
      g.moveTo(p, 0);
      g.lineTo(p, s);
      g.moveTo(0, p);
      g.lineTo(s, p);
      g.stroke();
    }
    g.strokeStyle = major;
    g.lineWidth = 4;
    g.strokeRect(0, 0, s, s);
  });
  const t = toTexture(c);
  t.userData = { unit: 4 };
  cache.set(key, t);
  return t;
}

export function concreteTexture(tint = '#7b7f86', seed = 7) {
  const key = `concrete:${tint}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, (g, s) => {
    g.fillStyle = tint;
    g.fillRect(0, 0, s, s);
    noise(g, s, 0.25, seed);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, s, s);
  });
  const t = toTexture(c);
  t.userData = { unit: 3 };
  cache.set(key, t);
  return t;
}

export function asphaltTexture() {
  if (cache.has('asphalt')) return cache.get('asphalt');
  const c = canvas(256, (g, s) => {
    g.fillStyle = '#2b2d31';
    g.fillRect(0, 0, s, s);
    noise(g, s, 0.35, 11);
    const r = rng(12);
    g.strokeStyle = 'rgba(10,10,10,0.5)';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      let x = r() * s;
      let y = r() * s;
      g.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.5) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  const t = toTexture(c);
  t.userData = { unit: 6 };
  cache.set('asphalt', t);
  return t;
}

export function sidewalkTexture() {
  if (cache.has('sidewalk')) return cache.get('sidewalk');
  const c = canvas(128, (g, s) => {
    g.fillStyle = '#8c8a86';
    g.fillRect(0, 0, s, s);
    noise(g, s, 0.2, 21);
    g.strokeStyle = 'rgba(40,40,40,0.55)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, s, s);
  });
  const t = toTexture(c);
  t.userData = { unit: 1.5 };
  cache.set('sidewalk', t);
  return t;
}

/**
 * Fachada con ventanas. Devuelve { map, emissiveMap } — las ventanas
 * encendidas se iluminan al atardecer.
 * 1 repetición = 4 plantas × 4 ventanas (16 m de ancho × 14 m de alto), con
 * un patrón de ventanas encendidas variado para que la repetición no se note.
 */
export function facadeTextures(style = 0) {
  const key = `facade:${style}`;
  if (cache.has(key)) return cache.get(key);
  const palettes = [
    { wall: '#5b5550', frame: '#2f2b28', glass: '#1d2733' },
    { wall: '#46505c', frame: '#22282f', glass: '#18222d' },
    { wall: '#7a6250', frame: '#3b2e25', glass: '#1f2630' },
    { wall: '#3a3d44', frame: '#1b1d22', glass: '#223144' },
    { wall: '#6d6f73', frame: '#303236', glass: '#1a2430' },
  ];
  const p = palettes[style % palettes.length];
  const r = rng(100 + style);
  const W = 512;
  const cell = W / 4;
  const lit = [];
  const color = canvas(W, (g, s) => {
    g.fillStyle = p.wall;
    g.fillRect(0, 0, s, s);
    noise(g, s, 0.18, 200 + style);
    for (let row = 0; row < 4; row++) {
      // Línea de forjado
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, row * cell + cell - 6, s, 6);
      for (let col = 0; col < 4; col++) {
        const x = col * cell + 16;
        const y = row * cell + 24;
        const w = cell - 32;
        const h = cell - 46;
        g.fillStyle = p.frame;
        g.fillRect(x - 4, y - 4, w + 8, h + 8);
        g.fillStyle = p.glass;
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x, y, w, h * 0.35);
        g.fillStyle = p.frame;
        g.fillRect(x + w / 2 - 2, y, 4, h);
        lit.push({ x, y, w, h, on: r() < 0.32, warm: r() < 0.8, dim: 0.55 + r() * 0.45 });
      }
    }
  });
  const emissive = canvas(W, (g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    for (const l of lit) {
      if (!l.on) continue;
      g.globalAlpha = l.dim;
      g.fillStyle = l.warm ? '#ffb45e' : '#9fd0ff';
      g.fillRect(l.x, l.y, l.w, l.h);
      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.fillRect(l.x + l.w / 2 - 2, l.y, 4, l.h);
    }
  });
  const map = toTexture(color);
  const emissiveMap = toTexture(emissive);
  map.userData = emissiveMap.userData = { unitX: 16, unitY: 14 };
  const res = { map, emissiveMap };
  cache.set(key, res);
  return res;
}

/** Texto sobre fondo transparente o sólido, para carteles y marcas de suelo. */
export function textTexture(lines, { width = 512, height = 256, bg = 'rgba(8,12,18,0.85)', fg = '#dfe9f5', accent = '#4aa3ff', font = 'Rajdhani, Arial Narrow, Arial, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);
    g.fillStyle = accent;
    g.fillRect(0, 0, 10, height);
  }
  const arr = Array.isArray(lines) ? lines : [lines];
  const big = Math.floor(height * 0.3);
  const small = Math.floor(height * 0.15);
  let y = height * 0.18;
  arr.forEach((line, i) => {
    const size = i === 0 ? big : small;
    g.font = `${i === 0 ? '700' : '500'} ${size}px ${font}`;
    g.fillStyle = i === 0 ? fg : '#9fb2c8';
    g.textBaseline = 'top';
    g.fillText(line, 32, y, width - 48);
    y += size * 1.25;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
