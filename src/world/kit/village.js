import * as THREE from 'three';
import {
  stoneWallTexture, roofTileTexture, cobbleTexture, woodTexture, plasterTexture, paintedWoodTexture,
  windowTextures, concreteTexture, rng,
} from '../textures.js';
import { deco, gableRoof, staticMesh, lampPost, climbMark } from './common.js';

/**
 * KIT DEL PUEBLO PESQUERO: casas altas y estrechas de
 * la costa vasca —planta baja de piedra, revoco blanco o crema, contraventanas
 * y balcones de madera pintada (rojo, verde, azul), tejado de teja a dos aguas
 * transitable o azotea—, faro, iglesia, muelle con barcas y marcas blancas de
 * escalada (Tomb Raider).
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

/** Paleta de materiales del pueblo (una vez por mapa). */
export function villageMaterials(night = false) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const win = windowTextures('#e9e4d8');
  const wet = night ? 0.75 : 1; // de noche, todo mojado
  return {
    plasterWhite: std({ map: tex(plasterTexture('#ebe6da', 31)), roughness: 0.92 * wet }),
    plasterCream: std({ map: tex(plasterTexture('#e6d3ac', 32)), roughness: 0.92 * wet }),
    plasterRose: std({ map: tex(plasterTexture('#dcb9a8', 33)), roughness: 0.92 * wet }),
    stone: std({ map: tex(stoneWallTexture('#9a907e', 63)), roughness: 0.9 * wet }),
    stoneDark: std({ map: tex(stoneWallTexture('#6f6a5e', 64)), roughness: 0.92 * wet }),
    trim: std({ map: tex(plasterTexture('#f4f1ea', 34)), roughness: 0.85 * wet }),
    roof: std({ map: tex(roofTileTexture('#a4553a', 65)), roughness: 0.8 * wet }),
    terrace: std({ map: tex(concreteTexture('#8d877c', 66)), roughness: 0.9 * wet }),
    paving: std({ map: tex(cobbleTexture('#8a8072', 62)), roughness: (night ? 0.45 : 0.88) }),
    red: std({ map: tex(paintedWoodTexture('#8f2c22', 51)), roughness: 0.7 }),
    green: std({ map: tex(paintedWoodTexture('#2f5e3c', 52)), roughness: 0.7 }),
    blue: std({ map: tex(paintedWoodTexture('#2b4f7d', 53)), roughness: 0.7 }),
    wood: std({ map: tex(woodTexture('#6e4e34', 71)), roughness: 0.85 }),
    metal: std({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 }),
    window: std({ map: tex(win.map), emissiveMap: tex(win.emissiveMap), emissive: night ? 0xffb35c : 0x000000, emissiveIntensity: night ? 1.5 : 0, roughness: 0.3 }),
    windowDark: std({ map: tex(win.map), roughness: 0.22, envMapIntensity: 1.3 }),
    lantern: std({ color: 0x2a2620, emissive: 0xffc27a, emissiveIntensity: night ? 2.4 : 0.15 }),
    hullRed: std({ map: tex(paintedWoodTexture('#a3321f', 54)), roughness: 0.6 }),
    hullGreen: std({ map: tex(paintedWoodTexture('#2f6b47', 55)), roughness: 0.6 }),
    hullBlue: std({ map: tex(paintedWoodTexture('#2a5aa0', 56)), roughness: 0.6 }),
    hullWhite: std({ map: tex(paintedWoodTexture('#e8e4da', 57)), roughness: 0.6 }),
    rope: std({ color: 0xb8a07a, roughness: 1 }),
    net: std({ color: 0x3f5a52, roughness: 1 }),
    whiteMark: std({ color: 0xf2efe6, roughness: 0.6, emissive: 0x2a2a28 }),
    lighthouseRed: std({ color: 0xb2302a, roughness: 0.55 }),
    glass: std({ color: 0xfff1c8, emissive: 0xffe2a0, emissiveIntensity: night ? 3 : 0.4, roughness: 0.1 }),
    sail: std({ color: 0xe8dcc4, roughness: 0.9, side: THREE.DoubleSide }),
  };
}

const WALLS = ['plasterWhite', 'plasterWhite', 'plasterCream', 'plasterRose'];
const WOODS = ['red', 'green', 'blue'];

/**
 * Casa de pueblo pesquero. `h` = { x, z, w, d, h } (planta y altura del
 * alero); `o` = { front: -1 | 1 (fachada con la puerta: −Z o +Z), roof:
 * 'gable' | 'flat', seed, balcony, stoneBase, shop }.
 * El cuerpo colisiona y se escala; el tejado a dos aguas es transitable.
 */
export function fishermanHouse(ctx, B, M, h, o = {}) {
  const { group } = ctx;
  const r = rng(o.seed ?? Math.round(h.x * 13 + h.z * 7 + 101));
  const wall = M[o.wall ?? WALLS[Math.floor(r() * WALLS.length)]];
  const wood = M[o.wood ?? WOODS[Math.floor(r() * WOODS.length)]];
  const front = o.front ?? 1;
  const flat = o.roof === 'flat';
  const floors = Math.max(1, Math.round(h.h / 2.9));
  const fh = h.h / floors;
  const stoneBase = o.stoneBase ?? r() < 0.6;
  // Cuerpo (colisión + escalada)
  B.block({ x: h.x, z: h.z, w: h.w, d: h.d, h: h.h, mat: [wall, wall, flat ? M.terrace : wall, wall, wall, wall] });
  // Planta baja de piedra (zócalo alto) o rodapié
  const baseH = stoneBase ? Math.min(fh, 2.7) : 0.7;
  deco(group, { x: h.x, z: h.z, w: h.w + 0.12, h: baseH, d: h.d + 0.12, mat: stoneBase ? M.stone : M.stoneDark });
  // Esquinas de sillería y líneas de forjado
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) deco(group, { x: h.x + sx * (h.w / 2 - 0.15), y: baseH, z: h.z + sz * (h.d / 2 - 0.15), w: 0.42, h: h.h - baseH, d: 0.42, mat: M.trim, cast: false });
  }
  for (let i = 1; i < floors; i++) deco(group, { x: h.x, y: i * fh - 0.08, z: h.z, w: h.w + 0.2, h: 0.16, d: h.d + 0.2, mat: M.trim, cast: false });
  // Cornisa bajo el alero
  deco(group, { x: h.x, y: h.h - 0.22, z: h.z, w: h.w + 0.3, h: 0.22, d: h.d + 0.3, mat: flat ? M.stoneDark : M.trim });

  // --- Fachadas: ventanas con marco, alféizar y contraventanas; puerta; balcones ---
  const facades = [
    { axis: 'z', sgn: -1, len: h.w }, { axis: 'z', sgn: 1, len: h.w },
    { axis: 'x', sgn: -1, len: h.d }, { axis: 'x', sgn: 1, len: h.d },
  ];
  for (const f of facades) {
    const n = Math.max(1, Math.floor(f.len / 2.6));
    const isFront = f.axis === 'z' && f.sgn === front;
    const doorIdx = isFront ? Math.floor(r() * n) : -1;
    for (let fl = 0; fl < floors; fl++) {
      const balcony = isFront && fl >= 1 && (o.balcony ?? r() < 0.7);
      if (balcony) facadeBalcony(group, M, wood, h, f, fl * fh, Math.min(f.len - 0.8, n * 2.2));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const along = t * f.len;
        if (fl === 0 && i === doorIdx) facadeDoor(group, M, wood, h, f, along, baseH);
        else facadeWindow(group, M, wood, h, f, along, fl * fh, { tall: balcony, lit: r() < 0.55, shop: fl === 0 && isFront && o.shop });
      }
    }
  }

  // --- Tejado ---
  if (flat) {
    flatRoofClutter(ctx, B, M, h, r);
  } else {
    const along = h.w >= h.d ? 'x' : 'z';
    const span = along === 'x' ? h.d : h.w;
    const roof = gableRoof(ctx, { x: h.x, z: h.z, w: h.w, d: h.d, y: h.h, rise: span * 0.32, roofMat: M.roof, wallMat: wall });
    // Chimenea sobre un faldón
    const cx = h.x + (along === 'x' ? (r() - 0.5) * h.w * 0.6 : h.w * 0.22);
    const cz = h.z + (along === 'x' ? h.d * 0.22 : (r() - 0.5) * h.d * 0.6);
    deco(group, { x: cx, y: h.h, z: cz, w: 0.7, h: roof.ridge - h.h + 0.7, d: 0.7, mat: M.stoneDark });
    deco(group, { x: cx, y: roof.ridge + 0.7, z: cz, w: 0.9, h: 0.12, d: 0.9, mat: M.stoneDark });
  }
}

/** Posición de un elemento en una fachada (a `along` m del centro, a `y` m). */
function onFacade(h, f, along, out = 0.0) {
  if (f.axis === 'z') return { x: h.x + along, z: h.z + f.sgn * (h.d / 2 + out), ry: 0 };
  return { x: h.x + f.sgn * (h.w / 2 + out), z: h.z + along, ry: Math.PI / 2 };
}

function facadeWindow(group, M, wood, h, f, along, y0, { tall = false, lit = false, shop = false }) {
  const wW = shop ? 1.8 : 0.9;
  const wH = tall ? 2.1 : shop ? 1.7 : 1.15;
  const yb = y0 + (tall ? 0.05 : shop ? 0.5 : 0.95);
  const p = onFacade(h, f, along, 0.06);
  const thin = (w, d) => (f.axis === 'z' ? { w, d } : { w: d, d: w });
  // Marco de piedra clara y vidrio
  deco(group, { x: p.x, y: yb - 0.12, z: p.z, ...thin(wW + 0.32, 0.06), h: wH + 0.24, mat: M.trim, cast: false });
  const g = onFacade(h, f, along, 0.1);
  deco(group, { x: g.x, y: yb, z: g.z, ...thin(wW, 0.04), h: wH, mat: lit ? M.window : M.windowDark, cast: false });
  // Alféizar
  if (!tall) {
    const s = onFacade(h, f, along, 0.16);
    deco(group, { x: s.x, y: yb - 0.16, z: s.z, ...thin(wW + 0.44, 0.22), h: 0.08, mat: M.trim, cast: false });
  }
  // Contraventanas abiertas a los lados
  if (!shop) {
    for (const sd of [-1, 1]) {
      const q = onFacade(h, f, along + sd * (wW / 2 + 0.26), 0.09);
      deco(group, { x: q.x, y: yb, z: q.z, ...thin(0.46, 0.04), h: wH, mat: wood, cast: false });
    }
  }
}

function facadeDoor(group, M, wood, h, f, along, baseH) {
  const p = onFacade(h, f, along, 0.07);
  // Registro de puertas (comprobaciones: que no den a una pared ni al vacío)
  (group.userData.doors ??= []).push({ x: p.x, z: p.z, nx: f.axis === 'x' ? f.sgn : 0, nz: f.axis === 'z' ? f.sgn : 0 });
  const thin = (w, d) => (f.axis === 'z' ? { w, d } : { w: d, d: w });
  deco(group, { x: p.x, y: 0, z: p.z, ...thin(1.5, 0.08), h: 2.55, mat: M.trim, cast: false });
  const q = onFacade(h, f, along, 0.12);
  deco(group, { x: q.x, y: 0, z: q.z, ...thin(1.1, 0.06), h: 2.25, mat: wood, cast: false });
  const s = onFacade(h, f, along, 0.3);
  deco(group, { x: s.x, y: 0, z: s.z, ...thin(1.6, 0.6), h: 0.14, mat: M.stoneDark, cast: false });
  // Farol sobre la puerta
  const l = onFacade(h, f, along + 0.95, 0.22);
  deco(group, { x: l.x, y: Math.max(2.4, baseH - 0.1), z: l.z, w: 0.22, h: 0.32, d: 0.22, mat: M.lantern, cast: false });
}

function facadeBalcony(group, M, wood, h, f, y0, len) {
  const thin = (w, d) => (f.axis === 'z' ? { w, d } : { w: d, d: w });
  const depth = 0.85;
  const c = onFacade(h, f, 0, depth / 2);
  deco(group, { x: c.x, y: y0 - 0.06, z: c.z, ...thin(len, depth), h: 0.14, mat: wood });
  // Barandilla: pasamanos, zócalo y balaustres
  const e = onFacade(h, f, 0, depth - 0.04);
  deco(group, { x: e.x, y: y0 + 0.98, z: e.z, ...thin(len, 0.07), h: 0.07, mat: wood, cast: false });
  deco(group, { x: e.x, y: y0 + 0.08, z: e.z, ...thin(len, 0.05), h: 0.1, mat: wood, cast: false });
  const nb = Math.max(4, Math.round(len / 0.32));
  for (let i = 0; i <= nb; i++) {
    const b = onFacade(h, f, (i / nb - 0.5) * len, depth - 0.04);
    deco(group, { x: b.x, y: y0 + 0.1, z: b.z, w: 0.04, h: 0.9, d: 0.04, mat: wood, cast: false });
  }
  for (const sd of [-1, 1]) {
    const s = onFacade(h, f, sd * len / 2, depth / 2);
    deco(group, { x: s.x, y: y0 + 0.98, z: s.z, ...thin(0.07, depth), h: 0.07, mat: wood, cast: false });
  }
}

/** Azotea: pretil con albardilla, chimeneas, depósito, antena y tendedero (en las esquinas: no estorban la ruta). */
function flatRoofClutter(ctx, B, M, h, r) {
  const { group } = ctx;
  const t = 0.3;
  for (const [x, z, w, d] of [
    [h.x, h.z - h.d / 2 + t / 2, h.w, t], [h.x, h.z + h.d / 2 - t / 2, h.w, t],
    [h.x - h.w / 2 + t / 2, h.z, t, h.d - 2 * t], [h.x + h.w / 2 - t / 2, h.z, t, h.d - 2 * t],
  ]) {
    B.block({ x, z, w, d, y: h.h, h: 0.32, mat: M.stoneDark });
    deco(group, { x, y: h.h + 0.32, z, w: w + 0.08, h: 0.06, d: d + 0.08, mat: M.trim, cast: false });
  }
  const cx = h.x - h.w / 2 + 1.1;
  const cz = h.z + (r() < 0.5 ? -1 : 1) * (h.d / 2 - 1.1);
  B.block({ x: cx, z: cz, w: 0.7, d: 0.7, y: h.h, h: 1.3, mat: M.stoneDark });
  deco(group, { x: cx, y: h.h + 1.3, z: cz, w: 0.9, h: 0.1, d: 0.9, mat: M.stoneDark });
  // Antena y tendedero en la esquina opuesta
  const ax = h.x + h.w / 2 - 1;
  const az = h.z - (cz - h.z);
  deco(group, { x: ax, y: h.h, z: az, w: 0.06, h: 2.6, d: 0.06, mat: M.metal, cast: false });
  deco(group, { x: ax, y: h.h + 2.2, z: az, w: 1.2, h: 0.04, d: 0.04, mat: M.metal, cast: false });
  if (r() < 0.6) {
    for (const sx of [-1, 1]) deco(group, { x: h.x + sx * 1.2, y: h.h, z: az, w: 0.05, h: 1.6, d: 0.05, mat: M.metal, cast: false });
    deco(group, { x: h.x, y: h.h + 1.55, z: az, w: 2.4, h: 0.02, d: 0.02, mat: M.rope, cast: false });
    for (let i = 0; i < 4; i++) deco(group, { x: h.x - 0.9 + i * 0.6, y: h.h + 0.95, z: az, w: 0.45, h: 0.6, d: 0.02, mat: [M.plasterWhite, M.blue, M.red, M.sail][i], cast: false });
  }
}

/** Faro sobre el espigón: torre blanca con bandas rojas, galería y linterna. Devuelve el haz (gira de noche). */
export function lighthouse(ctx, M, { x, z, y = 0, h = 16, night = false }) {
  const { group } = ctx;
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const r0 = 1.9 - (i / seg) * 0.55;
    const r1 = 1.9 - ((i + 1) / seg) * 0.55;
    const geo = new THREE.CylinderGeometry(r1, r0, h / seg, 20);
    const m = staticMesh(group, geo, i % 2 ? M.lighthouseRed : M.plasterWhite);
    m.position.set(x, y + (i + 0.5) * (h / seg), z);
  }
  // Galería, linterna y cúpula
  const gal = staticMesh(group, new THREE.CylinderGeometry(1.75, 1.75, 0.25, 20), M.metal);
  gal.position.set(x, y + h + 0.1, z);
  const lamp = staticMesh(group, new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), M.glass, { cast: false });
  lamp.position.set(x, y + h + 1.05, z);
  const dome = staticMesh(group, new THREE.ConeGeometry(1.15, 1, 12), M.lighthouseRed);
  dome.position.set(x, y + h + 2.35, z);
  // Haz giratorio (aditivo, solo de noche)
  // El haz se apaga a lo largo (color por vértice) para no verse como un cono sólido
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, vertexColors: true, transparent: true, opacity: night ? 0.28 : 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.ConeGeometry(5, 60, 16, 6, true).rotateZ(Math.PI / 2).translate(30, 0, 0);
  {
    const p = beamGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = Math.pow(1 - Math.min(1, p.getX(i) / 60), 2.2);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const beam = new THREE.Group();
  beam.position.set(x, y + h + 1.05, z);
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(beamGeo, beamMat);
    m.rotation.y = s > 0 ? 0 : Math.PI;
    beam.add(m);
  }
  beam.visible = night;
  group.add(beam);
  return { beam, update: (dt) => { beam.rotation.y += dt * 0.6; } };
}

/** Barca de pesca: casco afilado de madera pintada con franja, cabina y mástil. */
export function fishingBoat(ctx, M, { x, z, y = -1.25, ry = 0, color = 'hullRed', len = 6 }) {
  const { group } = ctx;
  const g = new THREE.Group();
  const w = len * 0.34;
  const hull = new THREE.Shape();
  hull.moveTo(-len / 2, -w / 2);
  hull.lineTo(len * 0.18, -w / 2);
  hull.quadraticCurveTo(len / 2, -w * 0.3, len / 2 + 0.2, 0);
  hull.quadraticCurveTo(len / 2, w * 0.3, len * 0.18, w / 2);
  hull.lineTo(-len / 2, w / 2);
  hull.closePath();
  const hgeo = new THREE.ExtrudeGeometry(hull, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2 });
  hgeo.rotateX(-Math.PI / 2);
  const uv = hgeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
  const h1 = new THREE.Mesh(hgeo, M[color]);
  h1.castShadow = true;
  g.add(h1);
  // Franja blanca y regala
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.9, 0.12, w + 0.3), M.hullWhite);
  stripe.position.set(-len * 0.05, 0.85, 0);
  g.add(stripe);
  // Cabina y mástil
  const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.24, 1.1, w * 0.7), M.hullWhite);
  cab.position.set(-len * 0.18, 1.5, 0);
  cab.castShadow = true;
  g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len * 0.28, 0.08, w * 0.8), M.blue);
  roof.position.set(-len * 0.18, 2.09, 0);
  g.add(roof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6), M.wood);
  mast.position.set(len * 0.1, 2.6, 0);
  g.add(mast);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  // Quietas en el agua: se fusionan con el resto del decorado
  g.traverse((o) => { if (o.isMesh) o.userData.levelStatic = true; });
  group.add(g);
  return g;
}

/**
 * Muelle de piedra: borde con sillares, norays, cajas, redes y faroles.
 * `from`/`to` en x a lo largo de z = `z` (el agua queda en +Z).
 */
export function quay(ctx, B, M, { x0, x1, z, y = 0, night = false }) {
  const { group } = ctx;
  const r = rng(Math.round(x0 * 3 + z));
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  B.block({ x: cx, z: z - 1, w: len, d: 2, y: y - 4, h: 4, mat: M.stone, climbable: false });
  deco(group, { x: cx, y: y - 0.05, z: z - 0.25, w: len, h: 0.2, d: 0.6, mat: M.stoneDark });
  for (let x = x0 + 3; x < x1 - 2; x += 7) {
    deco(group, { x, y, z: z - 0.4, w: 0.45, h: 0.55, d: 0.45, mat: M.metal });
    deco(group, { x, y: 0.55, z: z - 0.4, w: 0.6, h: 0.12, d: 0.6, mat: M.metal, cast: false });
  }
  // Cajas de pescado, barriles y redes amontonadas
  for (let x = x0 + 5; x < x1 - 4; x += 9 + r() * 6) {
    const zz = z - 3 - r() * 2;
    for (let k = 0; k < 3; k++) B.block({ x: x + (k % 2) * 0.9, z: zz + (k > 1 ? 0.8 : 0), y: k > 1 ? 0.5 : 0, w: 0.85, d: 0.6, h: 0.5, mat: M.wood, collide: k < 2 });
    const net = staticMesh(group, new THREE.SphereGeometry(0.9, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.net);
    net.position.set(x + 2.4, 0, zz + 0.3);
    net.scale.set(1.2, 0.5, 0.9);
    const barrel = staticMesh(group, new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), M.wood);
    barrel.position.set(x - 1.4, 0.45, zz + 0.2);
  }
  for (let x = x0 + 6; x < x1; x += 14) lampPost(group, { x, z: z - 1.2, metal: M.metal, glow: M.lantern, ry: Math.PI / 2 });
  void night;
}

/** Iglesia: nave con tejado a dos aguas y torre-campanario con chapitel. */
export function church(ctx, B, M, { x, z, ry = 0 }) {
  const { group } = ctx;
  const nave = { x, z: z - 7, w: 9, d: 14, h: 8 };
  B.block({ x: nave.x, z: nave.z, w: nave.w, d: nave.d, h: nave.h, mat: M.stone });
  gableRoof(ctx, { x: nave.x, z: nave.z, w: nave.w, d: nave.d, y: nave.h, rise: 3.2, along: 'z', roofMat: M.roof, wallMat: M.stone });
  // Rosetón y puerta
  const ros = staticMesh(group, new THREE.CircleGeometry(1.2, 20), M.window, { cast: false });
  ros.position.set(x, 6.2, z + 0.02);
  deco(group, { x, y: 0, z: z + 0.05, w: 2.2, h: 3.6, d: 0.12, mat: M.wood, cast: false });
  // Torre
  B.block({ x: x + 6, z: z - 2.5, w: 5, d: 5, h: 18, mat: M.stone });
  for (const yy of [6, 12]) deco(group, { x: x + 6, y: yy, z: z - 2.5, w: 5.3, h: 0.25, d: 5.3, mat: M.stoneDark, cast: false });
  // Campanario abierto (arcos sugeridos con huecos oscuros)
  for (const [dx, dz, ry2] of [[0, 2.53, 0], [0, -2.53, 0], [2.53, 0, Math.PI / 2], [-2.53, 0, Math.PI / 2]]) {
    deco(group, { x: x + 6 + dx, y: 14.6, z: z - 2.5 + dz, w: 1.6, h: 2.4, d: 0.06, mat: M.windowDark, ry: ry2, cast: false });
  }
  const spire = staticMesh(group, new THREE.ConeGeometry(3.7, 6, 4), M.roof);
  spire.position.set(x + 6, 21, z - 2.5);
  spire.rotation.y = Math.PI / 4;
  void ry;
}

/** Tendedero entre dos fachadas (callejones). */
export function laundryLine(group, M, { x0, z0, x1, z1, y }) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  deco(group, { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, w: len, h: 0.02, d: 0.02, mat: M.rope, ry, cast: false });
  const n = Math.floor(len / 0.8);
  for (let i = 1; i < n; i++) {
    if (i % 3 === 0) continue;
    const t = i / n;
    deco(group, {
      x: x0 + (x1 - x0) * t, y: y - 0.62, z: z0 + (z1 - z0) * t, w: 0.5, h: 0.6, d: 0.02, ry,
      mat: [M.plasterWhite, M.blue, M.red, M.sail, M.green][i % 5], cast: false,
    });
  }
}

export { climbMark, lampPost };
