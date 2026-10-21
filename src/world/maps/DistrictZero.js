import * as THREE from 'three';
import { createSky, createSun, createCity, cityTowers } from '../environment.js';
import { concreteTexture, rng } from '../textures.js';
import { EnergySource } from '../entities/EnergySource.js';
import { cityMaterials, storefronts, fireEscape, waterTank, monorail, car, streetLight, neonSign } from '../kit/city.js';
import { baseMaterials, chainFence, jersey, sandbags, truck, banner, lightPools } from '../kit/base.js';
import { deco, staticMesh } from '../kit/common.js';
import { Rain } from '../../story/props.js';

/**
 * MAPA 2 — DISTRITO CERO
 *
 * Una manzana de ciudad de noche bajo la lluvia (kit de ciudad): 8 edificios
 * principales + 2 anexos de ladrillo y hormigón con planta baja comercial
 * (escaparates, toldos y neón), escaleras de incendios trepables, azoteas con
 * depósitos de agua, un monorraíl elevado sobre la calle norte, puestos de la
 * PDC con torres de escaneo, un callejón de neón y bloques nuevos en las
 * esquinas. Alrededor, la ciudad sigue en todas direcciones (sin vacío).
 *
 * La geometría jugable (huellas y alturas de los edificios, escaleras,
 * pasarelas, cajas de los anexos, plaza, misión y patrullas) es la misma de
 * antes: las rutas de azoteas siguen funcionando igual.
 *
 * Red de azoteas (todas accesibles en la Etapa 1, sin escalada):
 *   Suelo → B5 (escalera) → B4 → B3 → A2 (bajada)
 *   Suelo → B6 (escalera) → B7 → B8 (torre) → B1 → B2
 *   Suelo → B1 (escalera) · Suelo → A1 y A2 (cajas y contenedores)
 *   B6 → B5 (pasarela)
 * Nuevas: escaleras de incendios en las fachadas traseras y los pilares del
 * monorraíl (se trepan) hasta la viga.
 */

const HALF = 62; // límite jugable

/**
 * Edificios. `fronts`: fachadas con planta comercial (y tramos libres en
 * coordenadas del mundo); `fire`: fachada con escalera de incendios;
 * `tank`: depósito de agua en la azotea (lejos de las rutas).
 */
const BUILDINGS = [
  { id: 'B1', x: -36, z: -36, w: 18, d: 18, h: 12, style: 0, body: 'brickRed', fronts: [{ f: '+z' }, { f: '+x', skip: [[-43, -35]] }], fire: '-z', tank: [-30.2, -30.6] },
  { id: 'B2', x: 0, z: -40, w: 20, d: 14, h: 18, style: 1, body: 'concrete', fronts: [{ f: '+z' }], fire: '-z', tank: [6, -44] },
  { id: 'B3', x: 36, z: -36, w: 16, d: 18, h: 9, style: 2, body: 'brickBuff', fronts: [{ f: '+z' }], fire: '+x', tank: [41, -42] },
  { id: 'B4', x: 40, z: 0, w: 14, d: 20, h: 14, style: 3, body: 'brickDark', fronts: [{ f: '-x' }], fire: '+x' },
  { id: 'B5', x: 36, z: 36, w: 18, d: 16, h: 7, style: 2, body: 'brickRed', fronts: [{ f: '-z' }], tank: [41.5, 40.5] },
  { id: 'B6', x: 0, z: 40, w: 22, d: 14, h: 10, style: 4, body: 'brickBuff', fronts: [{ f: '-z', skip: [[-8.5, -0.5]] }], fire: '+z', tank: [7, 44.5] },
  { id: 'B7', x: -36, z: 36, w: 16, d: 16, h: 16, style: 1, body: 'brickDark', fronts: [{ f: '-z' }, { f: '+x' }], fire: '+z' },
  { id: 'B8', x: -40, z: 0, w: 14, d: 22, h: 24, style: 3, body: 'concrete', fronts: [{ f: '+x' }], fire: '-x' },
  // Anexos que forman callejones
  { id: 'A1', x: -38, z: -19, w: 14, d: 8, h: 5, style: 4, body: 'brickRed', fronts: [{ f: '+z' }] },
  { id: 'A2', x: 19, z: -38, w: 10, d: 12, h: 6, style: 0, body: 'brickBuff', fronts: [{ f: '+z' }] },
  // Bloques nuevos en las esquinas (densidad) y la pared oeste del callejón de neón
  { id: 'C1', x: -18, z: -51, w: 10, d: 10, h: 11, style: 2, body: 'brickDark', fronts: [{ f: '+z' }] },
  { id: 'C2', x: 18, z: 50, w: 10, d: 12, h: 13, style: 0, body: 'concrete', fronts: [{ f: '-z' }] },
  { id: 'C3', x: 54, z: -30, w: 10, d: 12, h: 12, style: 4, body: 'brickRed', fronts: [{ f: '-x' }] },
  { id: 'C4', x: -52, z: 18, w: 12, d: 10, h: 9, style: 1, body: 'brickBuff', fronts: [{ f: '+x' }] },
  { id: 'C5', x: -53, z: 38, w: 10, d: 16, h: 14, style: 3, body: 'brickDark', fronts: [] },
];

/** Callejón de neón: entre C5 (x −48) y B7 (x −44), de z 28 a 46. */
const ALLEY = { x0: -48, x1: -44, z0: 28, z1: 46 };

export default {
  id: 'distrito',
  name: 'Distrito Cero',
  description: 'El corazón de la ciudad. Calles, callejones y azoteas.',
  /** Reputación: la PDC empieza tranquila y reacciona a lo que haga el jugador. */
  factions: { pdc: 0 },
  reputation: true,
  /** Aspecto: noche lluviosa, neón y calzada mojada. */
  envIntensity: 0.6,
  grade: { contrast: 1.08, saturation: 1.15, shadows: '#1c2244', highlights: '#ffb8e0', split: 0.09, lift: 0.03, vignette: 0.34 },
  fillLight: { color: 0x9fb0e8, intensity: 0.6 },
  /** Zona jugable (aviso al acercarse al límite). */
  bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },

  /** Puntos de teletransporte del menú de depuración. */
  waypoints: [
    { id: 'inicio', name: 'Plaza', x: 0, y: 0.3, z: 11, yaw: Math.PI },
    { id: 'B5', name: 'Escalera de B5', x: 26.2, y: 0.2, z: 46, yaw: Math.PI },
    { id: 'B8', name: 'Azotea de B8 (torre)', x: -36, y: 24.4, z: -6, yaw: 0 },
    { id: 'callejon', name: 'Callejón de A2', x: 12.2, y: 0.2, z: -48, yaw: Math.PI },
    { id: 'neon', name: 'Callejón de neón', x: -46, y: 0.2, z: 27, yaw: 0 },
    { id: 'monorrail', name: 'Viga del monorraíl', x: 8, y: 7.7, z: -24.3, yaw: Math.PI / 2 },
    { id: 'telefono', name: 'Teléfono público (misión)', x: -4.6, y: 0.3, z: 10, yaw: -Math.PI / 2 },
    { id: 'patrulla', name: 'Calle sur (patrulla de la misión)', x: 0, y: 0.3, z: -14, yaw: Math.PI },
  ],

  build(ctx) {
    const { group, builder: B, scene } = ctx;
    // --- Noche lluviosa ---
    scene.fog = new THREE.FogExp2(0x1c2433, 0.009);
    const moonDir = new THREE.Vector3(0.3, 0.5, -0.8);
    group.add(createSky({ top: '#060a14', horizon: '#3a2a4a', bottom: '#0a0c14', sunDir: moonDir, sunColor: '#8fa0c8', clouds: 0.85, cloudColor: '#3a3448', cloudShade: '#141420', stars: 0.15, moonDir }));
    group.add(new THREE.HemisphereLight(0x6a7aa8, 0x2a2228, 1.2));
    const sun = createSun({ color: '#8fa0c8', intensity: 0.9, direction: moonDir.clone().negate(), shadowSize: 60 });
    group.add(sun, sun.target);

    const tex = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.userData = t.userData;
      return c;
    };
    const M = cityMaterials(true);
    const P = baseMaterials(true);
    Object.assign(M, {
      plaza: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#7a7068', 41)), roughness: 0.5 }),
      roof: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#4a4d53', 31)), roughness: 0.8 }),
      rust: P.rust,
      bridge: new THREE.MeshStandardMaterial({ color: 0x3e444c, metalness: 0.6, roughness: 0.45 }),
      dumpster: new THREE.MeshStandardMaterial({ color: 0x2f5a3c, metalness: 0.3, roughness: 0.5 }),
      crate: new THREE.MeshStandardMaterial({ color: 0x7a5e3a, roughness: 0.9 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x2a4426, roughness: 0.9 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.9 }),
      water: new THREE.MeshStandardMaterial({ color: 0x14283a, metalness: 0.3, roughness: 0.05, emissive: 0x0a1e30 }),
      barrier: P.concrete,
      line: new THREE.MeshStandardMaterial({ color: 0xcfcabb, roughness: 0.6 }),
    });

    // --- Suelo: calzada mojada y, fuera del barrio, la ciudad sigue ---
    B.block({ x: 0, z: 0, w: 200, d: 200, y: -1, h: 1, mat: M.asphalt, cast: false });
    roadMarkings(B, M);
    outskirts(ctx);

    // --- Edificios ---
    const byId = {};
    for (const b of BUILDINGS) {
      byId[b.id] = b;
      building(ctx, B, M, b);
    }

    // --- Accesos a azoteas ---
    // B1: escalera de incendios en su fachada este (x = -27), carriles hacia +x
    B.stairTower({ x: -27, z: -41, axis: 'z', dir: 1, side: 1, height: 12, base: 0.15, width: 1.6, mat: M.iron, landingMat: M.rust });
    // B5: escalera en su fachada oeste (x = 27), carriles hacia -x
    B.stairTower({ x: 27, z: 43, axis: 'z', dir: -1, side: -1, height: 7, base: 0.15, width: 1.6, mat: M.iron, landingMat: M.rust });
    // B6: escalera en su fachada sur hacia la plaza (z = 33), carriles hacia -z
    B.stairTower({ x: -6, z: 33, axis: 'x', dir: 1, side: -1, height: 10, base: 0.15, width: 1.6, mat: M.iron, landingMat: M.rust });

    // A1: contenedor → cajas → toldo → azotea (cada salto ≤ 1.3 m)
    B.block({ x: -26.5, z: -16.5, w: 2.2, d: 1.4, h: 1.2, mat: M.dumpster });
    B.block({ x: -29.2, z: -16, w: 1.4, d: 1.4, h: 2.6, mat: M.crate });
    B.block({ x: -30.5, z: -18.2, w: 1.0, d: 2.2, y: 3.7, h: 0.2, mat: M.rust }); // toldo / repisa
    B.block({ x: -30.5, z: -18.2, w: 0.15, d: 0.15, y: 0.15, h: 3.55, mat: M.iron, collide: false });
    // A2: contenedores y cajas en el callejón con B2
    B.block({ x: 12.2, z: -45, w: 1.4, d: 2.2, y: 0.15, h: 1.2, mat: M.dumpster });
    B.block({ x: 12.2, z: -42.4, w: 1.4, d: 1.4, y: 0.15, h: 2.4, mat: M.crate });
    B.block({ x: 12.2, z: -40.2, w: 1.4, d: 1.4, y: 0.15, h: 3.6, mat: M.crate });
    B.block({ x: 13.5, z: -38, w: 1.0, d: 2.0, y: 4.7, h: 0.2, mat: M.rust });
    B.block({ x: 13.5, z: -38, w: 0.15, d: 0.15, y: 0.15, h: 4.55, mat: M.iron, collide: false });

    // --- Pasarelas entre azoteas ---
    // Los extremos quedan a la altura del pretil (azotea + 0.3) para enlazar sin escalón.
    const br = (from, to) => B.bridge({ from: { ...from, y: from.y + 0.3 }, to: { ...to, y: to.y + 0.3 }, width: 2.2, mat: M.bridge, rails: M.iron });
    br({ x: -27, y: 12, z: -44 }, { x: -10, y: 18, z: -44 }); // B1 → B2 (z=-44 para no cruzar la escalera de B1)
    br({ x: 38, y: 9, z: -27 }, { x: 38, y: 14, z: -10 }); // B3 → B4
    br({ x: 38, y: 14, z: 10 }, { x: 38, y: 7, z: 28 }); // B4 → B5
    br({ x: 24, y: 6, z: -36 }, { x: 28, y: 9, z: -36 }); // A2 → B3
    br({ x: -11, y: 10, z: 42 }, { x: -28, y: 16, z: 42 }); // B6 → B7
    br({ x: -40, y: 16, z: 28 }, { x: -40, y: 24, z: 11 }); // B7 → B8
    br({ x: -42, y: 24, z: -11 }, { x: -42, y: 12, z: -27 }); // B8 → B1
    br({ x: 11, y: 10, z: 38 }, { x: 27, y: 7, z: 38 }); // B6 → B5

    // --- Monorraíl elevado sobre la calle norte (bajo las pasarelas; sus pilares se trepan) ---
    monorail(ctx, B, M, { points: [{ x: -80, z: -24.3 }, { x: 80, z: -24.3 }], y: 6.4 });

    // --- Detalles de azotea ---
    rooftopProps(ctx, B, M, P, byId);

    // --- Plaza central ---
    plaza(B, M, group, ctx);

    // --- Mobiliario urbano, vehículos, PDC y callejón de neón ---
    const pools = [];
    streetProps(ctx, B, M, pools);
    pdcPosts(ctx, B, M, P, pools);
    neonAlley(ctx, B, M, pools);
    energySources(ctx, byId);
    lightPools(group, pools);

    // --- Patrullas y Acólitos del barrio (además de los de la misión) ---
    ambientEnemies(ctx, byId);

    // --- Límites del escenario ---
    boundaries(ctx, B, M, P);

    // --- Lluvia (sigue a la cámara) ---
    ctx.addEntity(new Rain(ctx, { count: 2600, follow: true }));

    return {
      spawn: { x: 0, y: 0.3, z: 11, yaw: Math.PI },
      sun,
    };
  },
};

/**
 * Edificio con el kit de ciudad sobre su caja de colisión de siempre: planta
 * baja de hormigón con escaparates, pisos con ventanas encendidas, pilastras
 * y cornisa de ladrillo, pretil bajo (se pasa caminando), escalera de
 * incendios trepable y depósito de agua.
 */
function building(ctx, B, M, b) {
  const { group } = ctx;
  const body = M[b.body];
  const f = M[`facade${b.style}`];
  const groundH = Math.min(4.2, b.h - 0.6);
  // Acera alrededor
  B.block({ x: b.x, z: b.z, w: b.w + 4, d: b.d + 4, h: 0.15, mat: M.sidewalk, cast: false });
  // Cuerpo (la colisión de siempre) y planta baja
  B.block({ x: b.x, z: b.z, w: b.w, d: b.d, y: 0.15, h: b.h - 0.15, mat: [f, f, M.roof, M.roof, f, f], tag: b.id });
  deco(group, { x: b.x, y: 0.15, z: b.z, w: b.w + 0.1, h: groundH - 0.15, d: b.d + 0.1, mat: M.concreteDark, cast: false });
  // Pilastras en las esquinas, imposta sobre la planta baja y cornisa
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) deco(group, { x: b.x + sx * (b.w / 2 - 0.3), y: groundH, z: b.z + sz * (b.d / 2 - 0.3), w: 0.75, h: b.h - groundH - 0.5, d: 0.75, mat: body, cast: false });
  }
  deco(group, { x: b.x, y: groundH - 0.3, z: b.z, w: b.w + 0.3, h: 0.35, d: b.d + 0.3, mat: body, cast: false });
  deco(group, { x: b.x, y: b.h - 0.5, z: b.z, w: b.w + 0.5, h: 0.5, d: b.d + 0.5, mat: body });
  parapet(B, b, body);
  for (const { f: face, skip } of b.fronts) storefronts(ctx, M, b, face, { groundH, skip, r: rng(Math.round(b.x * 11 + b.z * 5 + 7)) });
  if (b.fire) fireEscape(ctx, B, M, b, b.fire, groundH);
  if (b.tank) waterTank(ctx, B, M, { x: b.tank[0], z: b.tank[1], y: b.h });
}

function parapet(B, b, mat) {
  const t = 0.3;
  const h = 0.3; // ≤ escalón: se puede pasar caminando
  const y = b.h;
  B.block({ x: b.x, z: b.z - b.d / 2 + t / 2, w: b.w, d: t, y, h, mat });
  B.block({ x: b.x, z: b.z + b.d / 2 - t / 2, w: b.w, d: t, y, h, mat });
  B.block({ x: b.x - b.w / 2 + t / 2, z: b.z, w: t, d: b.d - 2 * t, y, h, mat });
  B.block({ x: b.x + b.w / 2 - t / 2, z: b.z, w: t, d: b.d - 2 * t, y, h, mat });
}

function roadMarkings(B, M) {
  // Líneas discontinuas en el anillo que rodea la plaza y las avenidas.
  const dash = (x, z, alongX) => B.block({ x, z, w: alongX ? 2 : 0.15, d: alongX ? 0.15 : 2, y: 0, h: 0.02, mat: M.line, collide: false, cast: false });
  for (let a = -56; a <= 56; a += 4) {
    dash(a, -22.5, true);
    dash(a, 22.5, true);
    dash(-22.5, a, false);
    dash(22.5, a, false);
  }
  // Pasos de cebra hacia la plaza
  for (const [x, z, alongX] of [[0, -22.5, false], [0, 22.5, false], [-22.5, 0, true], [22.5, 0, true]]) {
    for (let i = -3; i <= 3; i++) {
      B.block({
        x: alongX ? x : x + i * 1.1, z: alongX ? z + i * 1.1 : z,
        w: alongX ? 4 : 0.6, d: alongX ? 0.6 : 4, y: 0, h: 0.025, mat: M.line, collide: false, cast: false,
      });
    }
  }
}

/**
 * Población del barrio: una patrulla PDC de dos agentes recorre la calle
 * norte (tranquila hasta que el jugador la provoque), un Acólito vigila la
 * azotea de B3 (hostil siempre) y hay unidades especiales de la PDC
 * (Blindado, dron y francotirador). Se regeneran al reiniciar el escenario.
 */
function ambientEnemies(ctx, byId) {
  const north = [{ x: 18, z: 21 }, { x: -18, z: 21 }];
  const b3 = byId.B3;
  const spawn = () => {
    ctx.enemies.clear('distrito');
    ctx.enemies.spawn('pdc', { x: 14, y: 0.2, z: 21, yaw: -Math.PI / 2, tag: 'distrito', patrol: north });
    ctx.enemies.spawn('pdc', { x: 16.5, y: 0.2, z: 21, yaw: -Math.PI / 2, tag: 'distrito', patrol: north });
    ctx.enemies.spawn('acolyte', { x: b3.x - 4, y: b3.h + 0.1, z: b3.z - 2, yaw: Math.PI / 2, tag: 'distrito', patrol: [{ x: b3.x - 5, z: b3.z - 2 }, { x: b3.x + 5, z: b3.z - 2 }] });
  };
  // Unidades especiales de la PDC: un Blindado en la calle este, un dron sobre
  // la calle oeste y un francotirador en la azotea de B5
  const b5 = byId.B5;
  const special = () => {
    ctx.enemies.clear('distrito-esp');
    ctx.enemies.spawn('blindado', { x: 24, y: 0.2, z: -10, yaw: 0, tag: 'distrito-esp', patrol: [{ x: 24, z: -12 }, { x: 24, z: 12 }] });
    ctx.enemies.spawn('dron', { x: -21, y: 4, z: -8, yaw: 0, tag: 'distrito-esp', patrol: [{ x: -21, z: -10 }, { x: -21, z: 10 }] });
    ctx.enemies.spawn('francotirador', { x: b5.x - b5.w / 2 + 2, y: b5.h + 0.1, z: b5.z - b5.d / 2 + 2, yaw: Math.atan2(-1, -1), tag: 'distrito-esp' });
  };
  special();
  ctx.addEntity({ reset: special });
  spawn();
  ctx.addEntity({ reset: spawn });
}

function plaza(B, M, group, ctx) {
  B.block({ x: 0, z: 0, w: 32, d: 32, h: 0.2, mat: M.plaza, cast: false });
  // Fuente
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.7, 24), M.concrete);
  basin.position.set(0, 0.55, 0);
  basin.castShadow = basin.receiveShadow = true;
  basin.userData.levelStatic = true;
  group.add(basin);
  // Huella aproximada del vaso circular con tres cajas
  B.world.addBox({ x: -4.1, y: 0.2, z: -1.7 }, { x: 4.1, y: 0.9, z: 1.7 });
  B.world.addBox({ x: -1.7, y: 0.2, z: -4.1 }, { x: 1.7, y: 0.9, z: 4.1 });
  B.world.addBox({ x: -3.0, y: 0.2, z: -3.0 }, { x: 3.0, y: 0.9, z: 3.0 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.1, 24), M.water);
  water.position.set(0, 0.85, 0);
  water.userData.levelStatic = true;
  group.add(water);
  B.block({ x: 0, z: 0, w: 1.2, d: 1.2, y: 0.9, h: 2.2, mat: M.concrete });
  // Monolito central (se puede subir desde el borde de la fuente)
  const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x2f8bff, emissiveIntensity: 1.5 }));
  top.position.set(0, 3.8, 0);
  group.add(top);

  // Bancos y árboles
  const r = rng(77);
  for (const [x, z, rot] of [[-9, -12, 0], [9, -12, 0], [-9, 12, 0], [9, 12, 0], [-12, -6, 1], [-12, 6, 1], [12, -6, 1], [12, 6, 1]]) {
    B.block({ x, z, w: rot ? 0.6 : 2.4, d: rot ? 2.4 : 0.6, y: 0.2, h: 0.45, mat: M.wood });
  }
  for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
    B.block({ x, z, w: 2.4, d: 2.4, y: 0.2, h: 0.5, mat: M.concrete });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 3, 8), M.trunk);
    trunk.position.set(x, 2.2, z);
    trunk.castShadow = true;
    trunk.userData.levelStatic = true;
    group.add(trunk);
    // Copa frondosa: varias masas de hojas irregulares
    const size = 1.5 + r() * 0.3;
    for (const [ox, oy, oz, k] of [[0, 4.4, 0, 1], [0.8, 4.0, 0.3, 0.7], [-0.7, 4.1, -0.4, 0.72], [0.2, 3.9, -0.8, 0.65], [-0.3, 5.1, 0.4, 0.6]]) {
      const geo = new THREE.IcosahedronGeometry(size * k, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const j = 0.82 + r() * 0.3;
        pos.setXYZ(i, pos.getX(i) * j, pos.getY(i) * j * 0.85, pos.getZ(i) * j);
      }
      geo.computeVertexNormals();
      const crown = new THREE.Mesh(geo, M.leaves);
      crown.position.set(x + ox, oy, z + oz);
      crown.castShadow = true;
      crown.userData.levelStatic = true;
      group.add(crown);
    }
    B.world.addBox({ x: x - 0.25, y: 0.7, z: z - 0.25 }, { x: x + 0.25, y: 3.7, z: z + 0.25 });
  }

  // Farolas de la plaza (sin luz real: su charco de luz se pinta en el suelo)
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    lamp(ctx, x, z, false);
  }
}

/** Farola: también es una fuente de energía que se puede absorber (E). */
function lamp(ctx, x, z, withLight) {
  const src = ctx.addEntity(new EnergySource(ctx, { kind: 'lamp', x, z, light: withLight }));
  ctx.energySources.register(src);
}

/**
 * Fuentes de energía cotidianas repartidas por el barrio (además de las
 * farolas): armarios eléctricos en las aceras y azoteas y máquinas
 * expendedoras en la plaza, para que nunca falte carga.
 */
function energySources(ctx, byId) {
  const add = (o) => ctx.energySources.register(ctx.addEntity(new EnergySource(ctx, o)));
  // Plaza
  add({ kind: 'vending', x: 3.5, z: 15.3, yaw: Math.PI });
  add({ kind: 'vending', x: -3.5, z: -15.3, yaw: 0 });
  // Aceras, junto a las fachadas
  add({ kind: 'cabinet', x: -32.6, z: 6, yaw: Math.PI / 2, y: 0.15 }); // B8
  add({ kind: 'cabinet', x: 32.6, z: -6, yaw: -Math.PI / 2, y: 0.15 }); // B4
  add({ kind: 'cabinet', x: 6, z: 32.6, yaw: Math.PI, y: 0.15 }); // B6
  add({ kind: 'cabinet', x: 6, z: -32.6, yaw: 0, y: 0.15 }); // B2
  add({ kind: 'cabinet', x: -26.6, z: -31, yaw: Math.PI / 2, y: 0.15 }); // B1
  add({ kind: 'cabinet', x: 26.6, z: 30, yaw: -Math.PI / 2, y: 0.15 }); // B5
  // Azoteas (para recargar sin bajar a la calle)
  const roof = (b, ox, oz, yaw) => add({ kind: 'cabinet', x: b.x + ox, z: b.z + oz, yaw, y: b.h });
  roof(byId.B8, -4, -6, Math.PI / 2);
  roof(byId.B2, 6, 3, 0);
  roof(byId.B4, -4.5, -6, Math.PI / 2);
  roof(byId.B7, 4, -4, -Math.PI / 2);
  roof(byId.B1, -5, -5, 0);

  // Gravedad: escombros y bloques de hormigón de obra (cosas pesadas)
  add({ kind: 'concrete', x: -9, z: 17.6, yaw: 0, y: 0 });
  add({ kind: 'concrete', x: 9, z: -17.6, yaw: Math.PI, y: 0 });
  add({ kind: 'rubble', x: -17.6, z: -9, y: 0 });
  add({ kind: 'rubble', x: 17.6, z: 9, y: 0 });
  add({ kind: 'rubble', x: -27, z: 24, y: 0 });
  add({ kind: 'concrete', x: 48, z: -18, yaw: Math.PI / 2, y: 0 });
  const roofG = (b, ox, oz, kind) => add({ kind, x: b.x + ox, z: b.z + oz, y: b.h });
  roofG(byId.B5, 4, -3, 'rubble');
  roofG(byId.B3, 4, 5, 'rubble');
  roofG(byId.B1, 6, -4, 'concrete');
  roofG(byId.B6, -6, 3, 'rubble');

  // Hilo: tendederos en azoteas y callejones, puestos de tela en la plaza
  add({ kind: 'fabric', x: -12.5, z: 2, yaw: Math.PI / 2, y: 0.2 });
  add({ kind: 'fabric', x: 12.5, z: -2, yaw: -Math.PI / 2, y: 0.2 });
  add({ kind: 'clothesline', x: 22, z: -12, y: 0 });
  add({ kind: 'clothesline', x: -40, z: 24, y: 0 });
  roofG(byId.B7, -3, 4, 'clothesline');
  roofG(byId.B2, -4, 3, 'clothesline');
  roofG(byId.B4, 3, 5, 'clothesline');
  roofG(byId.B8, 3, -5, 'fabric');

  // Temperatura: bidones con fuego en los callejones, arcones de las tiendas
  add({ kind: 'brazier', x: -22, z: -14, y: 0 });
  add({ kind: 'brazier', x: 30, z: 20, y: 0 });
  add({ kind: 'icebox', x: -9, z: -17.6, yaw: 0, y: 0 });
  add({ kind: 'icebox', x: 9, z: 17.6, yaw: Math.PI, y: 0 });
  roofG(byId.B3, -4, -4, 'icebox');

  // Alas: palomares en las azoteas y cojines de un puesto de la plaza
  roofG(byId.B5, -4, 4, 'dovecote');
  roofG(byId.B6, 5, -3, 'dovecote');
  add({ kind: 'pillows', x: -12.5, z: -3, yaw: Math.PI / 2, y: 0.2 });
}

function streetProps(ctx, B, M, pools) {
  const { group } = ctx;
  // Farolas en las aceras del anillo (solo emisivas) con su charco de luz en la calzada mojada
  for (const a of [-16, 16]) {
    for (const [x, z] of [[a, -27.2], [a, 27.2], [-27.2, a], [27.2, a]]) {
      lamp(ctx, x, z, false);
      pools.push({ x, z, r: 5, color: 0xffc890, opacity: 0.3 });
    }
  }
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) pools.push({ x, y: 0.2, z, r: 6.5, color: 0xffd0a0, opacity: 0.34 });
  // Farolas altas de brazo en las calles exteriores
  for (const [x, z, ry] of [[-56, -40, 0], [-56, 0, 0], [-56, 52, 0], [56, -48, Math.PI], [56, 0, Math.PI], [56, 30, Math.PI], [-30, -56, -Math.PI / 2], [30, -56, -Math.PI / 2], [-30, 56, Math.PI / 2], [40, 56, Math.PI / 2]]) {
    streetLight(group, M, { x, z, ry });
    pools.push({ x: x + Math.cos(ry) * 1.2, z: z - Math.sin(ry) * 1.2, r: 6, color: 0xffd2a0, opacity: 0.28 });
  }
  // Coches aparcados (obstáculos que se pueden saltar; el habitáculo también colisiona)
  const colors = ['carRed', 'carBlue', 'carGrey', 'carRed', 'carGrey', 'carBlue', 'carGrey', 'carRed'];
  const cars = [
    [-18, -26, true], [8, -25.8, true], [26, -12, false], [-25.8, 14, false], [16, 25.8, true], [-6, 25.8, true], [25.8, 20, false], [-26, -6, false],
  ];
  cars.forEach(([x, z, alongX], i) => {
    car(ctx, B, M, { x, z, ry: alongX ? 0 : Math.PI / 2, color: colors[i] });
    const hw = alongX ? 1.2 : 0.85;
    const hd = alongX ? 0.85 : 1.2;
    ctx.world.addBox({ x: x - hw, y: 1.3, z: z - hd }, { x: x + hw, y: 2.06, z: z + hd });
  });
  // Contenedores y cajas en callejones
  const clutter = [
    [-27.5, -25, 1.4, 2.2, 1.2, M.dumpster], [-45, -25, 2.2, 1.4, 1.2, M.dumpster],
    [-44, -13, 1.2, 1.2, 1.2, M.crate], [-44, -13, 1.0, 1.0, 2.2, M.crate],
    [25.2, -30, 1.2, 1.2, 1.0, M.crate], [11.6, -33, 1.2, 1.2, 1.0, M.crate],
    [45, 26.5, 2.2, 1.4, 1.2, M.dumpster], [-30, 28.5, 1.2, 1.2, 1.2, M.crate],
  ];
  for (const [x, z, w, d, h, mat] of clutter) B.block({ x, z, w, d, y: 0.15, h, mat });
}

/**
 * Presencia de la PDC: dos puestos con barreras New Jersey, sacos terreros y
 * torre de escaneo (las de inFamous Second Son) en las calles este y oeste,
 * una tercera torre en la esquina sureste y un camión aparcado en la calle norte.
 */
function pdcPosts(ctx, B, M, P, pools) {
  for (const sx of [-1, 1]) {
    const x = sx * 28.5;
    for (const z of [-5.5, -2, 2, 5.5]) jersey(ctx, B, P, { x, z, along: 'z', len: 3 });
    sandbags(ctx, B, P, { x: x + sx * 1.6, z: sx * 8.6, along: 'x', len: 2.2 });
    scanTower(ctx, B, M, { x, z: sx * 10.5 });
    pools.push({ x, z: sx * 10.5, r: 4, color: 0x3ac8ff, opacity: 0.35 });
    banner(ctx, P, { x: sx * 33.1, y: 11, z: sx * 6, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  scanTower(ctx, B, M, { x: 50, z: 50 });
  pools.push({ x: 50, z: 50, r: 4, color: 0x3ac8ff, opacity: 0.35 });
  truck(ctx, B, P, { x: -4, z: -29, ry: 0 });
}

/** Torre de escaneo de la PDC: mástil azul con tres anillos luminosos. */
function scanTower(ctx, B, M, { x, z }) {
  const { group } = ctx;
  B.block({ x, z, w: 1.2, d: 1.2, h: 7, mat: M.pdcBlue });
  for (const yy of [2.5, 4.5, 6.5]) {
    const ring = staticMesh(group, new THREE.TorusGeometry(1.1, 0.09, 6, 24).rotateX(Math.PI / 2), M.scan, { cast: false });
    ring.position.set(x, yy, z);
  }
  deco(group, { x, y: 7, z, w: 2.2, h: 0.4, d: 2.2, mat: M.pdcBlue });
}

/**
 * Callejón de neón (Tokio / Madripoor): banderolas luminosas en las dos
 * paredes, cables con farolillos rojos, un puesto de fideos y charcos de
 * colores en el suelo mojado.
 */
function neonAlley(ctx, B, M, pools) {
  const { group } = ctx;
  const { x0, x1, z0 } = ALLEY;
  const cx = (x0 + x1) / 2;
  const texts = ['居酒屋', 'BAR', '麺', 'HOTEL', 'KARAOKE', '寿司', 'ABIERTO', 'NEÓN'];
  const colors = ['#ff4f6a', '#4fe6ff', '#ffd84f', '#7bff6a', '#ff4fd8', '#ffb04f', '#ff4f6a', '#4fe6ff'];
  for (let i = 0; i < 8; i++) {
    const west = i % 2 === 0;
    const z = z0 + 2 + i * 2.1;
    neonSign(group, { x: west ? x0 + 0.5 : x1 - 0.5, y: 3.4 + (i % 3) * 1.9, z, ry: 0, text: texts[i], color: colors[i], vertical: true, w: 0.7, h: 2.3 });
    deco(group, { x: west ? x0 + 0.25 : x1 - 0.25, y: 3.4 + (i % 3) * 1.9 + 2.3, z, w: 0.5, h: 0.05, d: 0.05, mat: M.iron, cast: false });
    pools.push({ x: west ? x0 + 1 : x1 - 1, y: 0.15, z, r: 2.2, color: new THREE.Color(colors[i]).getHex(), opacity: 0.35 });
  }
  // Cables con farolillos de papel
  const r = rng(4);
  for (let k = 0; k < 4; k++) {
    const z = z0 + 3 + k * 4.5;
    deco(group, { x: cx, y: 5.6, z, w: x1 - x0, h: 0.02, d: 0.02, mat: M.iron, cast: false });
    for (let j = 0; j < 3; j++) {
      const m = staticMesh(group, new THREE.SphereGeometry(0.2, 10, 8), M.paperLantern, { cast: false });
      m.position.set(x0 + 0.9 + j * 1.1 + (r() - 0.5) * 0.3, 5.25 + (r() - 0.5) * 0.15, z);
      m.scale.y = 1.4;
    }
  }
  // Puesto de fideos con toldo (mostrador sólido) y cajas
  B.block({ x: x1 - 0.6, z: z0 + 13, w: 1.0, d: 2.6, y: 0, h: 1.05, mat: M.wood });
  deco(group, { x: x1 - 0.9, y: 2.6, z: z0 + 13, w: 1.8, h: 0.06, d: 3, mat: M.awningRed, rz: 0.3, cast: false });
  neonSign(group, { x: x1 - 0.06, y: 3.2, z: z0 + 13, ry: -Math.PI / 2, text: 'RAMEN', color: '#ff5a5a', w: 2.6, h: 0.8 });
  B.block({ x: x0 + 0.7, z: z0 + 6, w: 1.2, d: 1.2, y: 0, h: 1.1, mat: M.crate });
  B.block({ x: x0 + 0.8, z: z0 + 15.5, w: 1.3, d: 2, y: 0, h: 1.2, mat: M.dumpster });
}

function rooftopProps(ctx, B, M, P, byId) {
  const { group } = ctx;
  const ac = (b, ox, oz) => {
    B.block({ x: b.x + ox, z: b.z + oz, w: 1.6, d: 1.2, y: b.h, h: 1.1, mat: M.metal });
    deco(group, { x: b.x + ox, y: b.h + 1.1, z: b.z + oz, w: 0.9, h: 0.04, d: 0.9, mat: M.iron, cast: false });
  };
  ac(byId.B1, -4, 3);
  ac(byId.B1, 3, 5);
  ac(byId.B2, -5, -2);
  ac(byId.B3, 3, 2);
  ac(byId.B4, -3, 4);
  ac(byId.B6, 5, 2);
  ac(byId.A2, 1, 3);
  // Salidas de humo (decorado, junto a los pretiles)
  for (const [id, ox, oz] of [['B1', -7.5, -7.5], ['B2', 8.5, 5.5], ['B3', 6.5, 7.5], ['B4', 5.5, 8.5], ['B6', -9.5, 5.5], ['B7', 6.5, -6.5], ['C1', 3, 3], ['C2', -3, 4], ['C3', 3, -4], ['C5', 3, 5]]) {
    const b = byId[id];
    deco(group, { x: b.x + ox, y: b.h, z: b.z + oz, w: 0.6, h: 1.4, d: 0.6, mat: M.iron });
  }
  // Depósito de agua en B7 (escalable por la plataforma)
  const b7 = byId.B7;
  waterTank(ctx, B, M, { x: b7.x + 3, z: b7.z + 3, y: b7.h });
  // Torre B8: casetón, antena con baliza roja y valla publicitaria hacia la plaza
  const b8 = byId.B8;
  B.block({ x: b8.x - 2, z: b8.z + 4, w: 5, d: 4, y: b8.h, h: 3, mat: M.concrete });
  B.block({ x: b8.x - 2, z: b8.z + 4, w: 0.3, d: 0.3, y: b8.h + 3, h: 9, mat: M.iron });
  deco(group, { x: b8.x - 2, y: b8.h + 12, z: b8.z + 4, w: 0.4, h: 0.4, d: 0.4, mat: P.redLight, cast: false });
  for (const dz of [-3, 3]) deco(group, { x: b8.x + 5.5, y: b8.h, z: b8.z - 2 + dz, w: 0.2, h: 4, d: 0.2, mat: M.iron });
  deco(group, { x: b8.x + 5.5, y: b8.h + 3.6, z: b8.z - 2, w: 0.2, h: 3.2, d: 7, mat: M.poster1, cast: false });
  // Cartel luminoso en B4
  const b4 = byId.B4;
  B.block({ x: b4.x + 2, z: b4.z - 5, w: 0.4, d: 8, y: b4.h, h: 0.3, mat: M.iron });
  neonSign(group, { x: b4.x + 2, y: b4.h + 3, z: b4.z - 5, ry: Math.PI / 2, text: 'DISTRITO 0', color: '#4fd1ff', w: 8, h: 3 });
  for (const dz of [-3.5, 3.5]) B.block({ x: b4.x + 2, z: b4.z - 5 + dz, w: 0.15, d: 0.15, y: b4.h, h: 1.5, mat: M.iron, collide: false });
  // Valla publicitaria en B2, de cara a la calle norte
  const b2 = byId.B2;
  for (const dx of [-2.5, 2.5]) deco(group, { x: b2.x - 3 + dx, y: b2.h, z: b2.z - 5.6, w: 0.2, h: 4, d: 0.2, mat: M.iron });
  deco(group, { x: b2.x - 3, y: b2.h + 3.6, z: b2.z - 5.6, w: 7, h: 3.2, d: 0.2, mat: M.poster0, cast: false, ry: Math.PI });
}

function boundaries(ctx, B, M, P) {
  // Barreras de hormigón con franja de aviso + valla metálica, e invisibles altas para impedir salir.
  const ring = [
    [0, -HALF, HALF * 2, 0.8], [0, HALF, HALF * 2, 0.8], [-HALF, 0, 0.8, HALF * 2], [HALF, 0, 0.8, HALF * 2],
  ];
  for (const [x, z, w, d] of ring) {
    B.block({ x, z, w, d, h: 1.1, mat: M.barrier });
    deco(ctx.group, { x, y: 0.55, z, w: w + 0.02, h: 0.22, d: d + 0.02, mat: P.hazard, cast: false });
    const alongX = w > d;
    chainFence(ctx, P, alongX ? { x0: x - w / 2, z0: z, x1: x + w / 2, z1: z, y: 1.1, h: 2.4 } : { x0: x, z0: z - d / 2, x1: x, z1: z + d / 2, y: 1.1, h: 2.4 });
    B.invisibleWall({ x, z, w: w + 0.5, d: d + 0.5, h: 80 });
  }
}

/**
 * La ciudad continúa fuera del barrio: suelo hasta el horizonte, manzanas
 * cercanas con ventanas encendidas (con niebla) en una cuadrícula que respeta
 * las calles, y rascacielos lejanos en todas direcciones (sin niebla).
 */
function outskirts(ctx) {
  const { group } = ctx;
  const ground = staticMesh(group, new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.8 }), { cast: false });
  ground.position.y = -0.05;
  const r = rng(31);
  const blocks = [];
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = -6; gz <= 6; gz++) {
      const x = gx * 26;
      const z = gz * 26;
      if (Math.abs(x) < 76 && Math.abs(z) < 76) continue;
      const far = Math.max(Math.abs(x), Math.abs(z));
      const w = 15 + r() * 5;
      const d = 15 + r() * 5;
      blocks.push({ x: x + (r() - 0.5) * 3, y: -0.5, z: z + (r() - 0.5) * 3, w, d, h: 12 + r() * 18 + (far - 70) * 0.35 + (r() < 0.12 ? 30 : 0), ry: 0, tone: 0.9 + r() * 0.3 });
    }
  }
  group.add(cityTowers(blocks, { lit: 0.34, intensity: 0.8, fog: true, near: { x: 0, z: 0 } }));
  group.add(createCity({ origin: { x: 0, y: -30, z: 0 }, heading: -Math.PI / 2, spread: Math.PI * 2, dist: [200, 480], count: 150, seed: 21, lit: 0.34, intensity: 1.1, fog: 0.25, near: { x: 0, z: 0 } }));
}
