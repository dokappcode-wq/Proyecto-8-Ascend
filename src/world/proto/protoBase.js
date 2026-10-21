import * as THREE from 'three';
import { createSky, createSun, createMountains } from '../environment.js';
import { createWater } from '../water.js';
import { grassTexture, dirtTexture, rockTexture } from '../textures.js';
import { terrain } from '../kit/terrain.js';
import {
  baseMaterials, container, perimeterWall, chainFence, watchtower, floodlight, truck, helicopter, dish, radar,
  banner, jersey, gatehouse, facility, rollDoor,
} from '../kit/base.js';
import { wildMaterials } from '../kit/wild.js';
import { deco, staticMesh, rockGeometry, climbMark } from '../kit/common.js';
import { glowSprite } from '../../vfx/glowTexture.js';
import { Searchlight } from '../../story/actors.js';
import { Rain, Zipline, pineForest, mulberry } from '../../story/props.js';

/**
 * PROTOTIPO v2 · BASE DE LA PDC (noche de la M01). Una base de verdad, no un
 * patio con un edificio: muro perimetral con pasarela y torres en las
 * esquinas, puesto de control con barreras, patio de contenedores con grúa
 * pórtico (calles de sigilo), edificio brutalista con franjas de luz azul,
 * helipuerto, garaje y depósitos. Charcos de luz de los focos y zonas
 * oscuras entre ellos: se lee por dónde se puede pasar sin ser visto.
 *
 * Mantiene los momentos de la historia (CP02–CP08): acantilado y valla rota
 * al oeste, patio, conducto de la fachada oeste, almacén con pasarela,
 * cámara de las cartas, balcón y andamio a la azotea, anexo, puente y torre
 * de la tirolina hacia la playa.
 *
 * Disposición: meseta a 10 m (x 56…158, z −112…14), acantilado al oeste
 * (x 50…56) sobre el pueblo, mar al sur, edificio x 88…112 · z −75…−45.
 */

const Y = 10;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function baseHeight(x, z) {
  // Meseta, acantilado al oeste (pueblo a 0 m) y caída al mar por el sur
  let y = Y * smooth(50.5, 54.5, x);
  y = Math.min(y, Y - 12 * smooth(16, 24, z));
  // Colinas al norte y al este, fuera del muro
  y += (6 + 3 * Math.sin(x * 0.05)) * smooth(-116, -150, z) * smooth(52, 70, x);
  y += 5 * smooth(162, 190, x) * smooth(18, 4, z);
  y += 0.25 * Math.sin(x * 0.3 + z * 0.2) * smooth(0, 6, Math.abs(x - 54)) * (x < 52 ? 1 : 0);
  return Math.max(y, -3);
}

function buildBase(ctx) {
  const { group, builder: B, scene } = ctx;
  const moonDir = new THREE.Vector3(-0.3, 0.5, 0.8).normalize();
  scene.fog = new THREE.FogExp2(0x2c3a52, 0.0075);
  group.add(createSky({ top: '#0a1424', horizon: '#34496a', bottom: '#0c1220', sunDir: moonDir, sunColor: '#9fb6d6', clouds: 0.8, cloudColor: '#32425a', cloudShade: '#141c28', stars: 0.5, moonDir }));
  group.add(new THREE.HemisphereLight(0x6f86b8, 0x2a2c36, 1.25));
  const moon = createSun({ color: '#9fb4dc', intensity: 1.2, direction: moonDir.clone().negate(), shadowSize: 80 });
  group.add(moon, moon.target);
  const M = baseMaterials(true);
  const Wm = wildMaterials();
  const r = mulberry(44);

  // ---------------------------------------------------------------- Terreno, suelo de la base y mar
  terrain(ctx, {
    minX: -60, minZ: -220, maxX: 240, maxZ: 70, cell: 2, height: baseHeight,
    grass: grassTexture('#3e4a36', 81), dirt: dirtTexture('#4a4036', 95), rock: rockTexture('#5a5650', 83),
    splat: (x, z, y, slope) => [z > 22 ? 0.9 : 0, smooth(0.6, 1.1, slope)],
    tint: () => 0.85,
  });
  B.block({ x: 107, z: -49, w: 102, d: 126, y: Y - 0.1, h: 0.12, mat: M.ground, collide: false, cast: false });
  // Calzada interior con líneas amarillas (de la puerta al edificio y al helipuerto)
  for (let z = -104; z < -78; z += 3) deco(group, { x: 102, y: Y + 0.03, z, w: 0.15, h: 0.01, d: 1.6, mat: M.yellow, cast: false });
  for (let x = 114; x < 150; x += 3) deco(group, { x, y: Y + 0.03, z: -80, w: 1.6, h: 0.01, d: 0.15, mat: M.yellow, cast: false });
  const sea = createWater({ width: 600, depth: 300, color: 0x0b1828, night: true, repeat: 60 });
  sea.position.set(60, -1.6, 180);
  group.add(sea);

  // ---------------------------------------------------------------- Acantilado (CP02) y valla rota
  for (const [x, z, h] of [[51.6, -21, 3], [52.6, -18.6, 6.2], [53.6, -21.4, 8.6]]) {
    B.block({ x, z, w: 2.2, d: 2.4, h, mat: Wm.rockDark });
    const m = staticMesh(group, rockGeometry(1.3, h * 0.45, 1.3, Math.round(h * 10), 1), Wm.rock);
    m.position.set(x - 0.2, h * 0.45, z);
    climbMark(group, Wm.whiteMark, { x: x - 1.12, y: h, z, w: 0.1, d: 1.8 });
  }
  climbMark(group, Wm.whiteMark, { x: 54.6, y: Y + 0.02, z: -19.5, w: 0.1, d: 2.6 });
  chainFence(ctx, M, { x0: 58, z0: -108, x1: 58, z1: 12, y: Y, gap: [-21, -17] });
  chainFence(ctx, M, { x0: 58, z0: 12, x1: 156, z1: 12, y: Y });

  // ---------------------------------------------------------------- Muro, torres y puesto de control
  perimeterWall(ctx, B, M, { x0: 58, z0: -111, x1: 96, z1: -111, y: Y, outside: -1 });
  perimeterWall(ctx, B, M, { x0: 108, z0: -111, x1: 157, z1: -111, y: Y, outside: -1 });
  perimeterWall(ctx, B, M, { x0: 157, z0: -111, x1: 157, z1: 12, y: Y, outside: 1 });
  for (const [x, z] of [[61.5, 8.5], [61.5, -107], [153.5, -107], [153.5, 8.5]]) watchtower(ctx, B, M, { x, z, y: Y, h: 9 });
  gatehouse(ctx, B, M, { x: 102, z: -111, y: Y, w: 10 });
  banner(ctx, M, { x: 95.3, y: Y + 5, z: -110, ry: 0 });
  banner(ctx, M, { x: 108.7, y: Y + 5, z: -110, ry: 0 });
  // Focos que barren el patio (los de la historia) y el borde del acantilado
  const lights = [
    new Searchlight(ctx, { origin: { x: 61.5, y: Y + 12.2, z: 8.5 }, a: { x: 62, z: -14 }, b: { x: 80, z: -10 }, y: Y, radius: 3.4, period: 10 }),
    new Searchlight(ctx, { origin: { x: 96, y: Y + 9, z: -30 }, a: { x: 70, z: -30 }, b: { x: 84, z: -48 }, y: Y, radius: 3.2, period: 8, phase: 3 }),
    new Searchlight(ctx, { origin: { x: 153.5, y: Y + 12.2, z: -107 }, a: { x: 120, z: -96 }, b: { x: 140, z: -70 }, y: Y, radius: 3.6, period: 12, phase: 5 }),
  ];
  for (const l of lights) ctx.addEntity(l);
  B.block({ x: 96, z: -30, w: 1.2, d: 1.2, y: Y, h: 8, mat: M.metal });
  B.block({ x: 96, z: -30, w: 2.2, d: 2.2, y: Y + 8, h: 0.25, mat: M.rust });

  // ---------------------------------------------------------------- Patio de contenedores y grúa
  const rows = [
    { z: -17, items: [[67, 0, 1], [74, 1, 2], [81.5, 2, 1]] },
    { z: -25.5, items: [[66.5, 3, 1], [73.8, 4, 1], [84.5, 5, 2]] },
    { z: -34, items: [[68, 1, 2], [75.4, 0, 1], [82.6, 3, 1]] },
    { z: -42.5, items: [[66, 5, 1], [79.5, 2, 2]] },
  ];
  rows.forEach((row, ri) => {
    for (const [x, color, levels] of row.items) {
      for (let k = 0; k < levels; k++) container(ctx, B, M, { x: x + k * 0.25, y: Y + k * 2.6, z: row.z + (k ? 0.1 : 0), color: color + k * 2 + ri });
    }
  });
  gantry(ctx, B, M, { x0: 62, x1: 90, z0: -38, z1: -22, h: 14 });

  // ---------------------------------------------------------------- Edificio principal
  facility(ctx, B, M, { x0: 88, x1: 112, z0: -75, z1: -45, y: Y, floors: 2, fh: 4.2, vents: [{ x: 88, z: -52 }] });
  for (const x of [92.5, 99.5]) banner(ctx, M, { x, y: Y + 8.2, z: -44.75, ry: 0, w: 2, h: 4.6 });
  // Entrada principal con marquesina y franja azul
  deco(group, { x: 108.2, y: Y + 3.2, z: -43.4, w: 4.4, h: 0.3, d: 3.2, mat: M.concreteDark });
  deco(group, { x: 108.2, y: Y + 3.15, z: -43.4, w: 4.42, h: 0.06, d: 3.22, mat: M.strip, cast: false });
  deco(group, { x: 108.2, y: Y, z: -44.85, w: 2.4, h: 2.6, d: 0.1, mat: M.hazard, cast: false });
  // Balcón y andamio de mantenimiento hasta la azotea (ruta de la huida)
  B.block({ x: 104.5, z: -43.6, w: 4, d: 2.4, y: Y + 3.9, h: 0.2, mat: M.rust });
  for (const dz of [-1.1, 1.1]) deco(group, { x: 104.5, y: Y + 4.1, z: -43.6 + dz, w: 4, h: 0.06, d: 0.06, mat: M.metal });
  B.block({ x: 106.9, z: -43.6, w: 0.8, d: 1.2, y: Y, h: 9.3, mat: M.metal, climbable: true });
  for (let yy = 0.5; yy < 9; yy += 1.5) deco(group, { x: 106.9, y: Y + yy, z: -43, w: 0.9, h: 0.06, d: 0.06, mat: M.yellow, cast: false });
  dish(ctx, M, { x: 95, y: Y + 9.3, z: -50, r: 2, ry: 2.4 });
  ctx.addEntity(radar(ctx, M, { x: 107, y: Y + 9.3, z: -69 }));
  // Anexo este, puente a la torre de la tirolina y cable hacia la playa
  B.block({ x: 116, z: -60, w: 8, d: 20, y: Y, h: 5, mat: M.concrete, climbable: false });
  deco(group, { x: 116, y: Y + 4.6, z: -49.95, w: 8, h: 0.08, d: 0.06, mat: M.strip, cast: false });
  rollDoor(ctx, M, { x: 116, y: Y, z: -49.9, w: 4, h: 3.4 });
  B.bridge({ from: { x: 116, y: Y + 5, z: -50 }, to: { x: 116, y: Y + 5, z: -16 }, width: 2.2, mat: M.rust, rails: M.metal });
  B.block({ x: 116, z: -11, w: 6, d: 10, y: Y, h: 5, mat: M.plate, climbable: false });
  deco(group, { x: 116, y: Y + 5, z: -7.5, w: 0.3, h: 4, d: 0.3, mat: M.metal });
  deco(group, { x: 116, y: Y + 9, z: -7.5, w: 0.4, h: 0.3, d: 0.4, mat: M.redLight, cast: false });
  new Zipline(ctx, { from: { x: 116, y: Y + 7.6, z: -8 }, to: { x: 110, y: 2.3, z: 38 } });

  // ---------------------------------------------------------------- Helipuerto, garaje, depósitos y camiones
  B.block({ x: 134, z: -32, w: 17, d: 17, y: Y, h: 0.25, mat: [M.concreteDark, M.concreteDark, M.helipad, M.concreteDark, M.concreteDark, M.concreteDark] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    deco(group, { x: 134 + Math.cos(a) * 8.2, y: Y + 0.25, z: -32 + Math.sin(a) * 8.2, w: 0.25, h: 0.12, d: 0.25, mat: i % 2 ? M.stripWhite : M.strip, cast: false });
  }
  helicopter(ctx, M, { x: 134, y: Y + 0.25, z: -32, ry: 0.6 });
  B.block({ x: 135, z: -96, w: 22, d: 16, y: Y, h: 6.5, mat: M.concrete });
  for (const x of [127, 135, 143]) rollDoor(ctx, M, { x, y: Y, z: -87.95, w: 5, h: 4.4 });
  deco(group, { x: 135, y: Y + 5.2, z: -87.9, w: 22, h: 0.12, d: 0.06, mat: M.strip, cast: false });
  for (const z of [-64, -55]) {
    const t = staticMesh(group, new THREE.CylinderGeometry(2.6, 2.6, 5.5, 20), M.metalLight);
    t.position.set(148, Y + 2.75, z);
    deco(group, { x: 148, y: Y + 3.6, z, w: 5.3, h: 0.4, d: 5.3, mat: M.hazard, cast: false });
    ctx.world.addBox({ x: 145.4, y: Y, z: z - 2.6 }, { x: 150.6, y: Y + 5.5, z: z + 2.6 }, { climbable: false });
  }
  truck(ctx, B, M, { x: 98, y: Y, z: -98, ry: Math.PI / 2, lights: true });
  truck(ctx, B, M, { x: 108, y: Y, z: -94, ry: -Math.PI / 2 });
  truck(ctx, B, M, { x: 122, y: Y, z: -40, ry: 0 });
  for (const [x, z] of [[100, -84], [104, -84], [130, -58]]) jersey(ctx, B, M, { x, y: Y, z, along: 'x', len: 3 });

  // ---------------------------------------------------------------- Focos (charcos de luz) y farolas
  floodlight(ctx, B, M, { x: 74, z: -11, y: Y, h: 10, aim: { x: 74, z: -24 } });
  floodlight(ctx, B, M, { x: 92, z: -86, y: Y, h: 10, aim: { x: 100, z: -96 } });
  floodlight(ctx, B, M, { x: 144, z: -44, y: Y, h: 10, aim: { x: 134, z: -32 } });
  floodlight(ctx, B, M, { x: 80, z: -58, y: Y, h: 9, aim: { x: 88, z: -60 }, intensity: 40 });
  for (const [x, z] of [[102, -78], [118, -80], [140, -80], [114, -30], [94, -40]]) {
    deco(group, { x, y: Y, z, w: 0.15, h: 6, d: 0.15, mat: M.metal });
    deco(group, { x, y: Y + 5.9, z, w: 0.8, h: 0.12, d: 0.35, mat: M.stripWhite, cast: false });
  }

  // ---------------------------------------------------------------- Alrededores: pinos, pueblo abajo y lluvia
  const trees = [];
  for (let i = 0; i < 3000 && trees.length < 700; i++) {
    const x = -50 + r() * 290;
    const z = -215 + r() * 230;
    const inside = x > 52 && x < 162 && z > -118 && z < 18;
    if (inside || (x < 50 && z > -60)) continue;
    trees.push({ x, y: baseHeight(x, z) - 0.1, z, s: 0.8 + r() * 0.8 });
  }
  pineForest(ctx, trees);
  // Ventanas del pueblo al pie del acantilado
  for (let i = 0; i < 40; i++) {
    const g = glowSprite(new THREE.Color(r() < 0.7 ? 0xffc27a : 0xcfe0ff), 1.2 + r(), 0.75);
    g.position.set(-30 + r() * 72, 1 + r() * 9, -50 + r() * 70);
    group.add(g);
  }
  group.add(createMountains([
    { x: -160, z: -240, rad: 110, h: 140 }, { x: 40, z: -280, rad: 130, h: 170 }, { x: 220, z: -240, rad: 110, h: 140 }, { x: 320, z: -60, rad: 120, h: 130 },
  ], { rock: '#1d2636', low: '#121a22', snow: '#5d6d86', snowLine: 0.74, seed: 31 }));
  const rain = new Rain(ctx, { count: 2600 });
  ctx.addEntity(rain);
  ctx.addEntity({ update: () => { const c = window.__ascend?.camera.position; if (c) { rain.center.x = c.x; rain.center.y = c.y - 12; rain.center.z = c.z; } } });

  return { spawn: { x: 48, y: 0.3, z: -20, yaw: Math.PI / 2 }, sun: moon };
}

/** Grúa pórtico amarilla sobre el patio, con un contenedor colgando del carro. */
function gantry(ctx, B, M, { x0, x1, z0, z1, h }) {
  const { group } = ctx;
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) B.block({ x, z, w: 0.9, d: 0.9, y: Y, h, mat: M.yellow, cameraBlocking: false });
    deco(group, { x, y: Y + h - 1, z: (z0 + z1) / 2, w: 1, h: 1, d: z1 - z0 + 0.9, mat: M.yellow });
    deco(group, { x, y: Y + 0.2, z: (z0 + z1) / 2, w: 1.2, h: 0.6, d: z1 - z0 + 2, mat: M.hazard });
  }
  for (const z of [z0, z1]) deco(group, { x: (x0 + x1) / 2, y: Y + h, z, w: x1 - x0 + 1, h: 1.2, d: 0.9, mat: M.yellow });
  const tx = (x0 + x1) / 2 + 2;
  deco(group, { x: tx, y: Y + h - 0.6, z: (z0 + z1) / 2, w: 3, h: 1.6, d: z1 - z0 + 1.4, mat: M.pdcDark });
  for (const dz of [-1, 1]) deco(group, { x: tx, y: Y + 7.6, z: (z0 + z1) / 2 + dz, w: 0.05, h: h - 8, d: 0.05, mat: M.metalLight, cast: false });
  container(ctx, B, M, { x: tx, y: Y + 5, z: (z0 + z1) / 2, color: 0 });
  deco(group, { x: tx, y: Y + 7.6, z: (z0 + z1) / 2, w: 6.2, h: 0.3, d: 2.5, mat: M.yellow });
}

export const ProtoBase = {
  id: 'proto-base', name: 'Prototipo · Base de la PDC', description: 'Propuesta v2', envIntensity: 0.6,
  grade: { contrast: 1.02, saturation: 0.98, shadows: '#1a2c4a', highlights: '#d2e0ff', split: 0.07, lift: 0.035, vignette: 0.3 },
  fillLight: { color: 0xa8bfe8, intensity: 0.7 },
  shots: [
    { id: 'vista', title: 'La base desde el mar', pos: { x: 58, y: 40, z: 34 }, look: { x: 108, y: 8, z: -50 }, fog: 0.003 },
    { id: 'brecha', title: 'La valla rota sobre el acantilado', pos: { x: 54.6, y: 12.3, z: -17.2 }, look: { x: 80, y: 11, z: -27 }, jon: { x: 59.8, y: 10.2, z: -19.2, yaw: Math.PI / 2 + 0.3 } },
    { id: 'patio', title: 'Calles de sigilo entre contenedores', pos: { x: 63.5, y: 11.6, z: -21.2 }, look: { x: 90, y: 12.4, z: -22 }, jon: { x: 70.5, y: 10.2, z: -21.2, yaw: Math.PI / 2 } },
    { id: 'fachada', title: 'Fachada oeste: el conducto', pos: { x: 76.5, y: 11.8, z: -45 }, look: { x: 89, y: 12.6, z: -55.5 }, jon: { x: 85, y: 10.2, z: -51.4, yaw: Math.PI / 2 } },
    { id: 'puerta', title: 'El puesto de control', pos: { x: 102, y: 12.4, z: -87 }, look: { x: 102, y: 13, z: -112 } },
    { id: 'helipuerto', title: 'Helipuerto y anexo', pos: { x: 123.5, y: 14.5, z: -17.5 }, look: { x: 135, y: 10.6, z: -33 } },
  ],
  build: buildBase,
};
