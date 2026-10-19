import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { WINGS_CONFIG } from '../../src/powers/wings/wingsConfig.js';
import { flightSpeed, swordStats } from '../../src/systems/WingsPowerSystem.js';
import { EnergyPool } from '../../src/powers/EnergyPool.js';
import { Progression } from '../../src/powers/Progression.js';
import { MARKS, COPY_ORDER } from '../../src/data/marks.js';
import { PROGRESSION } from '../../src/data/progression.js';

const DT = 1 / 60;
const F = WINGS_CONFIG.flight;

function flyer(y = 5) {
  const w = new CollisionWorld();
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y, z: 0 });
  return { w, m };
}

test('Alas: volando no hay gravedad y se avanza hacia donde se pide', () => {
  const { m } = flyer();
  m.fly = { speed: 18, response: F.response };
  for (let i = 0; i < 60; i++) m.update(DT, {});
  assert.ok(Math.abs(m.position.y - 5) < 0.01, `se mantiene en el aire (${m.position.y.toFixed(2)})`);
  for (let i = 0; i < 120; i++) m.update(DT, { moveX: 0, moveZ: -1 });
  assert.ok(m.position.z < -20, `avanza (${m.position.z.toFixed(1)})`);
  assert.ok(Math.abs(m.horizontalSpeed - 18) < 1, `a la velocidad de vuelo (${m.horizontalSpeed.toFixed(1)} m/s)`);
  const y0 = m.position.y;
  for (let i = 0; i < 60; i++) m.update(DT, { flyY: 1 });
  assert.ok(m.position.y > y0 + 8, `sube con flyY (${(m.position.y - y0).toFixed(1)} m)`);
});

test('Alas: sin vuelo vuelve a caer; volando hacia el suelo se posa sin atravesarlo', () => {
  const { m } = flyer(3);
  m.fly = { speed: 15, response: F.response };
  for (let i = 0; i < 120; i++) m.update(DT, { flyY: -1 });
  assert.ok(m.position.y >= -1e-6 && m.position.y < 0.05, `posado en el suelo (${m.position.y.toFixed(3)})`);
  m.teleport({ x: 0, y: 6, z: 0 });
  assert.equal(m.fly, null, 'teletransportar quita el estado de vuelo');
  for (let i = 0; i < 60; i++) m.update(DT, {});
  assert.ok(m.position.y < 1, 'sin vuelo cae');
});

test('Alas: no se atraviesan paredes volando', () => {
  const { w, m } = flyer(4);
  w.addBox({ x: -10, y: 0, z: -6 }, { x: 10, y: 20, z: -5 });
  m.fly = { speed: 20, response: F.response };
  for (let i = 0; i < 180; i++) m.update(DT, { moveZ: -1 });
  assert.ok(m.position.z > -5, `se detiene en la pared (z=${m.position.z.toFixed(2)})`);
});

test('Alas: cuantas más plumas, más rápido se vuela', () => {
  assert.equal(flightSpeed(F, 1), F.maxSpeed);
  assert.equal(flightSpeed(F, 0), F.minSpeed);
  assert.ok(flightSpeed(F, 0.5) > F.minSpeed && flightSpeed(F, 0.5) < F.maxSpeed);
  assert.equal(flightSpeed(F, 2), F.maxSpeed, 'se limita a 0..1');
});

test('Alas: la espada cuesta 20 plumas y +20 %; cada tamaño, 10 plumas y +10 % más', () => {
  const S = WINGS_CONFIG.sword;
  assert.deepEqual(swordStats(S, 0).feathers, 20);
  assert.ok(Math.abs(swordStats(S, 0).damageMul - 1.2) < 1e-9);
  assert.equal(swordStats(S, 2).feathers, 40);
  assert.ok(Math.abs(swordStats(S, 2).damageMul - 1.4) < 1e-9);
  assert.ok(swordStats(S, 3).rangeAdd > swordStats(S, 0).rangeAdd);
  assert.ok(Math.abs(swordStats(S, 0, 0.1).damageMul - 1.3) < 1e-9, 'Filo de pluma suma un 10 %');
});

test('Alas: 100 plumas que se gastan al disparar y se regeneran solas', () => {
  const pool = new EnergyPool(WINGS_CONFIG.pool);
  assert.equal(pool.max, 100);
  for (let i = 0; i < 100; i++) assert.ok(pool.spend(WINGS_CONFIG.projectile.cost));
  assert.ok(!pool.spend(1), 'sin plumas no se dispara');
  for (let i = 0; i < 60 * 10; i++) pool.update(DT);
  assert.ok(pool.value > 30, `se regeneran (${pool.value.toFixed(0)} en 10 s)`);
  assert.equal(WINGS_CONFIG.rain.cost, 50);
  assert.equal(WINGS_CONFIG.shield.cost, 10);
  assert.equal(WINGS_CONFIG.shield.hits, 1);
});

test('Alas: datos de la marca y árbol de mejoras', () => {
  assert.deepEqual(COPY_ORDER, ['energia', 'gravedad', 'hilo', 'temperatura', 'alas']);
  assert.equal(MARKS.alas.original, false);
  const p = new Progression({});
  p.state('alas').points = 5;
  assert.ok(p.unlock('alas', 'alas-fuertes').ok);
  assert.ok(p.unlock('alas', 'muda').ok);
  const m = p.modifiers('alas');
  assert.equal(m.flySpeedAdd, 5);
  assert.equal(m.featherRegenMul, 1.5);
  assert.equal(p.canUnlock('alas', 'vendaval').reason, 'future');
  assert.equal(PROGRESSION.alas.nodes.filter((n) => n.type === 'base').length, 5);
});
