import * as THREE from 'three';
import { createSky, createSun, createMountains, createCity } from '../environment.js';
import { createWater } from '../water.js';
import { grassTexture, dirtTexture, strataTexture } from '../textures.js';
import { terrain } from '../kit/terrain.js';
import { bridgeMaterials, trussSpan, spanColliders, pier } from '../kit/bridge.js';
import { baseMaterials, truck, jersey, sandbags, floodlight, banner } from '../kit/base.js';
import { deco, staticMesh, rockGeometry, climbMark } from '../kit/common.js';
import { wildMaterials } from '../kit/wild.js';
import { pineForest, scatterRocks, mulberry } from '../../story/props.js';

/**
 * PROTOTIPO v2 · EL GRAN CAÑÓN. El puente ya no es una fila de tramos con
 * huecos iguales: cada tramo roto cuenta una cosa y pide un movimiento.
 *
 *   tramo oeste entero (combate 1) → hueco de 9 m (dash) → tramo caído e
 *   inclinado (se baja corriendo) → pila partida (fuente de Energía) →
 *   salto al tramo descolgado → trepar sus vigas de piso marcadas →
 *   tramo este (combate 2 y bloqueo de la PDC) → colina con la ciudad.
 *
 * Disposición (x hacia el este): borde oeste x 0 · borde este x 120 ·
 * tablero a 3 m · río a −44 · pila 1 x 24 · pila partida x 55…63 (−8.4) ·
 * bisagra del tramo descolgado x 70 · pila 3 x 96 · colina x 175 (13 m).
 */

const DECK = 3;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rimW = (z) => 3.5 * Math.sin(z * 0.03) + 2 * Math.sin(z * 0.071);
const rimE = (z) => 120 + 4 * Math.sin(z * 0.026) - 3 * Math.sin(z * 0.05);

/**
 * Caída desde el borde: bancales de anchura y altura irregulares (cantiles
 * casi verticales y repisas con derrubios) que serpentean a lo largo de z.
 */
function drop(d, z, side) {
  let y = 0;
  let start = 0;
  for (let i = 0; i < 6; i++) {
    const ph = i * 1.9 + side * 2.3;
    const band = 8.5 + 2.5 * Math.sin(z * 0.021 + ph);
    const cliffW = 2.6 + 1.2 * Math.sin(z * 0.034 + ph * 1.3);
    const cliffH = 7.2 + 2.2 * Math.sin(z * 0.017 + ph * 0.7);
    const u = d - start;
    if (u <= 0) break;
    y += cliffH * smooth(0, cliffW, u) + 1.4 * Math.min(1, Math.max(0, (u - cliffW) / (band - cliffW)));
    start += band;
  }
  return y;
}

function canyonHeight(x, z) {
  const dW = x - rimW(z);
  const dE = rimE(z) - x;
  const d = Math.min(dW, dE);
  if (d > 0) {
    const n = 0.35 * Math.sin(x * 0.21 + z * 0.13) + 0.25 * Math.sin(z * 0.37 - x * 0.11);
    // Las bandas no son rectas: el borde de cada cantil ondula
    const dd = d + 1.6 * Math.sin(z * 0.09 + x * 0.05) + 0.8 * Math.sin(z * 0.23);
    return Math.max(-45, DECK - drop(Math.max(0, dd), z, dW < dE ? 0 : 1) + n * smooth(1, 4, d));
  }
  // Mesetas: carreteras llanas al puente, colinas a los lados y la colina final al este
  const o = -d;
  const road = Math.abs(z) < 6 ? 1 - smooth(4, 6, Math.abs(z)) : 0;
  let y = DECK + (5 + 4 * Math.sin(x * 0.02 + z * 0.03)) * smooth(8, 50, o) * (1 - road * 0.9);
  y += 0.4 * Math.sin(x * 0.17 + z * 0.11) * smooth(4, 12, o);
  if (x > 120) y += 10 * smooth(140, 172, x) * (1 - smooth(196, 230, x));
  return y;
}

function buildCanyon(ctx) {
  const { group, builder: B, scene, world } = ctx;
  const sunDir = new THREE.Vector3(-0.82, 0.2, 0.35).normalize();
  scene.fog = new THREE.FogExp2(0xd2b49a, 0.0036);
  group.add(createSky({ top: '#35507a', horizon: '#f6b47c', bottom: '#5a5a66', sunDir, sunColor: '#ffc080', clouds: 0.45, cloudColor: '#ffe6cc', cloudShade: '#9a7a7c' }));
  group.add(new THREE.HemisphereLight(0xc8d0e0, 0x5a4a3a, 1.05));
  const sun = createSun({ color: '#ffc896', intensity: 2.5, direction: sunDir.clone().negate(), shadowSize: 90 });
  group.add(sun, sun.target);
  const M = bridgeMaterials();
  const P = baseMaterials(false);
  const W = wildMaterials();
  const r = mulberry(33);

  // ---------------------------------------------------------------- Cañón
  const rock = strataTexture('#8a7660', 97);
  terrain(ctx, {
    minX: -160, minZ: -230, maxX: 280, maxZ: 230, cell: 2, height: canyonHeight,
    grass: grassTexture('#5a6a42', 81), dirt: dirtTexture('#8a7a62', 96), rock,
    splat: (x, z, y, slope) => {
      const inside = Math.min(x - rimW(z), rimE(z) - x) > 0.5;
      return [inside ? 0.9 : (Math.abs(z) < 4.5 && (x < 0 || x > 120) ? 0.8 : 0), smooth(0.7, 1.3, slope) + (inside && y < -42 ? 0.5 : 0)];
    },
    tint: (x, z) => 0.92 + 0.1 * Math.sin(x * 0.05 + z * 0.08),
  });
  const river = createWater({ width: 22, depth: 460, color: 0x2e5058, speed: 3.2, repeat: 30 });
  river.position.set(60, -44.2, 0);
  group.add(river);
  // Bloques caídos al fondo y en los bancales
  const boulders = [];
  for (let i = 0; i < 70; i++) {
    const z = -200 + r() * 400;
    const x = 52 + r() * 16;
    boulders.push({ x, y: -45, z, s: 0.8 + r() * 2.2 });
  }
  scatterRocks(ctx, boulders, 0x8a7a68);

  // ---------------------------------------------------------------- Estribos
  B.block({ x: -4, z: 0, w: 8, d: 10, y: -14, h: 14 + DECK - 0.6, mat: M.concrete, climbable: false });
  B.block({ x: 124, z: 0, w: 8, d: 10, y: -14, h: 14 + DECK - 0.6, mat: M.concrete, climbable: false });
  for (const [x0, x1] of [[-60, 0], [120, 200]]) {
    B.block({ x: (x0 + x1) / 2, z: 0, w: x1 - x0, d: 7.4, y: DECK - 0.4, h: 0.4, mat: M.road, cast: false });
  }

  // ---------------------------------------------------------------- 1 · Tramo oeste (entero)
  const spanW = trussSpan(M, { len: 30, broken: ['end'], seed: 3 });
  spanW.position.set(0, DECK, 0);
  group.add(spanW);
  spanColliders(world, { x0: 0, x1: 28.8, y: DECK });
  pier(ctx, B, M, { x: 24, bottom: -26, top: DECK - 0.6 });
  // Cobertura: barreras, coche accidentado y camión cruzado
  for (const [x, z, along] of [[8, 1.8, 'x'], [14, -2, 'x'], [21, 1.4, 'z']]) jersey(ctx, B, P, { x, y: DECK, z, along, len: 2.6 });
  wreck(ctx, B, P, { x: 17, y: DECK, z: 1.9, ry: 0.25 });

  // ---------------------------------------------------------------- 2 · Hueco (dash) y tramo inclinado
  const T0 = { x: 39, y: 1 };
  const T1 = { x: 56.5, y: -8.4 };
  const tLen = Math.hypot(T1.x - T0.x, T1.y - T0.y);
  const spanT = trussSpan(M, { len: tLen, broken: ['start'], seed: 5 });
  spanT.position.set(T0.x, T0.y, 0);
  spanT.rotation.z = Math.atan2(T1.y - T0.y, T1.x - T0.x);
  group.add(spanT);
  const slope = (T1.y - T0.y) / (T1.x - T0.x);
  world.addRamp({ minX: T0.x + 1.2, maxX: T1.x, minZ: -4, maxZ: 4, axis: 'x', y0: T0.y + slope * 1.2, y1: T1.y, base: T1.y - 1.2 });
  for (const s of [-1, 1]) {
    for (let x = T0.x + 1.2; x < T1.x; x += 3.5) {
      const yy = T0.y + slope * (x + 1.75 - T0.x);
      world.addBox({ x, y: yy - 1, z: s > 0 ? 3.75 : -4.4 }, { x: x + 3.5, y: yy + 1.6, z: s > 0 ? 4.4 : -3.75 }, { climbable: false, cameraBlocking: false });
    }
  }

  // ---------------------------------------------------------------- 3 · Pila partida (Energía)
  pier(ctx, B, M, { x: 59, bottom: -45, top: -8.4, w: 8, d: 7, broken: true, seed: 8 });
  generator(ctx, P, { x: 61, y: -8.4, z: -2.2 });

  // ---------------------------------------------------------------- 4 · Tramo descolgado (se trepa)
  const hinge = { x: 70, y: DECK - 0.6 };
  const spanH = trussSpan(M, { len: 15, broken: ['end'], seed: 9, marks: true });
  spanH.position.set(hinge.x, hinge.y, 0);
  spanH.rotation.z = -Math.PI / 2 - 0.14;
  group.add(spanH);
  // Colisión: dos cajas escalonadas que siguen la cara inferior (trepable)
  world.addBox({ x: 67.9, y: -11.6, z: -3.6 }, { x: 70.3, y: -4, z: 3.6 }, { climbable: true });
  world.addBox({ x: 68.9, y: -4, z: -3.6 }, { x: 70.3, y: DECK, z: 3.6 }, { climbable: true });
  climbMark(group, M.whiteMark, { x: 68.75, y: DECK + 0.02, z: 0, w: 0.1, d: 6 });

  // ---------------------------------------------------------------- 5 · Tramo este (combate 2 y bloqueo)
  const spanE = trussSpan(M, { len: 50, broken: ['start'], seed: 11 });
  spanE.position.set(70, DECK, 0);
  group.add(spanE);
  spanColliders(world, { x0: 70, x1: 120, y: DECK });
  pier(ctx, B, M, { x: 96, bottom: -26, top: DECK - 0.6 });
  for (const [x, z] of [[80, -1.8], [88, 2]]) jersey(ctx, B, P, { x, y: DECK, z, along: 'x', len: 2.6 });
  // Bloqueo de la PDC: camiones cruzados, sacos, barreras, focos y estandarte
  truck(ctx, B, P, { x: 110, y: DECK, z: -1.6, ry: Math.PI / 2 + 0.25 });
  truck(ctx, B, P, { x: 116, y: DECK, z: 2, ry: -Math.PI / 2 + 0.2 });
  sandbags(ctx, B, P, { x: 104, y: DECK, z: 1.8, along: 'z', len: 2.4 });
  sandbags(ctx, B, P, { x: 103, y: DECK, z: -2.6, along: 'z', len: 1.8 });
  jersey(ctx, B, P, { x: 106, y: DECK, z: 0.4, along: 'z', len: 2.4 });
  floodlight(ctx, B, P, { x: 122, z: -5.5, y: DECK, h: 8, aim: { x: 100, z: 0 }, night: false });
  floodlight(ctx, B, P, { x: 122, z: 5.5, y: DECK, h: 8, aim: { x: 100, z: 0 }, night: false });
  deco(group, { x: 124.5, y: DECK, z: 4, w: 0.15, h: 7, d: 0.15, mat: P.metal });
  banner(ctx, P, { x: 124.5, y: DECK + 6.8, z: 4, ry: -Math.PI / 2 });

  // ---------------------------------------------------------------- Mesetas: bosque y colina con la vista
  const sight = ProtoCanyon.shots.map((sh) => ({ a: sh.pos, b: sh.look }));
  const inSight = (x, z) => sight.some(({ a, b }) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(0.3, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < 6 || Math.hypot(x - a.x, z - a.z) < 12;
  });
  const trees = [];
  for (let i = 0; i < 6000 && trees.length < 1500; i++) {
    const x = -160 + r() * 440;
    const z = -225 + r() * 450;
    if (inSight(x, z)) continue;
    const d = Math.min(x - rimW(z), rimE(z) - x);
    if (d > -6 || Math.abs(z) < 9 && (x < 6 || x > 114)) continue;
    if (x > 168 && x < 200 && Math.abs(z) < 16) continue;
    trees.push({ x, y: canyonHeight(x, z) - 0.1, z, s: 0.8 + r() * 0.9 });
  }
  pineForest(ctx, trees);
  // Rocas del borde del cañón
  for (let i = 0; i < 80; i++) {
    const z = -220 + i * 5.5;
    for (const side of [0, 1]) {
      if (Math.abs(z) < 7) continue;
      const x = side ? rimE(z) + 1 + r() * 2 : rimW(z) - 1 - r() * 2;
      const m = staticMesh(group, rockGeometry(1 + r() * 1.4, 0.6 + r() * 0.6, 1.2 + r(), 600 + i * 2 + side, 1), W.rock);
      m.position.set(x, canyonHeight(x, z) - 0.2, z);
    }
  }
  group.add(createCity({ origin: { x: 260, y: -40, z: 0 }, dist: [800, 1150], seed: 33, intensity: 0.6 }));
  group.add(createMountains([
    { x: -120, z: -300, rad: 140, h: 200 }, { x: 80, z: -320, rad: 150, h: 240 }, { x: 260, z: -300, rad: 120, h: 180 },
    { x: -120, z: 300, rad: 140, h: 190 }, { x: 80, z: 320, rad: 150, h: 220 }, { x: -320, z: 0, rad: 160, h: 200 },
  ], { rock: '#5c5650', low: '#3a4232', snow: '#eef2f6', snowLine: 0.55, seed: 71 }));

  return { spawn: { x: 6, y: DECK + 0.2, z: 0, yaw: Math.PI / 2 }, sun };
}

/** Coche accidentado y medio aplastado (cobertura). */
function wreck(ctx, B, P, { x, y, z, ry = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(0.04, ry, -0.06);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.9, 1.9), P.truck);
  body.position.y = 0.75;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.7), P.glass);
  cab.position.set(-0.2, 1.4, 0);
  cab.rotation.z = 0.08;
  g.add(body, cab);
  for (const [dx, dz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateX(Math.PI / 2), P.tire);
    w.position.set(dx, 0.36, dz);
    g.add(w);
  }
  g.traverse((o) => { o.castShadow = true; });
  ctx.group.add(g);
  B.block({ x, z, w: 4.4, d: 2.4, y, h: 1.6, mat: P.metal }).visible = false;
}

/** Generador de la PDC (fuente de Energía): armario con paneles azules encendidos. */
function generator(ctx, P, { x, y, z }) {
  deco(ctx.group, { x, y, z, w: 1.6, h: 1.5, d: 1, mat: P.pdcDark });
  deco(ctx.group, { x: x + 0.81, y: y + 0.3, z, w: 0.04, h: 0.9, d: 0.7, mat: P.strip, cast: false });
  deco(ctx.group, { x, y: y + 1.5, z, w: 1.7, h: 0.12, d: 1.1, mat: P.metal });
  const l = new THREE.PointLight(0x4aa8ff, 4, 6, 1.5);
  l.position.set(x + 1.2, y + 1, z);
  ctx.group.add(l);
  ctx.world.addBox({ x: x - 0.8, y, z: z - 0.5 }, { x: x + 0.8, y: y + 1.5, z: z + 0.5 }, { climbable: true });
}

export const ProtoCanyon = {
  id: 'proto-canon', name: 'Prototipo · Gran cañón', description: 'Propuesta v2', envIntensity: 0.55,
  grade: { contrast: 1.06, saturation: 1.1, shadows: '#2a3046', highlights: '#ffcf9a', split: 0.08, vignette: 0.28 },
  fillLight: { color: 0xffe0c0, intensity: 0.35 },
  shots: [
    { id: 'puente', title: 'El puente roto sobre el cañón', pos: { x: -11, y: 8.5, z: -10 }, look: { x: 56, y: -5, z: 3 }, jon: { x: 5, y: 3.2, z: -1.6, yaw: Math.PI / 2 } },
    { id: 'perfil', title: 'El recorrido visto de lado', pos: { x: 60, y: -6, z: 96 }, look: { x: 60, y: -9, z: 0 }, fog: 0.0016 },
    { id: 'rampa', title: 'El tramo caído: se baja corriendo', pos: { x: 35, y: 6.5, z: 7 }, look: { x: 62, y: -9, z: -2 }, jon: { x: 47, y: -3, z: 0.6, yaw: Math.PI / 2 } },
    { id: 'trepar', title: 'Del pilar partido al tramo descolgado', pos: { x: 56.5, y: -5.4, z: 8.5 }, look: { x: 69, y: -3, z: -1 }, jon: { x: 61.8, y: -8.2, z: 1.2, yaw: Math.PI / 2 } },
    { id: 'bloqueo', title: 'Tramo este: el bloqueo de la PDC', pos: { x: 96.5, y: 5.2, z: 1.4 }, look: { x: 118, y: 3.8, z: -0.5 }, jon: { x: 101.5, y: 3.2, z: -0.3, yaw: Math.PI / 2 } },
    { id: 'colina', title: 'La colina: la ciudad al fondo', pos: { x: 170, y: 16.5, z: 6 }, look: { x: 600, y: 30, z: -20 }, jon: { x: 178, y: 13.2, z: 1, yaw: Math.PI / 2 } },
  ],
  build: buildCanyon,
};
