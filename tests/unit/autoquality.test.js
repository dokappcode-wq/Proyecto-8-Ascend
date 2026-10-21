import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AutoQuality } from '../../src/core/AutoQuality.js';

/** Simula `secs` segundos a `fps` fotogramas por segundo; devuelve cuántas veces pidió cambiar. */
function run(aq, fps, secs) {
  let changes = 0;
  for (let t = 0; t < secs; t += 1 / fps) if (aq.frame(1 / fps)) changes++;
  return changes;
}

test('calidad automática: a 60 FPS no toca nada', () => {
  const aq = new AutoQuality();
  assert.equal(run(aq, 60, 20), 0);
  assert.equal(aq.scale, 1);
  assert.equal(aq.msaa, true);
});

test('calidad automática: lento baja la resolución por escalones, con espera entre cambios, hasta el mínimo', () => {
  const aq = new AutoQuality({ min: 0.6, step: 0.1, cooldown: 4 });
  run(aq, 35, 1.6);
  assert.equal(aq.scale, 0.9, 'primer escalón tras la primera ventana');
  run(aq, 35, 3);
  assert.equal(aq.scale, 0.9, 'espera antes del siguiente');
  run(aq, 35, 30);
  assert.equal(aq.scale, 0.6, 'no baja del mínimo');
  assert.equal(aq.msaa, true, 'a 35 FPS conserva el MSAA');
});

test('calidad automática: muy lento en el mínimo quita el MSAA; al recuperarse lo devuelve antes de subir la resolución', () => {
  const aq = new AutoQuality({ min: 0.6, critical: 30 });
  run(aq, 20, 60);
  assert.equal(aq.scale, 0.6);
  assert.equal(aq.msaa, false);
  run(aq, 60, 12);
  assert.equal(aq.msaa, true, 'primero el MSAA');
  assert.ok(aq.scale < 1, 'la resolución sube poco a poco');
  run(aq, 60, 60);
  assert.equal(aq.scale, 1);
});

test('calidad automática: entre 45 y 57 FPS se queda donde está (sin oscilar)', () => {
  const aq = new AutoQuality();
  run(aq, 30, 2);
  const s = aq.scale;
  assert.equal(run(aq, 52, 40), 0);
  assert.equal(aq.scale, s);
});
