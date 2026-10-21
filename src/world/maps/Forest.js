import * as THREE from 'three';
import { createSky, createSun, createMountains, createCity, cityTowers, softFog } from '../environment.js';
import { concreteTexture, asphaltTexture, grassTexture, rockTexture, dirtTexture, strataTexture, metalPlateTexture } from '../textures.js';
import { createWater } from '../water.js';
import { terrain } from '../kit/terrain.js';
import { wildMaterials, campfire, steppingStones, rockPillar, waterfall, huntersTower, tent, flatRock } from '../kit/wild.js';
import { bridgeMaterials, trussSpan, spanColliders, pier } from '../kit/bridge.js';
import { baseMaterials, truck, jersey, sandbags, floodlight, banner } from '../kit/base.js';
import { deco, staticMesh, rockGeometry, climbMark } from '../kit/common.js';
import { EnergySource } from '../entities/EnergySource.js';
import { glowSprite, glowTexture } from '../../vfx/glowTexture.js';
import { VeinBoulder, Barricade, PrisonBus, LandingMarker, mulberry, pineForest, scatterRocks, scatterBushes } from '../../story/props.js';

/**
 * BOSQUE Y GRAN CAÑÓN (prólogo, M04 final y M05), según la propuesta aprobada.
 *
 * Un recorrido de oeste a este con relieve de verdad (terreno con colisión):
 *   valle del viaducto (el autobús vuelca) y prado del despertar →
 *   arroyo con piedras para saltar → barricada de tablones (a golpes) →
 *   cuesta → roca con vetas (solo la rompe la Energía) y generador →
 *   barranco con pilares de roca → repisa con la cascada y la cueva →
 *   pared de escalada marcada → meseta alta con la torre de caza →
 *   el puente roto sobre el gran cañón → colina con la ciudad al fondo.
 *
 * El puente: tramo oeste entero (los drones) → hueco de 9 m (dash) → tramo
 * caído e inclinado (se baja corriendo) → pila partida con un generador →
 * salto al tramo descolgado y escalada por sus vigas → tramo este (los dos
 * bloqueos de la PDC) → colina. Más allá, la tierra sigue hasta la ciudad.
 *
 * Disposición (x hacia el este): viaducto z −60, y 14, x −165…−40 ·
 * despertar (−45, 0, 10) · arroyo x −36 · barricada x −26.5 · roca x −3 ·
 * barranco x 3…15 · acantilado x 26 (13 m) · puente x 70…200 (tablero a 13 m)
 * · colina x 242…266 (23 m) · ciudad x > 900.
 */

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ Trazado
/** Centro de la senda del bosque (serpentea un poco). */
export const pathZ = (x) => 3 * Math.sin(x * 0.05);
const creekX = (z) => -36 + 2.5 * Math.sin(z * 0.11);
const ravineX = (z) => 8.5 + 1.2 * Math.sin(z * 0.09 + 0.6);
const POOL = { x: 21.5, z: -16 };
const CLIFF_X = 26;
const TOP = 13;
const CAVE = { z0: -17.5, z1: -14.5, top: 9, floor: 5.5, depth: 6 };
const CAMP = { x: -14, z: -19 };
const WAKE = { x: -45, z: 10 };
/** Escala de la niebla en la ciudad lejana (niebla suave: velada, nunca recortada). */
const CITY_HAZE = 0.3;

/** Tablero del puente (a la altura de la meseta alta). */
export const DECK_Y = 13;
/** Borde oeste del cañón (x) y desplazamiento de su perfil (de 3 a 13 m). */
const OX = 70;
const OY = 10;
/** Tramos enteros del puente (los que se recorren a ras de tablero). */
export const BRIDGE_SPANS = [
  { id: 'W', x0: 70, x1: 100 },
  { id: 'E', x0: 140, x1: 200 },
];
/** El único hueco que se cruza con el dash: del tramo oeste al tramo caído. */
export const BRIDGE_GAPS = [{ from: 100, to: 109, width: 9 }];
/** Tramo caído (rampa) que baja del hueco a la pila partida. */
export const FALLEN = { x0: 109, y0: 10.77, x1: 126.5, y1: 1.6 };
/** Pila partida a media altura (con un generador). */
export const PIER = { x0: 125, x1: 133, top: 1.6 };
/** Tramo descolgado: bisagra en el arranque del tramo este y caras trepables. */
export const HANG = { hinge: { x: 140, y: DECK_Y - 0.6 }, lowFace: 137.9, lowTop: 6, highFace: 138.9 };

export const Forest = {
  id: 'bosque',
  name: 'El bosque',
  description: 'Lejos del autobús',
  story: true,
  ambience: 'forest',
  factions: { pdc: 100 },
  /** Aspecto: tarde dorada en la montaña. */
  envIntensity: 0.5,
  grade: { contrast: 1.06, saturation: 1.1, shadows: '#283246', highlights: '#ffd6a0', split: 0.07, vignette: 0.28 },
  fillLight: { color: 0xffe2c0, intensity: 0.3 },
  /** Niebla del valle y del bosque (en la colina se abre para ver la ciudad). */
  fog: 0.0046,
  bounds: { minX: -172, maxX: 300, minZ: -95, maxZ: 60 },
  waypoints: [
    { id: 'despertar', name: 'Despertar (CP18)', x: WAKE.x, y: 0.3, z: WAKE.z, yaw: Math.PI / 2 },
    { id: 'roca', name: 'Roca de Energía (CP20)', x: -10, y: 5, z: pathZ(-10), yaw: Math.PI / 2 },
    { id: 'meseta', name: 'Meseta alta', x: 40, y: 13.5, z: pathZ(40), yaw: Math.PI / 2 },
    { id: 'puente', name: 'Puente (CP23)', x: 94, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    { id: 'colina', name: 'Colina', x: 246, y: 23.5, z: 0, yaw: Math.PI / 2 },
  ],
  build(ctx) {
    return buildForest(ctx);
  },
};

// ------------------------------------------------------------------ Relieve
/** Colinas fuera del recorrido, cada vez más altas hacia la niebla (no en el valle del viaducto). */
function far(x, z) {
  const f = Math.max(0, Math.abs(z) - 40) + Math.max(0, -64 - x);
  return (0.1 * f + 4 * Math.sin(x * 0.031 + 0.5) * Math.sin(z * 0.027) * smooth(0, 40, f)) * (1 - valley(x, z));
}

/** Valle llano bajo el viaducto (x −175…−38, z −85…25). */
function valley(x, z) {
  return smooth(-178, -168, x) * (1 - smooth(-48, -38, x)) * smooth(-92, -80, z) * (1 - smooth(18, 28, z));
}

function lowBase(x, z) {
  const dz = Math.abs(z - pathZ(x));
  let y = 5 * smooth(-28, -6, x) + 0.5 * smooth(17, 24, x);
  // La repisa entre el barranco y el acantilado es llana (se recorre a lo largo)
  const shelf = 1 - 0.85 * smooth(12, 18, x);
  const open = 1 - 0.85 * valley(x, z);
  // Laderas a los lados: el bosque encajona la senda
  y += 3.4 * smooth(8, 30, dz) * (0.7 + 0.3 * Math.sin(x * 0.04 + 1)) * shelf * open;
  const n = 0.55 * Math.sin(x * 0.13 + z * 0.07) + 0.35 * Math.sin(x * 0.07 - z * 0.17 + 1.3) + 0.2 * Math.sin(x * 0.31 + z * 0.23);
  y += n * smooth(2.5, 8, dz) * shelf * (1 - 0.6 * valley(x, z));
  // Los dos extremos del viaducto se apoyan en laderas a la altura del tablero
  const band = 1 - smooth(8, 26, Math.abs(z + 60));
  y = Math.max(y, 14 * smooth(-160, -172, x) * band, 14 * smooth(-50, -36, x) * band * (1 - smooth(-30, -20, x)));
  return y + far(x, z);
}
const CAMP_Y = lowBase(CAMP.x, CAMP.z);

/** Terreno bajo (oeste del acantilado). */
function lowHeight(x, z) {
  let y = lowBase(x, z);
  // Rellanos: campamento del cazador y prado del despertar (llano, a 0 m)
  y += (CAMP_Y - y) * (1 - smooth(4.5, 7.5, Math.hypot(x - CAMP.x, z - CAMP.z)));
  y += (0 - y) * (1 - smooth(6, 12, Math.hypot(x - WAKE.x, z - WAKE.z)));
  // Arroyo
  y -= 1.4 * (1 - smooth(2.2, 4.4, Math.abs(x - creekX(z))));
  // Barranco (paredes casi verticales; el fondo, bajo el nivel de caída)
  y = Math.min(y, -8.5 + 32 * smooth(5.2, 7.4, Math.abs(x - ravineX(z))));
  // Poza al pie de la cascada
  y = Math.min(y, 4 + 1.6 * smooth(2.5, 4.6, Math.hypot(x - POOL.x, z - POOL.z)));
  // Boca de la cueva: el suelo sigue llano hacia dentro
  if (x > 22) y = Math.min(y, CAVE.floor - 0.05 + 3 * smooth(2, 4, Math.abs(z - POOL.z)));
  return y;
}

/** Meseta alta (este del acantilado) con el cauce que acaba en la cascada. */
function highHeight(x, z) {
  const dz = Math.abs(z - pathZ(x));
  let y = TOP + (0.5 * Math.sin(x * 0.11 + z * 0.09) + 0.3 * Math.sin(x * 0.05 - z * 0.13)) * smooth(3, 9, dz) * smooth(28, 34, x);
  y += 2.5 * smooth(14, 34, dz) * smooth(30, 40, x);
  y -= 0.9 * (1 - smooth(1.1, 2.4, Math.abs(z - POOL.z)));
  return y + far(x, z);
}

const rimW = (z) => 3.5 * Math.sin(z * 0.03) + 2 * Math.sin(z * 0.071);
const rimE = (z) => 130 + 4 * Math.sin(z * 0.026) - 3 * Math.sin(z * 0.05);

/** Caída desde el borde del cañón: bancales irregulares (cantiles y repisas) que serpentean. */
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

/** Cañón y mesetas del este en coordenadas del cañón (c = x − OX; tablero a 3). */
function canyonLocal(c, z) {
  const dW = c - rimW(z);
  const dE = rimE(z) - c;
  const d = Math.min(dW, dE);
  if (d > 0) {
    const n = 0.35 * Math.sin(c * 0.21 + z * 0.13) + 0.25 * Math.sin(z * 0.37 - c * 0.11);
    const dd = d + 1.6 * Math.sin(z * 0.09 + c * 0.05) + 0.8 * Math.sin(z * 0.23);
    return Math.max(-45, 3 - drop(Math.max(0, dd), z, dW < dE ? 0 : 1) + n * smooth(1, 4, d));
  }
  // Mesetas: carretera llana al puente, colinas a los lados y la colina final al este
  const o = -d;
  const road = Math.abs(z) < 6 ? 1 - smooth(4, 6, Math.abs(z)) : 0;
  let y = 3 + (5 + 4 * Math.sin(c * 0.02 + z * 0.03)) * smooth(8, 50, o) * (1 - road * 0.9);
  y += 0.4 * Math.sin(c * 0.17 + z * 0.11) * smooth(4, 12, o);
  if (c > 130) y += 10 * smooth(140, 172, c) * (1 - smooth(196, 230, c));
  return y;
}

/** Altura del suelo en todo el mapa (bosque, acantilado, meseta y cañón). */
export function groundY(x, z) {
  if (x < CLIFF_X) return lowHeight(x, z);
  // Acantilado: el escalón queda dentro de las cajas trepables (x 26…34)
  if (x < CLIFF_X + 1.5) return lowHeight(CLIFF_X - 0.01, z) + (highHeight(CLIFF_X + 1.5, z) - lowHeight(CLIFF_X - 0.01, z)) * ((x - CLIFF_X) / 1.5);
  // Cueva tras la cascada: hueco bajo el dintel
  if (x < CLIFF_X + CAVE.depth && Math.abs(z - POOL.z) < 1.5) return CAVE.floor - 0.05;
  const c = canyonLocal(x - OX, z) + OY;
  return highHeight(x, z) * (1 - smooth(56, 68, x)) + c * smooth(56, 68, x);
}

// ------------------------------------------------------------------ Mapa
function buildForest(ctx) {
  const { group, builder: B, scene, world } = ctx;
  const sunDir = new THREE.Vector3(-0.75, 0.3, 0.4).normalize();
  scene.fog = new THREE.FogExp2(0xc9b8a4, Forest.fog);
  const sky = createSky({ top: '#3e5a82', horizon: '#f2c08e', bottom: '#5a6470', sunDir, sunColor: '#ffcf98', clouds: 0.4, cloudColor: '#fff0dc', cloudShade: '#988a8c' });
  group.add(sky);
  const hemi = new THREE.HemisphereLight(0xc6d4e6, 0x4a4434, 1.0);
  group.add(hemi);
  const sun = createSun({ color: '#ffd2a0', intensity: 2.3, direction: sunDir.clone().negate(), shadowSize: 60 });
  group.add(sun, sun.target);
  const W = wildMaterials();
  const BM = bridgeMaterials();
  const P = baseMaterials(false);
  const tex = (t) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.userData = t.userData;
    return c;
  };
  const M = {
    concrete: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8a8a86', 85)), roughness: 0.9 }),
    road: new THREE.MeshStandardMaterial({ map: tex(asphaltTexture()), roughness: 0.95 }),
    steelDark: new THREE.MeshStandardMaterial({ map: tex(metalPlateTexture('#3c4148', 92)), metalness: 0.6, roughness: 0.5 }),
    van: new THREE.MeshStandardMaterial({ color: 0x2b323b, metalness: 0.4, roughness: 0.5 }),
  };
  const r = mulberry(21);
  const hAt = groundY;

  // ---------------------------------------------------------------- Terreno (hasta el horizonte)
  const grass = grassTexture('#55663f', 81);
  const dirt = dirtTexture('#6a5440', 95);
  const rock = rockTexture('#6e6a63', 83);
  const strata = strataTexture('#8a7660', 97);
  const inCanyon = (x, z) => x > OX - 6 && x < OX + 136 && Math.min(x - OX - rimW(z), OX + rimE(z) - x) > 0.5;
  const splat = (x, z, y, slope) => {
    const dz = Math.abs(z - pathZ(x));
    const path = x < 60 ? 1 - smooth(1.4, 2.8, dz) : Math.abs(z) < 4.5 && (x < OX + 2 || x > OX + 128) ? 0.85 : 0;
    const bank = Math.max(1 - smooth(3, 5, Math.abs(x - creekX(z))), x > CLIFF_X && x < 60 ? 1 - smooth(1.6, 3, Math.abs(z - POOL.z)) : 0);
    const pool = 1 - smooth(3.5, 5.5, Math.hypot(x - POOL.x, z - POOL.z));
    const scree = inCanyon(x, z) ? 0.9 : 0;
    return [Math.max(path, bank * 0.9, pool, scree), smooth(0.75, 1.3, slope) + (y < -1 ? 0.6 : 0)];
  };
  const tint = (x, z) => 0.9 + 0.12 * Math.sin(x * 0.21 + z * 0.17) + 0.06 * Math.sin(x * 0.6 - z * 0.4);
  terrain(ctx, { minX: -200, minZ: -231, maxX: 59.5, maxZ: 231, cell: 1.5, height: groundY, splat, tint, grass, dirt, rock });
  terrain(ctx, { minX: 59.5, minZ: -231, maxX: 351.5, maxZ: 231, cell: 2, height: groundY, splat, tint, grass, dirt: dirtTexture('#8a7a62', 96), rock: strata });
  distantLand(ctx, grass);

  // Agua: arroyo, río del barranco, poza, cauce alto y el río del cañón
  for (const [w, d, color, speed, x, y, z] of [
    [15, 120, 0x35535a, 2.6, -36, -0.72, 0], [10, 300, 0x2f4f5c, 3, 8.5, -7.3, 0], [10, 10, 0x2e5560, 1.4, POOL.x, 5, POOL.z],
    [34, 3.2, 0x35535a, 2.2, CLIFF_X + 17, TOP - 0.45, POOL.z], [26, 460, 0x2e5058, 3.2, OX + 65, -34.2, 0],
  ]) {
    const water = createWater({ width: w, depth: d, color, speed, repeat: Math.max(4, d / 15) });
    water.position.set(x, y, z);
    group.add(water);
  }

  // ---------------------------------------------------------------- Viaducto del convoy y prado del despertar
  const viaduct = buildViaduct(ctx, B, M);

  // ---------------------------------------------------------------- 1 · Arroyo
  const sx = -36;
  const sz = pathZ(sx);
  steppingStones(ctx, W, [
    { x: sx - 3.4, z: sz + 0.3, top: -0.25, s: 1.1 },
    { x: sx - 1.2, z: sz - 0.4, top: -0.15, s: 1 },
    { x: sx + 1.1, z: sz + 0.5, top: -0.3, s: 1.15 },
    { x: sx + 3.2, z: sz - 0.2, top: -0.2, s: 1 },
  ]);
  logBridge(ctx, W, { x: creekX(14), z: 14, y: 0.4, len: 11, ry: 0.15 });

  // ---------------------------------------------------------------- 2 · Barricada de tablones (se rompe a golpes)
  const bx = -26.5;
  const barricade = new Barricade(ctx, { x: bx, y: hAt(bx, pathZ(bx)) - 0.1, z: pathZ(bx), w: 6.5, plankMat: W.plankLight, postMat: W.log, tapeMat: W.tape, signMat: W.sign });
  for (const sgn of [-1, 1]) {
    const m = staticMesh(group, rockGeometry(2.2, 2.2, 3.4, 140 + sgn, 1), W.rock);
    m.position.set(bx, hAt(bx, pathZ(bx) + sgn * 5.5) + 0.6, pathZ(bx) + sgn * 5.5);
    world.addBox({ x: bx - 1.5, y: m.position.y - 2, z: pathZ(bx) + sgn * 5.2 - 1.6 }, { x: bx + 1.5, y: m.position.y + 2.2, z: pathZ(bx) + sgn * 5.2 + 1.6 }, { climbable: false });
  }

  // ---------------------------------------------------------------- 3 · Cuesta con raíces y rocas
  for (let i = 0; i < 9; i++) {
    const x = -24 + i * 2.2;
    const z = pathZ(x) + (i % 2 ? 1 : -1) * (2.6 + r() * 1.2);
    const m = staticMesh(group, rockGeometry(0.7 + r() * 0.6, 0.5 + r() * 0.4, 0.8, 160 + i, 1), r() < 0.5 ? W.rock : W.rockWarm);
    m.position.set(x, hAt(x, z), z);
  }
  for (const x of [-21, -16.5, -12]) {
    const root = staticMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 5, 6).rotateX(Math.PI / 2), W.log);
    root.position.set(x, hAt(x, pathZ(x)) + 0.06, pathZ(x));
    root.rotation.y = 0.3;
  }

  // ---------------------------------------------------------------- 4 · Roca con vetas de Energía y generador
  const vx = -3;
  const debris = new VeinBoulder(ctx, { x: vx, y: hAt(vx, pathZ(vx)) - 0.2, z: pathZ(vx), r: 1.9, health: 20, rockMat: W.rockDark, veinMat: W.veinRock });
  ctx.addEntity(debris);
  for (const sgn of [-1, 1]) {
    const z = pathZ(vx) + sgn * 4.6;
    const m = staticMesh(group, rockGeometry(2.6, 3.4, 2.4, 180 + sgn, 1), W.rockWarm);
    m.position.set(vx + 0.5, hAt(vx, z) + 1, z);
    world.addBox({ x: vx - 1.5, y: hAt(vx, z) - 1, z: pathZ(vx) + sgn * 3.6 - 1.5 }, { x: vx + 2.5, y: hAt(vx, z) + 5, z: pathZ(vx) + sgn * 3.6 + 1.5 }, { climbable: false });
  }

  // ---------------------------------------------------------------- 5 · Barranco y pilares
  const rz = pathZ(ravineX(0));
  const rx = ravineX(rz);
  const pillars = [{ x: rx - 3.7, z: rz + 0.4, top: 5.0 }, { x: rx, z: rz - 0.5, top: 5.6 }, { x: rx + 3.8, z: rz + 0.3, top: 5.2 }];
  pillars.forEach((p, i) => rockPillar(ctx, W, { ...p, bottom: -8.5, r: 1.15, seed: 20 + i }));
  const stub = staticMesh(group, rockGeometry(1, 2, 1, 33, 1), W.rockDark);
  stub.position.set(rx + 1.8, -7, rz + 4);
  logBridge(ctx, W, { x: ravineX(-26), z: -26, y: 5.4, len: 16, ry: -0.1 });
  for (let i = 0; i < 40; i++) {
    const z = -60 + i * 3;
    for (const sgn of [-1, 1]) {
      const m = staticMesh(group, rockGeometry(1 + r() * 1.2, 0.8 + r(), 1.2 + r(), 200 + i * 2 + (sgn > 0 ? 1 : 0), 1), r() < 0.5 ? W.rock : W.rockDark);
      m.position.set(ravineX(z) + sgn * (4.4 + r() * 0.6), -8, z);
    }
  }

  // ---------------------------------------------------------------- 6 · Acantilado, cueva y cascada
  cliff(ctx, B, W, r);
  ctx.addEntity(waterfall(ctx, { x: CLIFF_X - 0.15, z: POOL.z, top: TOP - 0.4, bottom: 5, width: 3.6, ry: -Math.PI / 2, lip: 0.38 }));
  const cx = CLIFF_X + 3.6;
  deco(group, { x: cx, y: CAVE.floor, z: POOL.z, w: 0.9, h: 0.6, d: 0.7, mat: W.plank });
  const relic = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), W.relic);
  relic.position.set(cx, CAVE.floor + 0.9, POOL.z);
  group.add(relic);
  const rg = glowSprite(new THREE.Color(0xffb85a), 1.8, 0.7);
  rg.position.copy(relic.position);
  group.add(rg);
  ctx.addEntity({ update: () => { relic.rotation.y = performance.now() / 700; } });

  // ---------------------------------------------------------------- 7 · Meseta alta: torre de caza y mirador
  const tx = 44;
  const tz = pathZ(tx) - 6;
  huntersTower(ctx, B, W, { x: tx, y: hAt(tx, tz), z: tz, h: 6 });
  const view = flatRock(3.2, 1.6, 2.6, 260, 1, 0.7);
  const vm = staticMesh(group, view.geo, W.rockWarm);
  vm.position.set(63, hAt(63, -10) - 0.3, -10);
  world.addBox({ x: 60.5, y: hAt(63, -10) - 2, z: -12 }, { x: 65.5, y: hAt(63, -10) + view.top - 0.3, z: -8 }, { climbable: true });
  for (let i = 0; i < 26; i++) {
    const x = CLIFF_X + 1 + i * 1.9;
    for (const sgn of [-1, 1]) {
      const m = staticMesh(group, rockGeometry(0.5 + r() * 0.4, 0.3 + r() * 0.2, 0.5 + r() * 0.3, 300 + i * 2 + (sgn > 0 ? 1 : 0), 0), r() < 0.6 ? W.rock : W.moss);
      m.position.set(x, TOP - 0.5, POOL.z + sgn * (1.6 + r() * 0.4));
    }
  }

  // ---------------------------------------------------------------- Exploración: campamento del cazador
  const cy = hAt(CAMP.x, CAMP.z);
  const fire = campfire(ctx, W, { x: CAMP.x, y: cy, z: CAMP.z, light: true });
  ctx.addEntity({ update: (dt) => fire.update(dt, performance.now() / 1000) });
  tent(ctx, W, { x: CAMP.x - 3.2, y: hAt(CAMP.x - 3.2, CAMP.z - 2), z: CAMP.z - 2, ry: 0.5, mat: W.tarpOrange });
  deco(group, { x: CAMP.x + 2.4, y: hAt(CAMP.x + 2.4, CAMP.z - 1.6), z: CAMP.z - 1.6, w: 0.9, h: 0.6, d: 0.6, mat: W.plank });

  // ---------------------------------------------------------------- Gran cañón y puente roto
  const bridge = buildBridge(ctx, B, BM, P);

  // ---------------------------------------------------------------- Fuentes de energía
  const add = (o) => ctx.energySources.register(ctx.addEntity(new EnergySource(ctx, o)));
  const gy = (x, z) => hAt(x, z);
  const generators = {
    debris: add({ kind: 'generator', x: 0.8, y: gy(0.8, -3.6), z: -3.6, yaw: 0 }),
    plateau: add({ kind: 'cabinet', x: 48, y: gy(48, 3.6), z: 3.6, yaw: Math.PI }),
    s0: add({ kind: 'generator', x: 78, y: DECK_Y, z: -2.4, yaw: 0 }),
    pier: add({ kind: 'generator', x: 130.5, y: PIER.top, z: -2.2, yaw: 0 }),
    s1: add({ kind: 'cabinet', x: 150, y: DECK_Y, z: 2.9, yaw: Math.PI }),
    s4: add({ kind: 'generator', x: 172, y: DECK_Y, z: -2.4, yaw: 0 }),
    s5: add({ kind: 'cabinet', x: 186, y: DECK_Y, z: 2.9, yaw: Math.PI }),
  };

  // ---------------------------------------------------------------- Vegetación
  // Las vistas de las cinemáticas (despertar, autobús, ciudad) quedan despejadas
  const sight = [
    [{ x: -44, z: 11 }, { x: -108, z: -60 }], [{ x: -128, z: -28 }, { x: -150, z: -60 }], [{ x: -92, z: -44 }, { x: -112, z: -60 }],
    [{ x: -118, z: -48 }, { x: -109, z: -60 }], [{ x: 242, z: 3 }, { x: 600, z: -10 }],
  ];
  const inSight = (x, z, pad) => sight.some(([a, b]) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < pad;
  });
  const blocked = (x, z) => {
    const dz = Math.abs(z - pathZ(x));
    if (x < 62 && dz < 5.5) return true;
    if (Math.abs(x - creekX(z)) < 4.6 || Math.abs(x - ravineX(z)) < 8) return true;
    if (x > CLIFF_X - 7 && x < CLIFF_X + 4) return true;
    if (Math.hypot(x - POOL.x, z - POOL.z) < 7 || Math.hypot(x - CAMP.x, z - CAMP.z) < 6.5 || Math.hypot(x - tx, z - tz) < 5) return true;
    if (Math.abs(z - POOL.z) < 3 && x > CLIFF_X && x < 62) return true;
    if (Math.hypot(x - WAKE.x, z - WAKE.z) < 9 || Math.abs(z + 60) < 7) return true;
    if (x > OX - 8 && x < OX + 140 && Math.min(x - OX - rimW(z), OX + rimE(z) - x) > -6) return true;
    if (Math.abs(z) < 9 && (x > 56 || x < -175)) return true;
    if (x > 236 && x < 270 && Math.abs(z) < 16) return true;
    // La vista desde la colina: un cono abierto hacia la ciudad
    if (x > 254 && Math.abs(z) < 10 + (x - 254) * 0.6) return true;
    return inSight(x, z, 6);
  };
  const near = [];
  const farTrees = [];
  for (let i = 0; i < 16000 && (near.length < 1900 || farTrees.length < 1700); i++) {
    const x = -198 + r() * 548;
    const z = -228 + r() * 456;
    if (blocked(x, z)) continue;
    const close = Math.abs(z) < 70 && x > -175 && x < 280;
    const t = { x, y: hAt(x, z) - 0.1, z, s: 0.75 + r() * 0.85 };
    if (close && near.length < 1900) near.push(t);
    else if (!close && farTrees.length < 1700) farTrees.push({ ...t, s: t.s + 0.2 });
  }
  pineForest(ctx, near);
  pineForest(ctx, farTrees, { far: true });
  const bushes = [];
  const stones = [];
  for (let i = 0; i < 700; i++) {
    const x = -170 + r() * 420;
    const z = (r() - 0.5) * 120;
    if (blocked(x, z) && !(Math.abs(z - pathZ(x)) > 3.2 && Math.abs(z - pathZ(x)) < 5.5 && x < 60)) continue;
    (r() < 0.75 ? bushes : stones).push({ x, y: hAt(x, z), z, s: 0.35 + r() * 0.6 });
  }
  scatterBushes(ctx, bushes, 0x3c5232);
  scatterRocks(ctx, stones, 0x77726a);
  mountains(group);

  // ---------------------------------------------------------------- La ciudad en el horizonte (sobre su llanura)
  const city = buildCity(group);

  // Límites (muros invisibles): el resto del relieve se ve pero no se recorre
  B.invisibleWall({ x: -174, z: -15, w: 2, d: 180 });
  B.invisibleWall({ x: 302, z: -15, w: 2, d: 180 });
  B.invisibleWall({ x: 64, z: -96, w: 480, d: 2 });
  B.invisibleWall({ x: 64, z: 61, w: 480, d: 2 });

  const at = (x, z, yaw = Math.PI / 2, up = 0.2) => ({ x, y: hAt(x, z) + up, z, yaw });
  const points = {
    // Valle y bosque
    cp18: { x: WAKE.x, y: 0.2, z: WAKE.z, yaw: Math.PI / 2 },
    cp19: at(-42, pathZ(-42)),
    cp20: at(-11, pathZ(-11)),
    cp21: at(0.5, pathZ(0.5)),
    creek: { x: -37, y: 0, z: pathZ(-37) },
    creekEnd: { x: -31, y: 0, z: pathZ(-31) },
    barricade: { x: bx, y: hAt(bx, pathZ(bx)), z: pathZ(bx) },
    terrace: { x: -9, y: hAt(-9, pathZ(-9)), z: pathZ(-9) },
    debris: { x: vx, y: hAt(vx, pathZ(vx)), z: pathZ(vx) },
    debrisShot: at(-10.5, pathZ(vx)),
    generatorUse: at(0.8, -2.1, Math.PI),
    ravine: { x: rx, y: 5.6, z: rz },
    climb: { x: CLIFF_X, y: TOP, z: pathZ(CLIFF_X) },
    plateau: { x: 40, y: hAt(40, pathZ(40)), z: pathZ(40) },
    // Puente
    deckY: DECK_Y,
    cp22: { x: 84, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    clearing: { x: 72, y: DECK_Y, z: 0 },
    bridgeStart: { x: 97, y: DECK_Y, z: 0 },
    cp23: { x: 93, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    gapMid: { x: 104.5, y: DECK_Y + 0.2, z: 0 },
    pier: { x: 129.5, y: PIER.top, z: 0 },
    cp24: { x: 128.4, y: PIER.top + 0.2, z: 0.8, yaw: Math.PI / 2 },
    hangTop: { x: 141, y: DECK_Y, z: 0 },
    cp25: { x: 143, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    block1: { x: 160, y: DECK_Y, z: 0 },
    cp26: { x: 166, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp27: { x: 177, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    block2: { x: 188, y: DECK_Y, z: 0 },
    bridgeEnd: { x: 203, y: DECK_Y, z: 0 },
    cp28: { x: 204, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    hill: at(238, 0),
    hillTop: at(250, 0, Math.PI / 2, 0),
    cp29: at(246, 0),
    city: { x: city.center.x, y: city.center.y, z: city.center.z },
  };

  return {
    spawn: points.cp18,
    sun,
    story: { points, viaduct, bridge, debris, barricade, generators, city, hemi, sky, sun },
  };
}

/** Tronco caído transitable (puente natural) a la altura `y` de su cara superior. */
function logBridge(ctx, M, { x, z, y, len, ry = 0, rad = 0.42 }) {
  const { group, world } = ctx;
  const m = staticMesh(group, new THREE.CylinderGeometry(rad, rad * 1.15, len, 9).rotateZ(Math.PI / 2), M.log);
  m.position.set(x, y - rad, z);
  m.rotation.y = ry;
  const roots = staticMesh(group, rockGeometry(rad * 1.8, rad * 1.8, rad * 1.4, Math.round(x * 3 + z), 0), M.log);
  roots.position.set(x + Math.cos(ry) * len / 2, y - rad, z - Math.sin(ry) * len / 2);
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  world.addBox({ x: x - (len * c + rad * s) / 2, y: y - 2 * rad, z: z - (len * s + rad * c) / 2 }, { x: x + (len * c + rad * s) / 2, y, z: z + (len * s + rad * c) / 2 }, { climbable: false });
}

/**
 * Acantilado entre la repisa (5.5 m) y la meseta (13 m): cajas trepables con
 * estratos de roca, la cueva tras la cascada y la ruta de escalada marcada.
 */
function cliff(ctx, B, M, r) {
  const { group } = ctx;
  const D = 8;
  const seg = (z0, z1, rocks = true) => {
    B.block({ x: CLIFF_X + D / 2, z: (z0 + z1) / 2, w: D, d: z1 - z0, y: -2, h: TOP - 0.1 + 2, mat: M.rockDark, climbable: true });
    if (!rocks) return;
    for (let y = 4.5; y < TOP - 0.6; y += 1.6 + r() * 1.2) {
      for (let z = z0 + 0.8; z < z1 - 0.8; z += 2 + r() * 2.4) {
        const sx = 0.6 + r() * 0.7;
        const sy = 0.5 + r() * 0.8;
        const sz = 1 + r() * 1.6;
        const m = staticMesh(group, rockGeometry(sx, sy, sz, Math.round(y * 31 + z * 7 + 900), 1), r() < 0.5 ? M.rock : M.rockWarm);
        m.position.set(CLIFF_X + sx * 0.35, y + sy * 0.4, z);
      }
    }
  };
  const climbZ = pathZ(CLIFF_X);
  seg(-46, CAVE.z0);
  seg(CAVE.z1, climbZ - 2.4);
  seg(climbZ - 2.4, climbZ + 2.4, false);
  seg(climbZ + 2.4, 46);
  // Ruta de escalada: repisas de roca con el borde marcado en blanco (Tomb Raider)
  for (const [y, dz, w] of [[7.4, -0.6, 2.2], [9.6, 0.5, 1.8], [11.6, -0.3, 2]]) {
    const { geo, top } = flatRock(0.55, 0.5, w * 0.5, Math.round(y * 10), 1, 0.6);
    const m = staticMesh(group, geo, M.rockWarm);
    m.position.set(CLIFF_X - 0.2, y - top, climbZ + dz);
    climbMark(group, M.whiteMark, { x: CLIFF_X - 0.62, y: y + 0.02, z: climbZ + dz, w: 0.1, d: w * 0.8 });
  }
  climbMark(group, M.whiteMark, { x: CLIFF_X - 0.05, y: TOP - 0.05, z: climbZ, w: 0.1, d: 3 });
  for (const dz of [-2.2, 2.2]) deco(group, { x: CLIFF_X - 0.02, y: 5.5, z: climbZ + dz, w: 0.06, h: 7, d: 0.25, mat: M.rockDark, cast: false });
  // Cueva tras la cascada: suelo, dintel y fondo
  B.block({ x: CLIFF_X + CAVE.depth / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: CAVE.depth, d: CAVE.z1 - CAVE.z0, y: 2, h: CAVE.floor - 2, mat: M.rockDark });
  B.block({ x: CLIFF_X + D / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: D, d: CAVE.z1 - CAVE.z0, y: CAVE.top, h: TOP - 1 - CAVE.top, mat: M.rockDark });
  B.block({ x: CLIFF_X + CAVE.depth + (D - CAVE.depth) / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: D - CAVE.depth, d: CAVE.z1 - CAVE.z0, y: CAVE.floor, h: CAVE.top - CAVE.floor, mat: M.rockDark });
  for (let z = -45; z < 45; z += 2.6) {
    if (Math.abs(z - climbZ) < 2 || (z > CAVE.z0 - 1.5 && z < CAVE.z1 + 1.5)) continue;
    const m = staticMesh(group, rockGeometry(0.9 + r() * 0.6, 0.5 + r() * 0.4, 1.4, Math.round(z * 13 + 500), 1), M.rock);
    m.position.set(CLIFF_X + 0.6, TOP - 0.25, z);
  }
}

/**
 * Tierra lejana (sin colisión, barata): rodea los dos terrenos del mapa y
 * baja hacia el este hasta la llanura de la ciudad. Dentro del mapa queda
 * por debajo; en el borde continúa a la misma altura (sin rendijas).
 */
function distantLand(ctx, grass) {
  const NEAR = { x0: -200, x1: 351.5, z0: -231, z1: 231 };
  const height = (x, z) => {
    const cx = Math.min(NEAR.x1, Math.max(NEAR.x0, x));
    const cz = Math.min(NEAR.z1, Math.max(NEAR.z0, z));
    const out = Math.hypot(x - cx, z - cz);
    const edge = groundY(cx, cz);
    if (out === 0) {
      const inside = Math.min(x - NEAR.x0, NEAR.x1 - x, z - NEAR.z0, NEAR.z1 - z);
      return inside < 18 ? groundY(x, z) - 0.6 : edge - 60;
    }
    // Hacia el este: el valle baja hasta la llanura de la ciudad (−20 m) y se allana;
    // frente a la colina no hay lomas que tapen la llanura y sus luces
    const east = smooth(NEAR.x1, 640, x);
    const open = smooth(NEAR.x1, 470, x) * (1 - smooth(110, 320, Math.abs(z)));
    const hills = (Math.min(40, 0.12 * out) + 7 * Math.sin(x * 0.011 + 0.4) * Math.sin(z * 0.013 + 1) * smooth(0, 60, out)) * (1 - east * 0.85) * (1 - open);
    return edge * (1 - east) + -20 * east + hills;
  };
  terrain(ctx, { minX: -760, minZ: -840, maxX: 1520, maxZ: 840, cell: 24, height, simple: true, collide: false, grass, tint: () => 0.85 });
}

/** Cordilleras nevadas al norte y al sur (decorado, una malla cada una). */
function mountains(group) {
  const r = mulberry(9);
  const north = [];
  for (let i = 0; i < 18; i++) north.push({ x: -300 + i * 80 + r() * 30, z: -420 - r() * 160, h: 160 + r() * 160, rad: 110 + r() * 70, y0: -10 });
  const south = [];
  for (let i = 0; i < 12; i++) south.push({ x: -300 + i * 90 + r() * 40, z: 380 + r() * 140, h: 120 + r() * 100, rad: 100 + r() * 50, y0: -10 });
  group.add(
    createMountains(north, { rock: '#56534e', low: '#34402e', snow: '#eef2f6', snowLine: 0.55, seed: 91 }),
    createMountains(south, { rock: '#4a4741', low: '#2f3a2a', snow: '#e6ebf0', snowLine: 0.75, seed: 92 }),
  );
}

/**
 * Viaducto de hormigón (y 14) sobre el valle. El tramo central (x −110…−96)
 * se rompe en el ataque: `setBroken(true)` lo esconde y muestra los restos.
 */
function buildViaduct(ctx, B, M) {
  const { group } = ctx;
  const Y = 14;
  const Z = -60;
  const WD = 9;
  B.block({ x: (-172 + -110) / 2, z: Z, w: 62, d: WD, y: Y - 1.2, h: 1.2, mat: M.concrete, cameraBlocking: false });
  B.block({ x: (-96 + -34) / 2, z: Z, w: 62, d: WD, y: Y - 1.2, h: 1.2, mat: M.concrete, cameraBlocking: false });
  for (const [x0, x1] of [[-172, -110], [-96, -34]]) {
    B.block({ x: (x0 + x1) / 2, z: Z, w: x1 - x0, d: 7, y: Y - 0.02, h: 0.04, mat: M.road, collide: false, cast: false });
    for (const s of [-1, 1]) B.block({ x: (x0 + x1) / 2, z: Z + s * 4.3, w: x1 - x0, d: 0.3, y: Y, h: 0.9, mat: M.concrete, cameraBlocking: false });
  }
  for (const x of [-150, -125, -80, -55]) B.block({ x, z: Z, w: 3, d: 5, y: -2, h: Y + 0.8, mat: M.concrete, cameraBlocking: false });
  const intact = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, WD), M.concrete);
  seg.position.set(-103, Y - 0.6, Z);
  seg.castShadow = true;
  const segRoad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.04, 7), M.road);
  segRoad.position.set(-103, Y, Z);
  intact.add(seg, segRoad);
  group.add(intact);
  const intactBox = ctx.world.addBox({ x: -110, y: Y - 1.2, z: Z - WD / 2 }, { x: -96, y: Y, z: Z + WD / 2 }, { cameraBlocking: false });
  const broken = new THREE.Group();
  const r = mulberry(4);
  for (const [x, s] of [[-110, 1], [-96, -1]]) {
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5 + r() * 1.5, 5), M.steelDark);
      bar.position.set(x + s * (0.5 + r()), Y - 0.6 - r() * 0.5, Z - 3.5 + i * 1.15);
      bar.rotation.set(0, 0, s * (Math.PI / 2 - 0.3 - r() * 0.6));
      broken.add(bar);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4, 0.9, WD * 0.8), M.concrete);
    slab.position.set(x + s * 2.2, Y - 3.2, Z + (r() - 0.5) * 2);
    slab.rotation.set(0, 0, -s * 0.9);
    slab.castShadow = true;
    broken.add(slab);
  }
  for (let i = 0; i < 16; i++) {
    const s = 0.6 + r() * 1.3;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.concrete);
    m.position.set(-110 + r() * 14, groundY(-103, Z) + s * 0.4, Z + (r() - 0.5) * 12);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.castShadow = true;
    broken.add(m);
  }
  group.add(broken);
  const bus = new PrisonBus(ctx, { x: -150, y: Y, z: Z + 1.6, yaw: Math.PI / 2 });
  const vans = [van(group, M, -135, Y, Z + 1.6), van(group, M, -165, Y, Z + 1.6)];
  const handle = {
    bus,
    vans,
    deckY: Y,
    z: Z,
    broken: false,
    setBroken(v) {
      this.broken = v;
      intact.visible = !v;
      broken.visible = v;
      intactBox.enabled = !v;
    },
    /** Deja el autobús colgando del borde roto (estado tras el vuelco). */
    placeWreck() {
      const g = bus.group;
      g.position.set(-108.6, Y - 2.6, Z + 1.2);
      g.rotation.set(0.15, Math.PI / 2, 0);
      g.rotateX(0.95);
      vans[0].position.set(-92, Y, Z - 1.5);
      vans[0].rotation.set(0, Math.PI / 2 + 0.6, 0);
      vans[1].position.set(-128, Y, Z + 2);
      vans[1].rotation.set(0, Math.PI / 2 - 0.3, 0);
    },
  };
  handle.setBroken(false);
  return handle;
}

/** Furgón de la escolta de la PDC. */
function van(group, M, x, y, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.2, 5.4), M.van);
  body.position.y = 1.5;
  body.castShadow = true;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.2 }));
  glass.position.set(0, 2.05, 2.72);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.25, 5.1), new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.6 }));
  stripe.position.y = 1.2;
  const light = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a2a, emissiveIntensity: 2 }));
  light.position.y = 2.68;
  g.add(body, glass, stripe, light);
  for (const [px, pz] of [[-1, 1.8], [1, 1.8], [-1, -1.8], [1, -1.8]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x15171b }));
    w.rotation.z = Math.PI / 2;
    w.position.set(px * 1.1, 0.45, pz);
    g.add(w);
  }
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2;
  group.add(g);
  return g;
}

/**
 * Puente de celosía roto sobre el gran cañón (propuesta v2): cada tramo
 * pide un movimiento distinto. Devuelve los datos que usa el guion.
 */
function buildBridge(ctx, B, M, P) {
  const { group, world } = ctx;
  const Y = DECK_Y;
  // Estribos y carreteras de acceso
  B.block({ x: OX - 4, z: 0, w: 8, d: 10, y: Y - 16, h: 16 - 0.6, mat: M.concrete, climbable: false });
  B.block({ x: OX + 134, z: 0, w: 8, d: 10, y: Y - 16, h: 16 - 0.6, mat: M.concrete, climbable: false });
  for (const [x0, x1] of [[50, OX], [OX + 130, OX + 146]]) B.block({ x: (x0 + x1) / 2, z: 0, w: x1 - x0, d: 7.4, y: Y - 0.4, h: 0.42, mat: M.road, cast: false });

  // 1 · Tramo oeste entero (los drones): barreras y un coche accidentado
  const spanW = trussSpan(M, { len: 31.2, broken: ['end'], seed: 3 });
  spanW.position.set(OX, Y, 0);
  group.add(spanW);
  spanColliders(world, { x0: OX, x1: 100, y: Y });
  pier(ctx, B, M, { x: 94, bottom: groundY(94, 0) - 2, top: Y - 0.6 });
  for (const [x, z, along] of [[78, 1.8, 'x'], [84, -2, 'x'], [91, 1.4, 'z']]) jersey(ctx, B, P, { x, y: Y, z, along, len: 2.6 });
  wreck(ctx, B, P, { x: 87, y: Y, z: 1.9, ry: 0.25 });

  // 2 · Hueco (dash) y tramo caído, inclinado hasta la pila partida
  const T0 = { x: FALLEN.x0 - 1.2, y: FALLEN.y0 + (FALLEN.y0 - FALLEN.y1) / (FALLEN.x1 - FALLEN.x0) * 1.2 };
  const tLen = Math.hypot(FALLEN.x1 - T0.x, FALLEN.y1 - T0.y);
  const spanT = trussSpan(M, { len: tLen, broken: ['start'], seed: 5 });
  spanT.position.set(T0.x, T0.y, 0);
  spanT.rotation.z = Math.atan2(FALLEN.y1 - T0.y, FALLEN.x1 - T0.x);
  group.add(spanT);
  const slope = (FALLEN.y1 - FALLEN.y0) / (FALLEN.x1 - FALLEN.x0);
  world.addRamp({ minX: FALLEN.x0, maxX: FALLEN.x1, minZ: -4, maxZ: 4, axis: 'x', y0: FALLEN.y0, y1: FALLEN.y1, base: FALLEN.y1 - 1.2 });
  for (const s of [-1, 1]) {
    for (let x = FALLEN.x0; x < FALLEN.x1; x += 3.5) {
      const yy = FALLEN.y0 + slope * (x + 1.75 - FALLEN.x0);
      world.addBox({ x, y: yy - 1, z: s > 0 ? 3.75 : -4.4 }, { x: x + 3.5, y: yy + 1.6, z: s > 0 ? 4.4 : -3.75 }, { climbable: false, cameraBlocking: false });
    }
  }

  // 3 · Pila partida a media altura (generador de la PDC encima)
  pier(ctx, B, M, { x: (PIER.x0 + PIER.x1) / 2, bottom: -36, top: PIER.top, w: PIER.x1 - PIER.x0, d: 7, broken: true, seed: 8 });

  // 4 · Tramo descolgado de su bisagra: se trepa por las vigas de piso marcadas
  const spanH = trussSpan(M, { len: 15, broken: ['end'], seed: 9, marks: true });
  spanH.position.set(HANG.hinge.x, HANG.hinge.y, 0);
  spanH.rotation.z = -Math.PI / 2 - 0.14;
  group.add(spanH);
  world.addBox({ x: HANG.lowFace, y: -1.6, z: -3.6 }, { x: HANG.hinge.x + 0.3, y: HANG.lowTop, z: 3.6 }, { climbable: true });
  world.addBox({ x: HANG.highFace, y: HANG.lowTop, z: -3.6 }, { x: HANG.hinge.x + 0.3, y: Y, z: 3.6 }, { climbable: true });
  climbMark(group, M.whiteMark, { x: HANG.highFace - 0.15, y: Y + 0.02, z: 0, w: 0.1, d: 6 });

  // 5 · Tramo este: el primer bloqueo y, al fondo, la barricada de la PDC
  const spanE = trussSpan(M, { len: 60, broken: ['start'], seed: 11 });
  spanE.position.set(HANG.hinge.x, Y, 0);
  group.add(spanE);
  spanColliders(world, { x0: HANG.hinge.x, x1: OX + 130, y: Y });
  pier(ctx, B, M, { x: 170, bottom: groundY(170, 0) - 2, top: Y - 0.6 });
  for (const [x, z] of [[152, -1.8], [158, 2]]) jersey(ctx, B, P, { x, y: Y, z, along: 'x', len: 2.6 });
  truck(ctx, B, P, { x: 190, y: Y, z: -2.4, ry: Math.PI / 2 + 0.2 });
  truck(ctx, B, P, { x: 197, y: Y, z: 2.4, ry: -Math.PI / 2 + 0.2 });
  sandbags(ctx, B, P, { x: 182, y: Y, z: 2, along: 'z', len: 2.4 });
  sandbags(ctx, B, P, { x: 181, y: Y, z: -2.4, along: 'z', len: 1.8 });
  jersey(ctx, B, P, { x: 184.5, y: Y, z: 0, along: 'z', len: 2 });
  floodlight(ctx, B, P, { x: OX + 132, z: -5.5, y: Y, h: 8, aim: { x: 190, z: 0 }, night: false });
  floodlight(ctx, B, P, { x: OX + 132, z: 5.5, y: Y, h: 8, aim: { x: 190, z: 0 }, night: false });
  deco(group, { x: OX + 134.5, y: Y, z: 4, w: 0.15, h: 7, d: 0.15, mat: P.metal });
  banner(ctx, P, { x: OX + 134.5, y: Y + 6.8, z: 4, ry: -Math.PI / 2 });

  // Marcador de aterrizaje del hueco (dash asistido)
  const markers = BRIDGE_GAPS.map((g) => {
    const x = g.to + 2.6;
    const m = new LandingMarker(ctx, { x, y: FALLEN.y0 + slope * (x - FALLEN.x0), z: 0, r: 1.8 });
    ctx.addEntity(m);
    m.setVisible(false);
    return m;
  });
  return { spans: BRIDGE_SPANS, gaps: BRIDGE_GAPS, markers, deckY: Y, fallen: FALLEN, pier: PIER, hang: HANG };
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
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.userData.levelStatic = true;
    }
  });
  ctx.group.add(g);
  B.block({ x, z, w: 4.4, d: 2.4, y, h: 1.6, mat: P.metal }).visible = false;
}

/**
 * Ciudad lejana: torres con ventanas encendidas sobre su llanura (sin
 * niebla para que se distinga desde la colina), luces de las calles a ras
 * de suelo, bruma luminosa y la antena roja de la torre más alta.
 */
function buildCity(group) {
  // Velada por la bruma del valle (niebla suave): desde el bosque apenas se
  // intuye; en la colina la niebla se abre y aparece entera
  const towers = createCity({ origin: { x: 300, y: -20, z: 0 }, seed: 33, fog: CITY_HAZE });
  group.add(towers);
  // Torre emblema bajo la aguja
  group.add(cityTowers([{ x: 960, y: -20, z: -10, w: 34, d: 30, h: 220, ry: 0.2, tone: 1.1 }], { lit: 0.4, intensity: 1, fog: CITY_HAZE }));
  // Luces de las calles y de los barrios bajos: la ciudad se apoya en el suelo
  const r = mulberry(55);
  const n = 900;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = (r() - 0.5) * 1.5;
    const d = 560 + r() * 420;
    pos.set([300 + Math.cos(a) * d, -19.4 + r() * 1.5, Math.sin(a) * d], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(geo, softFog(new THREE.PointsMaterial({ map: glowTexture(), color: 0xffc27a, size: 7, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), CITY_HAZE));
  group.add(dots);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1400, 260), softFog(new THREE.MeshBasicMaterial({ color: 0xffb27a, transparent: true, opacity: 0.12, depthWrite: false }), CITY_HAZE));
  glow.position.set(1050, 90, 0);
  glow.rotation.y = -Math.PI / 2;
  group.add(glow);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 120, 6), softFog(new THREE.MeshStandardMaterial({ color: 0x2a3038, emissive: 0xff3030, emissiveIntensity: 0.6 }), CITY_HAZE));
  spire.position.set(960, 260, -10);
  group.add(spire);
  return { towers, center: { x: 960, y: 120, z: 0 } };
}

export default Forest;
