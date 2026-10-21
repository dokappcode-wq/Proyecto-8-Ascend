import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Piezas del cuerpo fusionadas por hueso.
 *
 * Cada hueso (grupo animado) junta todas sus piezas —de colores distintos—
 * en una sola malla por tipo de material, con el color en los vértices. Así
 * un personaje con cara, pelo, ropa por capas y dedos cuesta unas pocas
 * llamadas de dibujo por hueso en vez de una por pieza.
 *
 * Tipos de material: 'matte' (tela, pelo, suela), 'soft' (piel, cuero,
 * ojos) y 'metal' (equipo, armas, casco).
 */
export const MATERIAL_KINDS = Object.freeze({
  matte: { roughness: 0.9, metalness: 0 },
  soft: { roughness: 0.5, metalness: 0.02 },
  metal: { roughness: 0.38, metalness: 0.65 },
});

/** Materiales de un modelo (propios de cada uno: el destello de impacto los tiñe por separado). */
export function bodyMaterials() {
  const out = {};
  for (const [k, p] of Object.entries(MATERIAL_KINDS)) out[k] = new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class PartSet {
  constructor() {
    this.parts = { matte: [], soft: [], metal: [] };
  }

  /**
   * @param {'matte'|'soft'|'metal'} kind
   * @param {THREE.BufferGeometry} geo (no se modifica)
   * @param {number|string|THREE.Color} color
   * @param {object} [t] { pos: [x,y,z], rot: [x,y,z], scale: [x,y,z] | número }
   */
  add(kind, geo, color, t = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const sc = t.scale ?? 1;
    _s.set(...(typeof sc === 'number' ? [sc, sc, sc] : sc));
    _q.setFromEuler(_e.set(...(t.rot ?? [0, 0, 0])));
    _p.set(...(t.pos ?? [0, 0, 0]));
    g.applyMatrix4(_m.compose(_p, _q, _s));
    _c.set(color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts[kind].push(g);
    return this;
  }

  get empty() {
    return !Object.values(this.parts).some((l) => l.length);
  }

  /** Crea las mallas fusionadas dentro de `parent`. */
  build(parent, mats, { cast = true } = {}) {
    const meshes = [];
    for (const [kind, list] of Object.entries(this.parts)) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[kind]);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts = { matte: [], soft: [], metal: [] };
    return meshes;
  }
}

// ---------------------------------------------------------------- Primitivas
const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/** Caja redondeada (centrada). */
export function rbox(w, h, d, r = 0.02, seg = 2) {
  return cached(`rb:${w}:${h}:${d}:${r}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999));
}

export function sphere(r, ws = 14, hs = 10, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI) {
  return cached(`sp:${r}:${ws}:${hs}:${phiStart}:${phiLen}:${thetaStart}:${thetaLen}`, () => new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thetaStart, thetaLen));
}

export function cyl(rTop, rBottom, h, seg = 12, open = false, thetaStart = 0, thetaLen = Math.PI * 2) {
  return cached(`cy:${rTop}:${rBottom}:${h}:${seg}:${open}:${thetaStart}:${thetaLen}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open, thetaStart, thetaLen));
}

export function torus(r, tube, rs = 6, ts = 16, arc = Math.PI * 2) {
  return cached(`to:${r}:${tube}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
}

export function cone(r, h, seg = 8) {
  return cached(`co:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}

/**
 * Extremidad que cuelga del hueso: tronco de cono de `r1` (arriba, y = y0)
 * a `r2` (abajo, y = y0 − len) con extremos redondeados.
 */
export function limb(set, kind, color, r1, r2, len, { x = 0, y0 = 0, z = 0, sx = 1, sz = 1, caps = true } = {}) {
  set.add(kind, cyl(r1, r2, len, 12, true), color, { pos: [x, y0 - len / 2, z], scale: [sx, 1, sz] });
  if (caps) {
    set.add(kind, sphere(r1, 12, 8), color, { pos: [x, y0, z], scale: [sx, 1, sz] });
    set.add(kind, sphere(r2, 12, 8), color, { pos: [x, y0 - len, z], scale: [sx, 1, sz] });
  }
  return set;
}

/** Aclara u oscurece un color (para costuras, suelas, sombras de pliegues). */
export function shade(color, k) {
  const c = new THREE.Color(color);
  if (k >= 1) return c.lerp(new THREE.Color(0xffffff), Math.min(1, k - 1));
  return c.multiplyScalar(k);
}
