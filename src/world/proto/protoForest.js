import * as THREE from 'three';
import { createSky, createSun, createMountains } from '../environment.js';
import { createWater } from '../water.js';
import { grassTexture, dirtTexture, rockTexture } from '../textures.js';
import { terrain } from '../kit/terrain.js';
import {
  wildMaterials, campfire, steppingStones, rockPillar, crackedBoulder, plankBarricade, waterfall,
  huntersTower, tent, flatRock,
} from '../kit/wild.js';
import { deco, staticMesh, rockGeometry, climbMark } from '../kit/common.js';
import { glowSprite } from '../../vfx/glowTexture.js';
import { pineForest, scatterBushes, scatterRocks, mulberry } from '../../story/props.js';

/**
 * PROTOTIPO v2 · BOSQUE JUGABLE. Un recorrido de oeste a este con relieve
 * de verdad (terreno con colisión) y un reto distinto en cada tramo:
 *
 *   prado (despertar) → arroyo con piedras para saltar → barricada de
 *   tablones (se rompe a golpes) → cuesta del bosque → roca con vetas
 *   (se rompe con Energía) → barranco con pilares de roca (saltos) →
 *   repisa con la cascada y la cueva escondida detrás → pared de escalada
 *   marcada → meseta alta con la torre de caza (mirador) → borde del cañón.
 *
 * Exploración opcional: campamento del cazador (diario), tronco caído que
 * cruza el barranco por el norte, cueva tras la cascada (reliquia), cima de
 * la torre.
 */

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Centro de la senda (serpentea un poco). */
export const pathZ = (x) => 3 * Math.sin(x * 0.05);
const creekX = (z) => -36 + 2.5 * Math.sin(z * 0.11);
const ravineX = (z) => 8.5 + 1.2 * Math.sin(z * 0.09 + 0.6);
const POOL = { x: 21.5, z: -16 };
const CLIFF_X = 26;
const TOP = 13;
const CAVE = { z0: -17.5, z1: -14.5, top: 9, floor: 5.5, depth: 6 };

const CAMP = { x: -14, z: -19 };

/** Altura del terreno bajo (oeste del acantilado), sin rellanos. */
function lowBase(x, z) {
  const dz = Math.abs(z - pathZ(x));
  let y = 5 * smooth(-28, -6, x) + 0.5 * smooth(17, 24, x);
  // La repisa entre el barranco y el acantilado es llana (se recorre a lo largo)
  const shelf = 1 - 0.85 * smooth(12, 18, x);
  // Laderas a los lados: el bosque encajona la senda
  y += 3.4 * smooth(8, 30, dz) * (0.7 + 0.3 * Math.sin(x * 0.04 + 1)) * shelf;
  const n = 0.55 * Math.sin(x * 0.13 + z * 0.07) + 0.35 * Math.sin(x * 0.07 - z * 0.17 + 1.3) + 0.2 * Math.sin(x * 0.31 + z * 0.23);
  y += n * smooth(2.5, 8, dz) * shelf;
  return y + far(x, z);
}

/** Fuera del recorrido el terreno sigue (colinas cada vez más altas) hasta la niebla. */
function far(x, z) {
  const f = Math.max(0, Math.abs(z) - 40) + Math.max(0, -64 - x);
  return 0.1 * f + 4 * Math.sin(x * 0.031 + 0.5) * Math.sin(z * 0.027) * smooth(0, 40, f);
}
const CAMP_Y = lowBase(CAMP.x, CAMP.z);

/** Altura del terreno bajo (oeste del acantilado). */
function lowHeight(x, z) {
  let y = lowBase(x, z);
  // Rellano del campamento del cazador
  const k = 1 - smooth(4.5, 7.5, Math.hypot(x - CAMP.x, z - CAMP.z));
  y += (CAMP_Y - y) * k;
  // Arroyo
  y -= 1.4 * (1 - smooth(2.2, 4.4, Math.abs(x - creekX(z))));
  // Barranco (paredes casi verticales, fondo a −6)
  y = Math.min(y, -6 + 30 * smooth(5.2, 7.4, Math.abs(x - ravineX(z))));
  // Poza al pie de la cascada
  y = Math.min(y, 4 + 1.6 * smooth(2.5, 4.6, Math.hypot(x - POOL.x, z - POOL.z)));
  // Boca de la cueva: el suelo sigue llano hacia dentro
  if (x > 22) y = Math.min(y, CAVE.floor - 0.05 + 3 * smooth(2, 4, Math.abs(z - POOL.z)));
  return y;
}

/** Altura de la meseta alta (este del acantilado) con el cauce del arroyo. */
function highHeight(x, z) {
  const dz = Math.abs(z - pathZ(x));
  let y = TOP + (0.5 * Math.sin(x * 0.11 + z * 0.09) + 0.3 * Math.sin(x * 0.05 - z * 0.13)) * smooth(3, 9, dz) * smooth(28, 34, x);
  y += 2.5 * smooth(14, 34, dz) * smooth(30, 40, x);
  // Cauce que acaba en la cascada
  y -= 0.9 * (1 - smooth(1.1, 2.4, Math.abs(z - POOL.z)));
  // Borde del cañón al este (la otra orilla, lejos)
  y -= 48 * smooth(67, 73, x) - 50 * smooth(104, 112, x);
  return y + far(x, z);
}

function buildForest(ctx) {
  const { group, builder: B, scene, world } = ctx;
  const sunDir = new THREE.Vector3(-0.72, 0.3, 0.45).normalize();
  scene.fog = new THREE.FogExp2(0xc7b9a8, 0.0058);
  group.add(createSky({ top: '#3e5a82', horizon: '#f2c08e', bottom: '#5a6470', sunDir, sunColor: '#ffcf98', clouds: 0.4, cloudColor: '#fff0dc', cloudShade: '#988a8c' }));
  group.add(new THREE.HemisphereLight(0xc6d4e6, 0x4a4434, 1.0));
  const sun = createSun({ color: '#ffd2a0', intensity: 2.3, direction: sunDir.clone().negate(), shadowSize: 70 });
  group.add(sun, sun.target);
  const M = wildMaterials();
  const r = mulberry(21);
  const grass = grassTexture('#55663f', 81);
  const dirt = dirtTexture('#6a5440', 95);
  const rock = rockTexture('#6e6a63', 83);

  // ---------------------------------------------------------------- Terreno
  const splat = (top) => (x, z, y, slope) => {
    const dz = Math.abs(z - pathZ(x));
    const path = 1 - smooth(1.4, 2.8, dz);
    const bank = top ? 1 - smooth(1.6, 3, Math.abs(z - POOL.z)) : 1 - smooth(3, 5, Math.abs(x - creekX(z)));
    const pool = top ? 0 : 1 - smooth(3.5, 5.5, Math.hypot(x - POOL.x, z - POOL.z));
    return [Math.max(path, bank * 0.9, pool), smooth(0.75, 1.3, slope) + (y < -1 ? 0.6 : 0)];
  };
  const tint = (x, z) => 0.9 + 0.12 * Math.sin(x * 0.21 + z * 0.17) + 0.06 * Math.sin(x * 0.6 - z * 0.4);
  const low = terrain(ctx, { minX: -200, minZ: -170, maxX: 28, maxZ: 170, cell: 1.5, height: lowHeight, splat: splat(false), tint, grass, dirt, rock });
  const high = terrain(ctx, { minX: CLIFF_X, minZ: -170, maxX: 140, maxZ: 170, cell: 1.5, height: highHeight, splat: splat(true), tint, grass, dirt, rock });
  const hAt = (x, z) => (x < CLIFF_X ? low.heightAt(x, z) : high.heightAt(x, z));

  // Agua: arroyo, fondo del barranco, poza y cauce alto
  const creek = createWater({ width: 15, depth: 100, color: 0x35535a, speed: 2.6, repeat: 10 });
  creek.position.set(-36, -0.72, 0);
  group.add(creek);
  const river = createWater({ width: 10, depth: 100, color: 0x2f4f5c, speed: 3, repeat: 10 });
  river.position.set(8.5, -5.3, 0);
  group.add(river);
  const pool = createWater({ width: 10, depth: 10, color: 0x2e5560, speed: 1.4, repeat: 4 });
  pool.position.set(POOL.x, 5, POOL.z);
  group.add(pool);
  const stream = createWater({ width: 34, depth: 3.2, color: 0x35535a, speed: 2.2, repeat: 8 });
  stream.position.set(CLIFF_X + 17, TOP - 0.45, POOL.z);
  group.add(stream);

  // ---------------------------------------------------------------- 1 · Arroyo
  const sx = -36;
  const sz = pathZ(sx);
  steppingStones(ctx, M, [
    { x: sx - 3.4, z: sz + 0.3, top: -0.25, s: 1.1 },
    { x: sx - 1.2, z: sz - 0.4, top: -0.15, s: 1 },
    { x: sx + 1.1, z: sz + 0.5, top: -0.3, s: 1.15 },
    { x: sx + 3.2, z: sz - 0.2, top: -0.2, s: 1 },
  ]);
  // Tronco caído aguas arriba (otra forma de cruzar)
  logBridge(ctx, M, { x: creekX(14), z: 14, y: 0.4, len: 11, ry: 0.15 });

  // ---------------------------------------------------------------- 2 · Barricada de tablones
  const bx = -26.5;
  plankBarricade(ctx, M, { x: bx, y: hAt(bx, pathZ(bx)) - 0.1, z: pathZ(bx), w: 6.5 });
  for (const sgn of [-1, 1]) {
    const m = staticMesh(group, rockGeometry(2.2, 2.2, 3.4, 140 + sgn, 1), M.rock);
    m.position.set(bx, hAt(bx, pathZ(bx) + sgn * 5.5) + 0.6, pathZ(bx) + sgn * 5.5);
    B.block({ x: bx, z: pathZ(bx) + sgn * 5.2, w: 3, d: 3.2, y: m.position.y - 2, h: 4.2, mat: M.rock, collide: true }).visible = false;
  }

  // ---------------------------------------------------------------- 3 · Cuesta con raíces y rocas
  for (let i = 0; i < 9; i++) {
    const x = -24 + i * 2.2;
    const side = i % 2 ? 1 : -1;
    const z = pathZ(x) + side * (2.6 + r() * 1.2);
    const m = staticMesh(group, rockGeometry(0.7 + r() * 0.6, 0.5 + r() * 0.4, 0.8, 160 + i, 1), r() < 0.5 ? M.rock : M.rockWarm);
    m.position.set(x, hAt(x, z), z);
  }
  // Raíces que cruzan la senda (escalones naturales)
  for (const x of [-21, -16.5, -12]) {
    const root = staticMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 5, 6).rotateX(Math.PI / 2), M.log);
    root.position.set(x, hAt(x, pathZ(x)) + 0.06, pathZ(x));
    root.rotation.y = 0.3;
  }

  // ---------------------------------------------------------------- 4 · Roca con vetas (Energía)
  const vx = -3;
  const boulder = crackedBoulder(ctx, M, { x: vx, y: hAt(vx, pathZ(vx)) - 0.2, z: pathZ(vx), r: 1.9, seed: 7 });
  ctx.addEntity({ update: (dt) => boulder.update(dt, performance.now() / 1000) });
  for (const sgn of [-1, 1]) {
    const z = pathZ(vx) + sgn * 4.6;
    const m = staticMesh(group, rockGeometry(2.6, 3.4, 2.4, 180 + sgn, 1), M.rockWarm);
    m.position.set(vx + 0.5, hAt(vx, z) + 1, z);
    B.block({ x: vx + 0.5, z: pathZ(vx) + sgn * 3.6, w: 4, d: 3, y: hAt(vx, z) - 1, h: 6, mat: M.rock }).visible = false;
  }

  // ---------------------------------------------------------------- 5 · Barranco y pilares
  const rz = pathZ(ravineX(0));
  const rx = ravineX(rz);
  const pillars = [
    { x: rx - 3.7, z: rz + 0.4, top: 5.0 },
    { x: rx, z: rz - 0.5, top: 5.6 },
    { x: rx + 3.8, z: rz + 0.3, top: 5.2 },
  ];
  pillars.forEach((p, i) => rockPillar(ctx, M, { ...p, bottom: -6, r: 1.15, seed: 20 + i }));
  // Pilar roto (no aguanta: solo decorado, se ve que falta uno)
  const stub = staticMesh(group, rockGeometry(1, 2, 1, 33, 1), M.rockDark);
  stub.position.set(rx + 1.8, -4.5, rz + 4);
  // Tronco caído que cruza el barranco más al norte (ruta alternativa con equilibrio)
  logBridge(ctx, M, { x: ravineX(-26), z: -26, y: 5.4, len: 16, ry: -0.1 });
  // Rocas al pie de las paredes del barranco
  for (let i = 0; i < 30; i++) {
    const z = -44 + i * 3;
    for (const sgn of [-1, 1]) {
      const m = staticMesh(group, rockGeometry(1 + r() * 1.2, 0.8 + r(), 1.2 + r(), 200 + i * 2 + (sgn > 0 ? 1 : 0), 1), r() < 0.5 ? M.rock : M.rockDark);
      m.position.set(ravineX(z) + sgn * (4.4 + r() * 0.6), -5.6, z);
    }
  }

  // ---------------------------------------------------------------- 6 · Acantilado, cueva y cascada
  cliff(ctx, B, M, r, hAt);
  const fall = waterfall(ctx, { x: CLIFF_X - 0.15, z: POOL.z, top: TOP - 0.4, bottom: 5, width: 3.6, ry: -Math.PI / 2, lip: 0.38 });
  ctx.addEntity(fall);
  // Reliquia en la cueva (coleccionable)
  const cx = CLIFF_X + 3.6;
  deco(group, { x: cx, y: CAVE.floor, z: POOL.z, w: 0.9, h: 0.6, d: 0.7, mat: M.plank });
  const relic = staticMesh(group, new THREE.OctahedronGeometry(0.22, 0), M.relic, { cast: false });
  relic.position.set(cx, CAVE.floor + 0.9, POOL.z);
  const rg = glowSprite(new THREE.Color(0xffb85a), 1.8, 0.7);
  rg.position.copy(relic.position);
  group.add(rg);
  const rl = new THREE.PointLight(0xffb060, 6, 7, 1.5);
  rl.position.set(cx - 0.6, CAVE.floor + 1.4, POOL.z);
  group.add(rl);
  ctx.addEntity({ update: () => { relic.rotation.y = performance.now() / 700; } });

  // ---------------------------------------------------------------- 7 · Meseta alta: torre de caza y mirador
  const tx = 44;
  const tz = pathZ(tx) - 6;
  huntersTower(ctx, B, M, { x: tx, y: hAt(tx, tz), z: tz, h: 6 });
  // Mirador de roca en el borde del cañón
  const vxx = 63;
  const view = flatRock(3.2, 1.6, 2.6, 260, 1, 0.7);
  const vm = staticMesh(group, view.geo, M.rockWarm);
  vm.position.set(vxx, hAt(vxx, pathZ(vxx)) - 0.3, pathZ(vxx));
  B.block({ x: vxx, z: pathZ(vxx), w: 5, d: 4, y: hAt(vxx, pathZ(vxx)) - 2, h: 2 + view.top - 0.3, mat: M.rock }).visible = false;
  // Piedras a los lados del cauce alto
  for (let i = 0; i < 26; i++) {
    const x = CLIFF_X + 1 + i * 1.9;
    for (const sgn of [-1, 1]) {
      const m = staticMesh(group, rockGeometry(0.5 + r() * 0.4, 0.3 + r() * 0.2, 0.5 + r() * 0.3, 300 + i * 2 + (sgn > 0 ? 1 : 0), 0), r() < 0.6 ? M.rock : M.moss);
      m.position.set(x, TOP - 0.5, POOL.z + sgn * (1.6 + r() * 0.4));
    }
  }

  // ---------------------------------------------------------------- Exploración: campamento del cazador
  const camp = CAMP;
  const cy = hAt(camp.x, camp.z);
  const fire = campfire(ctx, M, { x: camp.x, y: cy, z: camp.z, light: true });
  ctx.addEntity({ update: (dt) => fire.update(dt, performance.now() / 1000) });
  tent(ctx, M, { x: camp.x - 3.2, y: hAt(camp.x - 3.2, camp.z - 2), z: camp.z - 2, ry: 0.5, mat: M.tarpOrange });
  deco(group, { x: camp.x + 2.4, y: hAt(camp.x + 2.4, camp.z - 1.6), z: camp.z - 1.6, w: 0.9, h: 0.6, d: 0.6, mat: M.plank });
  deco(group, { x: camp.x + 2.4, y: hAt(camp.x + 2.4, camp.z - 1.6) + 0.6, z: camp.z - 1.6, w: 0.32, h: 0.05, d: 0.24, mat: M.relic, cast: false });

  // ---------------------------------------------------------------- Vegetación
  // Las líneas de visión de los planos de la propuesta quedan despejadas
  const sight = ProtoForest.shots.map((sh) => ({ a: sh.pos, b: sh.look }));
  const inSight = (x, z, pad) => sight.some(({ a, b }) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(0.55, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < pad || Math.hypot(x - a.x, z - a.z) < pad * 2;
  });
  const trees = [];
  for (let i = 0; i < 9000 && trees.length < 2600; i++) {
    const near = i < 2500;
    const x = near ? -71 + r() * 146 : -200 + r() * 300;
    const z = near ? -45 + r() * 90 : -170 + r() * 340;
    if (x > 66 && x < 110) continue;
    if (inSight(x, z, 4.5)) continue;
    const dz = Math.abs(z - pathZ(x));
    if (dz < 5.5 + r() * 2) continue;
    if (Math.abs(x - creekX(z)) < 4.6) continue;
    if (Math.abs(x - ravineX(z)) < 8) continue;
    if (x > CLIFF_X - 7 && x < CLIFF_X + 4) continue;
    if (Math.hypot(x - POOL.x, z - POOL.z) < 7) continue;
    if (Math.hypot(x - camp.x, z - camp.z) < 6.5) continue;
    if (Math.hypot(x - tx, z - tz) < 5 || Math.abs(z - POOL.z) < 3 && x > CLIFF_X) continue;
    trees.push({ x, y: hAt(x, z) - 0.1, z, s: 0.75 + r() * 0.85 });
  }
  pineForest(ctx, trees);
  const bushes = [];
  for (let i = 0; i < 260; i++) {
    const x = -70 + r() * 136;
    const z = pathZ(x) + (r() < 0.5 ? -1 : 1) * (3.2 + r() * 14);
    if (Math.abs(x - ravineX(z)) < 7 || (x > CLIFF_X - 3 && x < CLIFF_X + 2) || inSight(x, z, 2.5)) continue;
    bushes.push({ x, y: hAt(x, z), z, s: 0.4 + r() * 0.6 });
  }
  scatterBushes(ctx, bushes, 0x3c5232);
  const stones = [];
  for (let i = 0; i < 90; i++) {
    const x = -70 + r() * 136;
    const z = -44 + r() * 88;
    if (Math.abs(z - pathZ(x)) < 2.2 || Math.abs(x - ravineX(z)) < 7) continue;
    stones.push({ x, y: hAt(x, z), z, s: 0.25 + r() * 0.5 });
  }
  scatterRocks(ctx, stones, 0x77726a);

  group.add(createMountains([
    { x: -150, z: -220, rad: 110, h: 170 }, { x: 10, z: -250, rad: 120, h: 210 }, { x: 150, z: -220, rad: 100, h: 160 },
    { x: 320, z: -60, rad: 120, h: 190 }, { x: 300, z: 140, rad: 110, h: 150 }, { x: -240, z: 60, rad: 120, h: 140 },
    { x: -40, z: 240, rad: 130, h: 160 }, { x: 140, z: 230, rad: 100, h: 130 },
  ], { rock: '#56534e', low: '#34402e', snow: '#eef2f6', snowLine: 0.55, seed: 91 }));

  const spawn = { x: -56, y: hAt(-56, pathZ(-56)) + 0.2, z: pathZ(-56), yaw: Math.PI / 2 };
  return { spawn, sun, story: { hAt, pillars, ravineX, creekX } };
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
function cliff(ctx, B, M, r, hAt) {
  const { group } = ctx;
  const D = 8;
  const seg = (z0, z1, deco = true) => {
    B.block({ x: CLIFF_X + D / 2, z: (z0 + z1) / 2, w: D, d: z1 - z0, y: -2, h: TOP - 0.1 + 2, mat: M.rockDark, climbable: true });
    if (!deco) return;
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
  // Grietas verticales a los lados de la ruta (se lee como un camino)
  for (const dz of [-2.2, 2.2]) deco(group, { x: CLIFF_X - 0.02, y: 5.5, z: climbZ + dz, w: 0.06, h: 7, d: 0.25, mat: M.rockDark, cast: false });
  // Cueva tras la cascada: suelo, dintel y fondo
  B.block({ x: CLIFF_X + CAVE.depth / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: CAVE.depth, d: CAVE.z1 - CAVE.z0, y: 2, h: CAVE.floor - 2, mat: M.rockDark });
  B.block({ x: CLIFF_X + D / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: D, d: CAVE.z1 - CAVE.z0, y: CAVE.top, h: TOP - 1 - CAVE.top, mat: M.rockDark });
  B.block({ x: CLIFF_X + CAVE.depth + (D - CAVE.depth) / 2, z: (CAVE.z0 + CAVE.z1) / 2, w: D - CAVE.depth, d: CAVE.z1 - CAVE.z0, y: CAVE.floor, h: CAVE.top - CAVE.floor, mat: M.rockDark });
  // Rocas del borde de la meseta (el borde superior no es una línea recta)
  for (let z = -45; z < 45; z += 2.6) {
    if (Math.abs(z - climbZ) < 2 || (z > CAVE.z0 - 1.5 && z < CAVE.z1 + 1.5)) continue;
    const m = staticMesh(group, rockGeometry(0.9 + r() * 0.6, 0.5 + r() * 0.4, 1.4, Math.round(z * 13 + 500), 1), M.rock);
    m.position.set(CLIFF_X + 0.6, TOP - 0.25, z);
  }
  void hAt;
}

export const ProtoForest = {
  id: 'proto-bosque', name: 'Prototipo · Bosque', description: 'Propuesta v2', envIntensity: 0.5,
  grade: { contrast: 1.05, saturation: 1.08, shadows: '#283246', highlights: '#ffd6a0', split: 0.07, vignette: 0.28 },
  fillLight: { color: 0xffe2c0, intensity: 0.35 },
  shots: [
    { id: 'ruta', title: 'El recorrido completo', pos: { x: -36, y: 64, z: 50 }, look: { x: 4, y: 0, z: -8 }, fog: 0.0028 },
    { id: 'arroyo', title: 'Arroyo: piedras para saltar', pos: { x: -43, y: 1.2, z: -0.5 }, look: { x: -31, y: 0.2, z: -4.5 }, jon: { x: -37.2, y: 0.2, z: -3.1, yaw: Math.PI / 2 } },
    { id: 'barricada', title: 'Barricada de la PDC (se rompe a golpes)', pos: { x: -33, y: 2.2, z: 1.6 }, look: { x: -24, y: 1.2, z: -3.4 }, jon: { x: -28.6, y: 0.6, z: -2.2, yaw: Math.PI / 2 } },
    { id: 'cuesta', title: 'La cuesta y la roca con vetas de Energía', pos: { x: -24.5, y: 1.9, z: -1.2 }, look: { x: -4, y: 6, z: -0.8 }, jon: { x: -15, y: 3, z: -2, yaw: Math.PI / 2 } },
    { id: 'saltos', title: 'Barranco: saltos entre pilares', pos: { x: 0.5, y: 8.6, z: 8.5 }, look: { x: 13, y: 2.5, z: -0.5 }, jon: { x: 9.2, y: 5.8, z: 0, yaw: Math.PI / 2 } },
    { id: 'cascada', title: 'Cascada con cueva escondida', pos: { x: 14.5, y: 7.6, z: -4.5 }, look: { x: 25, y: 8.4, z: -16 }, jon: { x: 21, y: 5.7, z: -10.5, yaw: -0.3 } },
    { id: 'escalada', title: 'Pared de escalada marcada', pos: { x: 16.5, y: 7.4, z: 7.5 }, look: { x: 26, y: 10.2, z: 2.9 }, jon: { x: 24.6, y: 5.7, z: 3.2, yaw: Math.PI / 2 } },
    { id: 'mirador', title: 'El mirador sobre el cañón', pos: { x: 54, y: 19, z: 8 }, look: { x: 95, y: -6, z: -4 }, jon: { x: 63, y: 14.6, z: 0, yaw: Math.PI / 2 } },
  ],
  build: buildForest,
};
