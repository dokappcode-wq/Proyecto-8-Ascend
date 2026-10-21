import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';

const DT = 1 / 60;
const idle = { moveX: 0, moveZ: 0, sprint: false, jump: false, dodge: false };

/** Rejilla de alturas a partir de una función (celdas de `cell` m). */
function field(w, { minX, minZ, maxX, maxZ, cell }, fn) {
  const cols = Math.round((maxX - minX) / cell) + 1;
  const rows = Math.round((maxZ - minZ) / cell) + 1;
  const heights = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) heights[j * cols + i] = fn(minX + i * cell, minZ + j * cell);
  return w.addHeightfield({ minX, minZ, cell, cols, rows, heights });
}

function run(motor, seconds, input = idle) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) motor.update(DT, input);
}

test('terreno: la altura interpola los dos triángulos de cada celda', () => {
  const w = new CollisionWorld();
  const hf = field(w, { minX: 0, minZ: 0, maxX: 2, maxZ: 2, cell: 2 }, (x, z) => (x === 2 && z === 2 ? 4 : 0));
  assert.equal(w.heightfieldAt(hf, 0, 0), 0);
  assert.equal(w.heightfieldAt(hf, 2, 2), 4);
  assert.equal(w.heightfieldAt(hf, 1, 1), 2); // diagonal
  assert.equal(w.heightfieldAt(hf, 2, 0), 0);
  assert.equal(w.heightfieldAt(hf, 3, 1), -Infinity); // fuera
  assert.equal(w.groundHeight(1, 1, 0.3, 10), 2);
  assert.equal(w.groundHeight(1, 1, 0.3, 1), -Infinity); // por encima de maxY no cuenta
});

test('terreno: se sube una cuesta andando y no se atraviesa', () => {
  const w = new CollisionWorld();
  // Cuesta de 25° hacia +X entre x 0 y 20
  field(w, { minX: -10, minZ: -10, maxX: 30, maxZ: 10, cell: 2 }, (x) => Math.max(0, Math.min(20, x)) * Math.tan(25 * Math.PI / 180));
  const m = new CharacterMotor(w);
  m.teleport({ x: -4, y: 2, z: 0 });
  run(m, 0.5);
  assert.ok(m.grounded);
  run(m, 6, { ...idle, moveX: 1 });
  const top = 20 * Math.tan(25 * Math.PI / 180);
  assert.ok(m.position.x > 20, `llega arriba (x ${m.position.x.toFixed(2)})`);
  assert.ok(Math.abs(m.position.y - top) < 0.05);
  assert.ok(m.grounded);
});

test('terreno: una pared empinada frena como un muro', () => {
  const w = new CollisionWorld();
  // Escalón de 6 m entre x 4 y 5 (≈ 80°)
  field(w, { minX: -10, minZ: -10, maxX: 20, maxZ: 10, cell: 1 }, (x) => (x >= 5 ? 6 : 0));
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0.5, z: 0 });
  run(m, 0.3);
  run(m, 2, { ...idle, moveX: 1, sprint: true });
  assert.ok(m.position.x < 4.9, `se queda al pie (x ${m.position.x.toFixed(2)})`);
  assert.ok(m.position.y < 0.5);
});

test('terreno: el rayo de la cámara choca con la ladera', () => {
  const w = new CollisionWorld();
  field(w, { minX: -20, minZ: -20, maxX: 20, maxZ: 20, cell: 2 }, (x) => (x > 5 ? (x - 5) * 2 : 0));
  const hit = w.raycastHit({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 20);
  assert.ok(hit, 'hay impacto');
  assert.ok(Math.abs(hit.t - 6) < 0.05, `a 6 m (${hit.t.toFixed(3)})`);
  assert.ok(hit.normal.x < 0 && hit.normal.y > 0);
  assert.equal(w.raycast({ x: 0, y: 2, z: 0 }, { x: -1, y: 0, z: 0 }, 20), Infinity);
});

test('terreno: dentro de una cueva bajo la ladera no empuja', () => {
  const w = new CollisionWorld();
  // Meseta a 10 m sobre un hueco con suelo de caja a 2 m
  field(w, { minX: -10, minZ: -10, maxX: 10, maxZ: 10, cell: 2 }, () => 10);
  w.addBox({ x: -5, y: 0, z: -5 }, { x: 5, y: 2, z: 5 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 2.2, z: 0 });
  run(m, 0.3);
  run(m, 0.5, { ...idle, moveX: 1 });
  assert.ok(m.grounded);
  assert.ok(Math.abs(m.position.y - 2) < 1e-6);
  assert.ok(m.position.x > 1.5 && Number.isFinite(m.position.z));
});
