import * as THREE from 'three';
import {
  brickTexture, concreteTexture, facadeTextures, asphaltTexture, sidewalkTexture, woodTexture,
  neonSignTexture, awningTexture, hazardTexture, metalPlateTexture, shopfrontTextures, posterTexture, rng,
} from '../textures.js';
import { deco, staticMesh } from './common.js';

/**
 * KIT DE CIUDAD (propuesta de rediseño del Distrito Cero): edificios de
 * ladrillo y hormigón con escaparates, rótulos de neón, escaleras de incendios
 * (se trepan), depósitos de agua y aparatos en las azoteas (el patio de recreo
 * vertical de inFamous Second Son), monorraíl elevado, control de la PDC con
 * barreras y torre de escaneo, coches y mobiliario urbano. Callejones con
 * rótulos verticales y farolillos (Tokio / Madripoor en Wolverine).
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

const BODY = ['brickRed', 'brickDark', 'brickBuff', 'concrete'];
const SIGNS = [
  ['RAMEN', '#ff5a5a'], ['BAR 24H', '#4fd1ff'], ['HOTEL', '#ffc94f'], ['FARMACIA', '#56ff8a'],
  ['KARAOKE', '#ff4fd8'], ['CAFÉ', '#ffb04f'], ['TATTOO', '#b06bff'], ['NOODLES', '#ff7a3a'],
];
const VSIGNS = [['ABIERTO', '#ff4f6a'], ['MERCADO', '#4fe6ff'], ['NEÓN', '#ffd84f'], ['HOSTAL', '#7bff6a']];

/**
 * Edificio de la ciudad: cuerpo de ladrillo u hormigón (con la fachada de
 * ventanas encima de la planta baja), escaparates con toldo y neón, cornisa,
 * escalera de incendios en un costado (trepable) y azotea con depósito de
 * agua, aparatos de aire, salidas de humo y valla publicitaria.
 * `front`: dirección de la calle principal ('-z' | '+z' | '-x' | '+x').
 */
export function cityBuilding(ctx, B, M, b, o = {}) {
  const { group } = ctx;
  const r = rng(o.seed ?? Math.round(b.x * 11 + b.z * 5 + 7));
  const body = M[o.body ?? BODY[Math.floor(r() * BODY.length)]];
  const facade = M[`facade${Math.floor(r() * 5)}`];
  const groundH = 4.2;
  // Planta baja (piedra/hormigón) + pisos con ventanas
  B.block({ x: b.x, z: b.z, w: b.w, d: b.d, h: groundH, mat: M.concreteDark });
  B.block({ x: b.x, z: b.z, w: b.w, d: b.d, y: groundH, h: b.h - groundH, mat: [facade, facade, M.concrete, M.concrete, facade, facade] });
  // Pilastras de ladrillo en las esquinas y cornisa
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) deco(group, { x: b.x + sx * (b.w / 2 - 0.3), y: groundH, z: b.z + sz * (b.d / 2 - 0.3), w: 0.75, h: b.h - groundH, d: 0.75, mat: body, cast: false });
  }
  deco(group, { x: b.x, y: groundH - 0.3, z: b.z, w: b.w + 0.3, h: 0.35, d: b.d + 0.3, mat: body, cast: false });
  deco(group, { x: b.x, y: b.h - 0.5, z: b.z, w: b.w + 0.5, h: 0.5, d: b.d + 0.5, mat: body });
  deco(group, { x: b.x, y: b.h, z: b.z, w: b.w, h: 0.8, d: b.d, mat: body }); // pretil

  // Escaparates, toldos y neón en las dos fachadas a la calle
  const fronts = o.fronts ?? ['-z', '+z'];
  for (const f of fronts) {
    const alongX = f[1] === 'z';
    const sgn = f[0] === '-' ? -1 : 1;
    const len = alongX ? b.w : b.d;
    const n = Math.max(1, Math.floor(len / 7));
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n - 0.5) * len;
      const px = alongX ? b.x + t : b.x + sgn * (b.w / 2 + 0.06);
      const pz = alongX ? b.z + sgn * (b.d / 2 + 0.06) : b.z + t;
      const ry = alongX ? 0 : Math.PI / 2;
      const thin = (w, d) => (alongX ? { w, d } : { w: d, d: w });
      const shop = M[`shop${Math.floor(r() * 4)}`];
      const glassW = Math.min(5.2, len / n - 1);
      deco(group, { x: px, y: 0.5, z: pz, ...thin(glassW, 0.08), h: 2.9, mat: shop, cast: false, ry: alongX && sgn > 0 ? 0 : alongX ? Math.PI : 0 });
      deco(group, { x: px, y: 0.35, z: pz, ...thin(glassW + 0.3, 0.14), h: 0.16, mat: M.concrete, cast: false });
      // Toldo inclinado
      const aw = alongX ? { x: px, z: pz + sgn * 0.8 } : { x: px + sgn * 0.8, z: pz };
      deco(group, { ...aw, y: 3.3, ...thin(Math.min(5.6, len / n - 0.6), 1.7), h: 0.06, mat: r() < 0.5 ? M.awningRed : M.awningGreen, rx: alongX ? sgn * 0.35 : 0, rz: alongX ? 0 : -sgn * 0.35, cast: false });
      // Rótulo de neón sobre el toldo
      const [text, color] = SIGNS[Math.floor(r() * SIGNS.length)];
      const sp = alongX ? { x: px, z: pz + sgn * 0.12 } : { x: px + sgn * 0.12, z: pz };
      neonSign(group, { ...sp, y: groundH - 0.05, ry: ry + (sgn < 0 ? Math.PI : 0), text, color, w: Math.min(4, len / n - 1.4), h: 0.9 });
    }
    // Banderola vertical en la esquina
    if (r() < 0.8) {
      const [text, color] = VSIGNS[Math.floor(r() * VSIGNS.length)];
      const cx = alongX ? b.x + (b.w / 2 - 1.2) * (r() < 0.5 ? -1 : 1) : b.x + sgn * (b.w / 2 + 0.9);
      const cz = alongX ? b.z + sgn * (b.d / 2 + 0.9) : b.z + (b.d / 2 - 1.2) * (r() < 0.5 ? -1 : 1);
      neonSign(group, { x: cx, y: groundH + 3.5, z: cz, ry: alongX ? Math.PI / 2 : 0, text, color, vertical: true });
    }
  }
  if (o.fireEscape !== false) fireEscape(ctx, B, M, b, o.fireSide ?? (r() < 0.5 ? '-x' : '+x'), groundH);
  rooftop(ctx, B, M, b, r);
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

/** Azotea: depósito de agua de madera sobre patas, aparatos, salidas de humo y valla publicitaria. */
function rooftop(ctx, B, M, b, r) {
  const { group } = ctx;
  const top = b.h;
  if (b.w * b.d > 120) {
    // Depósito de agua (icónico): cilindro de duelas con tejadillo cónico
    const tx = b.x - b.w * 0.22;
    const tz = b.z - b.d * 0.2;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: tx + dx * 1.1, y: top, z: tz + dz * 1.1, w: 0.18, h: 2.6, d: 0.18, mat: M.iron });
    B.block({ x: tx, z: tz, w: 2.8, d: 2.8, y: top + 2.6, h: 0.15, mat: M.iron });
    const tank = staticMesh(group, new THREE.CylinderGeometry(1.5, 1.6, 3.2, 14), M.wood);
    tank.position.set(tx, top + 2.75 + 1.6, tz);
    const cap = staticMesh(group, new THREE.ConeGeometry(1.75, 1.1, 14), M.iron);
    cap.position.set(tx, top + 2.75 + 3.75, tz);
  }
  // Aparatos de aire acondicionado y salidas de humo
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const ax = b.x + (r() - 0.5) * (b.w - 4);
    const az = b.z + (r() - 0.5) * (b.d - 4);
    B.block({ x: ax, z: az, y: top, w: 1.6, d: 1.1, h: 1.1, mat: M.metal });
  }
  for (let i = 0; i < 2; i++) {
    const vx = b.x + (r() - 0.5) * (b.w - 3);
    const vz = b.z + (r() - 0.5) * (b.d - 3);
    deco(group, { x: vx, y: top, z: vz, w: 0.7, h: 1.6, d: 0.7, mat: M.iron });
  }
  // Caseta de acceso
  B.block({ x: b.x + b.w * 0.28, z: b.z + b.d * 0.25, y: top, w: 2.6, d: 2.2, h: 2.6, mat: M.concrete });
  // Valla publicitaria luminosa
  if (r() < 0.5) {
    const bx = b.x + b.w * 0.15;
    const bz = b.z - b.d / 2 + 1;
    for (const dx of [-2.5, 2.5]) deco(group, { x: bx + dx, y: top, z: bz, w: 0.2, h: 4, d: 0.2, mat: M.iron });
    deco(group, { x: bx, y: top + 3.6, z: bz, w: 7, h: 3.2, d: 0.2, mat: M[`poster${Math.floor(r() * 3)}`], cast: false, ry: Math.PI });
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

/**
 * Control de la PDC: barreras de hormigón con franjas, sacos terreros, torre
 * de escaneo con anillo luminoso, barrera de paso y focos.
 */
export function pdcCheckpoint(ctx, B, M, { x, z, ry = 0 }) {
  const { group } = ctx;
  const along = Math.abs(Math.sin(ry)) < 0.5;
  const thin = (w, d) => (along ? { w, d } : { w: d, d: w });
  for (const off of [-6, -3, 3, 6]) {
    const p = along ? { x: x + off, z } : { x, z: z + off };
    B.block({ ...p, ...thin(2.6, 0.7), h: 0.9, mat: M.concrete, climbable: true });
    deco(group, { ...p, y: 0.3, ...thin(2.62, 0.72), h: 0.3, mat: M.hazard, cast: false });
  }
  // Barrera levadiza
  deco(group, { x, y: 1.1, z, ...thin(5.5, 0.12), h: 0.12, mat: M.hazard, cast: false });
  // Torre de escaneo (las de inFamous Second Son)
  const tx = along ? x + 9 : x;
  const tz = along ? z : z + 9;
  B.block({ x: tx, z: tz, w: 1.2, d: 1.2, h: 7, mat: M.pdcBlue });
  for (const yy of [2.5, 4.5, 6.5]) {
    const ring = staticMesh(group, new THREE.TorusGeometry(1.1, 0.09, 6, 24).rotateX(Math.PI / 2), M.scan, { cast: false });
    ring.position.set(tx, yy, tz);
  }
  deco(group, { x: tx, y: 7, z: tz, w: 2.2, h: 0.4, d: 2.2, mat: M.pdcBlue });
  // Sacos terreros
  for (let i = 0; i < 6; i++) {
    const p = along ? { x: x - 9 + (i % 3) * 0.9, z: z + 1.2 } : { x: x + 1.2, z: z - 9 + (i % 3) * 0.9 };
    deco(group, { ...p, y: i > 2 ? 0.4 : 0, w: 0.85, h: 0.4, d: 0.5, mat: M.wood });
  }
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
