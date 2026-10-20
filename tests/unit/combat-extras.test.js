import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBOS, detectCombo, chainTargets } from '../../src/powers/combos.js';
import { ENEMY_TYPES, enemyDamage } from '../../src/ai/enemyTypes.js';
import { wheelPick, clampWheel } from '../../src/ui/markWheel.js';
import { plumageAbsorb } from '../../src/systems/WingsPowerSystem.js';
import { WINGS_CONFIG } from '../../src/powers/wings/wingsConfig.js';
import { MARKS } from '../../src/data/marks.js';

test('Combos: cada combinación de marca y estado da su combo', () => {
  assert.equal(detectCombo('fuego', { floating: true }), 'combustion');
  assert.equal(detectCombo('estela', { floating: true }), 'combustion');
  assert.equal(detectCombo('tormenta', { bound: true }), 'cadena');
  assert.equal(detectCombo('bolt', { bound: true }), 'cadena');
  assert.equal(detectCombo('lluvia', { burning: true }), 'plumas');
  assert.equal(detectCombo('hielo', { floating: true }), 'escarcha');
  assert.equal(detectCombo('hielo', { bound: true }), 'escarcha');
});

test('Combos: sin el estado previo, o con daño de combo, no hay combo', () => {
  assert.equal(detectCombo('fuego', {}), null);
  assert.equal(detectCombo('lluvia', { floating: true }), null);
  assert.equal(detectCombo('tormenta', { burning: true }), null);
  assert.equal(detectCombo('combo-combustion', { floating: true, bound: true, burning: true }), null);
  assert.equal(detectCombo(undefined, { floating: true }), null);
  for (const c of Object.values(COMBOS)) assert.ok(c.marks.every((m) => MARKS[m]), `marcas válidas en ${c.id}`);
});

test('Combos: la descarga en cadena salta a los más cercanos dentro del alcance', () => {
  const o = { x: 0, y: 1, z: 0 };
  const cands = [{ x: 3, y: 1, z: 0 }, { x: 20, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 5 }, { x: 6, y: 1, z: 0 }];
  const r = chainTargets(o, cands, 9, 3);
  assert.deepEqual(r.map((c) => c.x + c.z), [1, 3, 5]);
  assert.equal(chainTargets(o, cands, 0.5, 3).length, 0);
});

const BL = ENEMY_TYPES.blindado;
const self = { x: 0, z: 0 };

test('Blindado: por delante solo recibe el 10 %; por detrás, todo', () => {
  // Mira hacia +z (facing 0)
  const front = enemyDamage(BL, 40, { kind: 'bolt', facing: 0, self, from: { x: 0, z: 10 } });
  assert.deepEqual(front, { amount: 4, blocked: true });
  const back = enemyDamage(BL, 40, { kind: 'bolt', facing: 0, self, from: { x: 0, z: -10 } });
  assert.deepEqual(back, { amount: 40, blocked: false });
  const side = enemyDamage(BL, 40, { kind: 'bolt', facing: 0, self, from: { x: 10, z: 0.5 } });
  assert.equal(side.blocked, false, 'de lado ya no cubre (arco de 75°)');
  assert.equal(enemyDamage(BL, 3, { kind: 'bolt', facing: 0, self, from: { x: 0, z: 5 } }).amount, 1, 'siempre al menos 1');
});

test('Blindado: sin apoyo o con ataques desde arriba, el escudo no sirve', () => {
  const from = { x: 0, z: 10 };
  assert.equal(enemyDamage(BL, 40, { kind: 'bolt', facing: 0, self, from, vulnerable: true }).amount, 40);
  for (const kind of ['tormenta', 'lluvia', 'estela', 'burn', 'combo-combustion']) {
    assert.equal(enemyDamage(BL, 20, { kind, facing: 0, self, from }).amount, 20, kind);
  }
});

test('Dron: los golpes cuerpo a cuerpo le hacen un 25 %; los disparos, todo', () => {
  const D = ENEMY_TYPES.dron;
  assert.equal(enemyDamage(D, 40, { kind: 'melee-energia' }).amount, 10);
  assert.equal(enemyDamage(D, 40, { kind: 'melee' }).amount, 10);
  assert.equal(enemyDamage(D, 40, { kind: 'pluma' }).amount, 40);
  assert.ok(D.flying.hover > 3);
  assert.ok(ENEMY_TYPES.francotirador.stationary && ENEMY_TYPES.francotirador.weapon.aimTime > 1);
  assert.equal(ENEMY_TYPES.blindado.weapon.pellets, 5);
});

test('Rueda de marcas: el ratón elige el sector (arriba el primero, sentido horario)', () => {
  assert.equal(wheelPick(0, -100, 5), 0); // arriba
  assert.equal(wheelPick(100, -30, 5), 1); // derecha, algo arriba
  assert.equal(wheelPick(60, 90, 5), 2); // abajo a la derecha
  assert.equal(wheelPick(-60, 90, 5), 3);
  assert.equal(wheelPick(-100, -30, 5), 4);
  assert.equal(wheelPick(5, 5, 5), -1, 'radio muerto');
  assert.equal(wheelPick(0, 100, 2), 1);
  const v = clampWheel({ x: 300, y: 400 });
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 140) < 1e-9);
});

test('Alas · Plumaje: las plumas absorben el 20 % del daño mientras queden', () => {
  const P = WINGS_CONFIG.passive;
  assert.deepEqual(plumageAbsorb(50, 100, P), { taken: 40, feathers: 10 });
  const few = plumageAbsorb(50, 3, P);
  assert.equal(few.feathers, 3);
  assert.equal(few.taken, 47);
  assert.deepEqual(plumageAbsorb(50, 0, P), { taken: 50, feathers: 0 });
  assert.ok(MARKS.alas.passive);
});
