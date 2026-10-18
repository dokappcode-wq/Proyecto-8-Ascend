import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { gridTexture, concreteTexture } from '../textures.js';
import { TrainingTarget } from '../entities/TrainingTarget.js';
import { TrainingDummy } from '../entities/TrainingDummy.js';
import { PhysicsProp } from '../entities/PhysicsProp.js';

/**
 * MAPA 1 — CAMPO DE PRUEBAS
 *
 * Entorno técnico y modular para verificar mecánicas.
 * Zona A (movimiento), B (recorridos), C (poderes), D (combate) y F (efectos
 * visuales) son jugables. La zona E (adquisición de marcas, Etapa 4) está
 * delimitada y señalizada a la espera de su contenido.
 */

const HALF = 85; // medio lado del recinto

export default {
  id: 'campo',
  name: 'Campo de Pruebas',
  description: 'Zona de entrenamiento y experimentación.',

  /** Puntos de teletransporte del menú de depuración. */
  waypoints: [
    { id: 'inicio', name: 'Inicio', x: 0, y: 0.3, z: 18, yaw: Math.PI },
    { id: 'A', name: 'Zona A — Movimiento', x: -38, y: 0.2, z: 6, yaw: Math.PI },
    { id: 'B', name: 'Zona B — Recorridos', x: 34, y: 0.2, z: 6, yaw: Math.PI },
    { id: 'C', name: 'Zona C — Poderes', x: -57, y: 0.2, z: -48, yaw: Math.PI },
    { id: 'C-alcance', name: 'Zona C — Prueba de alcance', x: -80, y: 0.2, z: -79, yaw: Math.PI / 2 },
    { id: 'D', name: 'Zona D — Combate', x: -15, y: 0.2, z: -41, yaw: Math.PI },
    { id: 'F', name: 'Zona F — Efectos visuales', x: 45, y: 0.2, z: -48, yaw: Math.PI },
  ],

  build(ctx) {
    const { group, builder: B, scene } = ctx;
    // --- Ambiente ---
    scene.fog = new THREE.Fog(0x8fa3b8, 90, 260);
    group.add(createSky({ top: '#2e5b8f', horizon: '#c9d6e2', bottom: '#5a6470', sunDir: new THREE.Vector3(-0.5, 0.75, 0.3), sunColor: '#fff2d6' }));
    group.add(new THREE.HemisphereLight(0xcfe3ff, 0x4a4f57, 1.1));
    const sun = createSun({ color: '#fff3e0', intensity: 2.6, direction: new THREE.Vector3(0.5, -0.85, -0.3) });
    group.add(sun, sun.target);

    // --- Materiales ---
    const tex = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.userData = t.userData;
      return c;
    };
    const M = {
      floor: new THREE.MeshStandardMaterial({ map: tex(gridTexture()), roughness: 0.9 }),
      block: new THREE.MeshStandardMaterial({ map: tex(gridTexture('#5b6675', '#7b8796', '#a9b8c9')), roughness: 0.8 }),
      orange: new THREE.MeshStandardMaterial({ map: tex(gridTexture('#b8652e', '#d08048', '#f0a66a')), roughness: 0.75 }),
      blue: new THREE.MeshStandardMaterial({ map: tex(gridTexture('#2d5f93', '#4a7db0', '#7fb2e3')), roughness: 0.75 }),
      white: new THREE.MeshStandardMaterial({ map: tex(gridTexture('#b9c0c8', '#d5dbe1', '#eef2f6')), roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ map: tex(concreteTexture('#3c4148', 5)), roughness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x59636e, metalness: 0.6, roughness: 0.4 }),
      pad: new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.95 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0xe0a53a, roughness: 0.6, emissive: 0x3a2400 }),
    };

    // --- Suelo y límites ---
    B.block({ x: 0, z: 0, w: HALF * 2, d: HALF * 2, y: -1, h: 1, mat: M.floor, cast: false });
    for (const [x, z, w, d] of [
      [0, -HALF, HALF * 2, 1], [0, HALF, HALF * 2, 1], [-HALF, 0, 1, HALF * 2], [HALF, 0, 1, HALF * 2],
    ]) {
      B.block({ x, z, w, d, h: 1.4, mat: M.stripe });
      B.invisibleWall({ x, z, w: w + 0.5, d: d + 0.5 });
    }

    // --- Núcleo central / punto de aparición ---
    B.block({ x: 0, z: 18, w: 10, d: 10, h: 0.25, mat: M.dark });
    B.sign(['CAMPO DE PRUEBAS', 'Oeste: Zona A — Movimiento · Este: Zona B — Recorridos', 'Norte: C Poderes · D Combate · F Efectos · E en la Etapa 4'], { x: 0, y: 3.2, z: 10, w: 9, h: 2.6, facing: 0, opts: { width: 1024, height: 300 } });
    B.block({ x: 0, z: 10.05, w: 9.4, d: 0.1, y: 0, h: 1.9, mat: M.metal, collide: false });

    buildZoneA(B, M);
    buildZoneB(B, M);
    buildZoneC(B, M, ctx);
    buildZoneD(B, M, ctx);
    buildZoneF(B, M, ctx);
    buildFutureZones(B, M);

    return {
      spawn: { x: 0, y: 0.3, z: 18, yaw: Math.PI },
      sun,
    };
  },
};

/** ZONA A — Movimiento: rampas, escaleras, plataformas, obstáculos, saltos. */
function buildZoneA(B, M) {
  B.sign(['ZONA A — MOVIMIENTO', 'Caminar · Sprint · Salto · Esquiva'], { x: -40, y: 3.5, z: 4, w: 7, h: 2.4, facing: 0 });
  B.block({ x: -40, z: 3.95, w: 0.2, d: 0.2, h: 2.3, mat: M.metal, collide: false });

  // Rampa suave (15°)
  B.ramp({ x: -20, z: -7, w: 4, d: 10, axis: 'z', dir: -1, y0: 0, y1: 2.68, mat: M.blue });
  B.block({ x: -20, z: -16, w: 4, d: 8, h: 2.68, mat: M.block });
  B.floorText(['Rampa 15°'], { x: -20, z: 0.5, w: 5, h: 2.5 });

  // Rampa pronunciada (30°)
  B.ramp({ x: -26, z: -5, w: 4, d: 6, axis: 'z', dir: -1, y0: 0, y1: 3.46, mat: M.orange });
  B.block({ x: -26, z: -12, w: 4, d: 8, h: 3.46, mat: M.block });
  B.floorText(['Rampa 30°'], { x: -26, z: 0.5, w: 5, h: 2.5 });

  // Escalera normal (peldaños de 0.3 m)
  const st = B.stairs({ x: -32, z: -2, width: 3, axis: 'z', dir: -1, y0: 0, y1: 3, mat: M.white });
  B.block({ x: -32, z: -2 - st.length - 4, w: 3, d: 8, h: 3, mat: M.block });
  B.floorText(['Escalera 0.3 m'], { x: -32, z: 0.5, w: 5, h: 2.5 });

  // Peldaños altos (0.5 m): superan el escalón automático, hay que saltar.
  for (let i = 0; i < 5; i++) {
    B.block({ x: -38, z: -2.4 - i * 0.8, w: 3, d: 0.8, h: 0.5 * (i + 1), mat: M.orange });
  }
  B.block({ x: -38, z: -8, w: 3, d: 4, h: 2.5, mat: M.block });
  B.floorText(['Peldaños 0.5 m', '(requieren salto)'], { x: -38, z: 0.5, w: 5, h: 2.5 });

  // Plataformas a distintas alturas
  const heights = [0.5, 1.0, 1.5, 2.0];
  heights.forEach((h, i) => {
    B.block({ x: -46, z: -3 - i * 4.5, w: 3, d: 3, h, mat: i === 3 ? M.orange : M.blue });
  });
  B.floorText(['Alturas', '0.5 · 1.0 · 1.5 · 2.0 m'], { x: -46, z: 0.5, w: 5, h: 2.5 });
  B.sign(['2.0 m', 'Desde el suelo: parkour (Etapa 5)'], { x: -46, y: 3.2, z: -18.2, w: 3, h: 1.2, facing: 0, opts: { width: 512, height: 200 } });

  // Obstáculos bajos
  [0.4, 0.8, 1.2].forEach((h, i) => {
    B.block({ x: -54, z: -3 - i * 5, w: 4, d: 0.6, h, mat: M.white });
  });
  B.floorText(['Obstáculos', '0.4 · 0.8 · 1.2 m'], { x: -54, z: 0.5, w: 5, h: 2.5 });

  // Saltos de longitud: plataformas de 1 m de altura con huecos crecientes
  let xCursor = -16;
  const gaps = [2, 3, 4, 5, 6, 7];
  B.block({ x: xCursor - 2, z: 9, w: 4, d: 3, h: 1, mat: M.block });
  B.stairs({ x: xCursor + 1.4, z: 9, width: 3, axis: 'x', dir: -1, y0: 0, y1: 1, stepRise: 0.25, stepRun: 0.35, mat: M.white });
  xCursor -= 4;
  for (const g of gaps) {
    xCursor -= g;
    B.floorText([`${g} m`], { x: xCursor + g / 2, z: 9, w: 3, h: 1.5 });
    B.block({ x: xCursor - 2, z: 9, w: 4, d: 3, h: 1, mat: g >= 6 ? M.orange : M.blue });
    xCursor -= 4;
  }
  B.floorText(['Saltos de longitud', 'Naranja = solo con sprint'], { x: -30, z: 13.5, w: 7, h: 3 });

  // Muros de colisión con esquinas interiores
  B.block({ x: -62, z: 24, w: 0.6, d: 10, h: 3, mat: M.dark });
  B.block({ x: -58, z: 19.3, w: 8, d: 0.6, h: 3, mat: M.dark });
  B.block({ x: -58, z: 28.7, w: 8, d: 0.6, h: 3, mat: M.dark });
  B.block({ x: -50, z: 24, w: 0.6, d: 4, h: 3, mat: M.dark });
  B.floorText(['Colisiones', 'Esquinas y pasillo'], { x: -57, z: 24, w: 5, h: 2.5 });
}

/** ZONA B — Recorridos: muros, cornisas, fachada, plataformas separadas, torre. */
function buildZoneB(B, M) {
  B.sign(['ZONA B — RECORRIDOS', 'Saltos encadenados y alturas'], { x: 40, y: 3.5, z: 4, w: 7, h: 2.4, facing: 0 });
  B.block({ x: 40, z: 3.95, w: 0.2, d: 0.2, h: 2.3, mat: M.metal, collide: false });

  // Ruta ascendente por saltos (cada plataforma 1.2 m más alta)
  const route = [
    [22, -4], [25.5, -8], [29, -12], [32.5, -16], [36, -20], [40, -23.5], [44, -26.5],
  ];
  route.forEach(([x, z], i) => {
    B.block({ x, z, w: 2.4, d: 2.4, h: 1.2 * (i + 1), mat: i % 2 ? M.blue : M.white });
  });
  B.floorText(['Ruta ascendente', 'Salto + sprint'], { x: 22, z: 0.5, w: 5, h: 2.5 });

  // Plataformas separadas a 8.4 m con huecos crecientes
  const topY = 1.2 * route.length;
  const plats = [[49.5, -26.5, 4], [56, -26.5, 4], [63.5, -26.5, 4]];
  plats.forEach(([x, z, s]) => B.block({ x, z, w: s, d: s, h: topY, mat: M.block }));

  // Torre de acceso con escalera en zigzag para volver a subir
  B.block({ x: 66, z: -16, w: 6, d: 6, h: topY, mat: M.dark });
  B.block({ x: 66, z: -21.75, w: 2.2, d: 5.5, h: topY, mat: M.dark }); // pasarela hacia las plataformas
  B.stairTower({ x: 63, z: -13, axis: 'x', dir: 1, side: 1, height: topY, width: 1.6, mat: M.white, landingMat: M.metal });
  B.floorText(['Torre de acceso'], { x: 66, z: -4, w: 5, h: 2.5 });

  // Muros para escalada futura
  [3, 5, 8].forEach((h, i) => {
    B.block({ x: 26 + i * 6, z: 12, w: 4, d: 0.8, h, mat: i === 2 ? M.orange : M.dark });
  });
  B.floorText(['Muros 3 · 5 · 8 m', 'Escalada en Etapa 5'], { x: 32, z: 16, w: 6, h: 3 });

  // Fachada con cornisas (para el agarre de cornisas de la Etapa 5)
  B.block({ x: 54, z: 12, w: 10, d: 1, h: 12, mat: M.dark });
  for (let i = 1; i <= 4; i++) {
    B.block({ x: 54, z: 11.3, w: 10, d: 0.4, y: i * 2.6, h: 0.25, mat: M.stripe });
  }
  B.floorText(['Fachada con cornisas', 'Agarre en Etapa 5'], { x: 54, z: 16, w: 6, h: 3 });
}

/** ZONA C — Poderes: dianas, maniquíes con salud, objetos físicos y prueba de alcance. */
function buildZoneC(B, M, ctx) {
  B.block({ x: -57, z: -65, w: 50, d: 38, h: 0.06, mat: M.pad, cast: false });
  B.sign(['ZONA C — PODERES', 'Clic izq. proyectil · Q dash · R (mantener) descarga · G onda · Clic der. apuntar'], {
    x: -57, y: 3.4, z: -46.2, w: 11, h: 2.4, facing: 0, opts: { width: 1100, height: 240 },
  });
  B.block({ x: -57, z: -46.3, w: 0.2, d: 0.2, h: 2.2, mat: M.metal, collide: false });

  // Dianas a distintas alturas
  [[-76, 1.4], [-70, 2.6], [-64, 1.8], [-58, 3.2], [-52, 1.4]].forEach(([x, y]) => {
    ctx.addEntity(new TrainingTarget(ctx, { x, y, z: -60, facing: 'z+' }));
  });
  B.floorText(['Dianas', 'Precisión a varias alturas'], { x: -64, z: -55, w: 6, h: 3 });

  // Maniquíes con salud (se recuperan a los 4 s)
  [-46, -41, -36].forEach((x) => ctx.addEntity(new TrainingDummy(ctx, { x, z: -58 })));
  B.floorText(['Maniquíes', '100 de salud'], { x: -41, z: -54, w: 6, h: 3 });

  // Objetos físicos que reaccionan a impactos y ondas
  const crate = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
  const barrel = new THREE.MeshStandardMaterial({ color: 0x2d5f93, roughness: 0.6, metalness: 0.3 });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.addEntity(new PhysicsProp(ctx, { x: -68 + i * 1.05, y: 0.06 + j * 1.0, z: -70, w: 1, h: 1, d: 1, mass: 1, mat: crate }));
    }
  }
  ctx.addEntity(new PhysicsProp(ctx, { x: -67, y: 2.06, z: -70, w: 1, h: 1, d: 1, mass: 1, mat: crate }));
  [[-58, -70], [-56.8, -70.6], [-57.4, -69.2], [-55.6, -69.6]].forEach(([x, z]) => {
    ctx.addEntity(new PhysicsProp(ctx, { x, y: 0.06, z, w: 0.7, h: 1.1, d: 0.7, mass: 0.8, mat: barrel }));
  });
  B.floorText(['Objetos físicos', 'Prueba la onda (G) aquí'], { x: -62, z: -66, w: 6, h: 3 });

  // Prueba de alcance: el proyectil llega a 45 m
  B.block({ x: -80, z: -79, w: 2, d: 2, h: 0.1, mat: M.stripe });
  B.floorText(['Disparo', 'mirando al este'], { x: -80, z: -76, w: 4, h: 2 });
  // Desplazadas lateralmente para que ninguna tape a otra desde el punto de disparo.
  [[10, 3], [20, -3], [30, -2], [40, 1], [50, 3.5]].forEach(([dist, dz]) => {
    const x = -80 + dist;
    ctx.addEntity(new TrainingTarget(ctx, { x, y: 1.6, z: -79 + dz, facing: 'x-', radius: 0.7 }));
    B.floorText([`${dist} m`, dist > 45 ? 'Fuera de alcance' : ''], { x, z: -79 + dz + (dz > 0 ? 2 : -2), w: 4, h: 2 });
  });
}

/** ZONA F — Efectos visuales: nave oscura para revisar marcas, estelas y partículas. */
function buildZoneF(B, M, ctx) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.95 });
  const x0 = 45;
  const z0 = -60;
  B.block({ x: x0, z: z0, w: 26, d: 30, h: 0.06, mat: dark, cast: false });
  B.block({ x: x0 - 13.25, z: z0, w: 0.5, d: 30, h: 6, mat: dark });
  B.block({ x: x0 + 13.25, z: z0, w: 0.5, d: 30, h: 6, mat: dark });
  B.block({ x: x0, z: z0 - 15.25, w: 27, d: 0.5, h: 6, mat: dark });
  B.block({ x: x0 - 8, z: z0 + 15.25, w: 10, d: 0.5, h: 6, mat: dark });
  B.block({ x: x0 + 8, z: z0 + 15.25, w: 10, d: 0.5, h: 6, mat: dark });
  B.block({ x: x0, z: z0 + 15.25, w: 6, d: 0.5, y: 4, h: 2, mat: dark });
  B.block({ x: x0, z: z0, w: 27, d: 31, y: 6, h: 0.4, mat: dark });
  B.sign(['ZONA F — EFECTOS VISUALES', 'Usa los poderes con poca luz · F2: marcas al máximo'], {
    x: x0, y: 3.4, z: z0 - 14.9, w: 10, h: 2.2, facing: 0, opts: { width: 1024, height: 230 },
  });
  B.sign(['ZONA F — EFECTOS VISUALES'], { x: x0, y: 4.9, z: z0 + 15.55, w: 6, h: 1.2, facing: 0, opts: { width: 1024, height: 200 } });
  ctx.addEntity(new TrainingDummy(ctx, { x: x0 - 5, z: z0 - 8 }));
  ctx.addEntity(new TrainingDummy(ctx, { x: x0 + 5, z: z0 - 8 }));
  ctx.addEntity(new TrainingTarget(ctx, { x: x0, y: 2.2, z: z0 - 14.9, facing: 'z+', radius: 0.8, post: false }));
}

/**
 * ZONA D — Combate: recinto cerrado con coberturas, un Agente PDC y un
 * Acólito de Energía, y una consola para reiniciar el encuentro (E).
 * Los muros (2.6 m) impiden que los enemigos vean la Zona C.
 */
function buildZoneD(B, M, ctx) {
  const wall = new THREE.MeshStandardMaterial({ map: M.dark.map, color: 0x9aa3ad, roughness: 0.9 });
  const cover = new THREE.MeshStandardMaterial({ color: 0x5b6675, roughness: 0.8 });
  const x0 = -15;
  const z0 = -60;
  const H = 2.6;
  B.block({ x: x0, z: z0, w: 26, d: 30, h: 0.06, mat: M.pad, cast: false });
  B.block({ x: x0 - 13.25, z: z0, w: 0.5, d: 31, h: H, mat: wall });
  B.block({ x: x0 + 13.25, z: z0, w: 0.5, d: 31, h: H, mat: wall });
  B.block({ x: x0, z: z0 - 15.25, w: 27, d: 0.5, h: H, mat: wall });
  // Muro sur con entrada de 6 m
  B.block({ x: x0 - 8, z: z0 + 15.25, w: 10.5, d: 0.5, h: H, mat: wall });
  B.block({ x: x0 + 8, z: z0 + 15.25, w: 10.5, d: 0.5, h: H, mat: wall });
  B.sign(['ZONA D — COMBATE', 'Agente PDC y Acólito de Energía · E en la consola: reiniciar'], {
    x: x0, y: 3.6, z: z0 + 15.55, w: 9, h: 1.9, facing: 0, opts: { width: 1024, height: 220 },
  });

  // Coberturas: barreras bajas (se puede saltar por encima) y pilares
  for (const [x, z, w, d, h] of [
    [x0 - 7, z0 + 5, 2.4, 0.8, 1.2], [x0 + 7, z0 + 5, 2.4, 0.8, 1.2], [x0, z0 - 2, 4, 0.8, 1.2],
    [x0 - 8, z0 - 7, 0.8, 3, 1.2], [x0 + 8, z0 - 7, 0.8, 3, 1.2],
    [x0 - 4, z0, 1, 1, 3], [x0 + 4, z0, 1, 1, 3], [x0 - 10, z0 + 10, 1.4, 1.4, 1.4], [x0 + 10, z0 + 10, 1.4, 1.4, 1.4],
  ]) {
    B.block({ x, z, w, d, h, mat: cover });
  }

  // Consola de reinicio junto a la entrada
  B.block({ x: x0 + 2.6, z: z0 + 13.6, w: 1.2, d: 0.6, h: 1.0, mat: M.metal });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f2c45a').multiplyScalar(1.4), toneMapped: false }));
  screen.position.set(x0 + 2.6, 1.15, z0 + 13.28);
  screen.rotation.y = Math.PI;
  ctx.group.add(screen);

  const spawnEncounter = () => {
    ctx.enemies.clear('zonaD');
    // Empiezan mirando hacia el fondo del recinto (puesto de guardia), no hacia la entrada.
    ctx.enemies.spawn('pdc', { x: x0 - 6, y: 0.1, z: z0 - 10, yaw: Math.PI, tag: 'zonaD', patrol: [{ x: x0 - 10, z: z0 - 11 }, { x: x0 + 2, z: z0 - 11 }] });
    ctx.enemies.spawn('acolyte', { x: x0 + 6, y: 0.1, z: z0 - 4, yaw: Math.PI, tag: 'zonaD', patrol: [{ x: x0 + 9, z: z0 - 4 }, { x: x0 + 9, z: z0 - 12 }] });
  };
  spawnEncounter();
  ctx.interactions.add({
    position: { x: x0 + 2.6, y: 0.5, z: z0 + 12.6 }, radius: 2.2, label: 'Reiniciar encuentro',
    onInteract: () => {
      spawnEncounter();
      ctx.events.emit('encounter:reset', { zone: 'D' });
    },
  });
}

/** Zona E: delimitada y señalizada para la Etapa 4. */
function buildFutureZones(B, M) {
  const zones = [
    { id: 'E', name: 'ADQUISICIÓN DE MARCAS', stage: 'Etapa 4', x: 15 },
  ];
  for (const z of zones) {
    B.block({ x: z.x, z: -60, w: 26, d: 30, h: 0.06, mat: M.pad, cast: false });
    B.floorText([`ZONA ${z.id} — ${z.name}`, `Contenido previsto para la ${z.stage}`], { x: z.x, z: -52, y: 0.08, w: 20, h: 6, opts: { width: 1024, height: 300 } });
  }
}
