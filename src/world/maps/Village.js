import * as THREE from 'three';
import { createSky, createSun, createMountains } from '../environment.js';
import { concreteTexture, stoneWallTexture, roofTileTexture, cobbleTexture, rockTexture, grassTexture, sandTexture, woodTexture, windowTextures, awningTexture } from '../textures.js';
import { createWater } from '../water.js';
import { scaleBoxUVs } from '../LevelBuilder.js';
import { EnergySource } from '../entities/EnergySource.js';
import { StealthGuard, Searchlight } from '../../story/actors.js';
import { NavGrid } from '../../ai/NavGrid.js';
import { Shutter, Zipline, Rain, AlarmLights, CardVitrines, mulberry, pineForest, scatterBushes, scatterRocks } from '../../story/props.js';
import { villageMaterials, fishermanHouse, lighthouse, fishingBoat, quay, church, laundryLine } from '../kit/village.js';
import { lampPost, climbMark, deco, staticMesh, rockGeometry, gableRoof } from '../kit/common.js';
import { terrain } from '../kit/terrain.js';
import {
  baseMaterials, container, perimeterWall, chainFence, watchtower, floodlight, truck, helicopter, dish, radar,
  banner, jersey, gatehouse, rollDoor, facilitySkin, lightPool,
} from '../kit/base.js';
import { glowSprite } from '../../vfx/glowTexture.js';

/**
 * PUEBLO COSTERO (prólogo, mapas nuevos): el pueblo de Jon junto al mar y la
 * base de la PDC en lo alto del acantilado.
 *
 * - `pueblo-noche` (M01): lluvia, focos y patrullas; tejados, acantilado,
 *   patio de la base, edificio con la cámara de las cartas, azotea y tirolina.
 * - `pueblo-dia` (M02–M04): plaza con mercado, casa de Jon (intacta o en
 *   ruinas), callejón, puerto; la tormenta se controla desde el guion.
 *
 * Disposición (x hacia el este, z hacia el mar):
 *   pueblo x −80…50 · plaza (0,0) · casa de Jon (−30, 18) · puerto z 44
 *   acantilado x 55 · base (meseta a 10 m) x 55…152, z −106…10 · playa al sur de la base.
 *
 * Aspecto (propuesta aprobada): casas de pescadores de la costa vasca (kit
 * `world/kit/village.js`) sobre los mismos solares que pide el guion, iglesia,
 * faro en su espigón, barcas y muelle; la base de la PDC con muro, torres,
 * puesto de control, contenedores, grúa, helipuerto y edificio brutalista
 * (kit `world/kit/base.js`). El terreno sigue hasta el horizonte: no hay
 * bordes de mapa a la vista.
 */

const PLATEAU = 10; // altura de la meseta de la base

/** Tejados del tutorial de parkour (de oeste a este). */
export const ROOF_ROUTE = [
  { x: -21, z: -9, w: 10, d: 10, h: 5 },
  { x: -9.5, z: -12, w: 8, d: 8, h: 5.5 },
  { x: 1, z: -16, w: 8, d: 8, h: 6 },
  { x: 11, z: -14, w: 7, d: 8, h: 4.5 },
  { x: 21, z: -18, w: 8, d: 8, h: 6 },
  { x: 31.5, z: -20, w: 8, d: 8, h: 5 },
  { x: 41, z: -20, w: 6, d: 8, h: 3.5 },
];

/** Casa de Jon (interior jugable). */
export const JON_HOUSE = { x: -30, z: 18, w: 10, d: 8, h: 4 };

const OTHER_HOUSES = [
  { x: -48, z: 18, w: 8, d: 8, h: 5 },
  { x: -14, z: 20, w: 8, d: 7, h: 4.5 },
  { x: 2, z: 22, w: 9, d: 8, h: 5 },
  { x: 16, z: 20, w: 8, d: 8, h: 4 },
  { x: 30, z: 18, w: 8, d: 8, h: 5 },
  { x: -50, z: -4, w: 10, d: 9, h: 6 },
  { x: -46, z: -26, w: 9, d: 8, h: 5 },
  { x: -14, z: -34, w: 8, d: 8, h: 6 },
  { x: 6, z: -36, w: 10, d: 8, h: 5 },
  { x: 30, z: 4, w: 8, d: 8, h: 5 },
  { x: 40, z: 26, w: 7, d: 7, h: 4 },
  { x: -62, z: 30, w: 8, d: 8, h: 4.5 },
  { x: 22, z: -36, w: 8, d: 7, h: 5.5 },
];

/** Mapa nocturno (M01). */
export const VillageNight = {
  id: 'pueblo-noche',
  name: 'Pueblo costero',
  description: 'La última noche · 23:47',
  story: true,
  ambience: 'village-night',
  factions: { pdc: 100 },
  /** Aspecto: noche fría y lluviosa, con la luna y las farolas como guía (nunca a oscuras). */
  envIntensity: 0.6,
  grade: { contrast: 1.0, saturation: 0.95, shadows: '#1a2c4a', highlights: '#d2e0ff', split: 0.07, lift: 0.035, vignette: 0.3 },
  /** Luz de relleno suave que acompaña a la cámara (se lee lo que se tiene cerca). */
  fillLight: { color: 0xa8bfe8, intensity: 0.8 },
  bounds: { minX: -100, maxX: 156, minZ: -110, maxZ: 70 },
  waypoints: [
    { id: 'tejado', name: 'Tejado (CP01)', x: -21, y: 5.3, z: -9, yaw: Math.PI / 2 },
    { id: 'acantilado', name: 'Pie del acantilado (CP02)', x: 49, y: 0.3, z: -20, yaw: Math.PI / 2 },
    { id: 'patio', name: 'Patio de la base', x: 66, y: 10.3, z: -20, yaw: Math.PI / 2 },
    { id: 'pasarela', name: 'Pasarela de la tirolina (CP08)', x: 116, y: 15.3, z: -14, yaw: Math.PI },
  ],
  build(ctx) {
    return buildVillage(ctx, true);
  },
};

/** Mapa de día (M02–M04). */
export const VillageDay = {
  id: 'pueblo-dia',
  name: 'Pueblo costero',
  description: 'Bajo su control',
  story: true,
  ambience: 'village-day',
  factions: { pdc: 0 },
  /** Aspecto: mañana luminosa junto al mar. */
  envIntensity: 0.5,
  grade: { contrast: 1.05, saturation: 1.08, shadows: '#283448', highlights: '#ffe6c4', vignette: 0.28 },
  /** Relleno apagado: solo se enciende con la tormenta (M04). */
  fillLight: { color: 0xb8c8e0, intensity: 0 },
  bounds: { minX: -100, maxX: 156, minZ: -110, maxZ: 70 },
  waypoints: [
    { id: 'casa', name: 'Casa de Jon', x: -30, y: 0.3, z: 12, yaw: Math.PI },
    { id: 'plaza', name: 'Plaza', x: 0, y: 0.3, z: 6, yaw: Math.PI },
    { id: 'puerto', name: 'Puerto', x: -20, y: 0.3, z: 40, yaw: 0 },
  ],
  build(ctx) {
    return buildVillage(ctx, false);
  },
};

function buildVillage(ctx, night) {
  const { group, builder: B, scene } = ctx;
  // --- Ambiente ---
  const sunDir = night ? new THREE.Vector3(-0.35, 0.45, 0.8) : new THREE.Vector3(0.7, 0.35, -0.2);
  scene.fog = new THREE.FogExp2(night ? 0x34465f : 0xa9bccb, night ? 0.0085 : 0.0045);
  const sky = createSky(night
    ? { top: '#0a1424', horizon: '#3d5577', bottom: '#0c1220', sunDir, sunColor: '#9fb6d6', clouds: 0.82, cloudColor: '#34445c', cloudShade: '#151d2a', stars: 0.6, moonDir: new THREE.Vector3(0.35, 0.55, 0.75) }
    : { top: '#3d6fa8', horizon: '#e9d7b8', bottom: '#5a6a76', sunDir, sunColor: '#fff0c8', clouds: 0.42, cloudColor: '#ffffff', cloudShade: '#b8c2cc' });
  group.add(sky);
  const hemi = new THREE.HemisphereLight(night ? 0x7393c8 : 0xbfd6ee, night ? 0x2c2e3a : 0x6a5a48, night ? 1.35 : 1.05);
  group.add(hemi);
  const sun = createSun({ color: night ? '#a9bfe6' : '#ffe2b8', intensity: night ? 1.5 : 2.3, direction: sunDir.clone().negate(), shadowSize: 48 });
  group.add(sun, sun.target);

  const tex = (t) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.userData = t.userData;
    return c;
  };
  const win = windowTextures('#5a4634');
  const M = {
    // De noche todo está mojado: menos rugoso (brilla con las farolas)
    ground: new THREE.MeshStandardMaterial({ map: tex(cobbleTexture('#66605a', 61)), roughness: night ? 0.55 : 0.92 }),
    paving: new THREE.MeshStandardMaterial({ map: tex(cobbleTexture('#8a8072', 62)), roughness: night ? 0.5 : 0.88 }),
    stone: new THREE.MeshStandardMaterial({ map: tex(stoneWallTexture('#9a907e', 63)), roughness: night ? 0.7 : 0.92 }),
    stoneDark: new THREE.MeshStandardMaterial({ map: tex(stoneWallTexture('#77705f', 64)), roughness: night ? 0.72 : 0.95 }),
    roof: new THREE.MeshStandardMaterial({ map: tex(roofTileTexture('#9a5236', 65)), roughness: night ? 0.6 : 0.85 }),
    cliff: new THREE.MeshStandardMaterial({ map: tex(rockTexture('#57534d', 66)), roughness: 1, flatShading: true }),
    grass: new THREE.MeshStandardMaterial({ map: tex(grassTexture('#3f5236', 67)), roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ map: tex(sandTexture('#b0a284', 68)), roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#7a7e84', 69)), roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3d434b, metalness: 0.7, roughness: 0.45 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x5a3b2c, metalness: 0.4, roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ map: tex(woodTexture('#7a5638', 71)), roughness: 0.85 }),
    crate: new THREE.MeshStandardMaterial({ map: tex(woodTexture('#6a6248', 72)), roughness: 0.9 }),
    // Ventanas con marco y cuarterones; de noche algunas tienen luz dentro
    window: new THREE.MeshStandardMaterial({ map: tex(win.map), emissiveMap: tex(win.emissiveMap), emissive: night ? 0xffb35c : 0x000000, emissiveIntensity: night ? 1.5 : 0, roughness: 0.3 }),
    windowDark: new THREE.MeshStandardMaterial({ map: tex(win.map), roughness: 0.25, envMapIntensity: 1.3 }),
    baseWindow: new THREE.MeshStandardMaterial({ color: 0x14181e, emissive: night ? 0xdfe9ff : 0x000000, emissiveIntensity: night ? 1.2 : 0 }),
    redLight: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: night ? 2.5 : 0.6 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: night ? 2.2 : 0 }),
    water: new THREE.MeshStandardMaterial({ color: night ? 0x0d1a2a : 0x2a5a78, metalness: 0.3, roughness: 0.15, emissive: night ? 0x040a14 : 0x0a1a24 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x59636e, metalness: 0.6, roughness: 0.4 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.6 }),
  };
  // Kit del pueblo (casas, faro, barcas, muelle) y de la PDC (base)
  const V = villageMaterials(night);
  const P = baseMaterials(night);

  // --- Terreno: pueblo, colina norte, acantilado de la base, playa y mar ---
  B.block({ x: -15, z: -20, w: 140, d: 128, y: -1, h: 1, mat: M.ground, cast: false }); // x −85…55, z −84…44
  B.block({ x: 0, z: 0, w: 22, d: 22, y: 0, h: 0.06, mat: V.paving, cast: false, collide: false }); // plaza
  B.block({ x: -15, z: -95, w: 140, d: 30, y: -1, h: 4, mat: M.grass, cast: false }); // colina norte
  B.block({ x: 103.5, z: -48, w: 97, d: 116, y: -1, h: PLATEAU + 1, mat: M.cliff, tag: 'cliff' }); // meseta x 55…152, z −106…10
  // Playa x 55…152, z 10…54: arena (mojada de noche) que baja hasta el agua, con rocas al pie del acantilado
  B.ramp({ x: 103.5, z: 32, w: 97, d: 44, axis: 'z', dir: -1, y0: -1.9, y1: -0.1, base: -3, mat: night ? new THREE.MeshStandardMaterial({ map: tex(sandTexture('#6e665a', 68)), roughness: 0.45 }) : M.sand });
  for (let i = 0; i < 40; i++) {
    const rr = mulberry(200 + i);
    const m = staticMesh(group, rockGeometry(1 + rr() * 1.6, 0.6 + rr() * 0.9, 1 + rr() * 1.4, 300 + i, 1), M.cliff);
    m.position.set(57 + i * 2.4 + rr() * 2, -0.6, 11 + rr() * (i % 3 === 0 ? 30 : 4));
  }
  surroundings(ctx, night);
  B.block({ x: -15, z: 47, w: 140, d: 6, y: -3, h: 3, mat: M.stoneDark, cast: false }); // muelle (borde del puerto)
  const sea = createWater({ width: 900, depth: 700, color: night ? 0x0b1828 : 0x24506a, night, repeat: 90 });
  sea.position.set(0, -1.6, 380);
  group.add(sea);
  ctx.world.addBox({ x: -200, y: -60, z: 50 }, { x: 300, y: -1.9, z: 800 }, { tag: 'sea' }); // fondo
  // Límites del mapa (muros invisibles)
  B.invisibleWall({ x: 28, z: -112, w: 266, d: 2 });
  B.invisibleWall({ x: -100, z: -20, w: 2, d: 200 });
  B.invisibleWall({ x: 156, z: -20, w: 2, d: 200 });
  B.invisibleWall({ x: 28, z: 72, w: 266, d: 2 });
  // Pasaderas al sur del muelle (no se cae al agua: barandilla de piedra baja)
  B.block({ x: -15, z: 44.6, w: 140, d: 0.5, y: 0, h: 0.6, mat: M.stone, climbable: false });

  // --- Montañas y colinas de fondo ---
  backdrop(group, night);

  // --- Casas ---
  // Los tejados del tutorial son azoteas (se corre por ellas); el resto, a dos aguas
  ROOF_ROUTE.forEach((h, i) => fishermanHouse(ctx, B, V, h, { front: 1, roof: 'flat', seed: 400 + i, balcony: i % 2 === 0, shop: i === 2 }));
  OTHER_HOUSES.forEach((h, i) => fishermanHouse(ctx, B, V, h, { front: h.z > 4 ? -1 : 1, roof: 'gable', seed: 500 + i, shop: Math.abs(h.x) < 20 && Math.abs(h.z) < 26 }));
  // Tendederos entre fachadas (callejones)
  laundryLine(group, V, { x0: -14, z0: 16.4, x1: -14, z1: 23.6, y: 3.6 });
  laundryLine(group, V, { x0: -42, z0: -20, x1: -42, z1: -8.6, y: 4.2 });
  const jonHouse = buildJonHouse(ctx, M, V);
  // Escaleras y cajas para subir a los tejados
  B.block({ x: -24, z: -2.6, w: 1.4, d: 1.4, h: 1.6, mat: M.crate }); // junto a R1
  B.block({ x: -26, z: -2.6, w: 1.4, d: 1.4, h: 3.2, mat: M.crate });
  B.block({ x: -6, z: -6.6, w: 1.4, d: 1.4, h: 2.6, mat: M.crate }); // junto a R2 (ruta de la tormenta)
  B.block({ x: 45.8, z: -20, w: 1.4, d: 1.6, h: 1.8, mat: M.crate }); // bajada de R7

  // Iglesia con campanario (hito de la parte alta) y depósito de agua en la colina
  church(ctx, B, V, { x: -44, z: -36 });
  const tank = staticMesh(group, new THREE.CylinderGeometry(3.2, 3.2, 6, 18), V.stone);
  tank.position.set(-20, 3 + 14, -80);
  deco(group, { x: -20, y: 20, z: -80, w: 6.8, h: 0.4, d: 6.8, mat: V.stoneDark });
  B.block({ x: -20, z: -80, w: 4, d: 4, y: 3, h: 11, mat: V.stoneDark });

  // Puerto: muelle de sillería, espigón con el faro, pantalán y barcas de colores
  quay(ctx, B, V, { x0: -84, x1: 54, z: 47, night });
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const m = staticMesh(group, rockGeometry(1.8, 1.2, 1.8, 30 + i, 1), M.cliff);
    m.position.set(-64 - t * 8 + (i % 2) * 1.2, -1.2, 48 + t * 10);
  }
  B.block({ x: -69, z: 54, w: 3.2, d: 13, y: -3, h: 3.6, mat: V.stoneDark });
  const lh = lighthouse(ctx, V, { x: -72, z: 61, y: 0.6, night });
  B.block({ x: -72, z: 61, w: 4.4, d: 4.4, y: -3, h: 3.6, mat: V.stoneDark });
  ctx.addEntity({ update: lh.update });
  B.block({ x: -20, z: 56, w: 3, d: 18, y: -0.4, h: 0.4, mat: V.wood });
  for (let z = 48; z < 65; z += 3) for (const sx of [-1.6, 1.6]) deco(group, { x: -20 + sx, y: -2.2, z, w: 0.22, h: 2.6, d: 0.22, mat: V.wood });
  fishingBoat(ctx, V, { x: -25.5, z: 57, ry: Math.PI / 2 + 0.1, color: 'hullRed' });
  fishingBoat(ctx, V, { x: -14.6, z: 60, ry: -Math.PI / 2 - 0.08, color: 'hullBlue', len: 7 });
  fishingBoat(ctx, V, { x: -36, z: 54.5, ry: 0.05, color: 'hullGreen' });
  fishingBoat(ctx, V, { x: 4, z: 54, ry: -0.1, color: 'hullWhite', len: 5 });
  fishingBoat(ctx, V, { x: 22, z: 55.5, ry: 0.15, color: 'hullRed', len: 6.5 });

  // Farolas (globo luminoso; de noche marcan las calles)
  for (const [x, z] of [[-12, -2], [12, -2], [-12, 12], [12, 12], [-30, 8], [-48, 8], [24, 10], [-38, -16], [40, -6]]) {
    lampPost(group, { x, z, metal: V.metal, glow: V.lantern });
    ctx.world.addBox({ x: x - 0.1, y: 0, z: z - 0.1 }, { x: x + 0.1, y: 4.2, z: z + 0.1 }, { cameraBlocking: false, climbable: false });
  }
  const r = mulberry(11);
  const trees = [];
  for (let i = 0; i < 40; i++) {
    const x = -85 + r() * 140;
    const z = -88 + r() * 16;
    trees.push({ x, y: 3, z, s: 0.7 + r() * 0.5 });
  }
  for (const [x, z] of [[-58, 8], [-60, -14], [-36, 34], [24, 34], [46, 10], [-8, -46], [16, -46]]) trees.push({ x, y: 0, z, s: 0.75 });
  pineForest(ctx, trees);
  // Matorrales en la colina y rocas al pie del acantilado
  const bushes = [];
  for (let i = 0; i < 46; i++) bushes.push({ x: -85 + r() * 140, y: 3, z: -88 + r() * 16, s: 0.5 + r() * 0.6 });
  for (const [x, z] of [[-58, 4], [-60, -10], [-36, 30], [24, 30], [46, 6], [-8, -42], [16, -42], [-66, 26]]) bushes.push({ x, y: 0, z, s: 0.6 });
  scatterBushes(ctx, bushes, night ? 0x22341f : 0x3a5532);
  const rocks = [];
  for (let i = 0; i < 26; i++) rocks.push({ x: 50 + r() * 4, y: 0, z: -90 + r() * 96, s: 0.5 + r() * 0.9 });
  scatterRocks(ctx, rocks, 0x5a5650);

  // Mercado de la plaza (día)
  const stalls = [];
  if (!night) {
    for (const [i, [x, z, color]] of [[-6, -7, 0xc94f3a], [0, -8.5, 0x3a8a5a], [6, -7, 0x3a6ac9]].entries()) {
      stall(B, M, x, z, color, i);
      stalls.push({ id: ['pan', 'patatas', 'pescado'][i], x, y: 0, z: z + 1.4 });
    }
    // Pozo de la plaza
    B.block({ x: 0, z: 4, w: 2.4, d: 2.4, h: 0.9, mat: M.stone });
  }

  // --- Base PDC (meseta) ---
  const base = buildBase(ctx, B, M, P, night);

  // --- Escombros de la tormenta (M04): cortan la calle hacia la casa de Jon ---
  const storm = night ? null : buildStormBarrier(ctx, M);

  // --- Lluvia (noche) ---
  const rain = new Rain(ctx, { count: night ? 2600 : 2200 });
  rain.setIntensity(night ? 1 : 0);
  ctx.addEntity(rain);

  const points = {
    cp01: { x: -19, y: 5.3, z: -8, yaw: Math.PI / 2 },
    iker01: { x: -25, y: 0.2, z: -1 },
    cp02: { x: 49, y: 0.3, z: -20, yaw: Math.PI / 2 },
    cp03: { x: 77.5, y: PLATEAU + 0.2, z: -43.6, yaw: Math.PI / 2 },
    cp04: { x: 90.2, y: PLATEAU + 0.2, z: -52, yaw: Math.PI / 2 },
    cp05: { x: 105.5, y: 14.2, z: -56, yaw: Math.PI },
    cp06: { x: 105.5, y: 14.2, z: -65.5, yaw: Math.PI },
    cp07: { x: 105.5, y: 14.2, z: -58, yaw: 0 },
    cp08: { x: 116, y: 15.2, z: -15, yaw: 0 },
    cliffTop: { x: 58, y: PLATEAU + 0.2, z: -20 },
    fenceGap: { x: 63.5, y: PLATEAU + 0.2, z: -19 },
    vent: { x: 88, y: PLATEAU + 0.6, z: -52 },
    ventOutside: { x: 86.2, y: PLATEAU + 0.2, z: -52 },
    catwalk: { x: 96, y: 14.2, z: -73.6 },
    chamberDoor: { x: 105.5, y: 14.2, z: -61.5 },
    card: base.vitrines.goldenPos,
    stairsTop: { x: 109, y: 14.2, z: -56 },
    balconyDoor: { x: 104, y: 14.2, z: -45.6 },
    balcony: { x: 104, y: 14.2, z: -44 },
    roof: { x: 104, y: 18.6, z: -50 },
    annexRoof: { x: 116, y: 15.2, z: -55 },
    zipStart: { x: 116, y: 15.2, z: -10 },
    beach: { x: 110, y: 0.2, z: 38 },
    // Día
    bed: { x: -33.4, y: 0.2, z: 20.3, yaw: Math.PI / 2 },
    cp09: { x: -32.2, y: 0.2, z: 20.3, yaw: Math.PI / 2 },
    houseDoor: { x: -30, y: 0.2, z: 12.6 },
    houseInside: { x: -30, y: 0.2, z: 16.5 },
    abuela: { x: -27, y: 0, z: 20.4 },
    stove: { x: -26, y: 0, z: 21.2 },
    photo: { x: -30, y: 1.5, z: 21.5 },
    plaza: { x: 0, y: 0.2, z: 2 },
    plazaEntry: { x: -10, y: 0.2, z: 4 },
    cp10: { x: -21.5, y: 0.2, z: 17, yaw: 0 },
    cp11: { x: -32, y: 0.2, z: 19.6, yaw: Math.PI / 2 },
    cp12: { x: -30, y: 0.2, z: 11.5, yaw: Math.PI / 2 },
    cp13: { x: 0, y: 0.2, z: -3, yaw: -Math.PI / 2 },
    cp14: { x: -9.5, y: 5.7, z: -10, yaw: -Math.PI / 2 },
    cp15: { x: -30, y: 0.2, z: 10.5, yaw: 0 },
    cp16: { x: -29, y: 0.2, z: 17.5, yaw: 0 },
    cp17: { x: -29, y: 0.2, z: 17.5, yaw: 0 },
    pier: { x: -20, y: 0.2, z: 50 },
    lookout: { x: 46, y: 0.2, z: 0 },
    alley: { x: -21.5, y: 0.2, z: 18 },
    market: { x: 0, y: 0.2, z: -4 },
  };

  return {
    spawn: night ? points.cp01 : points.cp09,
    sun,
    story: { points, stalls, jonHouse, base, rain, hemi, sky, sun, night, roofs: ROOF_ROUTE, storm },
  };
}

/**
 * Barrera de la tormenta: escombros y vigas caídas en x ≈ −15 que obligan a
 * dar el rodeo por los tejados (R2 → R1). Más baja que los tejados (4 m),
 * así que el salto entre tejados pasa por encima. Oculta hasta la tormenta.
 */
function buildStormBarrier(ctx, M) {
  const { group, world } = ctx;
  const g = new THREE.Group();
  g.visible = false;
  group.add(g);
  const X = -14.75;
  const boxes = [];
  for (const [z0, z1] of [[-110, 16.5], [23.5, 72]]) {
    boxes.push(world.addBox({ x: X - 0.9, y: -3, z: z0 }, { x: X + 0.9, y: 4, z: z1 }, { climbable: false, tag: 'storm' }));
  }
  const rubble = new THREE.MeshStandardMaterial({ color: 0x5d564d, roughness: 1, flatShading: true });
  const burnt = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 1, emissive: 0x3a1206, emissiveIntensity: 0.6 });
  const r = mulberry(77);
  // Montones visibles donde se ve la calle (calle principal, junto a R2 y al sur)
  for (const [z0, z1, n] of [[-4, 16.5, 34], [-24, -16, 10], [24, 44, 18]]) {
    for (let i = 0; i < n; i++) {
      const s = 0.5 + r() * 1.1;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 5 === 0 ? burnt : rubble);
      m.position.set(X + (r() - 0.5) * 2.4, s * 0.5 + r() * 2.2, z0 + r() * (z1 - z0));
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.castShadow = true;
      g.add(m);
    }
  }
  for (const [z, rot] of [[2, 0.5], [9, -0.6], [-20, 0.3], [32, -0.4]]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 7), M.wood);
    beam.position.set(X, 2.2, z);
    beam.rotation.set(rot, 0, 0.4);
    beam.castShadow = true;
    g.add(beam);
  }
  const handle = {
    blocked: false,
    setBlocked(v) {
      this.blocked = v;
      g.visible = v;
      for (const b of boxes) b.enabled = v;
    },
  };
  handle.setBlocked(false);
  return handle;
}

/** Pretil bajo alrededor de una azotea (la de la base). */
function parapet(B, x, z, w, d, y, mat) {
  const t = 0.3;
  const hh = 0.3;
  B.block({ x, z: z - d / 2 + t / 2, w, d: t, y, h: hh, mat });
  B.block({ x, z: z + d / 2 - t / 2, w, d: t, y, h: hh, mat });
  B.block({ x: x - w / 2 + t / 2, z, w: t, d: d - 2 * t, y, h: hh, mat });
  B.block({ x: x + w / 2 - t / 2, z, w: t, d: d - 2 * t, y, h: hh, mat });
}

// ---------------------------------------------------------------- Alrededores
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Rectángulo jugable (fuera, el terreno sigue hasta el horizonte). */
const AREA = { x0: -86, x1: 153, z0: -107, z1: 55 };

/** Altura del suelo en el borde del área jugable (pueblo, colina, meseta, playa o mar). */
function edgeLevel(x, z) {
  if (x > 55) return z > 54 ? -4 : z > 10 ? -0.2 - (z - 10) * 0.04 : PLATEAU;
  if (z > 50) return -4;
  return z < -80 ? 3 : 0;
}

function outerHeight(x, z) {
  const cx = Math.min(AREA.x1, Math.max(AREA.x0, x));
  const cz = Math.min(AREA.z1, Math.max(AREA.z0, z));
  const out = Math.hypot(x - cx, z - cz);
  const lv = edgeLevel(cx, cz);
  if (out === 0) {
    // Dentro: por debajo de los bloques del mapa (junto al borde, casi a ras para no dejar rendija)
    const edge = Math.min(x - AREA.x0, AREA.x1 - x, z - AREA.z0, AREA.z1 - z);
    return edge < 7 ? lv - 0.35 : lv - 5;
  }
  const coast = 1 - smooth(18, 58, z);
  const hills = (Math.min(34, 0.13 * out) + 6 * Math.sin(x * 0.021 + 1) * Math.sin(z * 0.027 + 0.4) * smooth(0, 40, out)) * coast;
  let y = lv + Math.max(-1, hills);
  if (z > 48) y = Math.min(y, lv - (z - 48) * 0.25, -2.5);
  return y;
}

/**
 * Alrededores: el terreno continúa más allá del pueblo y de la base (colinas
 * con pinos al norte, al oeste y al este; la costa baja al mar por el sur),
 * así que desde ningún punto se ve el borde del mapa ni el vacío.
 */
function surroundings(ctx, night) {
  terrain(ctx, {
    minX: -340, minZ: -380, maxX: 400, maxZ: 96, cell: 6, height: outerHeight, simple: true,
    grass: grassTexture(night ? '#33432c' : '#4a5c3a', 67), dirt: sandTexture('#a89a7c', 68), rock: rockTexture('#5a5650', 66),
    splat: (x, z, y, slope) => [z > 22 && y < 3 ? 0.9 : 0, smooth(0.7, 1.3, slope)],
    tint: (x, z) => 0.9 + 0.1 * Math.sin(x * 0.05 + z * 0.04),
  });
  const r = mulberry(91);
  const trees = [];
  for (let i = 0; i < 6000 && trees.length < 700; i++) {
    const x = -320 + r() * 700;
    const z = -360 + r() * 390;
    const outside = x < AREA.x0 - 4 || x > AREA.x1 + 4 || z < AREA.z0 - 6;
    if (!outside || z > 24) continue;
    const y = outerHeight(x, z);
    if (y < 0.5) continue;
    trees.push({ x, y: y - 0.2, z, s: 0.9 + r() * 1 });
  }
  pineForest(ctx, trees, { far: true });
}

/**
 * Casa de Jon: interior con cama, mesa, cocina y foto; puerta al norte.
 * Tiene dos versiones (intacta y en ruinas) que el guion alterna.
 */
function buildJonHouse(ctx, M, V) {
  const { group, world } = ctx;
  const H = JON_HOUSE;
  const x0 = H.x - H.w / 2;
  const x1 = H.x + H.w / 2;
  const z0 = H.z - H.d / 2;
  const z1 = H.z + H.d / 2;
  const t = 0.3;
  const intact = new THREE.Group();
  const ruined = new THREE.Group();
  group.add(intact, ruined);
  const intactBoxes = [];
  const ruinedBoxes = [];
  const box = (g, list, { x, y = 0, z, w, d, h, mat, collide = true, cast = true }) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUVs(geo, w, h, d, mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
    if (collide) list.push(world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { climbable: true }));
    return m;
  };
  // --- Intacta ---
  const door = 1.6;
  const wallM = V.plasterCream;
  box(intact, intactBoxes, { x: (x0 + H.x - door / 2) / 2, z: z0 + t / 2, w: H.x - door / 2 - x0, d: t, h: H.h, mat: wallM });
  box(intact, intactBoxes, { x: (H.x + door / 2 + x1) / 2, z: z0 + t / 2, w: x1 - H.x - door / 2, d: t, h: H.h, mat: wallM });
  box(intact, intactBoxes, { x: H.x, z: z0 + t / 2, y: 2.4, w: door, d: t, h: H.h - 2.4, mat: wallM });
  box(intact, intactBoxes, { x: H.x, z: z1 - t / 2, w: H.w, d: t, h: H.h, mat: wallM });
  box(intact, intactBoxes, { x: x0 + t / 2, z: H.z, w: t, d: H.d - 2 * t, h: H.h, mat: wallM });
  box(intact, intactBoxes, { x: x1 - t / 2, z: H.z, w: t, d: H.d - 2 * t, h: H.h, mat: wallM });
  box(intact, intactBoxes, { x: H.x, z: H.z, y: H.h, w: H.w, d: H.d, h: 0.3, mat: V.terrace });
  // Zócalo de piedra, esquinas claras, contraventanas verdes y tejado de teja (solo la casa entera)
  for (const [x, z, w, d] of [[H.x, z0 - 0.06, H.w + 0.12, 0.12], [H.x, z1 + 0.06, H.w + 0.12, 0.12], [x0 - 0.06, H.z, 0.12, H.d], [x1 + 0.06, H.z, 0.12, H.d]]) {
    box(intact, intactBoxes, { x, z, w, d, h: 0.8, mat: V.stone, collide: false });
  }
  for (const sx of [-3, 3]) for (const dx of [-0.75, 0.75]) box(intact, intactBoxes, { x: H.x + sx + dx, z: z0 - 0.07, y: 1.35, w: 0.45, d: 0.05, h: 1.1, mat: V.green, collide: false, cast: false });
  box(intact, intactBoxes, { x: H.x, z: z0 - 0.08, y: 0, w: 1.3, d: 0.06, h: 2.4, mat: V.green, collide: false, cast: false });
  gableRoof({ group: intact, world: ctx.world }, { x: H.x, z: H.z, w: H.w, d: H.d, y: H.h + 0.3, rise: 2.4, along: 'x', roofMat: V.roof, wallMat: wallM, collide: false });
  intact.traverse((o) => { o.userData.levelStatic = false; });
  box(intact, intactBoxes, { x: H.x - 3, z: z0 - 0.04, y: 1.4, w: 1, d: 0.06, h: 1, mat: M.window, collide: false });
  box(intact, intactBoxes, { x: H.x + 3, z: z0 - 0.04, y: 1.4, w: 1, d: 0.06, h: 1, mat: M.window, collide: false });
  // Muebles (también en la versión en ruinas, algunos)
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.9 });
  const furniture = new THREE.Group();
  group.add(furniture);
  const fbox = (o) => box(furniture, intactBoxes, o);
  fbox({ x: x0 + 1.6, z: z1 - 1.3, w: 2.2, d: 1.2, h: 0.55, mat: bedMat });
  fbox({ x: H.x + 2.5, z: H.z + 0.5, w: 1.6, d: 1, h: 0.8, mat: M.wood });
  fbox({ x: x1 - 0.8, z: z1 - 0.8, w: 1.2, d: 1, h: 0.95, mat: M.metal });
  // Foto familiar en la pared del fondo
  const photoMat = new THREE.MeshStandardMaterial({ map: photoTexture(), roughness: 0.6 });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), photoMat);
  photo.position.set(H.x, 1.6, z1 - t - 0.02);
  photo.rotation.y = Math.PI;
  intact.add(photo);
  // --- En ruinas: muros rotos, tejado hundido y escombros ---
  const rubble = new THREE.MeshStandardMaterial({ color: 0x6d665b, roughness: 1, flatShading: true });
  box(ruined, ruinedBoxes, { x: (x0 + H.x - door / 2) / 2, z: z0 + t / 2, w: H.x - door / 2 - x0, d: t, h: 2.2, mat: V.stoneDark });
  box(ruined, ruinedBoxes, { x: x1 - 1.5, z: z0 + t / 2, w: 3, d: t, h: 3.1, mat: V.plasterCream });
  box(ruined, ruinedBoxes, { x: H.x - 2, z: z1 - t / 2, w: 6, d: t, h: 2.6, mat: V.stoneDark });
  box(ruined, ruinedBoxes, { x: x0 + t / 2, z: H.z + 1, w: t, d: 5, h: 1.8, mat: V.plasterCream });
  box(ruined, ruinedBoxes, { x: x1 - t / 2, z: H.z - 1.5, w: t, d: 4, h: 3.4, mat: V.stoneDark });
  const r = mulberry(5);
  for (let i = 0; i < 22; i++) {
    const s = 0.4 + r() * 0.8;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 3 ? rubble : M.roof);
    m.position.set(x0 + 1 + r() * (H.w - 2), s * 0.5, z0 + 3.5 + r() * (H.d - 4));
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.castShadow = true;
    ruined.add(m);
  }
  // Viga caída sobre la abuela (la escena la coloca debajo)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 0.4), M.wood);
  beam.position.set(x0 + 2.4, 0.55, z1 - 1.6);
  beam.rotation.set(0.1, 0.3, 0.25);
  beam.castShadow = true;
  ruined.add(beam);
  const handle = {
    intact, ruined, furniture,
    ruinedState: false,
    setRuined(v) {
      this.ruinedState = v;
      intact.visible = !v;
      ruined.visible = v;
      for (const b of intactBoxes) b.enabled = !v;
      for (const b of ruinedBoxes) b.enabled = v;
    },
  };
  handle.setRuined(false);
  return handle;
}

function photoTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#d9c7a0';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#8a9fb5';
  g.fillRect(8, 8, 112, 80);
  g.fillStyle = '#e8d9c0';
  g.fillRect(8, 60, 112, 28);
  // Dos siluetas: una mujer mayor y un niño
  g.fillStyle = '#4c3a46';
  g.beginPath();
  g.arc(48, 42, 9, 0, Math.PI * 2);
  g.fill();
  g.fillRect(38, 50, 20, 30);
  g.fillStyle = '#2a3040';
  g.beginPath();
  g.arc(78, 52, 7, 0, Math.PI * 2);
  g.fill();
  g.fillRect(71, 58, 14, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Puesto del mercado: mostrador con género, postes y toldo a rayas. */
function stall(B, M, x, z, color, i = 0) {
  const stripe = ['#b8322a', '#2f6a4a', '#2b4f7d'][i % 3];
  const canvas = new THREE.MeshStandardMaterial({ map: awningTexture(stripe, '#efe6d2'), roughness: 0.85, side: THREE.DoubleSide });
  B.block({ x, z, w: 3, d: 1.4, h: 0.9, mat: M.wood });
  for (const sx of [-1.4, 1.4]) B.block({ x: x + sx, z: z - 0.6, w: 0.12, d: 0.12, h: 2.4, mat: M.wood, cameraBlocking: false });
  const awning = B.block({ x, z: z - 0.2, w: 3.4, d: 2, y: 2.4, h: 0.08, mat: canvas, collide: false });
  awning.rotation.x = -0.18;
  // Género: cajas con pan, patatas o pescado
  const goods = new THREE.MeshStandardMaterial({ color: [0xc8964a, 0xa8865a, 0x9fb4c0][i % 3], roughness: 0.8 });
  for (const sx of [-0.9, 0, 0.9]) B.block({ x: x + sx, z: z + 0.1, w: 0.7, d: 0.5, y: 0.9, h: 0.22, mat: goods, collide: false });
  void color;
}

/** Montañas y colinas lejanas (solo decorado, una malla). */
function backdrop(group, night) {
  const r = mulberry(3);
  const peaks = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (1.05 + i / 16 * 0.9);
    const dist = 260 + r() * 120;
    const h = 60 + r() * 90;
    peaks.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, rad: 70 + r() * 60, h, y0: -8 });
  }
  const m = createMountains(peaks, night
    ? { rock: '#1d2636', low: '#121a22', snow: '#5d6d86', snowLine: 0.74, seed: 31 }
    : { rock: '#66707c', low: '#4a5a46', snow: '#eef2f6', snowLine: 0.7, seed: 31 });
  group.add(m);
}

// ---------------------------------------------------------------- Base de la PDC
function buildBase(ctx, B, M, P, night) {
  const Y = PLATEAU;
  const { group } = ctx;
  const r = mulberry(61);
  // Suelo de hormigón de la base (mojado de noche) y franja de roca y hierba junto al borde
  B.block({ x: 106, z: -45.75, w: 88, d: 110.5, y: Y - 0.08, h: 0.1, mat: P.ground, collide: false, cast: false });
  // Acantilado: masas de roca sobre la cara oeste y escalones marcados en blanco (la ruta de Iker, z ≈ −20)
  for (let z = -104; z < 9; z += 3.4) {
    if (z > -24 && z < -15) continue;
    for (let k = 0; k < 3; k++) {
      const sy = 1.4 + ((Math.round(z) + k) % 3) * 0.7;
      const m = staticMesh(group, rockGeometry(1.4 + (k % 2) * 0.6, sy, 1.8 + r(), Math.round(z * 7) + k * 3 + 900, 1), M.cliff);
      m.position.set(54.4 + r() * 0.5, k * 3.4 + sy * 0.4, z + (k - 1) * 0.8);
    }
  }
  B.block({ x: 52.5, z: -20, w: 3, d: 6, y: 0, h: 3.2, mat: M.cliff });
  B.block({ x: 54, z: -20, w: 2, d: 5, y: 0, h: 6.6, mat: M.cliff });
  for (const [x, z, h] of [[52.5, -20, 3.2], [54, -20, 6.6]]) {
    const m = staticMesh(group, rockGeometry(1.2, h * 0.45, 2.4, Math.round(h * 13), 1), M.cliff);
    m.position.set(x - 0.4, h * 0.45, z + 0.6);
  }
  climbMark(group, P.stripWhite, { x: 50.98, y: 3.2, z: -20, w: 0.1, d: 2.2 });
  climbMark(group, P.stripWhite, { x: 52.98, y: 6.6, z: -20, w: 0.1, d: 2 });
  climbMark(group, P.stripWhite, { x: 54.98, y: Y, z: -19, w: 0.1, d: 2.4 });
  // Valla de malla en el borde del acantilado (x = 62) con el hueco roto en z −21…−17; valla sur sobre la playa
  chainFence(ctx, P, { x0: 62, z0: -100.5, x1: 62, z1: 9.5, y: Y, gap: [-21, -17] });
  chainFence(ctx, P, { x0: 62, z0: 9.5, x1: 149, z1: 9.5, y: Y });
  // Muro perimetral con pasarela (norte y este) y puesto de control en la entrada norte
  perimeterWall(ctx, B, P, { x0: 62, z0: -101.5, x1: 90, z1: -101.5, y: Y, outside: -1 });
  perimeterWall(ctx, B, P, { x0: 106, z0: -101.5, x1: 150, z1: -101.5, y: Y, outside: -1 });
  perimeterWall(ctx, B, P, { x0: 150, z0: -101.5, x1: 150, z1: 9.5, y: Y, outside: 1 });
  gatehouse(ctx, B, P, { x: 100, z: -101.5, y: Y, w: 10, night });
  banner(ctx, P, { x: 94.4, y: Y + 4.9, z: -100.9, ry: 0 });
  banner(ctx, P, { x: 105.6, y: Y + 4.9, z: -100.9, ry: 0 });
  for (const [x, z] of [[65, -98], [147, -98], [147, 6.5], [65, 6.5]]) watchtower(ctx, B, P, { x, z, y: Y, h: 9, night });
  // Coberturas del patio (mismas posiciones que pide el sigilo): cajas de suministros y un contenedor
  for (const [x, z, w, d, h] of [[69, -27, 2, 1.6, 1.4], [74, -34, 3, 1.4, 1.5], [70, -42, 1.6, 1.6, 1.4], [79, -40, 2.4, 1.4, 1.5], [80, -47, 1.6, 2.4, 1.5], [66, -36, 1.4, 1.4, 1.2]]) {
    B.block({ x, z, w, d, y: Y, h, mat: M.crate });
    deco(group, { x, y: Y + h * 0.45, z, w: w + 0.04, h: 0.12, d: d + 0.04, mat: P.pdcBlue, cast: false });
  }
  container(ctx, B, P, { x: 84, y: Y, z: -30, along: 'x', color: 0 });
  // Zona de contenedores al sur (grúa pórtico encima) y al noroeste: calles estrechas y oscuras
  for (const [x, z, along, color, levels] of [[71, -3.5, 'x', 1, 2], [71, 1.5, 'x', 3, 1], [79, -6, 'x', 2, 1], [79, -1, 'x', 4, 2], [87, 2, 'z', 5, 1],
    [68, -79, 'z', 1, 2], [68, -88, 'z', 2, 1], [75, -93, 'x', 4, 1], [80, -81, 'z', 3, 2], [86, -91, 'x', 0, 1]]) {
    for (let k = 0; k < levels; k++) container(ctx, B, P, { x: x + k * 0.2, y: Y + k * 2.6, z: z + k * 0.1, along, color: color + k * 2 });
  }
  gantry(ctx, B, P, { x0: 69, x1: 93.5, z0: -10, z1: 5.5, y: Y, h: 14 });
  // Torres de los focos que barren el patio (estructura de celosía)
  for (const [x, z] of [[74, -14], [96, -32]]) {
    B.block({ x, z, w: 1.2, d: 1.2, y: Y, h: 8, mat: P.metal });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: x + sx * 1.1, y: Y, z: z + sz * 1.1, w: 0.16, h: 8, d: 0.16, mat: P.metal, rx: sz * 0.06, rz: -sx * 0.06 });
    for (const yy of [2.5, 5]) deco(group, { x, y: Y + yy, z, w: 2.4, h: 0.1, d: 2.4, mat: P.metal, cast: false });
    B.block({ x, z, w: 2.6, d: 2.6, y: Y + 8, h: 0.25, mat: P.rust });
    B.block({ x, z, w: 0.2, d: 0.2, y: Y + 8.25, h: 2.5, mat: P.metal, collide: false });
    B.block({ x, z, w: 0.3, d: 0.3, y: Y + 10.7, h: 0.3, mat: P.redLight, collide: false });
  }
  const lightA = new Searchlight(ctx, { origin: { x: 74, y: Y + 8.9, z: -14 }, a: { x: 64, z: -27 }, b: { x: 86, z: -23 }, y: Y, radius: 3.4, period: 10 });
  const lightB = new Searchlight(ctx, { origin: { x: 96, y: Y + 8.9, z: -32 }, a: { x: 72, z: -38 }, b: { x: 84, z: -52 }, y: Y, radius: 3.2, period: 8, phase: 3 });
  ctx.addEntity(lightA);
  ctx.addEntity(lightB);

  // --- Edificio principal: x 88…112, z −75…−45, dos plantas (suelo a 10 y 14), azotea a 18.4 ---
  const X0 = 88;
  const X1 = 112;
  const Z0 = -75;
  const Z1 = -45;
  const T = 0.4;
  const wallMat = P.concrete;
  const wall = (o) => B.block({ ...o, mat: o.mat ?? wallMat, climbable: o.climbable ?? false });
  // Oeste con el conducto (z −52.7…−51.3, 1.2 de alto)
  wall({ x: X0 + T / 2, z: (Z0 + -52.7) / 2, w: T, d: -52.7 - Z0, y: Y, h: 8 });
  wall({ x: X0 + T / 2, z: (-51.3 + Z1) / 2, w: T, d: Z1 - -51.3, y: Y, h: 8 });
  wall({ x: X0 + T / 2, z: -52, w: T, d: 1.4, y: Y + 1.2, h: 6.8 });
  // Norte y este
  wall({ x: (X0 + X1) / 2, z: Z0 + T / 2, w: X1 - X0, d: T, y: Y, h: 8 });
  wall({ x: X1 - T / 2, z: (Z0 + Z1) / 2, w: T, d: Z1 - Z0, y: Y, h: 8 });
  // Sur: puerta principal abajo (x 107…109.4) y puerta al balcón arriba (x 103…105)
  wall({ x: (X0 + 107) / 2, z: Z1 - T / 2, w: 107 - X0, d: T, y: Y, h: 4 });
  wall({ x: (109.4 + X1) / 2, z: Z1 - T / 2, w: X1 - 109.4, d: T, y: Y, h: 4 });
  wall({ x: 108.2, z: Z1 - T / 2, w: 2.4, d: T, y: Y + 2.6, h: 1.4 });
  wall({ x: (X0 + 103) / 2, z: Z1 - T / 2, w: 103 - X0, d: T, y: Y + 4, h: 4 });
  wall({ x: (105 + X1) / 2, z: Z1 - T / 2, w: X1 - 105, d: T, y: Y + 4, h: 4 });
  wall({ x: 104, z: Z1 - T / 2, w: 2, d: T, y: Y + 6.5, h: 1.5 });
  // Piel brutalista: forjados, bandas de ventanas, aletas y franjas azules (respetando conducto, puertas y balcón)
  facilitySkin(ctx, P, {
    x0: X0, x1: X1, z0: Z0, z1: Z1, y: Y, floors: 2, fh: 4,
    skip: [{ face: 'x0', a0: -53.4, a1: -50.6, y0: Y, y1: Y + 1.8 }, { face: 'z1', a0: 101.6, a1: 110.2, y0: Y, y1: Y + 8 }, { face: 'x1', a0: -70, a1: -50, y0: Y, y1: Y + 5 }],
  });
  for (const x of [92.5, 97.5]) banner(ctx, P, { x, y: Y + 7.9, z: Z1 + 0.55, ry: 0, w: 2, h: 4.4 });
  // Marquesina de la entrada principal
  deco(group, { x: 108.9, y: Y + 3.1, z: Z1 + 1.5, w: 2.8, h: 0.3, d: 3, mat: P.concreteDark });
  deco(group, { x: 108.9, y: Y + 3.05, z: Z1 + 1.5, w: 2.82, h: 0.06, d: 3.02, mat: P.strip, cast: false });
  // Azotea con pretil y equipos
  wall({ x: (X0 + X1) / 2, z: (Z0 + Z1) / 2, w: X1 - X0, d: Z1 - Z0, y: Y + 8, h: T, mat: M.stoneDark });
  parapet(B, (X0 + X1) / 2, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, Y + 8 + T, M.metal);
  for (const [x, z] of [[94, -60], [100, -68], [96, -50]]) {
    B.block({ x, z, w: 2, d: 1.4, y: Y + 8.4, h: 1, mat: P.plate });
    deco(group, { x, y: Y + 9.4, z, w: 1, h: 0.18, d: 1, mat: P.metal });
  }
  // Mástil de antenas con balizas, radar que gira, parabólica y lucernario
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: 92 + sx * 0.45, y: Y + 8.4, z: -72 + sz * 0.45, w: 0.09, h: 8, d: 0.09, mat: P.metal });
  for (let k = 1; k < 8; k += 1.6) deco(group, { x: 92, y: Y + 8.4 + k, z: -72, w: 1, h: 0.05, d: 1, mat: P.metal, cast: false });
  for (const k of [4.2, 8.2]) {
    B.block({ x: 92, z: -72, w: 0.3, d: 0.3, y: Y + 8.4 + k, h: 0.3, mat: P.redLight, collide: false });
    if (night) {
      const gl = glowSprite(new THREE.Color(0xff3020), 1.3, 0.75);
      gl.position.set(92, Y + 8.6 + k, -72);
      group.add(gl);
    }
  }
  ctx.addEntity(radar(ctx, P, { x: 108, y: Y + 8.4, z: -71 }));
  dish(ctx, P, { x: 90.6, y: Y + 8.4, z: -48.2, r: 1.6, ry: 2.6 });
  deco(group, { x: 98.5, y: Y + 8.4, z: -56, w: 3.6, h: 0.45, d: 5, mat: P.concreteDark });
  deco(group, { x: 98.5, y: Y + 8.85, z: -56, w: 3, h: 0.4, d: 4.4, mat: P.skylight, cast: false });

  // Planta baja (oeste): almacén con cajas para trepar a la pasarela norte (y 14)
  for (const [x, z, h] of [[95, -71.5, 1.3], [96.6, -71.5, 2.6]]) B.block({ x, z, w: 1.5, d: 1.5, y: Y, h, mat: M.crate, climbable: true });
  B.block({ x: 94.2, z: -73.6, w: 11.6, d: 2, y: Y + 3.8, h: 0.2, mat: M.rust }); // pasarela norte x 88.4…100
  // Tabique oeste/este a la altura de la planta alta (x = 100), con paso desde la pasarela
  wall({ x: 100, z: (-72.6 + Z1) / 2, w: T, d: Z1 - -72.6, y: Y, h: 8 });
  wall({ x: 100, z: -73.8, w: T, d: 1.6, y: Y + 6.4, h: 1.6 });
  // Planta alta (este): losa a y 14, cámara al norte (z −75…−62) y pasillo al sur
  B.block({ x: 106, z: (Z0 + Z1) / 2, w: 12, d: Z1 - Z0, y: Y + 3.8, h: 0.2, mat: M.concrete });
  wall({ x: (100 + 104.6) / 2, z: -62, w: 4.6, d: T, y: Y + 4, h: 4 });
  wall({ x: (106.6 + X1) / 2, z: -62, w: X1 - 106.6, d: T, y: Y + 4, h: 4 });
  wall({ x: 105.6, z: -62, w: 2, d: T, y: Y + 6.4, h: 1.6 });
  // Hueco de la escalera hacia la salida principal (x 106.5…111.6, z −60…−46)
  const stairs = B.stairs({ x: 109, z: -59, width: 2.2, axis: 'z', dir: 1, y0: Y, y1: Y + 4, mat: M.metal, solid: false });
  void stairs;
  // Planta baja este (bajo la losa): cerrada salvo la escalera y la puerta principal
  wall({ x: 104, z: (-62 + Z1) / 2, w: T, d: Z1 + 62, y: Y, h: 3.8 });
  // Compuerta de la escalera y persiana de seguridad de la entrada (recogidas; bajan con la alarma)
  const shutterStairs = new Shutter(ctx, { x: 109, z: -59.6, w: 2.6, d: 0.2, y: Y + 4, h: 2.6, mat: P.plate, open: true });
  const shutterMain = new Shutter(ctx, { x: 108.2, z: Z1 + 0.05, w: 2.4, d: 0.12, y: Y, h: 2.6, mat: P.plate, open: true });
  // Entrada principal: doble puerta de cristal con marco y control de acceso (cerrada con llave)
  mainDoor(ctx, B, P, { x: 108.2, z: Z1 - 0.2, y: Y, w: 2.4, h: 2.6 });
  const shutterChamber = new Shutter(ctx, { x: 105.6, z: -62, w: 2, d: 0.3, y: Y + 4, h: 2.4, mat: M.metal, open: true });
  ctx.addEntity(shutterStairs);
  ctx.addEntity(shutterMain);
  ctx.addEntity(shutterChamber);
  // Tapa del conducto (Iker la abre)
  const ventCover = new Shutter(ctx, { x: X0 - 0.05, z: -52, w: 0.12, d: 1.4, y: Y, h: 1.2, mat: M.metal, open: false });
  ctx.addEntity(ventCover);

  // Cámara de contención: cinco vitrinas
  const vitrines = new CardVitrines(ctx, { x: 106, z: -69, y: Y + 4, spacing: 2.2 });
  ctx.addEntity(vitrines);
  // Documentos (exploración opcional)
  const documents = [
    { id: 'informe', x: 91, y: Y + 1, z: -47, title: 'Informe de vigilancia', text: 'Patrullas costeras: aumentar controles en los pueblos del litoral. Prioridad: localizar Encarnaciones.' },
    { id: 'inventario', x: 110.5, y: Y + 5, z: -50, title: 'Inventario · Proyecto Ascend', text: 'Cinco objetos en contención. Cuatro sin identificar. Uno catalogado como «Destino».' },
    { id: 'turnos', x: 98.5, y: Y + 1, z: -60, title: 'Cuadrante de turnos', text: 'Cambio de guardia del conducto oeste: cada 25 minutos. No dejar el puesto sin relevo.' },
  ];
  const docMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, emissive: 0x2a2a20, roughness: 0.8 });
  for (const d of documents) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.36), docMat);
    m.position.set(d.x, d.y + 0.02, d.z);
    m.rotation.y = 0.3;
    group.add(m);
    B.block({ x: d.x, z: d.z, w: 1.4, d: 0.8, y: d.y - 0.95, h: 0.95, mat: M.metal, collide: true });
  }

  // Balcón sur, andamio de mantenimiento hasta la azotea
  B.block({ x: 104.5, z: -43.6, w: 4, d: 2.4, y: Y + 3.8, h: 0.2, mat: M.rust });
  B.block({ x: 106.9, z: -43.6, w: 0.8, d: 1.2, y: Y, h: 8.75, mat: M.metal, climbable: true });
  // Anexo este (azotea a 15) y pasarela hasta la torre de la tirolina
  B.block({ x: 116, z: -60, w: 8, d: 20, y: Y, h: 5, mat: M.concrete, climbable: false });
  serviceDoor(ctx, P, { x: 116, z: -49.95, y: Y, face: 1, night });
  for (const z of [-66, -60, -54]) deco(group, { x: 120.04, y: Y + 3, z, w: 0.06, h: 0.8, d: 2.4, mat: night ? P.window : P.windowDark, cast: false });
  ladderRungs(group, P.metal, { x: 120.1, z: -67.5, y: Y, h: 5, face: 'x' });
  B.bridge({ from: { x: 116, y: Y + 5, z: -50 }, to: { x: 116, y: Y + 5, z: -16 }, width: 2.2, mat: M.rust, rails: M.metal });
  B.block({ x: 116, z: -11, w: 6, d: 10, y: Y, h: 5, mat: P.concrete, climbable: false }); // torre de la tirolina (caseta de mantenimiento)
  deco(group, { x: 116, y: Y + 4.6, z: -11, w: 6.2, h: 0.4, d: 10.2, mat: P.concreteDark });
  serviceDoor(ctx, P, { x: 112.95, z: -9, y: Y, face: -1, axis: 'x', night });
  ladderRungs(group, P.metal, { x: 116, z: -16.1, y: Y, h: 5, face: 'z' });
  B.block({ x: 116, z: -7.5, w: 0.3, d: 0.3, y: Y + 5, h: 4, mat: M.metal, collide: false });
  B.block({ x: 116, z: -7.5, w: 0.4, d: 0.4, y: Y + 9, h: 0.3, mat: M.redLight, collide: false });
  const zipline = new Zipline(ctx, { from: { x: 116, y: Y + 7.6, z: -8 }, to: { x: 110, y: 2.3, z: 38 } });

  // Helipuerto, garaje, depósitos y camiones; focos con charcos de luz y zonas oscuras entre ellos
  B.block({ x: 133, z: -30, w: 17, d: 17, y: Y, h: 0.25, mat: [P.concreteDark, P.concreteDark, P.helipad, P.concreteDark, P.concreteDark, P.concreteDark] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    deco(group, { x: 133 + Math.cos(a) * 8.2, y: Y + 0.25, z: -30 + Math.sin(a) * 8.2, w: 0.25, h: 0.12, d: 0.25, mat: i % 2 ? P.stripWhite : P.strip, cast: false });
  }
  helicopter(ctx, P, { x: 133, y: Y + 0.25, z: -30, ry: 0.6 });
  B.block({ x: 132, z: -90, w: 20, d: 14, y: Y, h: 6.5, mat: P.concrete, climbable: false });
  for (const x of [125, 132, 139]) rollDoor(ctx, P, { x, y: Y, z: -82.95, w: 5, h: 4.4 });
  serviceDoor(ctx, P, { x: 128.5, z: -82.95, y: Y, face: 1, night, w: 1.1 });
  deco(group, { x: 132, y: Y + 5.2, z: -82.92, w: 20, h: 0.12, d: 0.06, mat: P.strip, cast: false });
  for (const z of [-62, -53]) {
    const t = staticMesh(group, new THREE.CylinderGeometry(2.6, 2.6, 5.5, 20), P.metalLight);
    t.position.set(142, Y + 2.75, z);
    deco(group, { x: 142, y: Y + 3.6, z, w: 5.3, h: 0.4, d: 5.3, mat: P.hazard, cast: false });
    ctx.world.addBox({ x: 139.4, y: Y, z: z - 2.6 }, { x: 144.6, y: Y + 5.5, z: z + 2.6 }, { climbable: false });
  }
  truck(ctx, B, P, { x: 95.5, y: Y, z: -91, ry: Math.PI / 2 });
  if (night) lightPool(group, { x: 95.3, y: Y, z: -83, r: 4.5, color: 0xfff4e0, opacity: 0.3 });
  truck(ctx, B, P, { x: 104.5, y: Y, z: -88, ry: -Math.PI / 2 });
  truck(ctx, B, P, { x: 124, y: Y, z: -46, ry: 0 });
  for (const [x, z] of [[98, -82], [102, -82]]) jersey(ctx, B, P, { x, y: Y, z, along: 'x', len: 3 });
  floodlight(ctx, B, P, { x: 120, z: -41, y: Y, h: 10, aim: { x: 133, z: -30 }, night });
  floodlight(ctx, B, P, { x: 90, z: -94, y: Y, h: 10, aim: { x: 100, z: -92 }, night });
  floodlight(ctx, B, P, { x: 66, z: 4, y: Y, h: 10, aim: { x: 76, z: -4 }, night, intensity: 40 });

  // Alarmas: balizas y dos luces rojas reales (siempre creadas; solo cambia su intensidad)
  const alarms = new AlarmLights(ctx, [
    { x: 94, y: Y + 3.5, z: -45.6 }, { x: 106, y: Y + 7.5, z: -60 }, { x: 101, y: Y + 7.5, z: -50 },
    { x: 89, y: Y + 3.5, z: -60 }, { x: 110, y: Y + 7.5, z: -70 },
  ]);
  // Una sola luz roja real (las balizas son emisivas): cada luz encarece todos los píxeles
  for (const p of [{ x: 100, y: Y + 6, z: -56 }]) {
    const l = new THREE.PointLight(0xff2020, 0, 30, 1.4);
    l.position.set(p.x, p.y, p.z);
    group.add(l);
    alarms.addLight(l);
  }
  ctx.addEntity(alarms);

  // Guardias de sigilo: rutas que rodean cajas y paredes (rejilla de navegación de la meseta)
  const nav = new NavGrid(ctx.world, { x0: 56, x1: 151, z0: -105, z1: 9.5, y: Y, cell: 0.75 });
  const guard = (o) => new StealthGuard(ctx, { y: Y, nav, ...o });
  const guards = [
    guard({ id: 'patio', route: [{ x: 66, z: -31, wait: 2.5 }, { x: 87, z: -36, wait: 2.5 }], speed: 1.6, range: 12, fov: 38 }),
    guard({ id: 'fachada', route: [{ x: 76, z: -54, wait: 2 }, { x: 76, z: -62, wait: 2 }, { x: 70, z: -60, wait: 1.5 }], speed: 1.4, range: 11, fov: 36 }),
    guard({ id: 'conducto1', route: [{ x: 85.6, z: -50.2, wait: 999, yaw: -Math.PI / 2 }], range: 10, fov: 32 }),
    guard({ id: 'conducto2', route: [{ x: 85.6, z: -54, wait: 999, yaw: -Math.PI / 2 }], range: 10, fov: 32 }),
    guard({ id: 'almacen', route: [{ x: 91, z: -66, wait: 2.5 }, { x: 98, z: -66, wait: 2.5 }, { x: 98, z: -57, wait: 2 }], speed: 1.3, range: 9, fov: 36 }),
    // El resto de la base también está vigilado (lejos de la ruta del sigilo)
    guard({ id: 'puerta', route: [{ x: 96.5, z: -96.5, wait: 4, look: Math.PI }, { x: 103.5, z: -96.5, wait: 4, look: Math.PI }], speed: 1.1, range: 10, fov: 34 }),
    guard({ id: 'helipuerto', route: [{ x: 123.5, z: -40, wait: 2 }, { x: 143, z: -40, wait: 2 }, { x: 143, z: -20, wait: 2 }, { x: 123.5, z: -20, wait: 2 }], speed: 1.4, range: 11, fov: 36 }),
    guard({ id: 'garaje', route: [{ x: 128.5, z: -79.6, wait: 6, look: 0 }, { x: 121, z: -76, wait: 3 }], speed: 1.1, range: 10, fov: 34 }),
  ];
  for (const g of guards) ctx.addEntity(g);

  // Fluorescentes del interior: de noche son la única luz dentro de la base
  if (night) {
    const panel = new THREE.MeshStandardMaterial({ color: 0x1a1c20, emissive: 0xeef4ff, emissiveIntensity: 1.6 });
    // Dos luces reales (almacén y planta alta) y cuatro paneles emisivos
    for (const [x, z, color, intensity, dist] of [
      [94, -59, 0xdde8ff, 12, 22], // almacén (cajas, pasarela y conducto)
      [106, -62, 0xbcd8ff, 12, 18], // cámara de contención y pasillo alto
    ]) {
      const l = new THREE.PointLight(color, intensity, dist, 1.2);
      l.position.set(x, Y + 7.4, z);
      group.add(l);
    }
    for (const [x, z] of [[94, -66], [94, -52], [106, -68.5], [108, -53]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.32), panel);
      m.position.set(x, Y + 7.95, z);
      group.add(m);
    }
  }

  // Generador decorativo en el patio (sin uso en M01: Jon aún no tiene Energía)
  void EnergySource;
  void night;
  // Con la alarma: todos acuden a la entrada principal cerrada (creen que el
  // intruso sigue dentro); el de la puerta norte no la deja y los del
  // helipuerto y el garaje vigilan la pasarela del anexo
  const toDoor = { x: 108.2, z: -45 };
  const alarmPosts = {
    patio: { at: { x: 105.4, z: -40.6 }, look: toDoor }, fachada: { at: { x: 111, z: -40.4 }, look: toDoor },
    conducto1: { at: { x: 103.2, z: -42 }, look: toDoor }, conducto2: { at: { x: 113.4, z: -41.8 }, look: toDoor },
    almacen: { at: { x: 91, z: -52 }, look: { x: 88, z: -52 } }, puerta: { at: { x: 100, z: -97.5 }, look: { x: 100, z: -80 } },
    helipuerto: { at: { x: 121.5, z: -34 }, look: { x: 116, z: -30 } }, garaje: { at: { x: 120, z: -24 }, look: { x: 116, z: -24 } },
  };
  return {
    guards, lights: [lightA, lightB], vitrines, documents, zipline, alarms, nav, alarmPosts,
    /** Puerta del cuartel (garaje): ahí se releva la guardia del conducto. */
    barracks: { x: 128.5, z: -81.6 },
    shutters: { stairs: shutterStairs, main: shutterMain, chamber: shutterChamber, vent: ventCover },
  };
}

/** Doble puerta de cristal de la entrada (cerrada con llave: colisiona siempre), con marco, tirador y lector. */
function mainDoor(ctx, B, P, { x, z, y, w, h }) {
  const { group } = ctx;
  B.block({ x, z, w, d: 0.12, y, h, mat: P.glass }).castShadow = false;
  deco(group, { x, y, z: z + 0.07, w: 0.08, h, d: 0.08, mat: P.metal, cast: false });
  for (const sx of [-1, 1]) {
    deco(group, { x: x + sx * (w / 2 + 0.05), y, z, w: 0.1, h: h + 0.1, d: 0.2, mat: P.metal, cast: false });
    deco(group, { x: x + sx * 0.18, y: y + 1, z: z + 0.1, w: 0.04, h: 0.6, d: 0.05, mat: P.metalLight, cast: false });
  }
  deco(group, { x, y: y + h, z, w: w + 0.2, h: 0.1, d: 0.2, mat: P.metal, cast: false });
  deco(group, { x: x + w / 2 + 0.4, y: y + 1.1, z: z + 0.12, w: 0.18, h: 0.26, d: 0.05, mat: P.strip, cast: false });
}

/**
 * Puerta de servicio (chapa) con marco, rótulo luminoso y luz encima.
 * `face`: hacia dónde da (+1 / −1 en el eje `axis`).
 */
function serviceDoor(ctx, P, { x, z, y, face = 1, axis = 'z', night = true, w = 1.1, h = 2.2 }) {
  const { group } = ctx;
  const along = axis === 'z';
  const t = (a, b) => (along ? { w: a, d: b } : { w: b, d: a });
  const off = (k) => (along ? { x, z: z + face * k } : { x: x + face * k, z });
  deco(group, { ...off(0.02), y, ...t(w + 0.24, 0.08), h: h + 0.12, mat: P.concreteDark, cast: false });
  deco(group, { ...off(0.07), y, ...t(w, 0.06), h, mat: P.plate, cast: false });
  const hd = along ? { x: x + w * 0.32, z: z + face * 0.12 } : { x: x + face * 0.12, z: z + w * 0.32 };
  deco(group, { ...hd, y: y + 1, ...t(0.12, 0.05), h: 0.05, mat: P.metalLight, cast: false });
  deco(group, { ...off(0.08), y: y + h + 0.25, ...t(0.7, 0.04), h: 0.18, mat: P.strip, cast: false });
  deco(group, { ...off(0.3), y: y + h + 0.5, ...t(0.5, 0.5), h: 0.08, mat: P.concreteDark, cast: false });
  if (night) lightPool(group, { ...off(1.2), y, r: 2.4, color: 0xdfeaff, opacity: 0.25 });
}

/** Escalera de mano (peldaños de acero) pegada a una fachada (decorado). */
function ladderRungs(group, mat, { x, z, y, h, face = 'x' }) {
  const ax = face === 'x';
  for (const s of [-0.28, 0.28]) deco(group, { x: ax ? x : x + s, y, z: ax ? z + s : z, w: 0.06, h: h + 0.9, d: 0.06, mat });
  for (let k = 0.3; k < h + 0.8; k += 0.3) deco(group, { x, y: y + k, z, w: ax ? 0.05 : 0.56, h: 0.04, d: ax ? 0.56 : 0.05, mat, cast: false });
}

/** Grúa pórtico amarilla sobre los contenedores, con uno colgando del carro. */
function gantry(ctx, B, P, { x0, x1, z0, z1, y, h }) {
  const { group } = ctx;
  for (const x of [x0, x1]) {
    for (const z of [z0, z1]) B.block({ x, z, w: 0.9, d: 0.9, y, h, mat: P.yellow, cameraBlocking: false });
    deco(group, { x, y: y + h - 1, z: (z0 + z1) / 2, w: 1, h: 1, d: z1 - z0 + 0.9, mat: P.yellow });
    deco(group, { x, y: y + 0.2, z: (z0 + z1) / 2, w: 1.2, h: 0.6, d: z1 - z0 + 2, mat: P.hazard });
  }
  for (const z of [z0, z1]) deco(group, { x: (x0 + x1) / 2, y: y + h, z, w: x1 - x0 + 1, h: 1.2, d: 0.9, mat: P.yellow });
  const tx = (x0 + x1) / 2 + 2;
  deco(group, { x: tx, y: y + h - 0.6, z: (z0 + z1) / 2, w: 3, h: 1.6, d: z1 - z0 + 1.4, mat: P.pdcDark });
  for (const dz of [-1, 1]) deco(group, { x: tx, y: y + 8.2, z: (z0 + z1) / 2 + dz, w: 0.05, h: h - 8.6, d: 0.05, mat: P.metalLight, cast: false });
  container(ctx, B, P, { x: tx, y: y + 5.6, z: (z0 + z1) / 2, color: 0 });
  deco(group, { x: tx, y: y + 8.2, z: (z0 + z1) / 2, w: 6.2, h: 0.3, d: 2.5, mat: P.yellow });
}
