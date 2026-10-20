import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { concreteTexture, asphaltTexture } from '../textures.js';
import { EnergySource } from '../entities/EnergySource.js';
import { FragileDebris, PrisonBus, LandingMarker, mulberry, pineForest } from '../../story/props.js';

/**
 * BOSQUE Y PUENTE (prólogo, M04 final y M05): valle con el viaducto donde
 * vuelca el autobús de presos, bosque de pinos, ladera, paso del escombro,
 * descampado de los drones, puente de acero destruido sobre el cañón y
 * colina con la vista de la ciudad.
 *
 * Disposición (x hacia el este):
 *   viaducto z −60, y 14, x −165…−40 (hueco del ataque x −110…−96)
 *   despertar (−45, 0, 10) · rocas de la ladera x −9 · terraza a 3 m x −5…95
 *   paso del escombro x 15…32 · descampado x 40…92
 *   puente (tablero a 3 m) x 95…250 con huecos de 8.5, 9.5 y 10.5 m
 *   salida x 250…275 · colina (13 m) x 295…315 · ciudad al fondo (x > 700)
 */

export const DECK_Y = 3;
const DECK_HALF = 3.5;

/** Tramos del puente (entre ellos, los huecos que se cruzan con el dash). */
export const BRIDGE_SPANS = [
  { id: 'S0', x0: 95, x1: 112 },
  { id: 'S1', x0: 120.5, x1: 136 },
  { id: 'S2', x0: 145.5, x1: 160 },
  { id: 'S3', x0: 170.5, x1: 250 },
];

/** Huecos del puente (ancho creciente: 8.5, 9.5 y 10.5 m). */
export const BRIDGE_GAPS = BRIDGE_SPANS.slice(1).map((s, i) => ({ from: BRIDGE_SPANS[i].x1, to: s.x0, width: s.x0 - BRIDGE_SPANS[i].x1 }));

export const Forest = {
  id: 'bosque',
  name: 'El valle',
  description: 'Lejos del autobús',
  story: true,
  ambience: 'forest',
  factions: { pdc: 100 },
  bounds: { minX: -170, maxX: 320, minZ: -80, maxZ: 50 },
  waypoints: [
    { id: 'despertar', name: 'Despertar (CP18)', x: -45, y: 0.2, z: 10, yaw: Math.PI / 2 },
    { id: 'escombro', name: 'Escombro (CP20)', x: 10, y: 3.2, z: 0, yaw: Math.PI / 2 },
    { id: 'descampado', name: 'Descampado (CP21)', x: 38, y: 3.2, z: 0, yaw: Math.PI / 2 },
    { id: 'puente', name: 'Puente (CP23)', x: 100, y: 3.2, z: 0, yaw: Math.PI / 2 },
    { id: 'colina', name: 'Colina', x: 288, y: 11, z: 0, yaw: Math.PI / 2 },
  ],
  build(ctx) {
    return buildForest(ctx);
  },
};

function buildForest(ctx) {
  const { group, builder: B, scene, world } = ctx;
  // --- Ambiente: tarde fría con el sol bajo hacia el oeste ---
  const sunDir = new THREE.Vector3(-0.75, 0.32, 0.35).normalize();
  scene.fog = new THREE.FogExp2(0xb7b4b0, 0.0042);
  const sky = createSky({ top: '#46628a', horizon: '#f0c79a', bottom: '#5a6470', sunDir, sunColor: '#ffd9a8' });
  group.add(sky);
  const hemi = new THREE.HemisphereLight(0xc6d4e6, 0x4a4434, 0.95);
  group.add(hemi);
  const sun = createSun({ color: '#ffdcb0', intensity: 2.1, direction: sunDir.clone().negate(), shadowSize: 50 });
  group.add(sun, sun.target);

  const tex = (t) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.userData = t.userData;
    return c;
  };
  const M = {
    grass: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#4a5a3c', 81)), roughness: 1 }),
    forest: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#3d4a33', 82)), roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#6b6862', 83)), roughness: 1, flatShading: true }),
    rockDark: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#4e4b47', 84)), roughness: 1, flatShading: true }),
    snow: new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.9, flatShading: true }),
    concrete: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8a8a86', 85)), roughness: 0.9 }),
    road: new THREE.MeshStandardMaterial({ map: tex(asphaltTexture()), roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4b5560, metalness: 0.75, roughness: 0.45 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2c333b, metalness: 0.7, roughness: 0.5 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe0b021, metalness: 0.3, roughness: 0.55 }),
    mesh: new THREE.MeshStandardMaterial({ color: 0x59636e, metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.85 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3a5a6a, metalness: 0.3, roughness: 0.2, emissive: 0x0a1418 }),
    van: new THREE.MeshStandardMaterial({ color: 0x2b323b, metalness: 0.4, roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.9 }),
  };

  // --- Valle (despertar) y terraza del bosque ---
  B.block({ x: -87.5, z: -15, w: 165, d: 130, y: -1, h: 1, mat: M.forest, cast: false }); // x −170…−5, z −80…50
  B.block({ x: 45, z: 0, w: 100, d: 34, y: -1, h: DECK_Y + 1, mat: M.grass, climbable: false }); // terraza x −5…95, z −17…17
  // Rocas de la ladera (se trepan)
  B.block({ x: -9.2, z: 0.5, w: 2.4, d: 5, h: 1.3, mat: M.rock, climbable: true });
  B.block({ x: -6.6, z: 0, w: 2.8, d: 5.5, h: 2.3, mat: M.rock, climbable: true });
  // Paredes de roca a los lados de la terraza (encierran el camino)
  for (const s of [-1, 1]) B.block({ x: 45, z: s * 18.5, w: 100, d: 3, y: -1, h: 24, mat: M.rockDark, climbable: false });
  // Paso estrecho del escombro (x 15…32, corredor z −3…3)
  for (const s of [-1, 1]) B.block({ x: 23.5, z: s * 10, w: 17, d: 14, y: DECK_Y, h: 10, mat: M.rock, climbable: false });
  // Coberturas del descampado (rocas y troncos)
  for (const [x, z, w, d, h] of [[50, -6, 2.4, 1.6, 1.3], [64, 4, 1.6, 2.6, 1.4], [76, -4, 3, 1.4, 1.2], [84, 7, 1.6, 1.6, 1.5]]) {
    B.block({ x, z, w, d, y: DECK_Y, h, mat: M.rock });
  }
  for (const [x, z, r] of [[57, -10, 0.3], [71, 10, -0.5]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 5, 8), M.wood);
    log.position.set(x, DECK_Y + 0.35, z);
    log.rotation.set(0, r, Math.PI / 2);
    log.castShadow = true;
    log.userData.levelStatic = true;
    group.add(log);
    world.addBox({ x: x - 2.4, y: DECK_Y, z: z - 0.6 }, { x: x + 2.4, y: DECK_Y + 0.75, z: z + 0.6 }, { climbable: true });
  }
  // Límites del valle (muros invisibles)
  B.invisibleWall({ x: -87, z: -70, w: 170, d: 2 });
  B.invisibleWall({ x: -87, z: 40, w: 170, d: 2 });
  B.invisibleWall({ x: -168, z: -15, w: 2, d: 112 });

  // --- Pinos (instanciados): valle, bordes de la terraza y montañas cercanas ---
  const r = mulberry(21);
  const trees = [];
  for (let i = 0; i < 170; i++) {
    const x = -165 + r() * 158;
    const z = -66 + r() * 104;
    if (Math.abs(z - 10) < 4 && x > -60) continue; // senda del despertar
    if (Math.hypot(x + 45, z - 10) < 6) continue;
    if (Math.abs(z + 60) < 6) continue; // bajo el viaducto
    trees.push({ x, y: 0, z, s: 0.8 + r() * 0.6 });
  }
  for (let i = 0; i < 26; i++) {
    const x = -2 + r() * 96;
    if (x > 14 && x < 33) continue;
    const s = r() < 0.5 ? -1 : 1;
    trees.push({ x, y: DECK_Y, z: s * (12 + r() * 3.5), s: 0.8 + r() * 0.5 });
  }
  pineForest(ctx, trees);
  // Bosque lejano en las laderas (sin colisión, más grande)
  const far = [];
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2;
    const d = 190 + r() * 120;
    far.push({ x: 60 + Math.cos(a) * d * 1.6, y: -4 + r() * 18, z: Math.sin(a) * d, s: 1.6 + r() * 1.4 });
  }
  pineForest(ctx, far);
  mountains(group, M);

  // --- Viaducto del convoy (el autobús vuelca en el hueco) ---
  const viaduct = buildViaduct(ctx, B, M);

  // --- Cañón y puente de acero destruido ---
  const bridge = buildBridge(ctx, B, M);

  // --- Salida del puente y colina ---
  B.block({ x: 262.5, z: 0, w: 25, d: 30, y: -1, h: DECK_Y + 1, mat: M.grass, climbable: false }); // x 250…275
  B.ramp({ x: 285, z: 0, w: 20, d: 10, axis: 'x', dir: 1, y0: DECK_Y, y1: 13, mat: M.grass });
  B.block({ x: 305, z: 0, w: 20, d: 18, y: -1, h: 14, mat: M.grass, climbable: false }); // cima x 295…315
  for (const s of [-1, 1]) B.block({ x: 285, z: s * 8, w: 20, d: 6, y: -1, h: 15, mat: M.rock, climbable: false });
  for (const s of [-1, 1]) B.block({ x: 262.5, z: s * 16.5, w: 25, d: 3, y: -1, h: 20, mat: M.rockDark, climbable: false });
  B.invisibleWall({ x: 316, z: 0, w: 2, d: 40 });
  B.invisibleWall({ x: 305, z: -10, w: 22, d: 2 });
  B.invisibleWall({ x: 305, z: 10, w: 22, d: 2 });
  const hillTrees = [];
  for (let i = 0; i < 18; i++) hillTrees.push({ x: 250 + r() * 26, y: DECK_Y, z: (r() < 0.5 ? -1 : 1) * (9 + r() * 5), s: 0.9 + r() * 0.4 });
  pineForest(ctx, hillTrees);

  // --- La ciudad en el horizonte (sin niebla para que se vea desde la colina) ---
  const city = buildCity(group);

  // --- Fuentes de energía ---
  const add = (o) => ctx.energySources.register(ctx.addEntity(new EnergySource(ctx, o)));
  const generators = {
    debris: add({ kind: 'generator', x: 29.5, y: DECK_Y, z: -2.1, yaw: 0 }),
    clearing: add({ kind: 'generator', x: 60, y: DECK_Y, z: 9, yaw: Math.PI }),
    clearing2: add({ kind: 'cabinet', x: 88, y: DECK_Y, z: -8, yaw: 0 }),
    s0: add({ kind: 'generator', x: 104, y: DECK_Y, z: -2.4, yaw: 0 }),
    s1: add({ kind: 'cabinet', x: 128, y: DECK_Y, z: -2.9, yaw: 0 }),
    s2: add({ kind: 'generator', x: 152, y: DECK_Y, z: -2.4, yaw: 0 }),
    s3: add({ kind: 'cabinet', x: 178, y: DECK_Y, z: 2.9, yaw: Math.PI }),
    s4: add({ kind: 'generator', x: 214, y: DECK_Y, z: -2.4, yaw: 0 }),
    s5: add({ kind: 'cabinet', x: 236, y: DECK_Y, z: 2.9, yaw: Math.PI }),
  };

  // --- Escombro que solo se rompe disparando ---
  const debris = new FragileDebris(ctx, { x: 24, z: 0, y: DECK_Y, w: 2.2, d: 6.2, h: 4.6, health: 20, color: 0x6a6258 });
  ctx.addEntity(debris);

  const points = {
    cp18: { x: -45, y: 0.2, z: 10, yaw: Math.PI / 2 },
    cp19: { x: -16, y: 0.2, z: 0, yaw: Math.PI / 2 },
    cp20: { x: 10, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp21: { x: 38, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp22: { x: 88, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp23: { x: 100, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp24: { x: 150, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp25: { x: 174, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp26: { x: 203, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp27: { x: 207, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp28: { x: 253, y: DECK_Y + 0.2, z: 0, yaw: Math.PI / 2 },
    cp29: { x: 300, y: 13.2, z: 0, yaw: Math.PI / 2 },
    climb: { x: -9, y: 0, z: 0 },
    terrace: { x: -2, y: DECK_Y, z: 0 },
    debris: { x: 24, y: DECK_Y + 2, z: 0 },
    clearing: { x: 42, y: DECK_Y, z: 0 },
    bridgeStart: { x: 95, y: DECK_Y, z: 0 },
    block1: { x: 190, y: DECK_Y, z: 0 },
    block2: { x: 228, y: DECK_Y, z: 0 },
    bridgeEnd: { x: 250, y: DECK_Y, z: 0 },
    hill: { x: 292, y: 12, z: 0 },
    hillTop: { x: 304, y: 13, z: 0 },
    city: { x: 820, y: 60, z: -20 },
  };

  return {
    spawn: points.cp18,
    sun,
    story: { points, viaduct, bridge, debris, generators, city, hemi, sky, sun },
  };
}

/** Cordilleras nevadas al norte y montes oscuros al sur (decorado). */
function mountains(group, M) {
  const r = mulberry(9);
  for (let i = 0; i < 18; i++) {
    const x = -300 + i * 70 + r() * 30;
    const z = -320 - r() * 120;
    const h = 120 + r() * 140;
    const rad = 90 + r() * 60;
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), M.rockDark);
    m.position.set(x, h / 2 - 20, z);
    m.userData.levelStatic = true;
    group.add(m);
    // Casquete de nieve
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.42, h * 0.42, 7), M.snow);
    cap.position.set(x, h - 20 - h * 0.21 + 0.5, z);
    cap.userData.levelStatic = true;
    group.add(cap);
  }
  for (let i = 0; i < 10; i++) {
    const x = -260 + i * 70 + r() * 40;
    const z = 240 + r() * 80;
    const h = 60 + r() * 60;
    const m = new THREE.Mesh(new THREE.ConeGeometry(80 + r() * 40, h, 6), M.rockDark);
    m.position.set(x, h / 2 - 15, z);
    m.userData.levelStatic = true;
    group.add(m);
  }
}

/**
 * Viaducto de hormigón (y 14) sobre el valle. El tramo central (x −110…−96)
 * se rompe en el ataque: `setBroken(true)` lo esconde y muestra los restos.
 */
function buildViaduct(ctx, B, M) {
  const { group } = ctx;
  const Y = 14;
  const Z = -60;
  const W = 9;
  // Tablero en dos mitades fijas y el tramo que se rompe
  B.block({ x: (-165 + -110) / 2, z: Z, w: 55, d: W, y: Y - 1.2, h: 1.2, mat: M.concrete, cameraBlocking: false });
  B.block({ x: (-96 + -40) / 2, z: Z, w: 56, d: W, y: Y - 1.2, h: 1.2, mat: M.concrete, cameraBlocking: false });
  for (const [x0, x1] of [[-165, -110], [-96, -40]]) {
    B.block({ x: (x0 + x1) / 2, z: Z, w: x1 - x0, d: 7, y: Y - 0.02, h: 0.04, mat: M.road, collide: false, cast: false });
    for (const s of [-1, 1]) B.block({ x: (x0 + x1) / 2, z: Z + s * 4.3, w: x1 - x0, d: 0.3, y: Y, h: 0.9, mat: M.concrete, cameraBlocking: false });
  }
  // Pilares
  for (const x of [-150, -125, -80, -55]) B.block({ x, z: Z, w: 3, d: 5, y: -1, h: Y - 0.2, mat: M.concrete, cameraBlocking: false });
  // Tramo intacto (antes del ataque)
  const intact = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, W), M.concrete);
  seg.position.set(-103, Y - 0.6, Z);
  seg.castShadow = true;
  const segRoad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.04, 7), M.road);
  segRoad.position.set(-103, Y, Z);
  intact.add(seg, segRoad);
  group.add(intact);
  const intactBox = ctx.world.addBox({ x: -110, y: Y - 1.2, z: Z - W / 2 }, { x: -96, y: Y, z: Z + W / 2 }, { cameraBlocking: false });
  // Restos (después): bordes rotos, varillas y losas colgando
  const broken = new THREE.Group();
  const r = mulberry(4);
  for (const [x, s] of [[-110, 1], [-96, -1]]) {
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5 + r() * 1.5, 5), M.steelDark);
      bar.position.set(x + s * (0.5 + r()), Y - 0.6 - r() * 0.5, Z - 3.5 + i * 1.15);
      bar.rotation.set(0, 0, s * (Math.PI / 2 - 0.3 - r() * 0.6));
      broken.add(bar);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(4, 0.9, W * 0.8), M.concrete);
    slab.position.set(x + s * 2.2, Y - 3.2, Z + (r() - 0.5) * 2);
    slab.rotation.set(0, 0, -s * 0.9);
    slab.castShadow = true;
    broken.add(slab);
  }
  for (let i = 0; i < 16; i++) {
    const s = 0.6 + r() * 1.3;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M.concrete);
    m.position.set(-110 + r() * 14, s * 0.4, Z + (r() - 0.5) * 12);
    m.rotation.set(r() * 3, r() * 3, r() * 3);
    m.castShadow = true;
    broken.add(m);
  }
  group.add(broken);

  // Autobús de presos y furgones de la escolta (el guion los mueve)
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
      g.rotateX(0.95); // morro hacia abajo, sobre el hueco
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
 * Puente industrial de acero sobre el cañón, partido en tramos: barandillas
 * amarillas, pasarelas de rejilla, celosías y vigas retorcidas en los bordes.
 * Los bordes de los huecos no se pueden agarrar (hay que cruzar con el dash).
 */
function buildBridge(ctx, B, M) {
  const { group, world } = ctx;
  const Y = DECK_Y;
  // Cañón: paredes y río al fondo
  B.block({ x: 172.5, z: 0, w: 155, d: 180, y: -42, h: 2, mat: M.rockDark, cast: false }); // fondo x 95…250
  for (const [x, w] of [[92, 6], [253, 6]]) B.block({ x, z: 0, w, d: 120, y: -40, h: 40 + Y - 0.01, mat: M.rock, climbable: false });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(160, 180).rotateX(-Math.PI / 2), M.water);
  river.position.set(172.5, -36, 0);
  group.add(river);
  for (const s of [-1, 1]) {
    // Laderas del cañón (decorado lejano)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(170, 60, 20), M.rockDark);
    wall.position.set(172.5, -15, s * 75);
    wall.userData.levelStatic = true;
    group.add(wall);
  }

  const spans = [];
  for (const s of BRIDGE_SPANS) {
    const len = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2;
    // Tablero (losa de acero); los extremos junto a un hueco no se agarran
    B.block({ x: cx, z: 0, w: len, d: DECK_HALF * 2, y: Y - 0.6, h: 0.6, mat: M.steel, climbable: false });
    B.block({ x: cx, z: 0, w: len, d: 5, y: Y - 0.01, h: 0.02, mat: M.road, collide: false, cast: false });
    // Pasarelas de rejilla a los lados (decorado)
    for (const sd of [-1, 1]) B.block({ x: cx, z: sd * (DECK_HALF + 0.7), w: len, d: 1.4, y: Y - 0.5, h: 0.08, mat: M.mesh, collide: false, cast: false });
    // Barandillas amarillas (colisionan: no se cae por los lados)
    for (const sd of [-1, 1]) {
      B.block({ x: cx, z: sd * (DECK_HALF - 0.1), w: len, d: 0.12, y: Y + 1, h: 0.12, mat: M.yellow, collide: false });
      B.block({ x: cx, z: sd * (DECK_HALF - 0.1), w: len, d: 0.12, y: Y + 0.5, h: 0.08, mat: M.yellow, collide: false });
      world.addBox({ x: s.x0, y: Y, z: sd > 0 ? DECK_HALF - 0.2 : -DECK_HALF - 0.4 }, { x: s.x1, y: Y + 2.6, z: sd > 0 ? DECK_HALF + 0.4 : -DECK_HALF + 0.2 }, { climbable: false, cameraBlocking: false });
      for (let x = s.x0 + 0.6; x < s.x1; x += 2.2) B.block({ x, z: sd * (DECK_HALF - 0.1), w: 0.1, d: 0.1, y: Y, h: 1.1, mat: M.yellow, collide: false, cast: false });
    }
    // Celosía de acero (vigas verticales y diagonales a los lados)
    for (const sd of [-1, 1]) {
      const z = sd * (DECK_HALF + 1.5);
      B.block({ x: cx, z, w: len, d: 0.5, y: Y + 5.6, h: 0.5, mat: M.steelDark, collide: false });
      for (let x = s.x0 + 2; x < s.x1 - 1; x += 6) {
        B.block({ x, z, w: 0.45, d: 0.45, y: Y - 0.6, h: 6.7, mat: M.steelDark, collide: false });
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.2, 0.3), M.steelDark);
        diag.position.set(x + 3, Y + 2.8, z);
        diag.rotation.z = sd * 0.75;
        diag.castShadow = true;
        diag.userData.levelStatic = true;
        group.add(diag);
      }
    }
    spans.push({ ...s, cx });
  }
  // Vigas retorcidas que sobresalen en los bordes de los huecos
  const r = mulberry(17);
  for (const gap of BRIDGE_GAPS) {
    for (const [x, sgn] of [[gap.from, 1], [gap.to, -1]]) {
      for (let i = 0; i < 3; i++) {
        const len = 1.6 + r() * 2.2;
        const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.35), M.steelDark);
        beam.position.set(x + sgn * (len / 2 - 0.2), Y - 0.8 - r() * 1.4, -2.5 + i * 2.5);
        beam.rotation.set(r() * 0.4, (r() - 0.5) * 0.5, -sgn * (0.25 + r() * 0.5));
        beam.castShadow = true;
        beam.userData.levelStatic = true;
        group.add(beam);
      }
      // Trozo de barandilla doblada
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), M.yellow);
      rail.position.set(x + sgn * 0.9, Y + 0.4, DECK_HALF - 0.1);
      rail.rotation.z = -sgn * 0.6;
      group.add(rail);
    }
  }
  // Pilares del cañón
  for (const x of [104, 128, 152, 190, 230]) B.block({ x, z: 0, w: 2.6, d: 5, y: -40, h: 40 + Y - 0.6, mat: M.concrete, cameraBlocking: false });
  // Coberturas en los tramos de combate (bloques de hormigón y cajas)
  const covers = [[186, -1.6, 1.2, 1.8], [196, 1.8, 1.2, 1.8], [182, 2.2, 2, 1.1], [213, 1.6, 1.2, 1.8], [222, -1.8, 1.2, 1.8], [232, 1.4, 2.4, 1.1], [241, -1.6, 1.2, 1.8]];
  for (const [x, z, w, d] of covers) B.block({ x, z, w, d, y: Y, h: 1.25, mat: M.concrete });
  // Coche abandonado y barrera del bloqueo
  B.block({ x: 200, z: -1.4, w: 4.2, d: 1.9, y: Y, h: 1.4, mat: M.van });
  B.block({ x: 246, z: 1.6, w: 0.4, d: 3.4, y: Y, h: 1.1, mat: M.yellow });

  // Marcadores de aterrizaje (dash asistido)
  const markers = BRIDGE_GAPS.map((g) => {
    const m = new LandingMarker(ctx, { x: g.to + 2.6, y: Y, z: 0, r: 1.8 });
    ctx.addEntity(m);
    m.setVisible(false);
    return m;
  });
  return { spans, gaps: BRIDGE_GAPS, markers, deckY: Y };
}

/**
 * Ciudad lejana: torres con ventanas encendidas al atardecer. Una sola malla
 * instanciada por material; sin niebla para que se distinga desde la colina.
 */
function buildCity(group) {
  const r = mulberry(33);
  const n = 180;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const winTex = cityTexture();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a4250, emissive: 0xffc98a, emissiveMap: winTex, emissiveIntensity: 1.1, roughness: 0.6, fog: false });
  const towers = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = (r() - 0.5) * 1.2;
    const d = 640 + r() * 260;
    const h = 30 + Math.pow(r(), 2) * 190 + (Math.abs(a) < 0.18 ? 80 : 0);
    const w = 14 + r() * 22;
    p.set(300 + Math.cos(a) * d, -20, Math.sin(a) * d);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 0.5);
    s.set(w, h, w * (0.7 + r() * 0.6));
    m.compose(p, q, s);
    towers.setMatrixAt(i, m);
  }
  towers.userData.city = true;
  group.add(towers);
  // Bruma luminosa sobre la ciudad
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1400, 260), new THREE.MeshBasicMaterial({ color: 0xffb27a, transparent: true, opacity: 0.12, depthWrite: false, fog: false }));
  glow.position.set(1050, 90, 0);
  glow.rotation.y = -Math.PI / 2;
  group.add(glow);
  // Antena con luz roja en la torre más alta
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 120, 6), new THREE.MeshStandardMaterial({ color: 0x2a3038, emissive: 0xff3030, emissiveIntensity: 0.6, fog: false }));
  spire.position.set(960, 260, -10);
  group.add(spire);
  return { towers, center: { x: 960, y: 120, z: 0 } };
}

function cityTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  const r = mulberry(5);
  for (let y = 2; y < 128; y += 6) {
    for (let x = 2; x < 64; x += 6) {
      if (r() < 0.45) {
        const v = 120 + Math.floor(r() * 135);
        g.fillStyle = `rgb(${v},${Math.floor(v * 0.8)},${Math.floor(v * 0.55)})`;
        g.fillRect(x, y, 3, 3);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

export default Forest;
