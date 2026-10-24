import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreetGraph, polyLength, alongPolyline } from '../../src/city/streets.js';
import { STREETS } from '../../src/city/data/streets-cero.js';
import { createCityState, mergeCityState, districtControl, missionAvailable, medalFor, CONTROL } from '../../src/city/CityState.js';

const G = new StreetGraph(STREETS);

test('Calles del Distrito Cero: red conectada y rutas por la calle', () => {
  assert.ok(G.n > 300 && G.edges.length > 400);
  // Plaza del Kilómetro Cero → Subestación: hay camino y es más largo que la línea recta
  const a = { x: 2350, z: -2540 };
  const b = { x: 2800, z: -2200 };
  const r = G.route(a, b);
  assert.ok(r.length > 3);
  const L = polyLength(r);
  assert.ok(L >= Math.hypot(b.x - a.x, b.z - a.z) * 0.95 && L < 2000, `longitud ${L}`);
  // Casi todo el barrio está unido a la plaza
  const from = G.nearestNode(a.x, a.z);
  let reach = 0;
  const seen = new Uint8Array(G.n);
  const stack = [from];
  seen[from] = 1;
  while (stack.length) {
    const c = stack.pop();
    reach++;
    for (const { to } of G.adj[c]) if (!seen[to]) (seen[to] = 1), stack.push(to);
  }
  assert.ok(reach / G.n > 0.9, `alcanzables ${reach}/${G.n}`);
});

test('Calles: la acera queda fuera de la calzada y mira a la calle', () => {
  const s = G.sidewalk(2360, -2530);
  const p = s.street;
  const d = Math.hypot(s.x - p.x, s.z - p.z);
  assert.ok(Math.abs(d - (p.w / 2 + 1.6)) < 1e-3);
  // yaw mira hacia el eje de la calle
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  assert.ok(fx * (p.x - s.x) + fz * (p.z - s.z) > 0);
});

test('Calles: puntos a lo largo de una polilínea', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  assert.equal(polyLength(pts), 20);
  const m = alongPolyline(pts, 15);
  assert.deepEqual([m.x, m.z], [10, 5]);
  assert.ok(alongPolyline(pts, 99).done);
});

test('Campaña: control de la PDC por barrio', () => {
  const st = createCityState();
  const content = { sides: ['s1', 's2'], acts: [{ id: 'base', count: 2 }, { id: 'cab', count: 2 }] };
  assert.equal(districtControl(st, 'cero', content), 100);
  st.towers.cero = true;
  assert.equal(districtControl(st, 'cero', content), 100 - CONTROL.tower);
  st.done.s1 = st.done.s2 = true;
  st.acts['base-0'] = 1;
  st.acts['base-1'] = 3;
  st.acts['cab-0'] = 2;
  st.acts['cab-1'] = 1;
  st.events.cero = 9;
  assert.equal(districtControl(st, 'cero', content), 0);
  st.acts['cab-1'] = 0;
  assert.equal(districtControl(st, 'cero', content), 10);
});

test('Campaña: misiones disponibles, torres y medallas', () => {
  const st = createCityState();
  const h2 = { id: 'h2', after: ['h1'] };
  const act = { id: 'base', after: ['torre:cero'], repeat: true };
  assert.equal(missionAvailable(st, { id: 'h1' }), true);
  assert.equal(missionAvailable(st, h2), false);
  st.done.h1 = true;
  assert.equal(missionAvailable(st, h2), true);
  assert.equal(missionAvailable(st, { id: 'h1' }), false);
  assert.equal(missionAvailable(st, act), false);
  st.towers.cero = true;
  assert.equal(missionAvailable(st, act), true);
  assert.equal(medalFor(50, { gold: 40, silver: 60, bronze: 90 }, true), 2);
  assert.equal(medalFor(95, { gold: 40, silver: 60, bronze: 90 }, true), 0);
  assert.equal(medalFor(9, { gold: 8, silver: 6, bronze: 3 }), 3);
  const merged = mergeCityState(createCityState(), { version: 1, done: { h1: true } });
  assert.equal(merged.done.h1, true);
  assert.deepEqual(merged.towers, {});
});

import { Vehicle } from '../../src/city/props.js';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';

function fakeGame() {
  const world = new CollisionWorld();
  world.addBox({ x: -500, y: -1, z: -500 }, { x: 500, y: 0, z: 500 });
  const motor = { position: { x: 0, y: 0, z: 0 }, grounded: true, velocity: { x: 0, y: 0, z: 0 } };
  return { world, player: { motor, facing: 0 }, combat: { registerActor: () => () => {} } };
}

test('Vehículo: recorre la vía, gira con ella y arrastra a Jon en el techo', () => {
  const g = fakeGame();
  const path = [{ x: 0, z: 0 }, { x: 0, z: 100 }, { x: 100, z: 100 }];
  const v = new Vehicle(g, { kind: 'tram', path, s: 20, speed: 10 });
  v.target = 10;
  // Jon de pie sobre el techo, cerca de la parte delantera
  const m = g.player.motor;
  const r = v.roofPoint(4);
  Object.assign(m.position, { x: r.x, y: v.roofY, z: r.z });
  assert.ok(v.onRoof(m));
  const local0 = v.local(m.position);
  for (let i = 0; i < 60; i++) {
    v.update(1 / 30);
    m.grounded = true;
  }
  // Ha avanzado unos 20 m y Jon sigue en el mismo sitio del techo
  assert.ok(Math.abs(v.s - 40) < 0.5, `s=${v.s}`);
  const l = v.local(m.position);
  assert.ok(Math.abs(l.u - local0.u) < 0.3 && Math.abs(l.v - local0.v) < 0.3, JSON.stringify(l));
  assert.ok(v.riding);
  // La caja de colisión queda bajo sus pies, a la altura del techo
  assert.ok(m.position.x >= v.plate.minX && m.position.x <= v.plate.maxX && m.position.z >= v.plate.minZ && m.position.z <= v.plate.maxZ);
  assert.ok(Math.abs(v.plate.maxY - v.roofY) < 1e-6);
  // Al final de la vía se para
  for (let i = 0; i < 600; i++) v.update(1 / 30);
  assert.ok(v.done && v.speed === 0);
  // Un punto del techo vuelve a sus coordenadas locales
  const w = v.world(3, 0.5);
  const back = v.local(w);
  assert.ok(Math.abs(back.u - 3) < 1e-9 && Math.abs(back.v - 0.5) < 1e-9);
});
