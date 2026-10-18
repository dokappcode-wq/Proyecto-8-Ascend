import * as THREE from 'three';
import { createSky, createSun } from '../environment.js';
import { gridTexture, concreteTexture } from '../textures.js';

/**
 * MAPA 1 — CAMPO DE PRUEBAS
 *
 * Entorno técnico y modular para verificar mecánicas.
 * Etapa 1: Zona A (movimiento) y Zona B (recorridos y alturas) jugables.
 * Las zonas C–F están delimitadas y señalizadas, pero su contenido
 * (dianas, enemigos, estación de adquisición, banco de efectos) llega en
 * etapas posteriores; los carteles lo indican.
 */

const HALF = 85; // medio lado del recinto

export default {
  id: 'campo',
  name: 'Campo de Pruebas',
  description: 'Zona de entrenamiento y experimentación.',

  build({ group, builder: B, scene }) {
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
    B.sign(['CAMPO DE PRUEBAS', 'Oeste: Zona A — Movimiento · Este: Zona B — Recorridos', 'Norte: Zonas C–F (próximas etapas)'], { x: 0, y: 3.2, z: 10, w: 9, h: 2.6, facing: 0, opts: { width: 1024, height: 300 } });
    B.block({ x: 0, z: 10.05, w: 9.4, d: 0.1, y: 0, h: 1.9, mat: M.metal, collide: false });

    buildZoneA(B, M);
    buildZoneB(B, M);
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

/** Zonas C–F: delimitadas y señalizadas para las etapas siguientes. */
function buildFutureZones(B, M) {
  const zones = [
    { id: 'C', name: 'PODERES', stage: 'Etapa 2', x: -45 },
    { id: 'D', name: 'COMBATE', stage: 'Etapa 3', x: -15 },
    { id: 'E', name: 'ADQUISICIÓN DE MARCAS', stage: 'Etapa 4', x: 15 },
    { id: 'F', name: 'EFECTOS VISUALES', stage: 'Etapa 2', x: 45 },
  ];
  for (const z of zones) {
    B.block({ x: z.x, z: -60, w: 26, d: 30, h: 0.06, mat: M.pad, cast: false });
    B.floorText([`ZONA ${z.id} — ${z.name}`, `Contenido previsto para la ${z.stage}`], { x: z.x, z: -52, y: 0.08, w: 20, h: 6, opts: { width: 1024, height: 300 } });
  }
}
