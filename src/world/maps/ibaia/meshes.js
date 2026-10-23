import * as THREE from 'three';
import { asphaltTexture, sidewalkTexture, grassTexture, sandTexture, cobbleTexture, concreteTexture } from '../../textures.js';
import { forRingSegments, bridgePieces } from './decode.js';

/**
 * Mallas de Ibaia. Todo lo repetido (edificios, árboles, farolas, marcas
 * viales) se agrupa por celdas de CHUNK metros: cada celda es un grupo con
 * sus mallas, que se recorta entero por frustum y se oculta por distancia
 * (CityLod). Los edificios son cajas con ventanas procedurales en el shader:
 * así 33 000 cajas caben en unas pocas decenas de llamadas de dibujo.
 */
export const CHUNK = 400;

/** Paletas por tipo de edificio (las de la maqueta) y estilo de ventanas. */
const KIND_LOOK = {
  tower: { pal: ['#9aa4b2', '#8b96a6', '#a8b3c2', '#7f8a99', '#b4bcc8', '#6f8fa8', '#5d7d96'], win: 1 },
  mid: { pal: ['#b69a86', '#a3887a', '#c2a892', '#8f7a6e', '#c9b9a6'], win: 2 },
  walled: { pal: ['#9a8f86', '#8a7f78', '#a69a8e'], win: 2 },
  slab: { pal: ['#b9a48f', '#a99583'], win: 2 },
  old: { pal: ['#a5735a', '#b5846a', '#946652', '#c19a7e'], win: 3 },
  low: { pal: ['#e7dfcf', '#d9e4e6', '#efd9c4', '#cfe0d3', '#e9c9b8'], win: 4 },
  villa: { pal: ['#f0ece4', '#e6dfd2'], win: 4 },
  warehouse: { pal: ['#7d8794', '#6f7985', '#8e8a80'], win: 5 },
  industrial: { pal: ['#6e6b66', '#7d7974', '#5f5c58'], win: 5 },
  special: { pal: ['#c9c2b4'], win: 2 },
  stadium: { pal: ['#8c939c'], win: 0 },
  prison: { pal: ['#7a7d82'], win: 5 },
  container: { pal: ['#b5544a', '#3e7cb1', '#c9a24a', '#5f8f5a', '#8a5aa0', '#c7c7c7'], win: 0 },
  letters: { pal: ['#f5f2ea'], win: 0 },
  coaster: { pal: ['#c95f5f'], win: 0 },
  pier: { pal: ['#6a6152'], win: 0 },
};
/** Tipos que no se dibujan como caja (tienen modelo propio en specials). */
export const CUSTOM_KINDS = new Set(['tank', 'chimney', 'wheel', 'lighthouse', 'fountain', 'antenna', 'glass', 'torre', 'crane']);

const _c = new THREE.Color();

/**
 * Material de los edificios: color por vértice y, en las fachadas, una
 * rejilla de ventanas (cristal oscuro que refleja el cielo; algunas
 * encendidas, cálidas o frías). A lo lejos la rejilla se funde en su tono
 * medio para que no haga moaré.
 */
export function buildingMaterial({ lit = 1.0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
  mat.userData.lit = { value: lit };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = mat.userData.lit;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 facade;\nattribute vec2 bstyle;\nvarying vec2 vFacade;\nvarying vec2 vStyle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade;\nvStyle = bstyle;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vFacade;
varying vec2 vStyle;
uniform float uLit;
float bh21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float winMask = 0.0;
vec3 winLight = vec3(0.0);
if (vFacade.y >= 0.0 && vStyle.x > 0.5) {
  float st = floor(vStyle.x + 0.5);
  // Semilla entera: interpolada llega con un error mínimo que el hash convertiría en ruido
  float seed = floor(vStyle.y + 0.5);
  vec2 cell = vec2(3.2, 3.3);
  vec4 m = vec4(0.2, 0.2, 0.26, 0.16);
  float litF = 0.26;
  vec3 glass = vec3(0.07, 0.08, 0.1);
  if (st < 1.5) { cell = vec2(1.9, 3.7); m = vec4(0.05, 0.05, 0.1, 0.06); litF = 0.2; glass = vec3(0.1, 0.14, 0.19); }
  else if (st < 2.5) { }
  else if (st < 3.5) { cell = vec2(2.7, 3.3); m = vec4(0.3, 0.3, 0.2, 0.14); litF = 0.32; }
  else if (st < 4.5) { cell = vec2(4.2, 3.0); m = vec4(0.32, 0.32, 0.3, 0.22); litF = 0.36; }
  else { cell = vec2(7.0, 9.0); m = vec4(0.04, 0.04, 0.62, 0.1); litF = 0.08; }
  bool shop = (st > 1.5 && st < 3.5 && vFacade.y < 4.2);
  if (shop) { cell = vec2(5.0, 4.2); m = vec4(0.06, 0.06, 0.06, 0.22); litF = 0.55; glass = vec3(0.1, 0.1, 0.1); }
  vec2 c = vFacade / cell;
  vec2 id = floor(c);
  vec2 f = fract(c);
  vec2 fw = max(fwidth(c), vec2(1e-4));
  float mx = smoothstep(m.x - fw.x, m.x + fw.x, f.x) * (1.0 - smoothstep(1.0 - m.y - fw.x, 1.0 - m.y + fw.x, f.x));
  float my = smoothstep(m.z - fw.y, m.z + fw.y, f.y) * (1.0 - smoothstep(1.0 - m.w - fw.y, 1.0 - m.w + fw.y, f.y));
  float far = smoothstep(0.22, 0.55, max(fw.x, fw.y));
  float cover = (1.0 - m.x - m.y) * (1.0 - m.z - m.w);
  float win = mix(mx * my, cover, far);
  float h = bh21(id + seed * 0.731);
  float on = mix(step(1.0 - litF, h), litF * 0.7, far);
  float warm = bh21(id * 1.37 + seed);
  vec3 tint = mix(vec3(1.0, 0.7, 0.4), vec3(0.72, 0.84, 1.0), step(0.78, warm));
  diffuseColor.rgb = mix(diffuseColor.rgb, glass, win * mix(1.0, 0.75, far));
  winMask = win;
  winLight = tint * (0.45 + 0.55 * fract(h * 7.31)) * on * win;
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, winMask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.15, winMask);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += winLight * uLit;');
  };
  mat.customProgramCacheKey = () => 'ibaia-buildings';
  return mat;
}

/** Celda de agrupación de un punto. */
export const chunkKey = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;

/** Grupo de una celda (lo crea al pedirlo). */
export function chunkGroup(chunks, root, x, z) {
  const k = chunkKey(x, z);
  let c = chunks.get(k);
  if (!c) {
    const g = new THREE.Group();
    g.name = `Celda ${k}`;
    const [i, j] = k.split(',').map(Number);
    c = { group: g, x: (i + 0.5) * CHUNK, z: (j + 0.5) * CHUNK };
    chunks.set(k, c);
    root.add(g);
  }
  return c.group;
}

/**
 * Edificios como cajas (cuatro fachadas y azotea), fusionados por celda.
 * @returns {number} cajas dibujadas
 */
export function buildBuildings(B, CITY, chunks, root, mat) {
  const byChunk = new Map();
  for (let i = 0; i < B.n; i++) {
    if (CUSTOM_KINDS.has(CITY.kinds[B.kind[i]])) continue;
    const k = chunkKey(B.cx[i], B.cz[i]);
    if (!byChunk.has(k)) byChunk.set(k, []);
    byChunk.get(k).push(i);
  }
  let drawn = 0;
  for (const list of byChunk.values()) {
    const nb = list.length;
    const pos = new Float32Array(nb * 20 * 3);
    const nrm = new Float32Array(nb * 20 * 3);
    const col = new Uint8Array(nb * 20 * 3);
    const fac = new Float32Array(nb * 20 * 2);
    const sty = new Uint8Array(nb * 20 * 2);
    const idx = new Uint32Array(nb * 30);
    let v = 0;
    let t = 0;
    for (const i of list) {
      const kind = CITY.kinds[B.kind[i]];
      const look = KIND_LOOK[kind] ?? { pal: ['#a0a0a0'], win: 0 };
      const h = B.h[i];
      _c.set(look.pal[B.variant[i] % look.pal.length]);
      // Variación suave de tono por edificio
      const jit = 0.92 + ((B.variant[i] * 37) % 17) / 100;
      const wr = Math.min(255, _c.r * 255 * jit);
      const wg = Math.min(255, _c.g * 255 * jit);
      const wb = Math.min(255, _c.b * 255 * jit);
      const win = h > 7 ? look.win : look.win === 4 ? 4 : 0;
      const ux = Math.cos(B.ang[i]);
      const uz = Math.sin(B.ang[i]);
      const hw = B.hw[i];
      const hd = B.hd[i];
      const cx = B.cx[i];
      const cz = B.cz[i];
      // Esquinas en orden horario visto desde arriba
      const P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [cx + a * ux - b * uz, cz + a * uz + b * ux]);
      for (let e = 0; e < 4; e++) {
        const [ax, az] = P[e];
        const [bx, bz] = P[(e + 1) % 4];
        const L = Math.hypot(bx - ax, bz - az);
        const nx = (bz - az) / (L || 1);
        const nz = -(bx - ax) / (L || 1);
        // Ventanas centradas en la fachada
        const cell = win === 1 ? 1.9 : win === 3 ? 2.7 : win === 4 ? 4.2 : win === 5 ? 7 : 3.2;
        const off = (cell - (L % cell)) / 2;
        const quad = [[ax, 0, az, off, 0], [bx, 0, bz, off + L, 0], [bx, h, bz, off + L, h], [ax, h, az, off, h]];
        for (let q = 0; q < 4; q++) {
          const [x, y, z, fu, fv] = quad[q];
          pos.set([x, y, z], (v + q) * 3);
          nrm.set([nx, 0, nz], (v + q) * 3);
          // Pie de fachada algo más oscuro (suciedad y sombra de la calle)
          const k = y === 0 ? 0.78 : 1;
          col.set([wr * k, wg * k, wb * k], (v + q) * 3);
          fac.set([fu, fv], (v + q) * 2);
          sty.set([win, B.variant[i]], (v + q) * 2);
        }
        idx.set([v, v + 2, v + 1, v, v + 3, v + 2], t);
        v += 4;
        t += 6;
      }
      // Azotea
      for (let q = 0; q < 4; q++) {
        pos.set([P[q][0], h, P[q][1]], (v + q) * 3);
        nrm.set([0, 1, 0], (v + q) * 3);
        col.set([wr * 0.62, wg * 0.62, wb * 0.64], (v + q) * 3);
        fac.set([-1, -1], (v + q) * 2);
        sty.set([0, 0], (v + q) * 2);
      }
      idx.set([v, v + 2, v + 1, v, v + 3, v + 2], t);
      v += 4;
      t += 6;
      drawn++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    geo.setAttribute('facade', new THREE.BufferAttribute(fac, 2));
    geo.setAttribute('bstyle', new THREE.BufferAttribute(sty, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'Edificios';
    const i0 = list[0];
    chunkGroup(chunks, root, B.cx[i0], B.cz[i0]).add(mesh);
  }
  return drawn;
}

/** Geometría plana (con agujeros) a altura y; UV en repeticiones de `unit` metros. */
export function flatGeometry(polys, y, unit) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (const rings of polys) {
    const contour = [];
    const holes = [];
    rings.forEach((r, k) => {
      const pts = [];
      for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
      if (k === 0) contour.push(...pts);
      else holes.push(pts);
    });
    if (contour.length < 3) continue;
    const base = pos.length / 3;
    const all = contour.concat(...holes);
    const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
    for (const p of all) {
      pos.push(p.x, y, p.y);
      uv.push(p.x / unit, p.y / unit);
    }
    // ShapeUtils devuelve triángulos en el plano XY; en XZ (Z hacia el sur) se invierte el giro
    for (const [a, b, c] of faces) {
      const ax = all[a];
      const bx = all[b];
      const cx = all[c];
      const cross = (bx.x - ax.x) * (cx.y - ax.y) - (bx.y - ax.y) * (cx.x - ax.x);
      if (cross > 0) idx.push(base + a, base + c, base + b);
      else idx.push(base + a, base + b, base + c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  geo.setIndex(idx.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Paredes verticales a lo largo de anillos (bordillos, muelles). */
export function ringWalls(rings, y0, y1, keep = null) {
  const pos = [];
  const nrm = [];
  const uv = [];
  for (const r of rings) {
    forRingSegments(r, (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05 || (keep && !keep(ax, az, bx, bz))) return;
      const nx = (bz - az) / L;
      const nz = -(bx - ax) / L;
      // Dos caras (los anillos pueden venir en cualquier sentido)
      for (const s of [1, -1]) {
        const q = s > 0 ? [[ax, az], [bx, bz]] : [[bx, bz], [ax, az]];
        const [[px, pz], [qx, qz]] = q;
        pos.push(px, y0, pz, qx, y0, qz, qx, y1, qz, px, y0, pz, qx, y1, qz, px, y1, pz);
        for (let k = 0; k < 6; k++) nrm.push(nx * s, 0, nz * s);
        uv.push(0, 0, L / 3, 0, L / 3, (y1 - y0) / 3, 0, 0, L / 3, (y1 - y0) / 3, 0, (y1 - y0) / 3);
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}

const tex = (t, unit) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = { ...t.userData, unit };
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.anisotropy = 4;
  return c;
};

/** Suelo de la ciudad: calzada, aceras con bordillo, parques, playas, plazas, estanques y muelles. */
export function buildGround(group, data, landAtFn) {
  const asphalt = asphaltTexture();
  const side = sidewalkTexture();
  const mats = {
    land: new THREE.MeshStandardMaterial({ map: tex(asphalt, 6), color: 0xd8dae0, roughness: 0.72 }),
    blocks: new THREE.MeshStandardMaterial({ map: tex(side, 3), color: 0xc9c5bd, roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    park: new THREE.MeshStandardMaterial({ map: tex(grassTexture('#4f6b3e', 81), 3), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    forest: new THREE.MeshStandardMaterial({ map: tex(grassTexture('#344d2c', 82), 3), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    beach: new THREE.MeshStandardMaterial({ map: tex(sandTexture('#d6c79a', 68), 3), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    plaza: new THREE.MeshStandardMaterial({ map: tex(cobbleTexture('#8a8276', 62), 2.5), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    slag: new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1f4f73, roughness: 0.08, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
    curb: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8f8c86', 7), 3), roughness: 0.85 }),
    quay: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#6f6b64', 9), 4), roughness: 0.9 }),
  };
  const add = (geo, mat, name, y = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.receiveShadow = true;
    m.name = name;
    group.add(m);
    return m;
  };
  add(flatGeometry(data.land, -0.06, 6), mats.land, 'Calzada');
  add(flatGeometry(data.layers.blocks, 0.06, 3), mats.blocks, 'Aceras');
  add(ringWalls(data.layers.blocks.flat(), -0.06, 0.06), mats.curb, 'Bordillos');
  const Y = { park: 0.08, forest: 0.08, beach: 0.08, plaza: 0.08, slag: 0.08, water: 0.09 };
  for (const [k, y] of Object.entries(Y)) {
    if (data.layers[k]?.length) add(flatGeometry(data.layers[k], y, mats[k].map?.userData.unit ?? 3), mats[k], k);
  }
  // Muelles: solo los tramos del borde de la tierra que dan al agua
  const keep = (ax, az, bx, bz) => {
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (bz - az) / L;
    const nz = -(bx - ax) / L;
    return !landAtFn(mx + nx * 6, mz + nz * 6) || !landAtFn(mx - nx * 6, mz - nz * 6);
  };
  add(ringWalls(data.land.flat(), -4, -0.06, keep), mats.quay, 'Muelles');
  return mats;
}

/** Textura redonda y suave para los charcos de luz de las farolas. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Instancias repartidas por celdas: una InstancedMesh por celda y pieza. */
function instancedByChunk(chunks, root, pts, parts, place) {
  const by = new Map();
  for (let i = 0; i < pts.n; i++) {
    const k = chunkKey(pts.x[i], pts.z[i]);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(i);
  }
  for (const list of by.values()) {
    const g = chunkGroup(chunks, root, pts.x[list[0]], pts.z[list[0]]);
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach((i, k) => {
        place(i, _p, _q, _s);
        _m.compose(_p, _q, _s);
        im.setMatrixAt(k, _m);
        if (part.color) im.setColorAt(k, part.color(i));
      });
      im.castShadow = !!part.cast;
      im.receiveShadow = !part.noReceive;
      im.name = part.name;
      if (part.renderOrder) im.renderOrder = part.renderOrder;
      im.computeBoundingSphere();
      g.add(im);
    }
  }
}

/** Árboles de parques y bosques. */
export function buildTrees(chunks, root, trees) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 5).translate(0, 1.6, 0);
  const crown = new THREE.IcosahedronGeometry(2.3, 0).scale(1, 1.25, 1).translate(0, 4.6, 0);
  const tones = ['#3f6a35', '#4c7a3a', '#35592e', '#5a7d3c', '#2f5232'].map((c) => new THREE.Color(c));
  instancedByChunk(chunks, root, trees, [
    { geo: trunk, mat: new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9 }), name: 'Troncos' },
    { geo: crown, mat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), name: 'Copas', cast: true, color: (i) => tones[i % tones.length] },
  ], (i, p, q, s) => {
    p.set(trees.x[i], 0, trees.z[i]);
    q.setFromAxisAngle(_up, (i * 2.399) % (Math.PI * 2));
    s.setScalar(trees.e[i]);
  });
}

/** Farolas (poste, brazo hacia la calzada y luz) con su charco de luz en el suelo. */
export function buildLamps(chunks, root, lamps) {
  const pole = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 5).translate(0, 3.2, 0);
  const arm = new THREE.BoxGeometry(1.7, 0.08, 0.08).translate(0.85, 6.3, 0);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.5, roughness: 0.5 });
  const head = new THREE.BoxGeometry(0.6, 0.12, 0.3).translate(1.6, 6.22, 0);
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(2.2), toneMapped: false });
  const pool = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2).translate(1.6, 0.12, 0);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffd9a0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  instancedByChunk(chunks, root, lamps, [
    { geo: pole, mat: metal, name: 'Farolas' },
    { geo: arm, mat: metal, name: 'Brazos' },
    { geo: head, mat: glow, name: 'Luces', noReceive: true },
    { geo: pool, mat: poolMat, name: 'Charcos de luz', noReceive: true, renderOrder: 1 },
  ], (i, p, q, s) => {
    p.set(lamps.x[i], 0, lamps.z[i]);
    q.setFromAxisAngle(_up, -lamps.e[i]);
    s.setScalar(1);
  });
}

/** Marcas discontinuas en el eje de avenidas y autopistas. */
export function buildDashes(chunks, root, dashes) {
  const geo = new THREE.PlaneGeometry(3, 0.22).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  instancedByChunk(chunks, root, dashes, [{ geo, mat, name: 'Marcas viales' }], (i, p, q, s) => {
    p.set(dashes.x[i], -0.045, dashes.z[i]);
    q.setFromAxisAngle(_up, -dashes.e[i]);
    s.setScalar(1);
  });
}

/** Malla estática que MapManager fusionará (mergeStatic). */
function piece(group, geo, mat, { cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.userData.levelStatic = true;
  group.add(m);
  return m;
}

/** Caja orientada como geometría (para puentes y tren). */
function obbGeometry({ cx, cz, angle, hw, hd, minY, y0, y1 }) {
  const g = new THREE.BoxGeometry(2 * hw, 1, 2 * hd);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lu = p.getX(i);
    const top = p.getY(i) > 0;
    const t = (lu + hw) / (2 * hw);
    p.setY(i, top ? y0 + (y1 - y0) * t : minY);
  }
  g.computeVertexNormals();
  g.rotateY(-angle);
  g.translate(cx, 0, cz);
  return g;
}

/** Puentes: tablero, barandillas, pilas y, en los grandes, torres con tirantes. */
export function buildBridges(group, CITY) {
  const deck = new THREE.MeshStandardMaterial({ color: 0x6a6d74, roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f969f, metalness: 0.55, roughness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.4, roughness: 0.5 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.9 });
  const cables = [];
  for (const br of CITY.bridges) {
    const towerMat = br.color === '#c0392b' ? red : steel;
    bridgePieces(br, (p) => piece(group, obbGeometry(p), p.hd > 1 ? deck : steel));
    // Pilas cada ~60 m bajo el tablero
    const pts = br.pts;
    let acc = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, z0, y0] = pts[k];
      const [x1, z1, y1] = pts[k + 1];
      const L = Math.hypot(x1 - x0, z1 - z0);
      const a = Math.atan2(z1 - z0, x1 - x0);
      for (let s = 0; s < L; s += 4) {
        acc += 4;
        if (acc < 60) continue;
        acc = 0;
        const t = s / L;
        const y = y0 + (y1 - y0) * t;
        if (y < 3) continue;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        piece(group, new THREE.BoxGeometry(3, y + 2.4, br.w * 0.7).translate(0, (y - 5.6) / 2, 0).rotateY(-a).translate(x, 0, z), concrete);
      }
    }
    if (!br.towers) continue;
    // Dos torres en el tercio y dos tercios del tramo alto
    const high = pts.filter((p) => p[2] >= Math.max(...pts.map((q) => q[2])) - 0.01);
    if (high.length < 2) continue;
    const A = high[0];
    const Z = high[high.length - 1];
    const a = Math.atan2(Z[1] - A[1], Z[0] - A[0]);
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    const th = br.name === 'Puente de la Bahía' ? 150 : 110;
    for (const f of [0.28, 0.72]) {
      const x = A[0] + (Z[0] - A[0]) * f;
      const z = A[1] + (Z[1] - A[1]) * f;
      for (const s of [-1, 1]) {
        piece(group, new THREE.BoxGeometry(5, th, 5).translate(0, th / 2 - 2, 0).rotateY(-a).translate(x + nx * (br.w / 2 + 2) * s, 0, z + nz * (br.w / 2 + 2) * s), towerMat);
      }
      for (const yy of [th * 0.55, th - 6]) piece(group, new THREE.BoxGeometry(4, 4, br.w + 8).translate(0, yy, 0).rotateY(-a).translate(x, 0, z), towerMat);
      // Tirantes en abanico hasta el tablero
      for (const s of [-1, 1]) {
        const tx = x + nx * (br.w / 2 + 2) * s;
        const tz = z + nz * (br.w / 2 + 2) * s;
        for (let c = 1; c <= 6; c++) {
          for (const dir of [-1, 1]) {
            const d = c * 22 * dir;
            cables.push(tx, th - 10 - c * 2, tz, tx + Math.cos(a) * d, A[2] + 1, tz + Math.sin(a) * d);
          }
        }
      }
    }
  }
  if (cables.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8dde3, transparent: true, opacity: 0.7 }));
    lines.name = 'Tirantes';
    group.add(lines);
  }
}

/** Tren elevado: viga continua sobre pilares y raíles. */
export function buildRail(group, CITY) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a867e, roughness: 0.88 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x5a5f66, metalness: 0.7, roughness: 0.35 });
  const y = CITY.rail.y;
  for (const line of CITY.rail.lines) {
    for (let k = 0; k + 1 < line.length; k++) {
      const [x0, z0] = line[k];
      const [x1, z1] = line[k + 1];
      const L = Math.hypot(x1 - x0, z1 - z0);
      if (L < 0.5) continue;
      const a = Math.atan2(z1 - z0, x1 - x0);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      piece(group, obbGeometry({ cx, cz, angle: a, hw: L / 2 + 0.3, hd: 4.5, minY: y - 1.4, y0: y, y1: y }), concrete);
      piece(group, obbGeometry({ cx: x0, cz: z0, angle: a, hw: 1.1, hd: 1.1, minY: 0, y0: y - 1.4, y1: y - 1.4 }), concrete);
      for (const s of [-1.6, 1.6]) {
        const nx = -Math.sin(a) * s;
        const nz = Math.cos(a) * s;
        piece(group, obbGeometry({ cx: cx + nx, cz: cz + nz, angle: a, hw: L / 2 + 0.3, hd: 0.08, minY: y, y0: y + 0.18, y1: y + 0.18 }), rail, { cast: false });
      }
    }
  }
}
