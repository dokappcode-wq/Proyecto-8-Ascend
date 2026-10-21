import * as THREE from 'three';
import { metalPlateTexture, concreteTexture, asphaltTexture, rng } from '../textures.js';
import { scaleBoxUVs } from '../LevelBuilder.js';
import { deco } from './common.js';

/**
 * KIT DEL PUENTE (gran cañón): tramos de celosía de acero
 * pintado en rojo óxido que se construyen en coordenadas locales y luego se
 * colocan rectos, inclinados (se cayeron de un lado) o colgando (se
 * descolgaron de una bisagra). Pilas de hormigón enteras o partidas.
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

export function bridgeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    steel: std({ map: tex(metalPlateTexture('#8a3a2a', 93)), metalness: 0.45, roughness: 0.6 }),
    steelDark: std({ map: tex(metalPlateTexture('#5e2a20', 94)), metalness: 0.5, roughness: 0.6 }),
    deck: std({ map: tex(concreteTexture('#7b7f86', 11)), roughness: 0.9 }),
    road: std({ map: tex(asphaltTexture()), roughness: 0.85 }),
    grate: std({ color: 0x3a3f46, metalness: 0.7, roughness: 0.5 }),
    rail: std({ color: 0xe0b021, metalness: 0.3, roughness: 0.55 }),
    concrete: std({ map: tex(concreteTexture('#948e84', 12)), roughness: 0.92 }),
    rebar: std({ color: 0x3a2a22, metalness: 0.6, roughness: 0.7 }),
    cable: std({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.3 }),
    whiteMark: std({ color: 0xf2efe6, roughness: 0.6, emissive: 0x3a3a36 }),
    paint: std({ color: 0xe8e4d6, roughness: 0.7 }),
  };
}

/** Pieza de caja dentro de un grupo (UV en metros, se fusiona como estática). */
function part(g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUVs(geo, w, h, d, mat);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.levelStatic = true;
  g.add(m);
  return m;
}

/**
 * Tramo de celosía (Warren) en coordenadas locales: de x = 0 a x = len, cara
 * de rodadura en y = 0, centrado en z. Losa, asfalto, pasarelas de rejilla,
 * barandillas amarillas, vigas de piso por debajo (en un tramo colgado son
 * los travesaños por los que se trepa) y celosía a los dos lados.
 * `broken`: extremos rotos ('start' | 'end') con vigas retorcidas y losa partida.
 */
export function trussSpan(M, { len, width = 8, h = 5.5, panel = 5, broken = [], seed = 1, marks = false }) {
  const g = new THREE.Group();
  const r = rng(seed);
  const hw = width / 2;
  const cut = (end) => broken.includes(end);
  const a0 = cut('start') ? 1.2 : 0;
  const a1 = cut('end') ? len - 1.2 : len;
  const L = a1 - a0;
  const mid = (a0 + a1) / 2;
  part(g, M.deck, L, 0.6, width, mid, -0.3, 0);
  part(g, M.road, L, 0.03, width - 2.6, mid, 0.015, 0);
  for (const s of [-1, 1]) {
    part(g, M.grate, L, 0.08, 1.2, mid, 0.04, s * (hw - 0.7));
    // Barandillas
    part(g, M.rail, L, 0.1, 0.1, mid, 1.05, s * (hw - 0.08));
    part(g, M.rail, L, 0.07, 0.07, mid, 0.55, s * (hw - 0.08));
    for (let x = a0 + 0.6; x < a1; x += 2.2) part(g, M.rail, 0.08, 1.1, 0.08, x, 0.55, s * (hw - 0.08));
    // Celosía: cordones, montantes y diagonales
    const z = s * (hw + 0.35);
    part(g, M.steel, L, 0.55, 0.5, mid, -0.35, z);
    const n = Math.max(1, Math.round(L / panel));
    const p = L / n;
    part(g, M.steel, L - p, 0.5, 0.5, mid, h, z);
    for (let i = 0; i <= n; i++) {
      const x = a0 + i * p;
      if (i > 0 && i < n) part(g, M.steelDark, 0.4, h, 0.4, x, h / 2, z);
      if (i < n) {
        const up = i % 2 === 0;
        const dl = Math.hypot(p, h);
        const ang = Math.atan2(h, p) * (up ? 1 : -1);
        if (!(cut('start') && i === 0) && !(cut('end') && i === n - 1)) part(g, M.steel, dl, 0.38, 0.38, x + p / 2, h / 2, z, 0, 0, ang);
      }
    }
  }
  // Arriostrado superior y vigas de piso (por debajo)
  const n = Math.max(1, Math.round(L / panel));
  for (let i = 1; i < n; i++) part(g, M.steelDark, 0.35, 0.35, width + 0.7, a0 + (i * L) / n, h, 0);
  for (let x = a0 + 1.2; x < a1 - 0.4; x += 2.5) {
    part(g, M.steelDark, 0.35, 0.45, width + 0.5, x, -0.85, 0);
    if (marks) part(g, M.whiteMark, 0.1, 0.06, width - 1, x, -1.1, 0);
  }
  // Extremos rotos: vigas retorcidas, losa partida y barras de la armadura
  for (const end of broken) {
    const x = end === 'start' ? a0 : a1;
    const sg = end === 'start' ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const l = 1.4 + r() * 2.6;
      part(g, M.steelDark, l, 0.35, 0.35, x + sg * (l / 2 - 0.3), -0.4 - r() * 1.2, -hw + 0.8 + i * (width - 1.6) / 4, r() * 0.5, (r() - 0.5) * 0.7, -sg * (0.25 + r() * 0.6));
    }
    for (const s of [-1, 1]) {
      const l = 2 + r() * 2;
      part(g, M.steel, l, 0.45, 0.45, x + sg * (l / 2 - 0.4), h * (0.3 + r() * 0.4), s * (hw + 0.35), 0, (r() - 0.5) * 0.4, sg * (0.6 + r() * 0.6));
    }
    for (let i = 0; i < 6; i++) {
      const s = 0.4 + r() * 0.7;
      part(g, M.deck, s * 1.4, 0.5, s, x + sg * (0.2 + r() * 0.6), -0.25 - r() * 0.3, -hw + r() * width, r() * 0.5, r() * 3, r() * 0.6);
    }
    for (let i = 0; i < 10; i++) part(g, M.rebar, 0.04, 0.04, 0.8 + r() * 1.2, x + sg * (0.3 + r() * 0.5), -0.3, -hw + r() * width, (r() - 0.5) * 1.2, r() * 3, (r() - 0.5) * 1.2);
  }
  return g;
}

/** Colisión de un tramo recto: losa y barandillas (no se cae por los lados). */
export function spanColliders(world, { x0, x1, y, width = 8 }) {
  const hw = width / 2;
  world.addBox({ x: x0, y: y - 0.6, z: -hw }, { x: x1, y, z: hw }, { climbable: false });
  for (const s of [-1, 1]) {
    world.addBox({ x: x0, y, z: s > 0 ? hw - 0.25 : -hw - 0.4 }, { x: x1, y: y + 1.2, z: s > 0 ? hw + 0.4 : -hw + 0.25 }, { climbable: false, cameraBlocking: false });
  }
}

/** Pila de hormigón (entera o partida con armaduras al aire). */
export function pier(ctx, B, M, { x, z = 0, bottom, top, w = 3, d = 7, broken = false, seed = 1 }) {
  const { group } = ctx;
  B.block({ x, z, w, d, y: bottom, h: top - bottom, mat: M.concrete, climbable: false });
  if (!broken) {
    B.block({ x, z, w: w + 1, d: d + 1.4, y: top - 1.2, h: 1.2, mat: M.concrete });
    return;
  }
  const r = rng(seed);
  for (let i = 0; i < 7; i++) {
    const s = 0.5 + r() * 0.9;
    deco(group, { x: x + (r() - 0.5) * w, y: top - 0.2, z: z + (r() - 0.5) * d, w: s * 1.3, h: s * 0.7, d: s, mat: M.concrete, rx: r() * 0.4, ry: r() * 3, rz: r() * 0.4 });
  }
  for (let i = 0; i < 16; i++) deco(group, { x: x + (r() - 0.5) * w * 0.9, y: top - 0.3, z: z + (r() - 0.5) * d * 0.9, w: 0.05, h: 0.8 + r() * 1.6, d: 0.05, mat: M.rebar, rx: (r() - 0.5) * 0.8, rz: (r() - 0.5) * 0.8, cast: false });
}
