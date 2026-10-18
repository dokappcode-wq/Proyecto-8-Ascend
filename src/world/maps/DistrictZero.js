import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { asphaltTexture, concreteTexture, facadeTextures, sidewalkTexture, rng } from '../textures.js';
import { EnergySource } from '../entities/EnergySource.js';

/**
 * MAPA 2 — DISTRITO CERO
 *
 * Porción reducida de la ciudad: 8 edificios principales + 2 anexos,
 * calles, callejones, una plaza central y azoteas accesibles mediante
 * escaleras de incendios, pasarelas y saltos.
 *
 * Red de azoteas (todas accesibles en la Etapa 1, sin escalada):
 *   Suelo → B5 (escalera) → B4 → B3 → A2 (bajada)
 *   Suelo → B6 (escalera) → B7 → B8 (torre) → B1 → B2
 *   Suelo → B1 (escalera) · Suelo → A1 y A2 (cajas y contenedores)
 *   B6 → B5 (pasarela)
 */

const HALF = 62; // límite jugable

const BUILDINGS = [
  { id: 'B1', x: -36, z: -36, w: 18, d: 18, h: 12, style: 0 },
  { id: 'B2', x: 0, z: -40, w: 20, d: 14, h: 18, style: 1 },
  { id: 'B3', x: 36, z: -36, w: 16, d: 18, h: 9, style: 2 },
  { id: 'B4', x: 40, z: 0, w: 14, d: 20, h: 14, style: 3 },
  { id: 'B5', x: 36, z: 36, w: 18, d: 16, h: 7, style: 2 },
  { id: 'B6', x: 0, z: 40, w: 22, d: 14, h: 10, style: 4 },
  { id: 'B7', x: -36, z: 36, w: 16, d: 16, h: 16, style: 1 },
  { id: 'B8', x: -40, z: 0, w: 14, d: 22, h: 24, style: 3 },
  // Anexos que forman callejones
  { id: 'A1', x: -38, z: -19, w: 14, d: 8, h: 5, style: 4 },
  { id: 'A2', x: 19, z: -38, w: 10, d: 12, h: 6, style: 0 },
];

export default {
  id: 'distrito',
  name: 'Distrito Cero',
  description: 'El corazón de la ciudad. Calles, callejones y azoteas.',
  /** Reputación: la PDC empieza tranquila y reacciona a lo que haga el jugador. */
  factions: { pdc: 0 },
  reputation: true,
  /** Zona jugable (aviso al acercarse al límite). */
  bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },

  /** Puntos de teletransporte del menú de depuración. */
  waypoints: [
    { id: 'inicio', name: 'Plaza', x: 0, y: 0.3, z: 11, yaw: Math.PI },
    { id: 'B5', name: 'Escalera de B5', x: 26.2, y: 0.2, z: 46, yaw: Math.PI },
    { id: 'B8', name: 'Azotea de B8 (torre)', x: -36, y: 24.4, z: -6, yaw: 0 },
    { id: 'callejon', name: 'Callejón de A2', x: 12.2, y: 0.2, z: -48, yaw: Math.PI },
    { id: 'telefono', name: 'Teléfono público (misión)', x: -4.6, y: 0.3, z: 10, yaw: -Math.PI / 2 },
    { id: 'patrulla', name: 'Calle sur (patrulla de la misión)', x: 0, y: 0.3, z: -14, yaw: Math.PI },
  ],

  build(ctx) {
    const { group, builder: B, scene } = ctx;
    // --- Ambiente de atardecer ---
    scene.fog = new THREE.FogExp2(0x3a2f3a, 0.0085);
    const sunDir = new THREE.Vector3(0.75, 0.12, -0.65);
    group.add(createSky({ top: '#0d1a33', horizon: '#e0824e', bottom: '#1b1a20', sunDir, sunColor: '#ffb067' }));
    group.add(new THREE.HemisphereLight(0x6d83b5, 0x3a2a24, 0.9));
    const sun = createSun({ color: '#ffb27a', intensity: 2.4, direction: sunDir.clone().negate().setY(-0.45), shadowSize: 50 });
    group.add(sun, sun.target);

    const tex = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.userData = t.userData;
      return c;
    };
    const M = {
      asphalt: new THREE.MeshStandardMaterial({ map: tex(asphaltTexture()), roughness: 0.95 }),
      sidewalk: new THREE.MeshStandardMaterial({ map: tex(sidewalkTexture()), roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#55575c', 31)), roughness: 0.95 }),
      plaza: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#8a7f73', 41)), roughness: 0.85 }),
      concrete: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#77736d', 51)), roughness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x3d434b, metalness: 0.7, roughness: 0.45 }),
      rust: new THREE.MeshStandardMaterial({ color: 0x5a3b2c, metalness: 0.4, roughness: 0.7 }),
      bridge: new THREE.MeshStandardMaterial({ color: 0x4b5058, metalness: 0.55, roughness: 0.5 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.85 }),
      dumpster: new THREE.MeshStandardMaterial({ color: 0x2f5a3c, metalness: 0.3, roughness: 0.6 }),
      crate: new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 0.9 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.9 }),
      water: new THREE.MeshStandardMaterial({ color: 0x1f3d55, metalness: 0.2, roughness: 0.1, emissive: 0x0a1a2a }),
      lampHead: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 2.2 }),
      barrier: new THREE.MeshStandardMaterial({ color: 0xa8a39a, roughness: 0.85 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0xc9a13a, roughness: 0.6 }),
      line: new THREE.MeshStandardMaterial({ color: 0xd9d4c5, roughness: 0.8 }),
    };

    // --- Suelo (asfalto) ---
    B.block({ x: 0, z: 0, w: 200, d: 200, y: -1, h: 1, mat: M.asphalt, cast: false });
    roadMarkings(B, M);

    // --- Edificios ---
    const facadeMats = new Map();
    const facadeFor = (style) => {
      if (!facadeMats.has(style)) {
        const f = facadeTextures(style);
        facadeMats.set(style, new THREE.MeshStandardMaterial({
          map: tex(f.map),
          emissiveMap: tex(f.emissiveMap),
          emissive: 0xffffff,
          emissiveIntensity: 0.8,
          roughness: 0.75,
        }));
      }
      return facadeMats.get(style);
    };
    const byId = {};
    for (const b of BUILDINGS) {
      byId[b.id] = b;
      // Acera alrededor
      B.block({ x: b.x, z: b.z, w: b.w + 4, d: b.d + 4, h: 0.15, mat: M.sidewalk, cast: false });
      const f = facadeFor(b.style);
      B.block({ x: b.x, z: b.z, w: b.w, d: b.d, y: 0.15, h: b.h - 0.15, mat: [f, f, M.roof, M.roof, f, f], tag: b.id });
      parapet(B, b, M.concrete);
    }

    // --- Accesos a azoteas ---
    // B1: escalera de incendios en su fachada este (x = -27), carriles hacia +x
    B.stairTower({ x: -27, z: -41, axis: 'z', dir: 1, side: 1, height: 12, base: 0.15, width: 1.6, mat: M.metal, landingMat: M.rust });
    // B5: escalera en su fachada oeste (x = 27), carriles hacia -x
    B.stairTower({ x: 27, z: 43, axis: 'z', dir: -1, side: -1, height: 7, base: 0.15, width: 1.6, mat: M.metal, landingMat: M.rust });
    // B6: escalera en su fachada sur hacia la plaza (z = 33), carriles hacia -z
    B.stairTower({ x: -6, z: 33, axis: 'x', dir: 1, side: -1, height: 10, base: 0.15, width: 1.6, mat: M.metal, landingMat: M.rust });

    // A1: contenedor → cajas → toldo → azotea (cada salto ≤ 1.3 m)
    B.block({ x: -26.5, z: -16.5, w: 2.2, d: 1.4, h: 1.2, mat: M.dumpster });
    B.block({ x: -29.2, z: -16, w: 1.4, d: 1.4, h: 2.6, mat: M.crate });
    B.block({ x: -30.5, z: -18.2, w: 1.0, d: 2.2, y: 3.7, h: 0.2, mat: M.rust }); // toldo / repisa
    B.block({ x: -30.5, z: -18.2, w: 0.15, d: 0.15, y: 0.15, h: 3.55, mat: M.metal, collide: false });
    // A2: contenedores y cajas en el callejón con B2
    B.block({ x: 12.2, z: -45, w: 1.4, d: 2.2, y: 0.15, h: 1.2, mat: M.dumpster });
    B.block({ x: 12.2, z: -42.4, w: 1.4, d: 1.4, y: 0.15, h: 2.4, mat: M.crate });
    B.block({ x: 12.2, z: -40.2, w: 1.4, d: 1.4, y: 0.15, h: 3.6, mat: M.crate });
    B.block({ x: 13.5, z: -38, w: 1.0, d: 2.0, y: 4.7, h: 0.2, mat: M.rust });
    B.block({ x: 13.5, z: -38, w: 0.15, d: 0.15, y: 0.15, h: 4.55, mat: M.metal, collide: false });

    // --- Pasarelas entre azoteas ---
    // Los extremos quedan a la altura del pretil (azotea + 0.3) para enlazar sin escalón.
    const br = (from, to) => B.bridge({ from: { ...from, y: from.y + 0.3 }, to: { ...to, y: to.y + 0.3 }, width: 2.2, mat: M.bridge, rails: M.metal });
    br({ x: -27, y: 12, z: -44 }, { x: -10, y: 18, z: -44 }); // B1 → B2 (z=-44 para no cruzar la escalera de B1)
    br({ x: 38, y: 9, z: -27 }, { x: 38, y: 14, z: -10 }); // B3 → B4
    br({ x: 38, y: 14, z: 10 }, { x: 38, y: 7, z: 28 }); // B4 → B5
    br({ x: 24, y: 6, z: -36 }, { x: 28, y: 9, z: -36 }); // A2 → B3
    br({ x: -11, y: 10, z: 42 }, { x: -28, y: 16, z: 42 }); // B6 → B7
    br({ x: -40, y: 16, z: 28 }, { x: -40, y: 24, z: 11 }); // B7 → B8
    br({ x: -42, y: 24, z: -11 }, { x: -42, y: 12, z: -27 }); // B8 → B1
    br({ x: 11, y: 10, z: 38 }, { x: 27, y: 7, z: 38 }); // B6 → B5

    // --- Detalles de azotea ---
    rooftopProps(B, M, byId);

    // --- Plaza central ---
    plaza(B, M, group, ctx);

    // --- Mobiliario urbano y vehículos ---
    streetProps(B, M, group, ctx);
    energySources(ctx, byId);

    // --- Patrullas y Acólitos del barrio (además de los de la misión) ---
    ambientEnemies(ctx, byId);

    // --- Límites del escenario ---
    boundaries(B, M);
    skyline(group);

    return {
      spawn: { x: 0, y: 0.3, z: 11, yaw: Math.PI },
      sun,
    };
  },
};

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
 * norte (tranquila hasta que el jugador la provoque) y un Acólito vigila la
 * azotea de B3 (hostil siempre). Se regeneran al reiniciar el escenario.
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
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 + r() * 0.4, 1), M.leaves);
    crown.position.set(x, 4.2, z);
    crown.castShadow = true;
    crown.userData.levelStatic = true;
    group.add(crown);
    B.world.addBox({ x: x - 0.25, y: 0.7, z: z - 0.25 }, { x: x + 0.25, y: 3.7, z: z + 0.25 });
  }

  // Farolas de la plaza con luz real (pocas, por rendimiento)
  for (const [x, z] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    lamp(ctx, x, z, true);
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
}

function streetProps(B, M, group, ctx) {
  const r = rng(5);
  // Farolas en las aceras del anillo (solo emisivas)
  for (const a of [-16, 16]) {
    lamp(ctx, a, -27.2, false);
    lamp(ctx, a, 27.2, false);
    lamp(ctx, -27.2, a, false);
    lamp(ctx, 27.2, a, false);
  }
  // Coches aparcados (obstáculos que se pueden saltar: 1.5 m)
  const carColors = [0x7a1e1e, 0x1e3a5a, 0x2f2f33, 0xb0b4b8, 0x4a5a2a];
  const cars = [
    [-18, -26, true], [8, -25.8, true], [26, -12, false], [-25.8, 14, false], [16, 25.8, true], [-6, 25.8, true], [25.8, 20, false], [-26, -6, false],
  ];
  for (const [x, z, alongX] of cars) {
    const mat = new THREE.MeshStandardMaterial({ color: carColors[Math.floor(r() * carColors.length)], metalness: 0.6, roughness: 0.35 });
    const w = alongX ? 4.2 : 1.9;
    const d = alongX ? 1.9 : 4.2;
    B.block({ x, z, w, d, y: 0.3, h: 0.8, mat });
    B.block({ x, z, w: alongX ? 2.2 : 1.7, d: alongX ? 1.7 : 2.2, y: 1.1, h: 0.55, mat: M.metal });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b1118, metalness: 0.9, roughness: 0.1 });
    B.block({ x, z, w: alongX ? 2.25 : 1.6, d: alongX ? 1.6 : 2.25, y: 1.12, h: 0.48, mat: glass, collide: false });
    // ruedas (visuales)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12), M.metal);
        wheel.rotation[alongX ? 'x' : 'z'] = Math.PI / 2;
        wheel.position.set(x + (alongX ? sx * 1.3 : sx * 0.85), 0.33, z + (alongX ? sz * 0.85 : sz * 1.3));
        wheel.userData.levelStatic = true;
        group.add(wheel);
      }
    }
  }
  // Contenedores y cajas en callejones
  const clutter = [
    [-27.5, -25, 1.4, 2.2, 1.2, M.dumpster], [-45, -25, 2.2, 1.4, 1.2, M.dumpster],
    [-44, -13, 1.2, 1.2, 1.2, M.crate], [-44, -13, 1.0, 1.0, 2.2, M.crate],
    [25.2, -30, 1.2, 1.2, 1.0, M.crate], [11.6, -33, 1.2, 1.2, 1.0, M.crate],
    [45, 26.5, 2.2, 1.4, 1.2, M.dumpster], [-30, 28.5, 1.2, 1.2, 1.2, M.crate],
  ];
  for (const [x, z, w, d, h, mat] of clutter) B.block({ x, z, w, d, y: 0.15, h, mat });
}

function rooftopProps(B, M, byId) {
  const ac = (b, ox, oz) => B.block({ x: b.x + ox, z: b.z + oz, w: 1.6, d: 1.2, y: b.h, h: 1.1, mat: M.metal });
  ac(byId.B1, -4, 3);
  ac(byId.B1, 3, 5);
  ac(byId.B2, -5, -2);
  ac(byId.B3, 3, 2);
  ac(byId.B4, -3, 4);
  ac(byId.B6, 5, 2);
  ac(byId.A2, 1, 3);
  // Depósito de agua en B7 (escalable por la plataforma)
  const b7 = byId.B7;
  B.block({ x: b7.x + 3, z: b7.z + 3, w: 3, d: 3, y: b7.h, h: 1.2, mat: M.rust });
  B.block({ x: b7.x + 3, z: b7.z + 3, w: 2.6, d: 2.6, y: b7.h + 1.2, h: 2.4, mat: M.wood });
  // Torre B8: casetón y antena
  const b8 = byId.B8;
  B.block({ x: b8.x - 2, z: b8.z + 4, w: 5, d: 4, y: b8.h, h: 3, mat: M.concrete });
  B.block({ x: b8.x - 2, z: b8.z + 4, w: 0.3, d: 0.3, y: b8.h + 3, h: 9, mat: M.metal });
  // Cartel luminoso en B4
  const b4 = byId.B4;
  B.block({ x: b4.x + 2, z: b4.z - 5, w: 0.4, d: 8, y: b4.h, h: 0.3, mat: M.metal });
  const sign = B.block({ x: b4.x + 2, z: b4.z - 5, w: 0.3, d: 8, y: b4.h + 1.5, h: 3, mat: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2f8bff, emissiveIntensity: 1.4 }), collide: false });
  sign.castShadow = false;
  for (const dz of [-3.5, 3.5]) B.block({ x: b4.x + 2, z: b4.z - 5 + dz, w: 0.15, d: 0.15, y: b4.h, h: 1.5, mat: M.metal, collide: false });
}

function boundaries(B, M) {
  // Barreras de hormigón + valla, e invisibles altas para impedir salir.
  const ring = [
    [0, -HALF, HALF * 2, 0.8], [0, HALF, HALF * 2, 0.8], [-HALF, 0, 0.8, HALF * 2], [HALF, 0, 0.8, HALF * 2],
  ];
  const fence = new THREE.MeshStandardMaterial({ color: 0x8a95a3, transparent: true, opacity: 0.25, depthWrite: false });
  for (const [x, z, w, d] of ring) {
    B.block({ x, z, w, d, h: 1.1, mat: M.barrier });
    B.block({ x, z, w: w > 1 ? w : 0.1, d: d > 1 ? d : 0.1, y: 1.1, h: 2.4, mat: fence, collide: false, cast: false });
    B.invisibleWall({ x, z, w: w + 0.5, d: d + 0.5, h: 80 });
  }
}

function skyline(group) {
  // Siluetas lejanas de la gran ciudad (solo decorativas, sin colisión).
  const r = rng(9);
  const f = facadeTextures(3);
  // Un solo material para todas las siluetas: la repetición de la textura se
  // aplica en las UV de cada caja, así se fusionan en una única malla.
  const map = f.map.clone();
  const em = f.emissiveMap.clone();
  map.needsUpdate = em.needsUpdate = true;
  map.wrapS = map.wrapT = em.wrapS = em.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 1);
  em.repeat.set(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.7, color: 0x8899aa });
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + r() * 0.05;
    const dist = 120 + r() * 120;
    const w = 12 + r() * 20;
    const h = 25 + r() * (i % 7 === 0 ? 120 : 60);
    const geo = new THREE.BoxGeometry(w, h, w);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 16), uv.getY(k) * (h / 14));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * dist, h / 2, Math.sin(a) * dist);
    m.userData.levelStatic = true;
    group.add(m);
  }
}
