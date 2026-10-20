import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { concreteTexture, facadeTextures } from '../textures.js';
import { EnergySource } from '../entities/EnergySource.js';
import { StealthGuard, Searchlight } from '../../story/actors.js';
import { Shutter, Zipline, Rain, AlarmLights, CardVitrines, mulberry, pineForest } from '../../story/props.js';

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
 *   acantilado x 55 · base (meseta a 10 m) x 55…125, z −100…10 · playa al sur de la base.
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
  bounds: { minX: -100, maxX: 130, minZ: -110, maxZ: 70 },
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
  bounds: { minX: -100, maxX: 130, minZ: -110, maxZ: 70 },
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
  scene.fog = new THREE.FogExp2(night ? 0x2a3a52 : 0xa9bccb, night ? 0.011 : 0.0045);
  const sky = createSky(night
    ? { top: '#0a1424', horizon: '#3d5577', bottom: '#0c1220', sunDir, sunColor: '#9fb6d6' }
    : { top: '#3d6fa8', horizon: '#e9d7b8', bottom: '#5a6a76', sunDir, sunColor: '#fff0c8' });
  group.add(sky);
  const hemi = new THREE.HemisphereLight(night ? 0x5a78a8 : 0xbfd6ee, night ? 0x1a1a24 : 0x6a5a48, night ? 0.75 : 1.05);
  group.add(hemi);
  const sun = createSun({ color: night ? '#8fa8d6' : '#ffe2b8', intensity: night ? 0.9 : 2.3, direction: sunDir.clone().negate(), shadowSize: 48 });
  group.add(sun, sun.target);

  const tex = (t) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.userData = t.userData;
    return c;
  };
  const M = {
    ground: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#5e5a52', 61)), roughness: 0.95 }),
    paving: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#7d7466', 62)), roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8f8676', 63)), roughness: 0.92 }),
    stoneDark: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#6d665b', 64)), roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8a4a32', 65)), roughness: 0.85 }),
    cliff: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#4d4a46', 66)), roughness: 1, flatShading: true }),
    grass: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#3c4a34', 67)), roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#a89a7c', 68)), roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#7a7e84', 69)), roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3d434b, metalness: 0.7, roughness: 0.45 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x5a3b2c, metalness: 0.4, roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.85 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x5f5a44, roughness: 0.9 }),
    window: new THREE.MeshStandardMaterial({ color: 0x1a1612, emissive: night ? 0xffb35c : 0x000000, emissiveIntensity: night ? 1.4 : 0 }),
    windowDark: new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.3 }),
    baseWindow: new THREE.MeshStandardMaterial({ color: 0x14181e, emissive: night ? 0xdfe9ff : 0x000000, emissiveIntensity: night ? 1.2 : 0 }),
    redLight: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: night ? 2.5 : 0.6 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: night ? 2.2 : 0 }),
    water: new THREE.MeshStandardMaterial({ color: night ? 0x0d1a2a : 0x2a5a78, metalness: 0.3, roughness: 0.15, emissive: night ? 0x040a14 : 0x0a1a24 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x59636e, metalness: 0.6, roughness: 0.4 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.6 }),
  };

  // --- Terreno: pueblo, colina norte, acantilado de la base, playa y mar ---
  B.block({ x: -15, z: -20, w: 140, d: 128, y: -1, h: 1, mat: M.ground, cast: false }); // x −85…55, z −84…44
  B.block({ x: 0, z: 0, w: 20, d: 20, y: 0, h: 0.06, mat: M.paving, cast: false, collide: false }); // plaza
  B.block({ x: -15, z: -95, w: 140, d: 30, y: -1, h: 4, mat: M.grass, cast: false }); // colina norte
  B.block({ x: 90, z: -45, w: 70, d: 110, y: -1, h: PLATEAU + 1, mat: M.cliff, tag: 'cliff' }); // meseta x 55…125, z −100…10
  B.block({ x: 90, z: 32, w: 70, d: 44, y: -1.4, h: 1.3, mat: M.sand, cast: false }); // playa x 55…125, z 10…54
  B.block({ x: -15, z: 47, w: 140, d: 6, y: -3, h: 3, mat: M.stoneDark, cast: false }); // muelle (borde del puerto)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 700).rotateX(-Math.PI / 2), M.water);
  sea.position.set(0, -1.6, 380);
  group.add(sea);
  ctx.world.addBox({ x: -200, y: -60, z: 50 }, { x: 300, y: -1.9, z: 800 }, { tag: 'sea' }); // fondo
  // Límites del mapa (muros invisibles)
  B.invisibleWall({ x: 15, z: -112, w: 240, d: 2 });
  B.invisibleWall({ x: -100, z: -20, w: 2, d: 200 });
  B.invisibleWall({ x: 130, z: -20, w: 2, d: 200 });
  B.invisibleWall({ x: 15, z: 72, w: 240, d: 2 });
  // Pasaderas al sur del muelle (no se cae al agua: barandilla de piedra baja)
  B.block({ x: -15, z: 44.6, w: 140, d: 0.5, y: 0, h: 0.6, mat: M.stone, climbable: false });

  // --- Montañas y colinas de fondo ---
  backdrop(group, night);

  // --- Casas ---
  const houses = [...ROOF_ROUTE, ...OTHER_HOUSES];
  for (const h of houses) house(B, M, h);
  const jonHouse = buildJonHouse(ctx, M);
  // Escaleras y cajas para subir a los tejados
  B.block({ x: -24, z: -2.6, w: 1.4, d: 1.4, h: 1.6, mat: M.crate }); // junto a R1
  B.block({ x: -26, z: -2.6, w: 1.4, d: 1.4, h: 3.2, mat: M.crate });
  B.block({ x: -6, z: -6.6, w: 1.4, d: 1.4, h: 2.6, mat: M.crate }); // junto a R2 (ruta de la tormenta)
  B.block({ x: 45.8, z: -20, w: 1.4, d: 1.6, h: 1.8, mat: M.crate }); // bajada de R7

  // Torre del campanario (con luz arriba), depósito de agua y faro
  B.block({ x: -40, z: -40, w: 5, d: 5, h: 16, mat: M.stone });
  B.block({ x: -40, z: -40, w: 5.6, d: 5.6, y: 16, h: 0.4, mat: M.stoneDark });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, 5, 4), M.roof);
  cone.position.set(-40, 18.9, -40);
  cone.rotation.y = Math.PI / 4;
  cone.castShadow = true;
  cone.userData.levelStatic = true;
  group.add(cone);
  B.block({ x: -40, z: -37.45, w: 1.2, d: 0.1, y: 12.5, h: 1.8, mat: M.window, collide: false });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 6, 18), M.stone);
  tank.position.set(-20, 3 + 14, -80);
  tank.castShadow = true;
  tank.userData.levelStatic = true;
  group.add(tank);
  B.block({ x: -20, z: -80, w: 4, d: 4, y: 3, h: 11, mat: M.stoneDark });
  B.block({ x: -72, z: 50, w: 4, d: 4, y: -2, h: 16, mat: M.stone }); // faro
  B.block({ x: -72, z: 50, w: 2.6, d: 2.6, y: 14, h: 2, mat: M.lamp, collide: false });

  // Puerto: pantalán y barcas
  B.block({ x: -20, z: 56, w: 3, d: 18, y: -0.4, h: 0.4, mat: M.wood });
  for (const [x, z, r] of [[-25, 54, 0.2], [-15, 58, -0.15], [-30, 60, 0.4]]) boat(group, M, x, z, r);

  // Farolas y árboles
  for (const [x, z] of [[-12, -2], [12, -2], [-12, 12], [12, 12], [-30, 8], [-48, 8], [24, 10], [-38, -16], [40, -6]]) {
    B.block({ x, z, w: 0.18, d: 0.18, h: 4.2, mat: M.metal, cameraBlocking: false });
    B.block({ x, z, w: 0.45, d: 0.45, y: 4.2, h: 0.2, mat: M.lamp, collide: false });
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

  // Mercado de la plaza (día)
  const stalls = [];
  if (!night) {
    for (const [i, [x, z, color]] of [[-6, -7, 0xc94f3a], [0, -8.5, 0x3a8a5a], [6, -7, 0x3a6ac9]].entries()) {
      stall(B, M, x, z, color);
      stalls.push({ id: ['pan', 'patatas', 'pescado'][i], x, y: 0, z: z + 1.4 });
    }
    // Pozo de la plaza
    B.block({ x: 0, z: 4, w: 2.4, d: 2.4, h: 0.9, mat: M.stone });
  }

  // --- Base PDC (meseta) ---
  const base = buildBase(ctx, B, M, night);

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

// ---------------------------------------------------------------- Casas
function house(B, M, h) {
  const { x, z, w, d } = h;
  B.block({ x, z, w, d, h: h.h, mat: [M.stone, M.stone, M.roof, M.stoneDark, M.stone, M.stone] });
  parapet(B, x, z, w, d, h.h, M.stoneDark);
  // Ventanas (iluminadas de noche) y puerta
  windows(B, M, x, z, w, d, h.h);
  B.block({ x: x + w * 0.2, z: z - d / 2 - 0.04, w: 1, d: 0.08, h: 2.1, mat: M.wood, collide: false });
  // Chimenea
  B.block({ x: x - w * 0.3, z: z + d * 0.25, w: 0.7, d: 0.7, y: h.h, h: 1.1, mat: M.stoneDark });
}

function parapet(B, x, z, w, d, y, mat) {
  const t = 0.3;
  const hh = 0.3;
  B.block({ x, z: z - d / 2 + t / 2, w, d: t, y, h: hh, mat });
  B.block({ x, z: z + d / 2 - t / 2, w, d: t, y, h: hh, mat });
  B.block({ x: x - w / 2 + t / 2, z, w: t, d: d - 2 * t, y, h: hh, mat });
  B.block({ x: x + w / 2 - t / 2, z, w: t, d: d - 2 * t, y, h: hh, mat });
}

function windows(B, M, x, z, w, d, h) {
  const rows = h > 5 ? [1.4, 3.6] : [1.6];
  for (const y of rows) {
    for (const fx of [-0.25, 0.25]) {
      for (const s of [-1, 1]) {
        B.block({ x: x + w * fx, z: z + s * (d / 2 + 0.03), w: 0.9, d: 0.06, y, h: 1, mat: (Math.abs(x * 7 + z * 3 + y) % 3) < 1.6 ? M.window : M.windowDark, collide: false, cast: false });
      }
    }
  }
}

/**
 * Casa de Jon: interior con cama, mesa, cocina y foto; puerta al norte.
 * Tiene dos versiones (intacta y en ruinas) que el guion alterna.
 */
function buildJonHouse(ctx, M) {
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
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
    if (collide) list.push(world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { climbable: true }));
    return m;
  };
  // --- Intacta ---
  const door = 1.6;
  box(intact, intactBoxes, { x: (x0 + H.x - door / 2) / 2, z: z0 + t / 2, w: H.x - door / 2 - x0, d: t, h: H.h, mat: M.stone });
  box(intact, intactBoxes, { x: (H.x + door / 2 + x1) / 2, z: z0 + t / 2, w: x1 - H.x - door / 2, d: t, h: H.h, mat: M.stone });
  box(intact, intactBoxes, { x: H.x, z: z0 + t / 2, y: 2.4, w: door, d: t, h: H.h - 2.4, mat: M.stone });
  box(intact, intactBoxes, { x: H.x, z: z1 - t / 2, w: H.w, d: t, h: H.h, mat: M.stone });
  box(intact, intactBoxes, { x: x0 + t / 2, z: H.z, w: t, d: H.d - 2 * t, h: H.h, mat: M.stone });
  box(intact, intactBoxes, { x: x1 - t / 2, z: H.z, w: t, d: H.d - 2 * t, h: H.h, mat: M.stone });
  box(intact, intactBoxes, { x: H.x, z: H.z, y: H.h, w: H.w, d: H.d, h: 0.3, mat: M.roof });
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
  const lamp = new THREE.PointLight(0xffc27a, 0, 9, 1.6);
  lamp.position.set(H.x, 3.2, H.z);
  group.add(lamp);
  // --- En ruinas: muros rotos, tejado hundido y escombros ---
  const rubble = new THREE.MeshStandardMaterial({ color: 0x6d665b, roughness: 1, flatShading: true });
  box(ruined, ruinedBoxes, { x: (x0 + H.x - door / 2) / 2, z: z0 + t / 2, w: H.x - door / 2 - x0, d: t, h: 2.2, mat: M.stoneDark });
  box(ruined, ruinedBoxes, { x: x1 - 1.5, z: z0 + t / 2, w: 3, d: t, h: 3.1, mat: M.stoneDark });
  box(ruined, ruinedBoxes, { x: H.x - 2, z: z1 - t / 2, w: 6, d: t, h: 2.6, mat: M.stoneDark });
  box(ruined, ruinedBoxes, { x: x0 + t / 2, z: H.z + 1, w: t, d: 5, h: 1.8, mat: M.stoneDark });
  box(ruined, ruinedBoxes, { x: x1 - t / 2, z: H.z - 1.5, w: t, d: 4, h: 3.4, mat: M.stoneDark });
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
    intact, ruined, furniture, lamp,
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

function boat(group, M, x, z, rot) {
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x2f5a7a, roughness: 0.7 }));
  hull.position.set(x, -1.2, z);
  hull.rotation.y = rot;
  hull.castShadow = true;
  group.add(hull);
}

function stall(B, M, x, z, color) {
  const canvas = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  B.block({ x, z, w: 3, d: 1.4, h: 0.9, mat: M.wood });
  for (const sx of [-1.4, 1.4]) B.block({ x: x + sx, z: z - 0.6, w: 0.12, d: 0.12, h: 2.4, mat: M.wood, cameraBlocking: false });
  B.block({ x, z: z - 0.2, w: 3.4, d: 2, y: 2.4, h: 0.12, mat: canvas, collide: false });
}

/** Montañas oscuras y colinas lejanas (solo decorado). */
function backdrop(group, night) {
  const mat = new THREE.MeshStandardMaterial({ color: night ? 0x1b2433 : 0x55657a, roughness: 1, flatShading: true });
  const r = mulberry(3);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (1.05 + i / 16 * 0.9);
    const dist = 260 + r() * 120;
    const h = 60 + r() * 90;
    const m = new THREE.Mesh(new THREE.ConeGeometry(70 + r() * 60, h, 6), mat);
    m.position.set(Math.cos(a) * dist, h / 2 - 8, Math.sin(a) * dist);
    m.userData.levelStatic = true;
    group.add(m);
  }
}

// ---------------------------------------------------------------- Base de la PDC
function buildBase(ctx, B, M, night) {
  const Y = PLATEAU;
  const { group } = ctx;
  // Escalones de roca para trepar al acantilado (oeste, z ≈ −20)
  B.block({ x: 52.5, z: -20, w: 3, d: 6, y: 0, h: 3.2, mat: M.cliff });
  B.block({ x: 54, z: -20, w: 2, d: 5, y: 0, h: 6.6, mat: M.cliff });
  // Valla perimetral (x = 62) con un hueco roto en z −21…−17
  const fence = (z0, z1) => B.block({ x: 62, z: (z0 + z1) / 2, w: 0.15, d: z1 - z0, y: Y, h: 2.6, mat: M.fence, climbable: false, cameraBlocking: false });
  fence(-100, -21);
  fence(-17, 10);
  B.block({ x: 93.5, z: 9.5, w: 63, d: 0.15, y: Y, h: 2.6, mat: M.fence, climbable: false, cameraBlocking: false });
  // Coberturas: cajas y contenedores en el patio
  for (const [x, z, w, d, h] of [[69, -27, 2, 1.6, 1.4], [74, -34, 3, 1.4, 1.5], [70, -42, 1.6, 1.6, 1.4], [79, -40, 2.4, 1.4, 1.5], [80, -47, 1.6, 2.4, 1.5], [66, -36, 1.4, 1.4, 1.2], [84, -30, 6, 2.4, 2.6]]) {
    B.block({ x, z, w, d, y: Y, h, mat: M.crate });
  }
  // Torres de los focos
  for (const [x, z] of [[74, -14], [96, -32]]) {
    B.block({ x, z, w: 1.2, d: 1.2, y: Y, h: 8, mat: M.metal });
    B.block({ x, z, w: 2.2, d: 2.2, y: Y + 8, h: 0.25, mat: M.rust });
    B.block({ x, z, w: 0.2, d: 0.2, y: Y + 8.25, h: 2.5, mat: M.metal, collide: false });
    B.block({ x, z, w: 0.3, d: 0.3, y: Y + 10.7, h: 0.3, mat: M.redLight, collide: false });
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
  const wallMat = M.concrete;
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
  // Ventanas iluminadas (fachada sur y oeste)
  for (let i = 0; i < 6; i++) {
    for (const yy of [Y + 1.6, Y + 5.4]) {
      B.block({ x: 90 + i * 3.6, z: Z1 + 0.03, w: 1.4, d: 0.06, y: yy, h: 1.1, mat: M.baseWindow, collide: false, cast: false });
    }
  }
  // Azotea con pretil y equipos
  wall({ x: (X0 + X1) / 2, z: (Z0 + Z1) / 2, w: X1 - X0, d: Z1 - Z0, y: Y + 8, h: T, mat: M.stoneDark });
  parapet(B, (X0 + X1) / 2, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, Y + 8 + T, M.metal);
  for (const [x, z] of [[94, -60], [100, -68], [96, -50]]) B.block({ x, z, w: 2, d: 1.4, y: Y + 8.4, h: 1, mat: M.metal });
  B.block({ x: 92, z: -72, w: 0.3, d: 0.3, y: Y + 8.4, h: 7, mat: M.metal, collide: false }); // antena
  B.block({ x: 92, z: -72, w: 0.5, d: 0.5, y: Y + 15.4, h: 0.4, mat: M.redLight, collide: false });

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
  // Compuerta de la escalera (se cierra con la alarma) y puerta principal
  const shutterStairs = new Shutter(ctx, { x: 109, z: -59.6, w: 2.6, d: 0.2, y: Y + 4, h: 2.6, mat: M.stripe, open: true });
  const shutterMain = new Shutter(ctx, { x: 108.2, z: Z1 - 0.2, w: 2.4, d: 0.25, y: Y, h: 2.6, mat: M.stripe, open: false });
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
  B.bridge({ from: { x: 116, y: Y + 5, z: -50 }, to: { x: 116, y: Y + 5, z: -16 }, width: 2.2, mat: M.rust, rails: M.metal });
  B.block({ x: 116, z: -11, w: 6, d: 10, y: Y, h: 5, mat: M.metal, climbable: false }); // torre de la tirolina
  B.block({ x: 116, z: -7.5, w: 0.3, d: 0.3, y: Y + 5, h: 4, mat: M.metal, collide: false });
  B.block({ x: 116, z: -7.5, w: 0.4, d: 0.4, y: Y + 9, h: 0.3, mat: M.redLight, collide: false });
  const zipline = new Zipline(ctx, { from: { x: 116, y: Y + 7.6, z: -8 }, to: { x: 110, y: 2.3, z: 38 } });

  // Alarmas: balizas y dos luces rojas reales (siempre creadas; solo cambia su intensidad)
  const alarms = new AlarmLights(ctx, [
    { x: 94, y: Y + 3.5, z: -45.6 }, { x: 106, y: Y + 7.5, z: -60 }, { x: 101, y: Y + 7.5, z: -50 },
    { x: 89, y: Y + 3.5, z: -60 }, { x: 110, y: Y + 7.5, z: -70 },
  ]);
  for (const p of [{ x: 104, y: Y + 7, z: -52 }, { x: 94, y: Y + 3, z: -60 }]) {
    const l = new THREE.PointLight(0xff2020, 0, 22, 1.6);
    l.position.set(p.x, p.y, p.z);
    group.add(l);
    alarms.addLight(l);
  }
  ctx.addEntity(alarms);

  // Guardias de sigilo
  const guards = [
    new StealthGuard(ctx, { id: 'patio', route: [{ x: 66, z: -31, wait: 2.5 }, { x: 87, z: -36, wait: 2.5 }], y: Y, speed: 1.6, range: 12, fov: 38 }),
    new StealthGuard(ctx, { id: 'fachada', route: [{ x: 76, z: -54, wait: 2 }, { x: 76, z: -62, wait: 2 }, { x: 70, z: -60, wait: 1.5 }], y: Y, speed: 1.4, range: 11, fov: 36 }),
    new StealthGuard(ctx, { id: 'conducto1', route: [{ x: 85.6, z: -50.2, wait: 999, yaw: -Math.PI / 2 }], y: Y, range: 10, fov: 32 }),
    new StealthGuard(ctx, { id: 'conducto2', route: [{ x: 85.6, z: -54, wait: 999, yaw: -Math.PI / 2 }], y: Y, range: 10, fov: 32 }),
    new StealthGuard(ctx, { id: 'almacen', route: [{ x: 91, z: -66, wait: 2.5 }, { x: 98, z: -66, wait: 2.5 }, { x: 98, z: -57, wait: 2 }], y: Y, speed: 1.3, range: 9, fov: 36 }),
  ];
  for (const g of guards) ctx.addEntity(g);

  // Generador decorativo en el patio (sin uso en M01: Jon aún no tiene Energía)
  void EnergySource;
  void night;
  return {
    guards, lights: [lightA, lightB], vitrines, documents, zipline, alarms,
    shutters: { stairs: shutterStairs, main: shutterMain, chamber: shutterChamber, vent: ventCover },
  };
}
