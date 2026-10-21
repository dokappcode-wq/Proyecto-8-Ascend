import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { NavGrid } from '../../src/ai/NavGrid.js';

/** Muro en x = 0 (de z −20 a 20) con un hueco de 3 m en z 8…11, y una caja baja que no estorba. */
function world() {
  const w = new CollisionWorld();
  w.addBox({ x: -0.3, y: 0, z: -20 }, { x: 0.3, y: 4, z: 8 });
  w.addBox({ x: -0.3, y: 0, z: 11 }, { x: 0.3, y: 4, z: 20 });
  w.addBox({ x: -6, y: 0, z: -2 }, { x: -5, y: 0.2, z: 2 }); // bordillo (por debajo de las rodillas)
  return w;
}

test('NavGrid: rodea un muro por el hueco y ningún tramo lo atraviesa', () => {
  const nav = new NavGrid(world(), { x0: -15, x1: 15, z0: -15, z1: 15, y: 0, cell: 0.5 }).build();
  const path = nav.findPath({ x: -8, z: 0 }, { x: 8, z: 0 });
  assert.ok(path && path.length >= 2, 'hay camino y no es recto');
  const pts = [{ x: -8, z: 0 }, ...path];
  for (let i = 0; i < pts.length - 1; i++) assert.ok(nav.clear(pts[i], pts[i + 1]), `tramo ${i} libre`);
  assert.ok(pts.some((p) => p.z > 8 && p.z < 11 && Math.abs(p.x) < 3), 'pasa por el hueco');
  assert.deepEqual(path[path.length - 1], { x: 8, z: 0 });
});

test('NavGrid: en línea recta si nada lo impide; lo bajo no estorba', () => {
  const nav = new NavGrid(world(), { x0: -15, x1: 15, z0: -15, z1: 15, y: 0, cell: 0.5 }).build();
  assert.deepEqual(nav.findPath({ x: -8, z: 0 }, { x: -2, z: 0 }), [{ x: -2, z: 0 }]);
  assert.equal(nav.walkable(0, 0), false, 'dentro del muro');
  assert.equal(nav.walkable(-5.5, 0), true, 'sobre el bordillo bajo');
});

test('NavGrid: un destino dentro de un obstáculo se cambia por el sitio libre más cercano; sin salida, null', () => {
  const nav = new NavGrid(world(), { x0: -15, x1: 15, z0: -15, z1: 15, y: 0, cell: 0.5 }).build();
  const p = nav.findPath({ x: -8, z: 0 }, { x: 0, z: -5 });
  const end = p[p.length - 1];
  assert.ok(nav.walkable(end.x, end.z) && Math.hypot(end.x, end.z + 5) < 1.5);
  // Encerrado: caja alrededor
  const w = new CollisionWorld();
  for (const [a, b] of [[{ x: -3, z: -3 }, { x: 3, z: -2.5 }], [{ x: -3, z: 2.5 }, { x: 3, z: 3 }], [{ x: -3, z: -3 }, { x: -2.5, z: 3 }], [{ x: 2.5, z: -3 }, { x: 3, z: 3 }]]) w.addBox({ ...a, y: 0 }, { ...b, y: 3 });
  const closed = new NavGrid(w, { x0: -10, x1: 10, z0: -10, z1: 10, y: 0, cell: 0.5 }).build();
  assert.equal(closed.findPath({ x: 0, z: 0 }, { x: 8, z: 8 }), null);
});

test('NavGrid: una puerta cerrada (caja activa) bloquea; abierta, deja pasar', () => {
  const w = world();
  const door = w.addBox({ x: -0.3, y: 0, z: 8 }, { x: 0.3, y: 3, z: 11 });
  const nav = new NavGrid(w, { x0: -15, x1: 15, z0: -15, z1: 15, y: 0, cell: 0.5 });
  nav.build();
  assert.equal(nav.findPath({ x: -8, z: 0 }, { x: 8, z: 0 }), null);
  door.enabled = false;
  nav.build();
  assert.ok(nav.findPath({ x: -8, z: 0 }, { x: 8, z: 0 }));
});
