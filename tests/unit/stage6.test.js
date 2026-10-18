import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reputation, FACTIONS } from '../../src/factions/Reputation.js';
import { Mission } from '../../src/missions/Mission.js';
import { MISSIONS } from '../../src/data/missions.js';

test('reputación: la PDC empieza tranquila y atacarla la vuelve hostil', () => {
  const r = new Reputation();
  assert.equal(r.level('pdc').id, 'calm');
  const ch = r.report('pdc:attacked');
  assert.equal(r.isHostile('pdc'), true);
  assert.deepEqual(ch.map((c) => [c.faction, c.from, c.to]), [['pdc', 'calm', 'hostile']]);
});

test('reputación: usar poderes a la vista la pone vigilante y, si se repite, hostil', () => {
  const r = new Reputation();
  r.report('pdc:power-seen');
  assert.equal(r.level('pdc').id, 'calm');
  r.report('pdc:power-seen');
  assert.equal(r.level('pdc').id, 'watchful');
  r.report('pdc:power-seen');
  assert.equal(r.isHostile('pdc'), true);
});

test('reputación: la hostilidad baja si la PDC deja de verle, pero no mientras le ve', () => {
  const r = new Reputation();
  r.report('pdc:killed');
  for (let i = 0; i < 60 * 20; i++) r.update(1 / 60, { pdc: true });
  assert.equal(r.hostility.pdc, 100);
  let calmAt = null;
  for (let i = 0; i < 60 * 60; i++) {
    const ch = r.update(1 / 60, {});
    if (ch.some((c) => c.to === 'calm')) calmAt = i / 60;
  }
  assert.ok(calmAt !== null && calmAt > 12, `vuelve a la calma a los ${calmAt?.toFixed(1)} s`);
});

test('reputación: con hostilidad base (simulacro) nunca baja de ella', () => {
  const r = new Reputation({ pdc: 100 });
  assert.equal(r.isHostile('pdc'), true);
  for (let i = 0; i < 600; i++) r.update(0.1, {});
  assert.equal(r.hostility.pdc, 100);
});

test('reputación: las demás facciones existen pero aún no reaccionan', () => {
  assert.deepEqual(Object.keys(FACTIONS).sort(), ['acolitos', 'ciudadanos', 'encarnaciones', 'pdc']);
  const r = new Reputation();
  assert.deepEqual(r.report('accion-desconocida'), []);
  assert.equal(r.hostility.ciudadanos, 0);
});

test('misión: activación, recuento de objetivos y finalización', () => {
  const m = new Mission(MISSIONS['op-distrito-cero']);
  assert.equal(m.state, 'inactive');
  assert.equal(m.onNeutralized('mision-pdc').objective, null, 'antes de activarla no cuenta');
  assert.ok(m.activate());
  assert.equal(m.activate(), false);
  m.update(2);
  assert.ok(m.markDetected());
  assert.equal(m.markDetected(), false);
  m.onNeutralized('mision-pdc');
  m.onNeutralized('otro');
  m.onNeutralized('mision-pdc');
  assert.deepEqual(m.pendingTags, ['mision-pdc', 'mision-acolito']);
  assert.equal(m.onNeutralized('mision-acolito').completed, false);
  const last = m.onNeutralized('mision-pdc');
  assert.equal(last.completed, true);
  assert.equal(m.state, 'completed');
  assert.equal(m.time, 2);
  assert.equal(m.onNeutralized('mision-pdc').objective, null, 'terminada no cuenta más');
});

test('misión: los datos coinciden con los objetivos (3 agentes y 1 Acólito)', () => {
  const def = MISSIONS['op-distrito-cero'];
  for (const o of def.objectives) {
    assert.equal(def.spawns.filter((s) => s.tag === o.tag).length, o.count, o.id);
  }
});

test('sonido 3D: volumen por distancia y panorámica según la cámara', async () => {
  const { spatialize, SPATIAL } = await import('../../src/audio/spatial.js');
  const L = { x: 0, y: 0, z: 0, yaw: 0 }; // mirando hacia -Z: la derecha es +X
  assert.equal(spatialize(L, { x: 0, y: 0, z: -2 }).gain, 1);
  const near = spatialize(L, { x: 0, y: 0, z: -10 }).gain;
  const far = spatialize(L, { x: 0, y: 0, z: -40 }).gain;
  assert.ok(near > far && far > 0);
  assert.equal(spatialize(L, { x: 0, y: 0, z: -SPATIAL.maxDistance - 1 }).gain, 0);
  assert.ok(spatialize(L, { x: 10, y: 0, z: 0 }).pan > 0.8, 'a la derecha');
  assert.ok(spatialize(L, { x: -10, y: 0, z: 0 }).pan < -0.8, 'a la izquierda');
  // Girando la cámara 180°, el lado se invierte
  assert.ok(spatialize({ ...L, yaw: Math.PI }, { x: 10, y: 0, z: 0 }).pan < -0.8);
});
