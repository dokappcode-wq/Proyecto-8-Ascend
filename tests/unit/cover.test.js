import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { findCover, wallBehind, findPeek } from '../../src/player/Cover.js';

function world() {
  const w = new CollisionWorld();
  w.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  return w;
}

test('detecta un muro bajo cercano como cobertura baja', () => {
  const w = world();
  w.addBox({ x: -2, y: 0, z: 1 }, { x: 2, y: 1.2, z: 1.8 }); // barrera de 1.2 m al norte (+z)
  const c = findCover(w, { x: 0, y: 0, z: 0.2 }, 0.38);
  assert.ok(c);
  assert.equal(c.high, false);
  assert.ok(Math.abs(c.nz + 1) < 1e-9, 'la normal apunta hacia el jugador (-z)');
});

test('sin muro cerca o con un obstáculo muy bajo no hay cobertura', () => {
  const w = world();
  assert.equal(findCover(w, { x: 0, y: 0, z: 0 }, 0.38), null);
  w.addBox({ x: -2, y: 0, z: 1 }, { x: 2, y: 0.5, z: 1.8 });
  assert.equal(findCover(w, { x: 0, y: 0, z: 0.4 }, 0.38), null);
});

test('muro alto: detecta el borde lateral para asomarse', () => {
  const w = world();
  w.addBox({ x: -1, y: 0, z: 1 }, { x: 3, y: 3, z: 1.6 }); // muro alto que termina en x = -1
  const pos = { x: 0, y: 0, z: 0.5 };
  const c = findCover(w, pos, 0.38);
  assert.ok(c && c.high);
  assert.ok(wallBehind(w, pos, c, 0.38));
  assert.ok(!wallBehind(w, { x: -1.6, y: 0, z: 0.5 }, c, 0.38), 'más allá del borde no hay muro');
  const peek = findPeek(w, pos, c, 0.38);
  assert.ok(peek && peek.x < -1, `se asoma por el borde izquierdo (x=${peek?.x})`);
});
