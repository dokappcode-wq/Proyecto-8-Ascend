import * as THREE from 'three';
import {
  brickTexture, concreteTexture, facadeTextures, asphaltTexture, sidewalkTexture, woodTexture,
  neonSignTexture, awningTexture, hazardTexture, metalPlateTexture, shopfrontTextures, posterTexture, rng,
} from '../textures.js';
import { deco, staticMesh } from './common.js';

/**
 * KIT DE CIUDAD (Distrito Cero): plantas bajas comerciales con escaparates,
 * toldos y rótulos de neón, escaleras de incendios (se trepan), depósitos de
 * agua en las azoteas (el patio de recreo vertical de inFamous Second Son),
 * monorraíl elevado, coches y farolas.
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

export function cityMaterials(night = true) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const wet = night ? 0.55 : 1;
  const mats = {
    brickRed: std({ map: tex(brickTexture('#7a3e2e', 41)), roughness: 0.9 }),
    brickDark: std({ map: tex(brickTexture('#4e3a34', 42)), roughness: 0.9 }),
    brickBuff: std({ map: tex(brickTexture('#9a7a5a', 43)), roughness: 0.9 }),
    concrete: std({ map: tex(concreteTexture('#7d8086', 44)), roughness: 0.85 }),
    concreteDark: std({ map: tex(concreteTexture('#4b4f56', 45)), roughness: 0.85 }),
    asphalt: std({ map: tex(asphaltTexture()), roughness: 0.9 * wet, metalness: night ? 0.15 : 0 }),
    sidewalk: std({ map: tex(sidewalkTexture()), roughness: 0.85 * wet }),
    shopGlass: std({ color: 0x1b2430, roughness: 0.08, metalness: 0.4 }),
    paint: std({ color: 0xd8d4c8, roughness: 0.7 }),
    metal: std({ map: tex(metalPlateTexture('#3b4048', 92)), metalness: 0.75, roughness: 0.4 }),
    iron: std({ color: 0x23262b, metalness: 0.8, roughness: 0.5 }),
    wood: std({ map: tex(woodTexture('#6a5038', 75)), roughness: 0.9 }),
    hazard: std({ map: hazardTexture(), roughness: 0.6 }),
    pdcBlue: std({ color: 0x1d2c44, metalness: 0.5, roughness: 0.4 }),
    scan: std({ color: 0x0a1a24, emissive: 0x3ac8ff, emissiveIntensity: 2.4 }),
    lampGlow: std({ color: 0x2a2620, emissive: 0xffd2a0, emissiveIntensity: night ? 2.6 : 0.2 }),
    paperLantern: std({ color: 0x5a1410, emissive: 0xff4a2a, emissiveIntensity: night ? 0.9 : 0.1, roughness: 0.8 }),
    carRed: std({ color: 0x7a1e1e, metalness: 0.6, roughness: 0.3 }),
    carGrey: std({ color: 0x5a6068, metalness: 0.6, roughness: 0.3 }),
    carBlue: std({ color: 0x1f3a5a, metalness: 0.6, roughness: 0.3 }),
    tire: std({ color: 0x111111, roughness: 0.9 }),
    awningRed: std({ map: awningTexture('#a8322a', '#e9e0cc'), roughness: 0.85, side: THREE.DoubleSide }),
    awningGreen: std({ map: awningTexture('#2f6a4a', '#e9e0cc'), roughness: 0.85, side: THREE.DoubleSide }),
  };
  for (let i = 0; i < 4; i++) {
    const f = shopfrontTextures(i);
    mats[`shop${i}`] = std({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: night ? 0.75 : 0.15, roughness: 0.15, metalness: 0.2 });
  }
  for (let i = 0; i < 3; i++) mats[`poster${i}`] = std({ map: posterTexture(i), emissiveMap: posterTexture(i), emissive: 0xffffff, emissiveIntensity: night ? 0.7 : 0.1, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const f = facadeTextures(i);
    mats[`facade${i}`] = std({ map: tex(f.map), emissiveMap: tex(f.emissiveMap), emissive: night ? 0xffffff : 0x000000, emissiveIntensity: night ? 1 : 0, roughness: 0.8 });
  }
  return mats;
}

/** Material de rótulo luminoso (se comparte por texto y color). */
const signCache = new Map();
function signMat(text, color, vertical) {
  const key = `${text}|${color}|${vertical}`;
  if (!signCache.has(key)) {
    const t = neonSignTexture(text, { color, vertical, width: vertical ? 96 : 256, height: vertical ? 320 : 96 });
    signCache.set(key, new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.5 }));
  }
  return signCache.get(key);
}

/** Rótulo de neón: plano luminoso (horizontal sobre la tienda o vertical en banderola). */
export function neonSign(group, { x, y, z, ry = 0, text, color = '#ff4fa3', vertical = false, w, h }) {
  const mat = signMat(text, color, vertical);
  const W = w ?? (vertical ? 0.9 : 3.2);
  const H = h ?? (vertical ? 3.2 : 1.1);
  const box = new THREE.BoxGeometry(W, H, 0.12);
  const m = new THREE.Mesh(box, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.userData.levelStatic = true;
  group.add(m);
  return m;
}

const SIGNS = [
  ['RAMEN', '#ff5a5a'], ['BAR 24H', '#4fd1ff'], ['HOTEL', '#ffc94f'], ['FARMACIA', '#56ff8a'],
  ['KARAOKE', '#ff4fd8'], ['CAFÉ', '#ffb04f'], ['TATTOO', '#b06bff'], ['NOODLES', '#ff7a3a'],
];
const VSIGNS = [['ABIERTO', '#ff4f6a'], ['MERCADO', '#4fe6ff'], ['NEÓN', '#ffd84f'], ['HOSTAL', '#7bff6a']];

/**
 * Planta baja comercial de una fachada (`f`: '-z' | '+z' | '-x' | '+x'):
 * escaparates iluminados, zócalo, toldo inclinado, rótulo de neón encima y,
 * a veces, una banderola vertical en la esquina. Todo decorado (sin colisión).
 * `skip`: tramos [a0, a1] de la fachada (en x o z del mundo) que quedan libres
 * (escaleras, pasarelas, cajas para trepar…).
 */
export function storefronts(ctx, M, b, f, { r = rng(Math.round(b.x * 7 + b.z * 13)), groundH = 4.2, skip = [], vertical = true } = {}) {
  const { group } = ctx;
  const alongX = f[1] === 'z';
  const sgn = f[0] === '-' ? -1 : 1;
  const len = alongX ? b.w : b.d;
  const c0 = alongX ? b.x : b.z;
  const n = Math.max(1, Math.floor(len / 7));
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n - 0.5) * len;
    const glassW = Math.min(5.2, len / n - 1);
    const shop = M[`shop${Math.floor(r() * 4)}`];
    const awning = r() < 0.5 ? M.awningRed : M.awningGreen;
    const [text, color] = SIGNS[Math.floor(r() * SIGNS.length)];
    if (skip.some(([a0, a1]) => c0 + t + glassW / 2 + 0.6 > a0 && c0 + t - glassW / 2 - 0.6 < a1)) continue;
    const px = alongX ? b.x + t : b.x + sgn * (b.w / 2 + 0.06);
    const pz = alongX ? b.z + sgn * (b.d / 2 + 0.06) : b.z + t;
    const ry = alongX ? 0 : Math.PI / 2;
    const thin = (w, d) => (alongX ? { w, d } : { w: d, d: w });
    deco(group, { x: px, y: 0.5, z: pz, ...thin(glassW, 0.08), h: 2.9, mat: shop, cast: false, ry: alongX && sgn > 0 ? 0 : alongX ? Math.PI : 0 });
    deco(group, { x: px, y: 0.35, z: pz, ...thin(glassW + 0.3, 0.14), h: 0.16, mat: M.concrete, cast: false });
    // Toldo inclinado
    const aw = alongX ? { x: px, z: pz + sgn * 0.8 } : { x: px + sgn * 0.8, z: pz };
    deco(group, { ...aw, y: 3.3, ...thin(Math.min(5.6, len / n - 0.6), 1.7), h: 0.06, mat: awning, rx: alongX ? sgn * 0.35 : 0, rz: alongX ? 0 : -sgn * 0.35, cast: false });
    // Rótulo de neón sobre el toldo
    const sp = alongX ? { x: px, z: pz + sgn * 0.12 } : { x: px + sgn * 0.12, z: pz };
    neonSign(group, { ...sp, y: groundH - 0.05, ry: ry + (sgn < 0 ? Math.PI : 0), text, color, w: Math.min(4, len / n - 1.4), h: 0.9 });
  }
  // Banderola vertical en la esquina
  if (vertical && r() < 0.8) {
    const [text, color] = VSIGNS[Math.floor(r() * VSIGNS.length)];
    const side = r() < 0.5 ? -1 : 1;
    const a = c0 + (len / 2 - 1.2) * side;
    if (!skip.some(([a0, a1]) => a + 0.6 > a0 && a - 0.6 < a1)) {
      const cx = alongX ? a : b.x + sgn * (b.w / 2 + 0.9);
      const cz = alongX ? b.z + sgn * (b.d / 2 + 0.9) : a;
      neonSign(group, { x: cx, y: groundH + 3.5, z: cz, ry: alongX ? Math.PI / 2 : 0, text, color, vertical: true });
    }
  }
}

/**
 * Depósito de agua de azotea (icónico de Nueva York / Seattle): cuatro patas,
 * plataforma, cuba de duelas y tejadillo cónico. Colisión: un bloque macizo
 * de su planta (no se pasa por debajo) con la plataforma a modo de repisa.
 */
export function waterTank(ctx, B, M, { x, z, y }) {
  const { group } = ctx;
  for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) deco(group, { x: x + dx, y, z: z + dz, w: 0.18, h: 2.6, d: 0.18, mat: M.iron });
  deco(group, { x, y: y + 2.6, z, w: 2.8, h: 0.15, d: 2.8, mat: M.iron });
  for (const dy of [0.9, 1.8]) deco(group, { x, y: y + dy, z, w: 2.3, h: 0.06, d: 0.06, mat: M.iron, ry: Math.PI / 4, cast: false });
  const tank = staticMesh(group, new THREE.CylinderGeometry(1.5, 1.6, 3.2, 14), M.wood);
  tank.position.set(x, y + 2.75 + 1.6, z);
  for (const dy of [0.5, 1.6, 2.7]) {
    const hoop = staticMesh(group, new THREE.TorusGeometry(1.57, 0.035, 4, 20).rotateX(Math.PI / 2), M.iron, { cast: false });
    hoop.position.set(x, y + 2.75 + dy, z);
  }
  const cap = staticMesh(group, new THREE.ConeGeometry(1.75, 1.1, 14), M.iron);
  cap.position.set(x, y + 2.75 + 3.75, z);
  ctx.world.addBox({ x: x - 1.25, y, z: z - 1.25 }, { x: x + 1.25, y: y + 2.75, z: z + 1.25 }, { climbable: true });
  ctx.world.addBox({ x: x - 1.55, y: y + 2.75, z: z - 1.55 }, { x: x + 1.55, y: y + 5.95, z: z + 1.55 }, { climbable: true });
}

/**
 * Escalera de incendios: plataformas de rejilla en cada piso con barandilla y
 * tramos de escalera entre ellas. Plataformas transitables (colisión) y
 * trepables: la ruta clásica de la calle a la azotea.
 */
export function fireEscape(ctx, B, M, b, side, groundH = 4.2) {
  const { group } = ctx;
  const sgn = side[0] === '-' ? -1 : 1;
  const onX = side[1] === 'x';
  const depth = 1.4;
  const len = 5;
  const off = (onX ? b.w : b.d) / 2 + depth / 2;
  const base = onX ? { x: b.x + sgn * off, z: b.z } : { x: b.x, z: b.z + sgn * off };
  const thin = (w, d) => (onX ? { w: d, d: w } : { w, d });
  for (let y = groundH - 0.6; y < b.h - 1; y += 3.2) {
    B.block({ ...base, y, ...thin(len, depth), h: 0.12, mat: M.iron, climbable: true });
    // Barandilla exterior
    const rail = onX ? { x: base.x + sgn * (depth / 2 - 0.05), z: base.z } : { x: base.x, z: base.z + sgn * (depth / 2 - 0.05) };
    deco(group, { ...rail, y: y + 1, ...thin(len, 0.05), h: 0.05, mat: M.iron, cast: false });
    for (let k = -2; k <= 2; k++) {
      const p = onX ? { x: rail.x, z: base.z + k * (len / 4) } : { x: base.x + k * (len / 4), z: rail.z };
      deco(group, { ...p, y: y + 0.12, w: 0.05, h: 0.9, d: 0.05, mat: M.iron, cast: false });
    }
    // Tramo de escalera inclinado hacia la plataforma de arriba
    const st = onX ? { x: base.x, z: base.z } : { x: base.x, z: base.z };
    deco(group, { ...st, y: y + 1.5, ...thin(len * 0.9, depth * 0.55), h: 0.08, mat: M.iron, rx: onX ? 0.6 : 0, rz: onX ? 0 : 0.6, cast: false });
  }
}

/**
 * Monorraíl elevado sobre pilares (el de Seattle Center): viga de hormigón
 * transitable a lo largo de una polilínea, con un vagón detenido.
 */
export function monorail(ctx, B, M, { points, y = 9, width = 2.4 }) {
  const { group } = ctx;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const along = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
    B.block({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y, w: along ? len + width : width, d: along ? width : len + width, h: 1.1, mat: M.concrete, climbable: true });
    for (let t = 0; t <= len; t += 16) {
      const px = a.x + ((b.x - a.x) * t) / len;
      const pz = a.z + ((b.z - a.z) * t) / len;
      B.block({ x: px, z: pz, w: 1.2, d: 1.2, h: y, mat: M.concrete, climbable: true });
      deco(group, { x: px, y: y - 0.8, z: pz, w: along ? 1.4 : 3, h: 0.8, d: along ? 3 : 1.4, mat: M.concrete, cast: false });
    }
  }
  // Vagón detenido sobre el primer tramo
  const a = points[0];
  const b = points[1];
  const along = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
  const cx = a.x + (b.x - a.x) * 0.35;
  const cz = a.z + (b.z - a.z) * 0.35;
  B.block({ x: cx, z: cz, y: y + 1.1, w: along ? 14 : 3, d: along ? 3 : 14, h: 3, mat: M.carBlue });
  deco(group, { x: cx, y: y + 2.3, z: cz, w: along ? 13.6 : 3.06, h: 1, d: along ? 3.06 : 13.6, mat: M.shopGlass, cast: false });
}

/** Coche aparcado (carrocería, habitáculo con lunas y ruedas). Colisiona y sirve de cobertura. */
export function car(ctx, B, M, { x, z, ry = 0, color = 'carGrey' }) {
  const { group } = ctx;
  const along = Math.abs(Math.sin(ry)) < 0.5;
  B.block({ x, z, w: along ? 4.4 : 1.9, d: along ? 1.9 : 4.4, h: 1, y: 0.3, mat: M[color] });
  deco(group, { x, y: 1.3, z, w: along ? 2.4 : 1.7, h: 0.7, d: along ? 1.7 : 2.4, mat: M.shopGlass, cast: false });
  deco(group, { x, y: 1.98, z, w: along ? 2.2 : 1.6, h: 0.08, d: along ? 1.6 : 2.2, mat: M[color] });
  for (const [dx, dz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
    const w = staticMesh(group, new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateX(Math.PI / 2), M.tire);
    w.position.set(x + (along ? dx : dz), 0.36, z + (along ? dz : dx));
    if (!along) w.rotation.y = Math.PI / 2;
  }
}

/** Farola urbana alta de brazo largo. */
export function streetLight(group, M, { x, z, ry = 0 }) {
  deco(group, { x, y: 0, z, w: 0.2, h: 6.5, d: 0.2, mat: M.iron });
  const ox = Math.cos(ry) * 1.2;
  const oz = -Math.sin(ry) * 1.2;
  deco(group, { x: x + ox / 2, y: 6.4, z: z + oz / 2, w: 1.3, h: 0.1, d: 0.1, mat: M.iron, ry });
  deco(group, { x: x + ox, y: 6.15, z: z + oz, w: 0.6, h: 0.18, d: 0.35, mat: M.lampGlow, ry, cast: false });
}
