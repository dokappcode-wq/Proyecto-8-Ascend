import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITY, BIN } from '../../src/world/maps/ibaia/cityData.js';
import { decodeCity, cityColliders, districtAt, landAt, barrierGroup } from '../../src/world/maps/ibaia/decode.js';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';

const data = decodeCity(CITY, BIN);
const world = new CollisionWorld();
const [fx0, fz0, fx1, fz1] = CITY.frame;
world.addBox({ x: fx0, y: -1, z: fz0 }, { x: fx1, y: 0, z: fz1 });
const set = world.addObbSet(cityColliders(CITY, data.buildings));
const free = (x, z) => world.groundHeight(x, z, 0.45, 1000) <= 0.01;

test('Ibaia: diez barrios en orden de ruta, cada uno con su barrera y su Ancla', () => {
  assert.deepEqual(CITY.districts.map((d) => d.id), ['cero', 'industrial', 'midtown', 'parque', 'bloques', 'colinas', 'puerto', 'costa', 'chino', 'centro']);
  for (const d of CITY.districts) {
    assert.ok(d.barrier.length >= 1 && d.barrier.every((r) => r.length >= 6), d.id);
    assert.ok(d.anchor && Number.isFinite(d.anchor.x), d.id);
    assert.ok(d.zones.length >= 4, d.id);
  }
  // El Centro tiene dos anillos: la punta de la isla y La Roca
  assert.ok(CITY.districts.find((d) => d.id === 'centro').barrier.length >= 2);
});

test('Ibaia: los edificios caben en el marco y tienen medidas razonables', () => {
  const B = data.buildings;
  assert.ok(B.n > 25000);
  for (let i = 0; i < B.n; i += 7) {
    assert.ok(B.cx[i] > fx0 && B.cx[i] < fx1 && B.cz[i] > fz0 && B.cz[i] < fz1);
    assert.ok(B.hw[i] > 0 && B.hd[i] > 0 && B.h[i] > 0 && B.h[i] <= 520);
  }
  assert.ok(data.layers.blocks.length > 1000);
  assert.ok(data.trees.n > 5000 && data.lamps.n > 5000);
});

test('Ibaia: aparición en la calle del Distrito Cero, en tierra y sin edificios encima', () => {
  const s = CITY.spawn;
  assert.equal(districtAt(CITY, s.x, s.z)?.id, 'cero');
  assert.ok(landAt(data.mask, s.x, s.z));
  assert.ok(free(s.x, s.z));
});

test('Ibaia: los destinos de viaje de cada zona están en la calle, no dentro de un edificio', () => {
  let bad = 0;
  let total = 0;
  for (const d of CITY.districts) {
    for (const z of d.zones) {
      total++;
      if (!free(z.gx, z.gz)) bad++;
    }
    assert.ok(free(d.center.x, d.center.z), `centro de ${d.id}`);
  }
  assert.ok(bad <= total * 0.1, `${bad}/${total} destinos ocupados`);
});

test('Ibaia: la máscara distingue tierra y agua (la ría entre la península y la isla)', () => {
  const cero = CITY.districts.find((d) => d.id === 'cero');
  assert.ok(landAt(data.mask, cero.center.x, cero.center.z));
  // Punto del río entre el Distrito Cero y Los Bloques (Puente de Hierro, a media luz)
  const br = CITY.bridges.find((b) => b.name === 'Puente de Hierro');
  const mid = br.pts.reduce((a, p) => (p[2] > a[2] ? p : a));
  assert.equal(landAt(data.mask, mid[0], mid[1]), false);
  // El tablero está sobre el agua a la altura del puente
  assert.ok(Math.abs(world.groundHeight(mid[0], mid[1], 0.3, 100) - mid[2]) < 0.01);
});

test('Ibaia: la barrera del barrio frena al jugador y bajarla le deja pasar', () => {
  const cero = CITY.districts.find((d) => d.id === 'cero');
  // Un punto del anillo de la barrera y la dirección hacia fuera
  const r = cero.barrier[0];
  const i = 2 * Math.floor(r.length / 4);
  const bx = r[i];
  const bz = r[i + 1];
  const dx = bx - cero.label.x;
  const dz = bz - cero.label.z;
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const hit = world.raycastHit({ x: bx - ux * 6, y: 1, z: bz - uz * 6 }, { x: ux, y: 0, z: uz }, 12, { ignoreTags: ['building', 'bridge', 'rail'] });
  assert.equal(hit?.collider.tag, 'barrier');
  assert.equal(hit.collider.climbable, false);
  const g = barrierGroup(CITY, 'cero');
  set.setGroup(g, false);
  assert.equal(world.raycastHit({ x: bx - ux * 6, y: 1, z: bz - uz * 6 }, { x: ux, y: 0, z: uz }, 12, { ignoreTags: ['building', 'bridge', 'rail'] }), null);
  set.setGroup(g, true);
});

test('Ibaia: andar por la calle desde la aparición no atraviesa edificios', () => {
  const m = new CharacterMotor(world, { parkour: true });
  const s = CITY.spawn;
  m.teleport({ x: s.x, y: 0, z: s.z });
  const L = Math.hypot(s.dx, s.dz);
  for (let i = 0; i < 240; i++) m.update(1 / 60, { moveX: s.dx / L, moveZ: s.dz / L, sprint: true });
  assert.ok(Math.hypot(m.position.x - s.x, m.position.z - s.z) > 15, 'avanza');
  assert.ok(free(m.position.x, m.position.z) || m.position.y > 0.5);
});
