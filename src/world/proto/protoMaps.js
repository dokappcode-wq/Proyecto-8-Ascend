import * as THREE from 'three';
import { createSky, createSun, createMountains, createCity } from '../environment.js';
import { createWater } from '../water.js';
import { grassTexture, rockTexture, cobbleTexture } from '../textures.js';
import { villageMaterials, fishermanHouse, lighthouse, fishingBoat, quay, church, laundryLine, climbMark, lampPost } from '../kit/village.js';
import { wildMaterials, logCabin, campfire, ropeBridge, canyonWall, fallenLog } from '../kit/wild.js';
import { cityMaterials, cityBuilding, monorail, pdcCheckpoint, car, streetLight, neonSign } from '../kit/city.js';
import { deco, staticMesh, rockGeometry } from '../kit/common.js';
import { pineForest, scatterBushes, scatterRocks, Rain, mulberry } from '../../story/props.js';

/**
 * PROTOTIPOS DE LA PROPUESTA DE MAPAS (solo para capturas: se registran con
 * `?proto` en la URL). Cada uno es una viñeta pequeña con el estilo
 * propuesto para un mapa, construida con el kit (`world/kit/`), y trae sus
 * planos de cámara (`shots`).
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

// ================================================================= Pueblo
function buildVillageProto(ctx, night) {
  const { group, builder: B, scene } = ctx;
  const sunDir = night ? new THREE.Vector3(-0.35, 0.45, 0.8) : new THREE.Vector3(0.55, 0.42, 0.7);
  scene.fog = new THREE.FogExp2(night ? 0x34465f : 0xb9c8d4, night ? 0.0085 : 0.0042);
  const sky = createSky(night
    ? { top: '#0a1424', horizon: '#3d5577', bottom: '#0c1220', sunDir, sunColor: '#9fb6d6', clouds: 0.75, cloudColor: '#34445c', cloudShade: '#151d2a', stars: 0.6, moonDir: new THREE.Vector3(0.35, 0.55, 0.75) }
    : { top: '#3f74ad', horizon: '#eadbc0', bottom: '#5a6a76', sunDir, sunColor: '#fff0c8', clouds: 0.45, cloudColor: '#ffffff', cloudShade: '#b8c2cc' });
  group.add(sky);
  group.add(new THREE.HemisphereLight(night ? 0x7393c8 : 0xc4dbf0, night ? 0x2c2e3a : 0x6a5a48, night ? 1.35 : 1.1));
  const sun = createSun({ color: night ? '#a9bfe6' : '#ffe6c0', intensity: night ? 1.5 : 2.4, direction: sunDir.clone().negate(), shadowSize: 60 });
  group.add(sun, sun.target);
  const M = villageMaterials(night);
  const grass = new THREE.MeshStandardMaterial({ map: tex(grassTexture('#4b5e3c', 67)), roughness: 1 });
  const rock = new THREE.MeshStandardMaterial({ map: tex(rockTexture('#6a655c', 66)), roughness: 1, flatShading: true });

  // Suelo: calles empedradas, plaza y colina
  B.block({ x: 0, z: -10, w: 120, d: 76, y: -1, h: 1, mat: M.paving, cast: false });
  B.block({ x: 0, z: -4, w: 22, d: 14, y: 0, h: 0.05, mat: new THREE.MeshStandardMaterial({ map: tex(cobbleTexture('#9a8f7f', 69)), roughness: night ? 0.45 : 0.85 }), cast: false, collide: false });
  B.block({ x: -5, z: -52, w: 120, d: 20, y: -1, h: 4, mat: grass, cast: false });
  // Muro de contención de la colina con escalera
  B.block({ x: -5, z: -42.3, w: 120, d: 0.6, y: 0, h: 3, mat: M.stone });
  B.stairs({ x: -24, z: -38, width: 2.4, axis: 'z', dir: -1, y0: 0, y1: 3, mat: M.stoneDark });

  // Mar y muelle
  const sea = createWater({ width: 500, depth: 300, color: night ? 0x0b1828 : 0x24506a, night, repeat: 60 });
  sea.position.set(0, -1.6, 180);
  group.add(sea);
  quay(ctx, B, M, { x0: -40, x1: 44, z: 28, night });
  // Espigón con rocas hasta el faro
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const x = -38 - t * 10;
    const z = 30 + t * 22;
    const m = staticMesh(group, rockGeometry(1.8, 1.2, 1.8, 30 + i, 1), rock);
    m.position.set(x + (i % 2) * 1.2, -1, z);
  }
  B.block({ x: -43, z: 41, w: 3, d: 24, y: -1, h: 1.6, mat: M.stoneDark });
  const lh = lighthouse(ctx, M, { x: -48, z: 53, y: 0.6, night });
  ctx.addEntity({ update: lh.update });
  fishingBoat(ctx, M, { x: -24, z: 33, ry: 0.1, color: 'hullRed' });
  fishingBoat(ctx, M, { x: -12, z: 34, ry: -0.08, color: 'hullBlue', len: 7 });
  fishingBoat(ctx, M, { x: 2, z: 33.5, ry: 0.05, color: 'hullGreen' });
  fishingBoat(ctx, M, { x: 18, z: 35, ry: -0.2, color: 'hullWhite', len: 5 });

  // Fila del puerto: casas altas de colores mirando al mar (fachada +Z)
  const harbor = [
    { x: -31, w: 7, h: 11.6, wall: 'plasterWhite', wood: 'green' },
    { x: -23.5, w: 7, h: 8.7, wall: 'plasterCream', wood: 'red' },
    { x: -16, w: 7, h: 11.6, wall: 'plasterWhite', wood: 'blue' },
    { x: -8.5, w: 7, h: 14.5, wall: 'plasterRose', wood: 'green' },
    // Pasaje bajo arco hacia la plaza (x −5…−3)
    { x: 1.5, w: 8, h: 11.6, wall: 'plasterWhite', wood: 'red' },
    { x: 9.5, w: 7, h: 8.7, wall: 'plasterCream', wood: 'blue' },
    { x: 17, w: 7, h: 11.6, wall: 'plasterWhite', wood: 'green' },
    { x: 24.5, w: 7, h: 8.7, wall: 'plasterRose', wood: 'red' },
  ];
  for (const [i, h] of harbor.entries()) fishermanHouse(ctx, B, M, { x: h.x, z: 15, w: h.w, d: 9, h: h.h }, { front: 1, roof: 'gable', wall: h.wall, wood: h.wood, seed: 200 + i, balcony: true, shop: i % 2 === 0 });
  // Arco del pasaje
  deco(group, { x: -4, y: 4.4, z: 15, w: 2.6, h: 4.2, d: 9, mat: M.stone });
  laundryLine(group, M, { x0: -12, z0: 10.6, x1: -12, z1: 19.4, y: 7.2 });

  // Plaza: fila norte con azoteas (ruta de tejados) y casas a dos aguas
  const north = [
    { x: -24, w: 8, h: 8.7, roof: 'gable' },
    { x: -15, w: 8, h: 11.6, roof: 'flat' },
    { x: -6.5, w: 7, h: 8.7, roof: 'flat' },
    { x: 2, w: 8, h: 11.6, roof: 'flat' },
    { x: 11, w: 8, h: 8.7, roof: 'gable' },
    { x: 20, w: 8, h: 11.6, roof: 'gable' },
  ];
  for (const [i, h] of north.entries()) fishermanHouse(ctx, B, M, { x: h.x, z: -17, w: h.w, d: 9, h: h.h }, { front: 1, roof: h.roof, seed: 300 + i, balcony: i % 2 === 1, shop: i === 2 });
  // Ruta de tejados (inFamous + Tomb Raider): tablones entre azoteas, escalera
  // de mano para subir a la más alta y bordes agarrables marcados en blanco
  deco(group, { x: -10.4, y: 8.7, z: -17, w: 2.2, h: 0.12, d: 0.9, mat: M.wood, rz: -0.25 });
  deco(group, { x: -2, y: 8.7, z: -16, w: 2.4, h: 0.12, d: 0.9, mat: M.wood, rz: 0.25 });
  for (let i = 0; i < 8; i++) deco(group, { x: -2.6, y: 8.9 + i * 0.36, z: -13.2, w: 0.5, h: 0.05, d: 0.06, mat: M.wood, cast: false });
  for (const sx of [-2.85, -2.35]) deco(group, { x: sx, y: 8.7, z: -13.2, w: 0.06, h: 3.1, d: 0.06, mat: M.wood, cast: false });
  climbMark(group, M.whiteMark, { x: 2, y: 11.95, z: -12.4, w: 8, d: 0.1 });
  climbMark(group, M.whiteMark, { x: -15, y: 11.95, z: -12.4, w: 8, d: 0.1 });
  laundryLine(group, M, { x0: -11, z0: -13, x1: -11, z1: -21, y: 10.4 });
  for (const [x, z] of [[-17.5, -20], [-12.5, -20.5], [4.5, -20.5], [-0.5, -20.5]]) {
    deco(group, { x, y: 11.6, z, w: 0.6, h: 0.5, d: 0.6, mat: M.lighthouseRed });
    const p = staticMesh(group, rockGeometry(0.5, 0.45, 0.5, Math.round(x * 3), 0), new THREE.MeshStandardMaterial({ color: 0x3f6a35, roughness: 1 }));
    p.position.set(x, 12.3, z);
  }
  church(ctx, B, M, { x: -38, z: -14 });
  // Pozo y bancos de la plaza
  B.block({ x: 0, z: -3, w: 2.6, d: 2.6, h: 0.9, mat: M.stone });
  deco(group, { x: 0, y: 0.9, z: -3, w: 2.8, h: 0.12, d: 2.8, mat: M.stoneDark });
  for (const sx of [-1.2, 1.2]) deco(group, { x: sx, y: 0.9, z: -3, w: 0.1, h: 1.6, d: 0.1, mat: M.wood });
  deco(group, { x: 0, y: 2.5, z: -3, w: 2.6, h: 0.1, d: 0.1, mat: M.wood });
  // Puestos del mercado (de día)
  if (!night) {
    for (const [x, z, mat] of [[-7, 2, M.red], [-2, 3, M.green], [4, 2.5, M.blue]]) {
      B.block({ x, z, w: 3, d: 1.4, h: 0.9, mat: M.wood });
      for (const sx of [-1.4, 1.4]) deco(group, { x: x + sx, y: 0, z: z - 0.6, w: 0.1, h: 2.4, d: 0.1, mat: M.wood });
      deco(group, { x, y: 2.35, z: z - 0.2, w: 3.4, h: 0.08, d: 2, mat, rx: -0.2, cast: false });
    }
  }
  for (const [x, z] of [[-11, -8], [11, -8], [-11, 6], [11, 6]]) lampPost(group, { x, z, metal: M.metal, glow: M.lantern });

  // Acantilado de la base con la ruta de escalada marcada (Tomb Raider):
  // grandes masas de roca a distintas profundidades, hierba arriba
  B.block({ x: 46, z: -10, w: 14, d: 60, y: -1, h: 11, mat: rock, climbable: true, tag: 'cliff' });
  for (let i = 0; i < 16; i++) {
    const zz = -38 + i * 3.8;
    if (zz > -10 && zz < -2) continue; // la ruta de escalada queda despejada
    for (let k = 0; k < 3; k++) {
      const sy = 1.6 + ((i + k) % 3) * 0.8;
      const m = staticMesh(group, rockGeometry(1.6 + (k % 2) * 0.8, sy, 2.2 + (i % 2), 60 + i * 5 + k, 1), rock);
      m.position.set(38.6 + ((i + k) % 3) * 0.5, k * 3.4 + sy * 0.4, zz + (k - 1) * 0.9);
    }
  }
  deco(group, { x: 46, y: 10, z: -10, w: 14.4, h: 0.12, d: 60.4, mat: grass, cast: false });
  for (let i = 0; i < 20; i++) {
    const m = staticMesh(group, rockGeometry(0.9, 0.5, 1.1, 120 + i, 0), grass);
    m.position.set(39.4 + (i % 3) * 0.4, 10, -38 + i * 3);
  }
  // Escalones de roca con marcas blancas en el borde agarrable
  for (const [x, z, h] of [[37.2, -6, 2.6], [38.4, -8, 5.2], [38.8, -5.5, 7.6]]) {
    B.block({ x, z, w: 2.2, d: 2.4, h, mat: rock });
    climbMark(group, M.whiteMark, { x: x - 1.12, y: h, z, w: 0.1, d: 2 });
  }
  climbMark(group, M.whiteMark, { x: 38.9, y: 10, z: -6, w: 0.1, d: 3 });
  // Valla (postes y alambre) y torre de la PDC arriba
  for (let z = -38; z <= 18; z += 3) deco(group, { x: 41.5, y: 10, z, w: 0.1, h: 2.6, d: 0.1, mat: M.metal });
  for (const yy of [10.6, 11.5, 12.4]) deco(group, { x: 41.5, y: yy, z: -10, w: 0.03, h: 0.03, d: 57, mat: M.metal, cast: false });
  B.block({ x: 46, z: -22, w: 1.2, d: 1.2, y: 10, h: 8, mat: M.metal });
  deco(group, { x: 46, y: 18, z: -22, w: 2.2, h: 0.25, d: 2.2, mat: M.metal });

  // Árboles y matorrales en la colina
  const r = mulberry(5);
  const trees = [];
  for (let i = 0; i < 30; i++) trees.push({ x: -60 + r() * 110, y: 3, z: -48 - r() * 12, s: 0.7 + r() * 0.5 });
  pineForest(ctx, trees);
  const bushes = [];
  for (let i = 0; i < 30; i++) bushes.push({ x: -60 + r() * 110, y: 3, z: -45 - r() * 14, s: 0.5 + r() * 0.6 });
  scatterBushes(ctx, bushes, night ? 0x22341f : 0x3a5532);
  group.add(createMountains([
    { x: -160, z: -220, rad: 90, h: 120 }, { x: -40, z: -260, rad: 110, h: 150 }, { x: 90, z: -230, rad: 90, h: 120 }, { x: 200, z: -180, rad: 80, h: 90 },
  ], night ? { rock: '#1d2636', low: '#121a22', snow: '#5d6d86', snowLine: 0.74, seed: 31 } : { rock: '#66707c', low: '#4a5a46', snow: '#eef2f6', snowLine: 0.7, seed: 31 }));
  if (night) {
    const rain = new Rain(ctx, { count: 2200 });
    ctx.addEntity(rain);
    ctx.addEntity({ update: () => { const c = window.__ascend?.camera.position; if (c) { rain.center.x = c.x; rain.center.y = c.y - 12; rain.center.z = c.z; } } });
  }
  return { spawn: { x: 0, y: 0.3, z: -6, yaw: Math.PI }, sun };
}

const VILLAGE_SHOTS = [
  { id: 'puerto', title: 'El puerto y el faro', pos: { x: 14, y: 5, z: 64 }, look: { x: -24, y: 7, z: 26 } },
  { id: 'plaza', title: 'La plaza del mercado', pos: { x: -9, y: 2.2, z: 8 }, look: { x: 4, y: 6, z: -17 } },
  { id: 'tejados', title: 'Ruta por los tejados', pos: { x: -18.5, y: 13.4, z: -14.5 }, look: { x: 6, y: 10.2, z: -18 } },
  { id: 'acantilado', title: 'Escalada al acantilado de la base', pos: { x: 27, y: 3.2, z: 3 }, look: { x: 39, y: 6, z: -8 } },
];

export const ProtoVillage = {
  id: 'proto-pueblo', name: 'Prototipo · Pueblo', description: 'Propuesta', envIntensity: 0.5,
  grade: { contrast: 1.05, saturation: 1.1, shadows: '#283448', highlights: '#ffe6c4', vignette: 0.26 },
  shots: VILLAGE_SHOTS,
  build: (ctx) => buildVillageProto(ctx, false),
};
export const ProtoVillageNight = {
  id: 'proto-pueblo-noche', name: 'Prototipo · Pueblo (noche)', description: 'Propuesta', envIntensity: 0.6,
  grade: { contrast: 1.0, saturation: 0.95, shadows: '#1a2c4a', highlights: '#d2e0ff', split: 0.07, lift: 0.035, vignette: 0.3 },
  fillLight: { color: 0xa8bfe8, intensity: 0.8 },
  shots: VILLAGE_SHOTS.slice(0, 2),
  build: (ctx) => buildVillageProto(ctx, true),
};

// ================================================================= Bosque
function buildWildProto(ctx) {
  const { group, builder: B, scene } = ctx;
  const sunDir = new THREE.Vector3(-0.7, 0.22, 0.4).normalize();
  scene.fog = new THREE.FogExp2(0xc4b8ac, 0.0075);
  const sky = createSky({ top: '#3e5a82', horizon: '#f2c08e', bottom: '#5a6470', sunDir, sunColor: '#ffcf98', clouds: 0.4, cloudColor: '#fff0dc', cloudShade: '#988a8c' });
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xc6d4e6, 0x4a4434, 0.95));
  const sun = createSun({ color: '#ffd2a0', intensity: 2.2, direction: sunDir.clone().negate(), shadowSize: 70 });
  group.add(sun, sun.target);
  const M = wildMaterials();
  const r = mulberry(12);
  // Terreno (x −80…50) a los dos lados del barranco (z ±12) y el gran cañón al este (x > 50)
  B.block({ x: -15, z: -46, w: 130, d: 68, y: -1, h: 1, mat: M.grass, cast: false });
  B.block({ x: -15, z: 46, w: 130, d: 68, y: -1, h: 1, mat: M.grass, cast: false });
  B.block({ x: -15, z: 0, w: 130, d: 24, y: -10, h: 1, mat: M.rockDark, cast: false });
  B.block({ x: 130, z: 0, w: 160, d: 200, y: -42, h: 1, mat: M.rockDark, cast: false });
  const river = createWater({ width: 130, depth: 22, color: 0x2f4f5c, speed: 2.4, repeat: 20 });
  river.position.set(-15, -8.4, 0);
  group.add(river);
  const bigRiver = createWater({ width: 160, depth: 60, color: 0x2a4652, speed: 1.6, repeat: 18 });
  bigRiver.position.set(130, -40.5, 0);
  group.add(bigRiver);
  // Ondulaciones del terreno y afloramientos de roca
  for (let i = 0; i < 26; i++) {
    const x = -76 + r() * 120;
    const z = (r() < 0.5 ? -1 : 1) * (20 + r() * 50);
    const m = staticMesh(group, rockGeometry(6 + r() * 8, 1.2 + r() * 1.6, 5 + r() * 6, 400 + i, 1), M.grass);
    m.position.set(x, -0.6, z);
  }
  for (let i = 0; i < 18; i++) {
    const x = -76 + r() * 120;
    const z = (r() < 0.5 ? -1 : 1) * (18 + r() * 50);
    const m = staticMesh(group, rockGeometry(1.5 + r() * 2.5, 1 + r() * 2.5, 1.5 + r() * 2.5, 600 + i, 1), r() < 0.5 ? M.rock : M.rockWarm);
    m.position.set(x, 0, z);
  }
  // Paredes del barranco: estratos irregulares y borde roto con rocas
  for (const sgn of [-1, 1]) {
    B.block({ x: -15, z: sgn * 13, w: 130, d: 2, y: -10, h: 9, mat: M.rockDark });
    for (let i = 0; i < 30; i++) {
      const x = -78 + i * 4.3;
      for (let k = 0; k < 4; k++) {
        const sy = 1.2 + ((i + k) % 3) * 0.6;
        const m = staticMesh(group, rockGeometry(1.8 + (k % 2), sy, 1.4 + (i % 2) * 0.6, i * 7 + k + (sgn > 0 ? 500 : 0), 1), k % 2 ? M.rock : M.rockWarm);
        m.position.set(x + (k - 1.5) * 1.1, -9 + k * 2.4, sgn * (11.6 - (i % 3) * 0.3));
      }
      const rim = staticMesh(group, rockGeometry(1.4 + r(), 0.7 + r() * 0.6, 1.2, 800 + i + (sgn > 0 ? 50 : 0), 0), M.rock);
      rim.position.set(x + r() * 2, -0.2, sgn * 12.6);
    }
  }
  for (const [x, y] of [[-12, -6], [-9, -3.4], [-12.5, -1]]) climbMark(group, M.whiteMark, { x, y, z: -11.1, w: 1.8, d: 0.1 });
  // Puente de cuerda
  ropeBridge(ctx, M, { from: { x: -20, y: 0, z: -14 }, to: { x: -20, y: 0, z: 14 }, sag: 1.6 });
  // Campamento base: hoguera, cabaña, tienda, farol, leña y cajas
  const fire = campfire(ctx, M, { x: -8, z: -24 });
  ctx.addEntity({ update: (dt) => fire.update(dt, performance.now() / 1000) });
  logCabin(ctx, B, M, { x: -21, z: -33, w: 8, d: 6 });
  for (const sx of [-1, 1]) deco(group, { x: 1.6 + sx * 0.75, y: 0.7, z: -30, w: 1.7, h: 0.05, d: 3, mat: M.tarp, rz: sx * 0.95, cast: true });
  deco(group, { x: 1.6, y: 0, z: -28.4, w: 0.08, h: 1.5, d: 0.08, mat: M.log });
  deco(group, { x: -3.5, y: 0, z: -19.5, w: 0.12, h: 2, d: 0.12, mat: M.log });
  deco(group, { x: -3.5, y: 2, z: -19.5, w: 0.3, h: 0.4, d: 0.3, mat: M.window, cast: false });
  for (let i = 0; i < 6; i++) {
    const l = staticMesh(group, new THREE.CylinderGeometry(0.16, 0.16, 1.4, 7).rotateZ(Math.PI / 2), M.log);
    l.position.set(-13.5, 0.16 + Math.floor(i / 3) * 0.3, -21 + (i % 3) * 0.34);
  }
  for (const [x, z] of [[4, -25], [4.9, -24.4]]) B.block({ x, z, w: 0.8, d: 0.8, h: 0.7, mat: M.plank });
  fallenLog(ctx, B, M, { x: 8, z: -18, len: 8, ry: 0.6 });
  // Bosque denso (pinos nevados), con claro para el campamento y la senda del puente
  const trees = [];
  for (let i = 0; i < 300; i++) {
    const x = -78 + r() * 126;
    const z = (r() < 0.5 ? -1 : 1) * (15 + r() * 62);
    if (Math.hypot(x + 9, z + 26) < 12 || (Math.abs(x + 20) < 3.5 && Math.abs(z) < 30)) continue;
    trees.push({ x, y: 0, z, s: 0.7 + r() * 0.9 });
  }
  pineForest(ctx, trees, { snow: true });
  const bushes = [];
  for (let i = 0; i < 80; i++) bushes.push({ x: -78 + r() * 126, y: 0, z: (r() < 0.5 ? -1 : 1) * (14 + r() * 60), s: 0.5 + r() * 0.7 });
  scatterBushes(ctx, bushes, 0x3c5232);
  // El gran cañón y el puente de acero roto (la escena final del prólogo)
  // Paredes del gran cañón: muro de roca con estratos en la cara interior
  for (const sgn of [-1, 1]) {
    deco(group, { x: 130, y: -42, z: sgn * 36, w: 160, h: 42, d: 10, mat: M.rockDark });
    for (let i = 0; i < 26; i++) {
      for (let k = 0; k < 6; k++) {
        const sy = 2 + ((i + k) % 3);
        const m = staticMesh(group, rockGeometry(3 + (k % 2) * 1.5, sy, 2.2, 900 + i * 9 + k + (sgn > 0 ? 400 : 0), 1), k % 2 ? M.rock : M.rockWarm);
        m.position.set(52 + i * 6, -40 + k * 7, sgn * (31 - ((i + k) % 3) * 0.6));
      }
    }
  }
  // El barranco desemboca en el cañón: borde del terreno roto
  for (let i = 0; i < 10; i++) {
    const m = staticMesh(group, rockGeometry(4, 2.2 + (i % 3) * 0.8, 3.5, 1300 + i, 1), M.rockWarm);
    m.position.set(49 + (i % 2), -2.5 - (i % 3) * 1.5, -30 + i * 6.5);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c333b, metalness: 0.7, roughness: 0.5 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe0b021, metalness: 0.3, roughness: 0.55 });
  for (const [x0, x1] of [[50, 82], [90, 124], [132, 170]]) {
    deco(group, { x: (x0 + x1) / 2, y: -0.6, z: 0, w: x1 - x0, h: 0.6, d: 8, mat: steel });
    for (const sz of [-1, 1]) {
      deco(group, { x: (x0 + x1) / 2, y: 5.6, z: sz * 4.5, w: x1 - x0, h: 0.5, d: 0.5, mat: steel });
      deco(group, { x: (x0 + x1) / 2, y: 1, z: sz * 3.9, w: x1 - x0, h: 0.12, d: 0.12, mat: yellow });
      for (let x = x0 + 2; x < x1; x += 6) {
        deco(group, { x, y: -0.6, z: sz * 4.5, w: 0.45, h: 6.7, d: 0.45, mat: steel });
        deco(group, { x: x + 3, y: -0.6, z: sz * 4.5, w: 0.3, h: 8.2, d: 0.3, mat: steel, rz: sz * 0.75 });
      }
    }
  }
  for (const x of [70, 107, 150]) deco(group, { x, y: -42, z: 0, w: 3, h: 41.4, d: 6, mat: M.rockDark });
  group.add(createMountains([
    { x: -120, z: -240, rad: 110, h: 170 }, { x: 10, z: -260, rad: 120, h: 210 }, { x: 140, z: -230, rad: 100, h: 160 },
    { x: 300, z: -60, rad: 120, h: 180 }, { x: 290, z: 120, rad: 110, h: 150 },
  ], { rock: '#56534e', low: '#34402e', snow: '#eef2f6', snowLine: 0.5, seed: 91 }));
  return { spawn: { x: -8, y: 0.3, z: -18, yaw: Math.PI }, sun };
}

export const ProtoWild = {
  id: 'proto-bosque', name: 'Prototipo · Bosque', description: 'Propuesta', envIntensity: 0.5,
  grade: { contrast: 1.05, saturation: 1.08, shadows: '#283246', highlights: '#ffd6a0', split: 0.07, vignette: 0.3 },
  shots: [
    { id: 'campamento', title: 'Campamento base al atardecer', pos: { x: 6, y: 2.2, z: -15 }, look: { x: -14, y: 1, z: -30 } },
    { id: 'barranco', title: 'Puente de cuerda sobre el barranco', pos: { x: -33, y: 2.6, z: -19 }, look: { x: -18, y: -2.5, z: 5 } },
    { id: 'canon', title: 'El gran cañón y el puente de acero roto', pos: { x: 38, y: 7, z: -14 }, look: { x: 100, y: -8, z: 2 } },
  ],
  build: buildWildProto,
};

// ================================================================= Distrito
function buildCityProto(ctx) {
  const { group, builder: B, scene } = ctx;
  const sunDir = new THREE.Vector3(0.3, 0.5, -0.8);
  scene.fog = new THREE.FogExp2(0x1c2433, 0.012);
  const sky = createSky({ top: '#060a14', horizon: '#3a2a4a', bottom: '#0a0c14', sunDir, sunColor: '#8fa0c8', clouds: 0.85, cloudColor: '#3a3448', cloudShade: '#141420', stars: 0.15, moonDir: sunDir });
  group.add(sky);
  group.add(new THREE.HemisphereLight(0x6a7aa8, 0x2a2228, 1.2));
  const sun = createSun({ color: '#8fa0c8', intensity: 0.9, direction: sunDir.clone().negate(), shadowSize: 60 });
  group.add(sun, sun.target);
  const M = cityMaterials(true);
  // Calle principal (x), acera y cruce
  B.block({ x: 0, z: 0, w: 140, d: 120, y: -1, h: 1, mat: M.asphalt, cast: false });
  for (const sz of [-1, 1]) B.block({ x: 0, z: sz * 8.5, w: 140, d: 3, h: 0.18, mat: M.sidewalk, cast: false });
  // Líneas de la calzada
  for (let x = -66; x < 66; x += 6) deco(group, { x, y: 0.005, z: 0, w: 3, h: 0.01, d: 0.18, mat: M.paint, cast: false });
  // Edificios a los dos lados (con callejones entre ellos)
  const row = (z, fronts, seed) => {
    let x = -62;
    let i = 0;
    while (x < 60) {
      const w = 12 + ((i * 7 + seed) % 3) * 4;
      const h = 14 + ((i * 5 + seed) % 4) * 6;
      cityBuilding(ctx, B, M, { x: x + w / 2, z, w, d: 14, h }, { fronts, seed: seed * 10 + i, fireSide: i % 2 ? '-x' : '+x' });
      x += w + (i % 2 ? 4 : 3);
      i++;
    }
  };
  row(-17, ['+z'], 3);
  row(17, ['-z'], 7);
  // Callejón con banderolas y farolillos (Tokio / Madripoor) entre dos edificios de la fila norte (x −23…−19)
  const r = mulberry(4);
  const AX = -21;
  for (let i = 0; i < 6; i++) {
    neonSign(group, { x: AX + (i % 2 ? 1.6 : -1.6), y: 3.2 + (i % 3) * 2.2, z: 12 + i * 2.2, ry: Math.PI / 2, text: ['居酒屋', 'BAR', '麺', 'HOTEL', 'KARAOKE', '寿司'][i], color: ['#ff4f6a', '#4fe6ff', '#ffd84f', '#7bff6a', '#ff4fd8', '#ffb04f'][i], vertical: true, w: 0.6, h: 2.2 });
  }
  for (let i = 0; i < 12; i++) {
    const m = staticMesh(group, new THREE.SphereGeometry(0.2, 10, 8), M.paperLantern, { cast: false });
    m.position.set(AX + (r() - 0.5) * 2.4, 5.2 + Math.sin(i) * 0.2, 10.5 + i * 1.2);
    m.scale.y = 1.4;
  }
  for (let i = 0; i < 4; i++) deco(group, { x: AX, y: 5.5, z: 11 + i * 3, w: 4, h: 0.02, d: 0.02, mat: M.iron, cast: false });
  for (const z of [14, 20]) { deco(group, { x: AX - 1.3, y: 0, z, w: 0.9, h: 1.1, d: 0.7, mat: M.metal }); deco(group, { x: AX + 1.4, y: 0, z: z + 2, w: 0.6, h: 0.9, d: 0.6, mat: M.wood }); }
  // Monorraíl sobre la calle
  monorail(ctx, B, M, { points: [{ x: -70, z: 4 }, { x: 70, z: 4 }], y: 10 });
  // Control de la PDC, coches y farolas
  pdcCheckpoint(ctx, B, M, { x: 26, z: 0, ry: Math.PI / 2 });
  for (const [x, z, c] of [[-40, -5.2, 'carRed'], [-26, 5.2, 'carGrey'], [-8, -5.2, 'carBlue'], [12, 5.2, 'carGrey'], [42, -5.2, 'carRed']]) car(ctx, B, M, { x, z, color: c });
  for (let x = -60; x <= 60; x += 15) {
    streetLight(group, M, { x, z: -7.4, ry: -Math.PI / 2 });
    streetLight(group, M, { x: x + 7, z: 7.4, ry: Math.PI / 2 });
  }
  // Rascacielos al fondo y lluvia
  group.add(createCity({ origin: { x: 0, y: -40, z: 0 }, heading: -Math.PI / 2, spread: 2.6, dist: [160, 420], count: 120, seed: 21, lit: 0.34, intensity: 1.1 }));
  const rain = new Rain(ctx, { count: 2600 });
  ctx.addEntity(rain);
  ctx.addEntity({ update: () => { const c = window.__ascend?.camera.position; if (c) { rain.center.x = c.x; rain.center.y = c.y - 12; rain.center.z = c.z; } } });
  return { spawn: { x: -30, y: 0.3, z: 2, yaw: Math.PI / 2 }, sun };
}

export const ProtoCity = {
  id: 'proto-distrito', name: 'Prototipo · Distrito', description: 'Propuesta', envIntensity: 0.6,
  grade: { contrast: 1.08, saturation: 1.15, shadows: '#1c2244', highlights: '#ffb8e0', split: 0.09, lift: 0.03, vignette: 0.34 },
  fillLight: { color: 0x9fb0e8, intensity: 0.6 },
  shots: [
    { id: 'calle', title: 'La calle principal de noche', pos: { x: -36, y: 1.9, z: 2.5 }, look: { x: 4, y: 5, z: -3 } },
    { id: 'azoteas', title: 'Las azoteas y el monorraíl', pos: { x: -24, y: 28, z: 24 }, look: { x: 14, y: 14, z: -10 } },
    { id: 'callejon', title: 'Callejón de neón', pos: { x: -21, y: 1.9, z: 6.5 }, look: { x: -21, y: 4.2, z: 26 } },
    { id: 'control', title: 'Control de la PDC', pos: { x: 12, y: 2.4, z: -4.5 }, look: { x: 28, y: 2.6, z: 1.5 } },
  ],
  build: buildCityProto,
};

export const PROTO_MAPS = [ProtoVillage, ProtoVillageNight, ProtoWild, ProtoCity];
