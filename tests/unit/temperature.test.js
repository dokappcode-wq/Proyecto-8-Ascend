import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { TEMPERATURE_CONFIG } from '../../src/powers/temperature/temperatureConfig.js';
import { BurnStatus } from '../../src/powers/temperature/BurnStatus.js';
import { Progression } from '../../src/powers/Progression.js';
import { MARKS, COPY_ORDER } from '../../src/data/marks.js';
import { PROGRESSION } from '../../src/data/progression.js';

const DT = 1 / 60;
const SK = TEMPERATURE_CONFIG.skate;

function world() {
  const w = new CollisionWorld();
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  return w;
}

function grounded(w, skate) {
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  m.skate = skate ? SK : null;
  for (let i = 0; i < 10; i++) m.update(DT, {});
  return m;
}

/** Corre 1.5 s hacia -z y suelta: devuelve los metros recorridos sin input. */
function glideAfterRelease(skate) {
  const m = grounded(world(), skate);
  for (let i = 0; i < 90; i++) m.update(DT, { moveX: 0, moveZ: -1, sprint: true });
  const z0 = m.position.z;
  for (let i = 0; i < 60; i++) m.update(DT, {});
  return { dist: z0 - m.position.z, speed: m.horizontalSpeed };
}

test('Temperatura: patinando casi no hay fricción (se sigue deslizando al soltar)', () => {
  const walk = glideAfterRelease(false);
  const skate = glideAfterRelease(true);
  assert.ok(walk.dist < 2, `andando frena enseguida (${walk.dist.toFixed(2)} m)`);
  assert.ok(skate.dist > 6, `patinando sigue deslizando (${skate.dist.toFixed(2)} m)`);
  assert.ok(skate.speed > 5, `y conserva velocidad (${skate.speed.toFixed(1)} m/s)`);
});

test('Temperatura: patinando se alcanza más velocidad punta que corriendo', () => {
  const m = grounded(world(), true);
  for (let i = 0; i < 180; i++) m.update(DT, { moveX: 0, moveZ: -1 });
  assert.ok(m.horizontalSpeed > SK.maxSpeed - 0.5, `velocidad ${m.horizontalSpeed.toFixed(1)} m/s`);
});

test('Temperatura: al patinar contra una pared sube por ella y cae en U', () => {
  const w = world();
  // Pared alta delante (perpendicular a -z) y algo ladeada respecto a la carrera
  w.addBox({ x: -20, y: 0, z: -14 }, { x: 20, y: 12, z: -13 });
  const m = grounded(w, true);
  let rode = false;
  let peak = 0;
  let maxX = 0;
  for (let i = 0; i < 300; i++) {
    m.update(DT, { moveX: 0.5, moveZ: -1 });
    if (m.events.wallRide) rode = true;
    if (rode) {
      peak = Math.max(peak, m.position.y);
      maxX = Math.max(maxX, m.position.x);
    }
    if (rode && m.grounded && i > 30) break;
  }
  assert.ok(rode, 'entra en la pared');
  assert.ok(peak > 1.5, `sube por la pared (${peak.toFixed(2)} m)`);
  assert.ok(m.grounded, 'y acaba de nuevo en el suelo');
  assert.ok(maxX > 3, `avanza a lo largo de la pared (${maxX.toFixed(2)} m)`);
  assert.ok(m.position.z > -13.2, 'sin atravesarla');
});

test('Temperatura: sin patinar, la pared detiene la carrera (no hay U)', () => {
  const w = world();
  w.addBox({ x: -20, y: 0, z: -14 }, { x: 20, y: 12, z: -13 });
  const m = grounded(w, false);
  let rode = false;
  for (let i = 0; i < 200; i++) {
    m.update(DT, { moveX: 0.5, moveZ: -1, noParkour: true });
    if (m.events.wallRide) rode = true;
  }
  assert.ok(!rode);
  assert.ok(m.position.y < 0.1);
});

test('Temperatura: la carrera de hielo avanza por el aire en la dirección apuntada, sin caer', () => {
  const m = grounded(world(), true);
  m.teleport({ x: 0, y: 5, z: 0 });
  m.iceRun = { x: 0, y: 0, z: -1, speed: TEMPERATURE_CONFIG.iceRun.speed };
  for (let i = 0; i < 60; i++) m.update(DT, {});
  assert.ok(Math.abs(m.position.y - 5) < 0.01, `mantiene la altura (${m.position.y.toFixed(2)})`);
  assert.ok(m.position.z < -15, `avanza ${(-m.position.z).toFixed(1)} m`);
  m.iceRun = null;
  for (let i = 0; i < 30; i++) m.update(DT, {});
  assert.ok(m.position.y < 4.5, 'al terminar vuelve a caer');
});

test('Temperatura: la quemadura hace 1 por tic hasta 10 y no se acumula', () => {
  const b = new BurnStatus(TEMPERATURE_CONFIG.burn);
  let dmg = 0;
  b.ignite();
  // A mitad de la quemadura se vuelve a encender: no reinicia ni duplica
  for (let i = 0; i < 600; i++) {
    if (i === 60) assert.equal(b.ignite(), false);
    dmg += b.update(DT);
  }
  assert.equal(dmg, 10);
  assert.ok(!b.active);
  // Terminada, se puede volver a quemar
  assert.equal(b.ignite(), true);
  for (let i = 0; i < 40; i++) dmg += b.update(DT);
  assert.equal(dmg, 10 + 1);
});

test('Temperatura: datos de la marca, degradado y árbol de mejoras', () => {
  assert.deepEqual(COPY_ORDER.slice(0, 4), ['energia', 'gravedad', 'hilo', 'temperatura']);
  const mk = MARKS.temperatura;
  assert.equal(mk.original, false);
  assert.ok(mk.color && mk.color2 && mk.passive);
  assert.equal(TEMPERATURE_CONFIG.projectile.magazineSize, 10);
  const p = new Progression({});
  p.state('temperatura').points = 5;
  assert.ok(p.unlock('temperatura', 'cargador-termico').ok);
  assert.equal(p.modifiers('temperatura').magazineBonus, 4);
  assert.equal(p.modifiers('energia').magazineBonus ?? 0, 0);
  assert.ok(PROGRESSION.temperatura.nodes.length >= 5);
});
