import * as THREE from 'three';
import { rng } from './textures.js';

let normalCanvas = null;

/**
 * Normal de olas (suma de ondas en varias direcciones), repetible sin
 * costuras. Se genera una vez y se comparte.
 */
function waveNormalCanvas() {
  if (normalCanvas) return normalCanvas;
  const S = 256;
  const r = rng(404);
  const waves = [];
  for (let i = 0; i < 9; i++) {
    // Frecuencias enteras: la textura se repite sin costuras
    waves.push({ kx: Math.round((r() - 0.5) * 10), ky: Math.round((r() - 0.5) * 10) || 1, amp: 0.4 + r(), ph: r() * Math.PI * 2 });
  }
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const a = ((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.ph;
        const c0 = Math.cos(a) * w.amp;
        dx += c0 * w.kx * 0.05;
        dy += c0 * w.ky * 0.05;
      }
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      d[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      d[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      d[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  normalCanvas = c;
  return c;
}

function normalTexture(repeat) {
  const t = new THREE.CanvasTexture(waveNormalCanvas());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/**
 * Agua animada: dos capas de olas que se desplazan en direcciones distintas
 * (normal del material y de la capa transparente), casi espejo, reflejando
 * el cielo del mapa (mapa de entorno).
 *
 * @param {object} o { width, depth, color, night, speed, repeat }
 */
export function createWater({ width = 400, depth = 400, color = 0x2a5a78, night = false, speed = 1, repeat = 40 } = {}) {
  const n1 = normalTexture(repeat);
  const n2 = normalTexture(repeat * 0.37);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: night ? 0.18 : 0.12,
    metalness: 0,
    normalMap: n1,
    normalScale: new THREE.Vector2(0.55, 0.55),
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    clearcoatNormalMap: n2,
    clearcoatNormalScale: new THREE.Vector2(0.4, 0.4),
    envMapIntensity: night ? 0.7 : 1.15,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2), mat);
  mesh.receiveShadow = true;
  mesh.name = 'Agua';
  const t0 = performance.now();
  mesh.onBeforeRender = () => {
    const t = ((performance.now() - t0) / 1000) * speed;
    n1.offset.set(t * 0.011, t * 0.007);
    n2.offset.set(-t * 0.006, t * 0.009);
  };
  return mesh;
}
