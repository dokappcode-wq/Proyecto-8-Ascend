import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAcquisition } from '../../src/powers/acquisition.js';
import { Progression } from '../../src/powers/Progression.js';
import { SaveSystem, SAVE_KEY } from '../../src/core/SaveSystem.js';

const incarnation = { kind: 'incarnation', markId: 'energia' };
const acolyte = { kind: 'acolyte', markId: 'energia' };

test('Regla II: solo una Encarnación original es fuente válida', () => {
  assert.deepEqual(evaluateAcquisition(acolyte, ['destino'], { contact: true, will: 1 }), { ok: false, reason: 'not-original' });
  assert.equal(evaluateAcquisition(incarnation, ['destino'], { contact: true, will: 1 }).ok, true);
});

test('Regla II: sin contacto físico no hay copia', () => {
  assert.equal(evaluateAcquisition(incarnation, ['destino'], { contact: false, will: 1 }).reason, 'no-contact');
});

test('Regla III: el contacto sin voluntad no basta', () => {
  assert.equal(evaluateAcquisition(incarnation, ['destino'], { contact: true, will: 0.6 }).reason, 'no-will');
});

test('No se copia una marca que ya se posee', () => {
  assert.equal(evaluateAcquisition(incarnation, ['destino', 'energia'], { contact: true, will: 1 }).reason, 'already-owned');
});

test('Progresión: niveles, puntos y requisitos de mejoras', () => {
  const profile = { marks: ['destino', 'energia'], skillProgress: {} };
  const p = new Progression(profile);
  assert.ok(p.isUnlocked('energia', 'proyectil'), 'las capacidades fundamentales vienen con la marca');
  assert.equal(p.canUnlock('energia', 'cargador').reason, 'points');
  assert.equal(p.addXp('energia', 250), 2);
  assert.equal(p.state('energia').level, 3);
  assert.equal(p.state('energia').points, 2);
  assert.equal(p.state('energia').xp, 50);
  assert.equal(p.canUnlock('energia', 'recarga').reason, 'requires');
  assert.ok(p.unlock('energia', 'cargador').ok);
  assert.ok(p.unlock('energia', 'recarga').ok);
  assert.equal(p.state('energia').points, 0);
  assert.equal(p.canUnlock('energia', 'sobrecarga').reason, 'future');
  const m = p.modifiers('energia');
  assert.equal(m.magazineBonus, 5);
  assert.ok(Math.abs(m.reloadMul - 0.65) < 1e-9);
  assert.equal(m.drainMul, 1);
});

test('Persistencia: marcas y progreso sobreviven a guardar y cargar', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const a = new SaveSystem(storage);
  a.data.profile.marks.push('energia');
  new Progression(a.data.profile).addXp('energia', 120);
  a.save();
  const b = new SaveSystem(storage);
  assert.deepEqual(b.data.profile.marks, ['destino', 'energia']);
  assert.equal(b.data.profile.skillProgress.energia.level, 2);
  assert.ok(data.has(SAVE_KEY));
});

test('Migración: los guardados anteriores dejan de tener la Energía concedida por depuración', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  data.set(SAVE_KEY, JSON.stringify({ version: 1, settings: { fov: 80 }, debug: { grantEnergy: true } }));
  const s = new SaveSystem(storage);
  assert.equal(s.data.debug.grantEnergy, false);
  assert.equal(s.settings.fov, 80, 'conserva los ajustes');
});
