import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveSystem, SAVE_KEY } from '../../src/core/SaveSystem.js';

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test('los ajustes se guardan y se recuperan', () => {
  const storage = fakeStorage();
  const a = new SaveSystem(storage);
  a.updateSettings({ fov: 85, invertY: true });
  const b = new SaveSystem(storage);
  assert.equal(b.settings.fov, 85);
  assert.equal(b.settings.invertY, true);
  assert.equal(b.settings.mouseSensitivity, 1); // valor por defecto conservado
});

test('el perfil incluye la marca innata del Destino', () => {
  const s = new SaveSystem(fakeStorage());
  assert.deepEqual(s.data.profile.marks, ['destino']);
});

test('un guardado corrupto o de otra versión vuelve a los valores por defecto', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, '{no es json');
  assert.equal(new SaveSystem(storage).settings.fov, 70);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, settings: { fov: 40 } }));
  assert.equal(new SaveSystem(storage).settings.fov, 70);
});

test('un almacenamiento que falla no rompe el juego', () => {
  const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const s = new SaveSystem(broken);
  assert.equal(s.save(), false);
  assert.equal(s.settings.fov, 70);
});
