import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { findSwingAnchor, anchorVisible, SWING_ANCHOR_CONFIG } from '../../src/physics/swingAnchors.js';
import { THREAD_CONFIG } from '../../src/powers/thread/threadConfig.js';

const DT = 1 / 60;
const R = CharacterMotor.ROPE_POINT;
const FWD = { x: 0, y: 0, z: 1 };

function city(boxes = []) {
  const w = new CollisionWorld();
  w.addBox({ x: -200, y: -1, z: -200 }, { x: 200, y: 0, z: 200 });
  for (const [min, max, o] of boxes) w.addBox(min, max, o ?? {});
  return w;
}
const origin = { x: 0, y: 1.5 + R, z: 0 };
const pick = (w, extra = {}) => findSwingAnchor(w, origin, { feetY: 0, view: FWD, move: null, prev: null, ...extra });

test('Enganche: elige un edificio alto delante y no uno que quede debajo', () => {
  // Edificio alto delante (z 12..18) y una cornisa baja a ras de suelo
  const w = city([
    [{ x: -6, y: 0, z: 12 }, { x: 6, y: 22, z: 18 }],
    [{ x: -6, y: 0, z: 3 }, { x: 6, y: 1, z: 4 }],
  ]);
  const a = pick(w);
  assert.ok(a, 'hay un punto');
  assert.ok(a.y - 0 >= SWING_ANCHOR_CONFIG.minHeight, 'a altura suficiente');
  assert.ok(a.z > 11, `el enganche está en el edificio (${a.z.toFixed(1)})`);
});

test('Enganche: no se engancha a superficies debajo del jugador ni a ras de suelo', () => {
  // Solo hay un bloque bajo: nada válido
  const w = city([[{ x: -3, y: 0, z: 6 }, { x: 3, y: 2, z: 9 }]]);
  assert.equal(pick(w), null);
});

test('Enganche: un punto detrás de una pared no es válido (la línea de visión lo tapa)', () => {
  const w = city([
    [{ x: -8, y: 0, z: 8 }, { x: 8, y: 30, z: 9 }], // muro que tapa
    [{ x: -4, y: 0, z: 20 }, { x: 4, y: 20, z: 24 }], // edificio detrás
  ]);
  const a = pick(w, { cfg: { ...SWING_ANCHOR_CONFIG, elevations: [40], yawOffsets: [0] } });
  // Con un único rayo hacia el muro, el punto es el muro (no el edificio de detrás)
  assert.ok(!a || a.z < 10, 'no engancha detrás del muro');
});

test('Enganche: los límites y las barreras no cuentan como anclaje', () => {
  const w = city([[{ x: -6, y: 0, z: 12 }, { x: 6, y: 40, z: 18 }, { tag: 'barrier', climbable: false }]]);
  assert.equal(pick(w), null);
});

test('Enganche: mantener el punto en uso evita cambiar de objetivo por nada', () => {
  const w = city([
    [{ x: -6, y: 0, z: 12 }, { x: 6, y: 22, z: 18 }],
    [{ x: -6, y: 0, z: 14 }, { x: 6, y: 23, z: 19 }],
  ]);
  const first = pick(w);
  const again = pick(w, { prev: first });
  assert.ok(Math.hypot(again.x - first.x, again.y - first.y, again.z - first.z) < 1e-6, 'se queda con el mismo');
  assert.ok(anchorVisible(w, origin, first));
});

test('Motor: cambiar de anclaje conserva la velocidad y no teletransporta', () => {
  const m = new CharacterMotor(city());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  for (let i = 0; i < 40; i++) m.update(DT, {});
  const p0 = { ...m.position };
  const v0 = { ...m.velocity };
  assert.ok(m.retarget({ x: 6, y: 16, z: 6 }));
  assert.deepEqual({ x: m.position.x, y: m.position.y, z: m.position.z }, p0, 'no se mueve');
  assert.ok(Math.hypot(m.velocity.x - v0.x, m.velocity.y - v0.y, m.velocity.z - v0.z) < 1e-9, 'misma velocidad');
  const d = Math.hypot(6 - p0.x, 16 - (p0.y + R), 6 - p0.z);
  assert.ok(Math.abs(m.swingAnchor.len - d) < 1e-9, 'la cuerda mide la distancia actual');
});

test('Motor: el aire frena poco a poco (sin energía infinita)', () => {
  const m = new CharacterMotor(city());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, { ...THREAD_CONFIG.swing, drag: 0.3 });
  for (let i = 0; i < 40; i++) m.update(DT, {});
  const e0 = Math.hypot(m.velocity.x, m.velocity.y, m.velocity.z);
  for (let i = 0; i < 240; i++) m.update(DT, {});
  const e1 = Math.hypot(m.velocity.x, m.velocity.y, m.velocity.z);
  assert.ok(e1 < e0 * 1.1, `sin empuje no se gana energía (${e0.toFixed(1)} → ${e1.toFixed(1)})`);
});

test('Motor: soltar en el punto alto de un arco bien llevado da la calidad perfecta', () => {
  const m = new CharacterMotor(city());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  let perfect = 0;
  for (let i = 0; i < 600; i++) {
    m.update(DT, { moveX: 0, moveZ: 0 });
    perfect = Math.max(perfect, m.releaseQuality());
  }
  assert.equal(perfect, 1, 'en algún momento del arco la soltada es perfecta');
  assert.equal(new CharacterMotor(city()).releaseQuality(), 0, 'sin balanceo no');
});

test('Motor: la fase del balanceo distingue subida y bajada', () => {
  const m = new CharacterMotor(city());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  const phases = new Set();
  for (let i = 0; i < 300; i++) {
    m.update(DT, {});
    if (m.swingPhase) phases.add(m.swingPhase);
  }
  assert.ok(phases.has('rise') && phases.has('fall'));
});
