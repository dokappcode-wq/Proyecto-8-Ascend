import * as THREE from 'three';

/**
 * Texturas procedurales (canvas). El prototipo no depende de recursos
 * externos: todo se genera al cargar.
 */

const cache = new Map();

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // Se lee de vuelta (mapa normal, relieve): mejor en memoria que en la GPU
  draw(c.getContext('2d', { willReadFrequently: true }), size);
  return c;
}

function toTexture(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
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

/**
 * Mapa normal a partir de la luminosidad del color (lo claro sobresale y
 * las juntas oscuras quedan hundidas). Da relieve a piedras, tejas, juntas
 * y grietas sin geometría extra.
 */
export function normalFromCanvas(src, strength = 2) {
  const w = src.width;
  const h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (sd[i * 4] * 0.3 + sd[i * 4 + 1] * 0.59 + sd[i * 4 + 2] * 0.11) / 255;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      d[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      d[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      d[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(out, { srgb: false });
}

/**
 * Mapas normales por imagen de origen: las copias de una textura (clone)
 * comparten `source`, así que todas encuentran el suyo. (No va en
 * `userData`: Texture.clone lo copia como JSON.)
 */
const normals = new WeakMap();

/** Mapa normal asociado a una textura procedural (o undefined). */
export function normalMapFor(texture) {
  return texture?.source ? normals.get(texture.source) : undefined;
}

/** Textura de color con su mapa normal (MapManager lo aplica solo). */
function material(key, size, unit, strength, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size, draw);
  const t = toTexture(c);
  t.userData = { unit };
  normals.set(t.source, normalFromCanvas(c, strength));
  cache.set(key, t);
  return t;
}

const hexRgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** Variación de un color: k > 1 aclara, k < 1 oscurece. */
const tone = (hex, k) => {
  const [r, g, b] = hexRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

/** Manchas suaves de gran tamaño (variación de tono que rompe la repetición). */
function blotches(g, size, r, n, alpha) {
  for (let i = 0; i < n; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = size * (0.08 + r() * 0.25);
    const light = r() < 0.5;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        grd.addColorStop(0, light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.3})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
}

/** Grieta fina (polilínea). */
function crack(g, r, x, y, steps, len, alpha = 0.45) {
  g.strokeStyle = `rgba(0,0,0,${alpha})`;
  g.lineWidth = 1 + r();
  g.beginPath();
  g.moveTo(x, y);
  for (let j = 0; j < steps; j++) {
    x += (r() - 0.5) * len;
    y += (r() - 0.5) * len;
    g.lineTo(x, y);
  }
  g.stroke();
}

/** Hormigón: manchas, poros, grietas, chorreones y la junta del panel. */
export function concreteTexture(tint = '#7b7f86', seed = 7) {
  return material(`concrete:${tint}:${seed}`, 256, 3, 2.2, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tint;
    g.fillRect(0, 0, s, s);
    blotches(g, s, r, 10, 0.07);
    noise(g, s, 0.22, seed);
    // Poros
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.25})`;
      g.beginPath();
      g.arc(r() * s, r() * s, 0.6 + r() * 1.3, 0, Math.PI * 2);
      g.fill();
    }
    // Chorreones desde arriba
    for (let i = 0; i < 6; i++) {
      const x = r() * s;
      const grd = g.createLinearGradient(0, 0, 0, s * (0.2 + r() * 0.5));
      grd.addColorStop(0, 'rgba(0,0,0,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 2 + r() * 5, s);
    }
    for (let i = 0; i < 3; i++) crack(g, r, r() * s, r() * s, 6, 30, 0.35);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s - 2);
  });
}

/** Muro de mampostería: piedras irregulares en hiladas con juntas de mortero. */
export function stoneWallTexture(tint = '#8f8676', seed = 63) {
  return material(`stonewall:${tint}:${seed}`, 512, 2.4, 3.2, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tone(tint, 0.55);
    g.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const rowH = 38 + r() * 30;
      let x = -r() * 40;
      while (x < s) {
        const w = 50 + r() * 70;
        const k = 0.82 + r() * 0.3;
        const pad = 3 + r() * 2;
        const rx = Math.min(10, w / 4);
        for (const ox of [0, x + w > s ? -s : 0]) {
          g.fillStyle = tone(tint, k);
          roundRect(g, x + pad + ox, y + pad, w - pad * 2, Math.min(rowH, s - y + rowH) - pad * 2, rx);
          g.fill();
          // Luz arriba y sombra abajo (relieve)
          g.fillStyle = 'rgba(255,255,255,0.07)';
          roundRect(g, x + pad + ox, y + pad, w - pad * 2, (rowH - pad * 2) * 0.35, rx);
          g.fill();
        }
        x += w;
      }
      y += rowH;
    }
    noise(g, s, 0.2, seed + 1);
    blotches(g, s, r, 8, 0.06);
  });
}

/** Tejas curvas en hiladas solapadas. */
export function roofTileTexture(tint = '#8a4a32', seed = 65) {
  return material(`tiles:${tint}:${seed}`, 256, 2, 3, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tone(tint, 0.5);
    g.fillRect(0, 0, s, s);
    const rows = 8;
    const cols = 8;
    const th = s / rows;
    const tw = s / cols;
    for (let row = 0; row < rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = col * tw + (row % 2) * (tw / 2);
        const y = row * th;
        const grd = g.createLinearGradient(x, 0, x + tw, 0);
        const k = 0.85 + r() * 0.3;
        grd.addColorStop(0, tone(tint, k * 0.7));
        grd.addColorStop(0.45, tone(tint, k * 1.12));
        grd.addColorStop(1, tone(tint, k * 0.65));
        g.fillStyle = grd;
        roundRect(g, x + 1, y, tw - 2, th - 2, 6);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 1, y + th - 5, tw - 2, 3);
      }
    }
    noise(g, s, 0.16, seed);
  });
}

/** Adoquines redondeados (plazas y calles del pueblo). */
export function cobbleTexture(tint = '#7d7466', seed = 62) {
  return material(`cobble:${tint}:${seed}`, 512, 2, 2.6, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tone(tint, 0.62);
    g.fillRect(0, 0, s, s);
    // Hiladas de piedras de tamaño variable (≈ 13 por metro), con juntas finas
    const rows = 13;
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * rh;
      const y = row * rh;
      while (x < s) {
        const w = rh * (0.8 + r() * 0.55);
        const k = 0.86 + r() * 0.26;
        for (const ox of [0, x + w > s ? -s : 0]) {
          const px = x + ox + 1.6 + (r() - 0.5) * 1.5;
          const py = y + 1.6 + (r() - 0.5) * 1.5;
          const grd = g.createRadialGradient(px + w * 0.4, py + rh * 0.35, 1, px + w * 0.5, py + rh * 0.5, w * 0.7);
          grd.addColorStop(0, tone(tint, k * 1.08));
          grd.addColorStop(1, tone(tint, k * 0.88));
          g.fillStyle = grd;
          roundRect(g, px, py, w - 3.2, rh - 3.2, rh * 0.3);
          g.fill();
        }
        x += w;
      }
    }
    blotches(g, s, r, 10, 0.06);
    noise(g, s, 0.1, seed);
  });
}

/**
 * Roca fracturada: placas poligonales de tonos distintos separadas por
 * grietas oscuras (el mapa normal les da relieve), con manchas y poros.
 */
export function rockTexture(tint = '#6b6862', seed = 83) {
  return material(`rock:${tint}:${seed}`, 512, 4, 3, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tone(tint, 0.5);
    g.fillRect(0, 0, s, s);
    // Celdas de Voronoi aproximadas: puntos repetidos en 3×3 para no tener costuras
    const pts = [];
    for (let i = 0; i < 46; i++) pts.push([r() * s, r() * s, 0.8 + r() * 0.35]);
    const img = g.getImageData(0, 0, s, s);
    const d = img.data;
    const [tr, tg, tb] = hexRgb(tint);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        let a = 1e9;
        let b = 1e9;
        let k = 1;
        for (const [px, py, pk] of pts) {
          let dx = Math.abs(x - px);
          let dy = Math.abs(y - py);
          if (dx > s / 2) dx = s - dx;
          if (dy > s / 2) dy = s - dy;
          const dd = dx * dx + dy * dy;
          if (dd < a) {
            b = a;
            a = dd;
            k = pk;
          } else if (dd < b) b = dd;
        }
        // Distancia al borde de la celda → grieta oscura y borde biselado
        const edge = Math.sqrt(b) - Math.sqrt(a);
        const crackK = edge < 2.2 ? 0.45 : edge < 7 ? 0.75 + (edge - 2.2) * 0.05 : 1;
        const f = k * crackK * (0.92 + Math.sqrt(a) * 0.0012);
        const i = (y * s + x) * 4;
        d[i] = Math.min(255, tr * f);
        d[i + 1] = Math.min(255, tg * f);
        d[i + 2] = Math.min(255, tb * f);
      }
    }
    g.putImageData(img, 0, 0);
    blotches(g, s, r, 14, 0.1);
    noise(g, s, 0.22, seed);
    for (let i = 0; i < 6; i++) crack(g, r, r() * s, r() * s, 6, 40, 0.4);
  });
}

/** Hierba: tallos cortos de varios verdes y calvas de tierra. */
export function grassTexture(tint = '#4a5a3c', seed = 81) {
  return material(`grass:${tint}:${seed}`, 256, 3, 1.4, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tint;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(92,72,48,0.18)';
      g.beginPath();
      g.ellipse(r() * s, r() * s, 10 + r() * 22, 6 + r() * 14, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 2600; i++) {
      const x = r() * s;
      const y = r() * s;
      g.strokeStyle = tone(tint, 0.65 + r() * 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 5);
      g.stroke();
    }
  });
}

/** Tablones de madera con veta. */
export function woodTexture(tint = '#6b4a32', seed = 71) {
  return material(`wood:${tint}:${seed}`, 256, 2, 2.5, (g, s) => {
    const r = rng(seed);
    const n = 6;
    const pw = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = tone(tint, 0.85 + r() * 0.3);
      g.fillRect(i * pw, 0, pw, s);
      for (let k = 0; k < 9; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
        g.lineWidth = 1;
        g.beginPath();
        let x = i * pw + r() * pw;
        g.moveTo(x, 0);
        for (let y = 0; y <= s; y += 16) {
          x += (r() - 0.5) * 2.5;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(i * pw, 0, 2, s);
      const cut = r() * s;
      g.fillRect(i * pw, cut, pw, 2);
    }
  });
}

/** Chapa de acero: paneles, remaches y arañazos. */
export function metalPlateTexture(tint = '#4b5560', seed = 91) {
  return material(`plate:${tint}:${seed}`, 256, 2, 2.4, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tint;
    g.fillRect(0, 0, s, s);
    blotches(g, s, r, 8, 0.07);
    const half = s / 2;
    for (const [x, y] of [[0, 0], [half, 0], [0, half], [half, half]]) {
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 3;
      g.strokeRect(x + 1.5, y + 1.5, half - 3, half - 3);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (const [rx, ry] of [[8, 8], [half - 8, 8], [8, half - 8], [half - 8, half - 8]]) {
        g.beginPath();
        g.arc(x + rx, y + ry, 2.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Rejilla antideslizante en relieve
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 6; y < s; y += 10) for (let x = 6 + ((y / 10) % 2) * 5; x < s; x += 10) g.fillRect(x, y, 5, 2);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`;
      g.beginPath();
      const x = r() * s;
      const y = r() * s;
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 12);
      g.stroke();
    }
    noise(g, s, 0.12, seed);
  });
}

/** Arena con ondulaciones del viento. */
export function sandTexture(tint = '#a89a7c', seed = 68) {
  return material(`sand:${tint}:${seed}`, 256, 3, 1.6, (g, s) => {
    const r = rng(seed);
    g.fillStyle = tint;
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 7) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.05})`;
      g.beginPath();
      for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5);
      g.stroke();
    }
    noise(g, s, 0.25, seed);
  });
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function asphaltTexture() {
  return material('asphalt', 256, 6, 1.1, (g, s) => {
    g.fillStyle = '#33353a';
    g.fillRect(0, 0, s, s);
    const r = rng(12);
    blotches(g, s, r, 8, 0.07);
    noise(g, s, 0.22, 11);
    // Árido claro (fino, poco contraste para que no "chispee" a lo lejos)
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(180,180,180,${0.04 + r() * 0.07})`;
      g.fillRect(r() * s, r() * s, 1, 1);
    }
    for (let i = 0; i < 5; i++) crack(g, r, r() * s, r() * s, 5, 40, 0.4);
  });
}

export function sidewalkTexture() {
  return material('sidewalk', 128, 1.5, 2.4, (g, s) => {
    g.fillStyle = '#8c8a86';
    g.fillRect(0, 0, s, s);
    blotches(g, s, rng(22), 4, 0.06);
    noise(g, s, 0.2, 21);
    g.strokeStyle = 'rgba(40,40,40,0.55)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, s, s);
  });
}

/**
 * Ventana con marco y cuarterones. Devuelve { map, emissiveMap }: de día el
 * vidrio oscuro refleja el cielo (rugosidad baja); de noche los cristales se
 * encienden con una luz cálida irregular (cortina, sombras). 1 repetición =
 * una ventana (0.9 × 1 m).
 */
export function windowTextures(frame = '#5a4634') {
  const key = `window:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const W = 128;
  const H = 144;
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    draw(c.getContext('2d'));
    return c;
  };
  const panes = [];
  const fw = 10;
  const bar = 6;
  const pw = (W - fw * 2 - bar) / 2;
  const ph = (H - fw * 2 - bar) / 2;
  for (const ix of [0, 1]) for (const iy of [0, 1]) panes.push([fw + ix * (pw + bar), fw + iy * (ph + bar)]);
  const base = mk((g) => {
    g.fillStyle = frame;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, W - 3, H - 3);
    for (const [x, y] of panes) {
      const grd = g.createLinearGradient(x, y, x + pw * 0.6, y + ph);
      grd.addColorStop(0, '#5d6f80');
      grd.addColorStop(0.45, '#26313d');
      grd.addColorStop(1, '#1a222b');
      g.fillStyle = grd;
      g.fillRect(x, y, pw, ph);
      // Reflejo en diagonal
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.moveTo(x + pw * 0.15, y + ph);
      g.lineTo(x + pw * 0.55, y);
      g.lineTo(x + pw * 0.75, y);
      g.lineTo(x + pw * 0.35, y + ph);
      g.fill();
    }
  });
  const glow = mk((g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (const [x, y] of panes) {
      const grd = g.createRadialGradient(x + pw / 2, y + ph * 0.7, 2, x + pw / 2, y + ph * 0.6, ph);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(1, '#8a6a4a');
      g.fillStyle = grd;
      g.fillRect(x, y, pw, ph);
    }
    // Cortina recogida a un lado
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(fw, fw, pw * 0.35, H - fw * 2);
  });
  const map = toTexture(base);
  const emissiveMap = toTexture(glow);
  map.userData = emissiveMap.userData = { unitX: 0.9, unitY: 1 };
  const out = { map, emissiveMap };
  cache.set(key, out);
  return out;
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
  normals.set(map.source, normalFromCanvas(color, 2.5));
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
