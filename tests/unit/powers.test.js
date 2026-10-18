import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyPool } from '../../src/powers/EnergyPool.js';
import { Ability } from '../../src/powers/Ability.js';
import { CombatSystem, radialFalloff } from '../../src/combat/CombatSystem.js';
import { stepProjectile } from '../../src/combat/projectile.js';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';

test('la energía se gasta, no baja de cero y se regenera tras el retardo', () => {
  const e = new EnergyPool({ max: 100, regenPerSecond: 10, regenDelay: 1 });
  assert.ok(e.spend(60));
  assert.ok(!e.spend(50));
  assert.equal(e.value, 40);
  e.update(0.5);
  assert.equal(e.value, 40); // aún en retardo
  e.update(0.5);
  assert.ok(Math.abs(e.value - 45) < 1e-9); // el retardo se cumple en este paso
  e.update(1);
  assert.ok(Math.abs(e.value - 55) < 1e-9);
  for (let i = 0; i < 100; i++) e.update(0.1);
  assert.equal(e.value, 100);
});

test('energía infinita (depuración) nunca se agota', () => {
  const e = new EnergyPool();
  e.infinite = true;
  for (let i = 0; i < 50; i++) assert.ok(e.spend(30));
  e.update(0.016);
  assert.equal(e.value, e.max);
});

test('una habilidad respeta coste y tiempo de reutilización', () => {
  const e = new EnergyPool({ max: 50 });
  const a = new Ability({ id: 'x', cost: 20, cooldown: 1 });
  assert.ok(a.commit(e));
  assert.equal(e.value, 30);
  assert.ok(!a.commit(e)); // en reutilización
  a.tick(1);
  assert.ok(a.commit(e));
  a.tick(1);
  assert.ok(!a.commit(e)); // sin energía (10 < 20)
  assert.equal(e.value, 10);
});

test('atenuación radial del daño', () => {
  assert.equal(radialFalloff(0, 5), 1);
  assert.equal(radialFalloff(5, 5), 0);
  assert.ok(Math.abs(radialFalloff(2.5, 5, 0.5) - 0.75) < 1e-9);
});

function dummy(x, y, z, hp = 100) {
  return {
    center: { x, y, z }, radius: 0.4, hp, alive: true, impulse: null,
    takeDamage(a) { const d = Math.min(a, this.hp); this.hp -= d; if (this.hp <= 0) this.alive = false; return d; },
    applyImpulse(x2, y2, z2) { this.impulse = { x: x2, y: y2, z: z2 }; },
  };
}

test('el combate aplica daño, emite eventos y neutraliza', () => {
  const events = [];
  const cs = new CombatSystem({ emit: (t, p) => events.push([t, p]) });
  const d = dummy(0, 1, 0, 25);
  cs.register(d);
  assert.equal(cs.applyDamage(d, 10), 10);
  assert.equal(cs.applyDamage(d, 50), 15);
  assert.equal(d.alive, false);
  assert.equal(cs.applyDamage(d, 10), 0);
  assert.equal(events.length, 2);
  assert.equal(events[1][1].killed, true);
});

test('el daño de área afecta solo dentro del radio y empuja hacia fuera', () => {
  const cs = new CombatSystem(null);
  const near = dummy(2, 0, 0);
  const far = dummy(20, 0, 0);
  cs.register(near);
  cs.register(far);
  cs.radial({ x: 0, y: 0, z: 0 }, 7, 30, { knockback: 10 });
  assert.ok(near.hp < 100);
  assert.equal(far.hp, 100);
  assert.ok(near.impulse.x > 0 && near.impulse.y > 0);
});

test('el proyectil impacta en un muro fino aunque sea muy rápido', () => {
  const w = new CollisionWorld();
  const wall = w.addBox({ x: -2, y: 0, z: 9.9 }, { x: 2, y: 3, z: 10 }, { owner: 'muro' });
  const p = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: 1 }, speed: 300, range: 45, traveled: 0 };
  const r = stepProjectile(p, 1 / 60, w) ?? stepProjectile(p, 1 / 60, w);
  assert.equal(r.type, 'hit');
  assert.equal(r.collider, wall);
  assert.equal(r.collider.owner, 'muro');
  assert.ok(Math.abs(r.point.z - 9.9) < 1e-6);
  assert.equal(r.normal.z, -1);
});

test('el proyectil caduca al superar su alcance e ignora los límites invisibles', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -2, y: 0, z: 5 }, { x: 2, y: 3, z: 6 }, { tag: 'bounds' });
  const p = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: 1 }, speed: 60, range: 20, traveled: 0 };
  let r = null;
  for (let i = 0; i < 100 && !r; i++) r = stepProjectile(p, 1 / 60, w);
  assert.equal(r.type, 'expired');
  assert.ok(Math.abs(p.traveled - 20) < 1e-6);
});

test('las cajas desactivadas no colisionan', () => {
  const w = new CollisionWorld();
  const b = w.addBox({ x: -1, y: 0, z: 2 }, { x: 1, y: 2, z: 3 });
  b.enabled = false;
  assert.equal(w.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 10), Infinity);
});

test('el dash desplaza rápido, anula la caída y respeta los muros', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 3, z: 0 });
  m.velocity.y = -5;
  assert.ok(m.startBurst({ x: 0, z: 1, speed: 26, duration: 0.17 }));
  assert.equal(m.velocity.y, 0);
  assert.ok(!m.startBurst({ x: 0, z: 1, speed: 26, duration: 0.17 }));
  for (let i = 0; i < 12; i++) m.update(1 / 60, { moveX: 0, moveZ: 0 });
  assert.ok(m.position.z > 4, `z=${m.position.z}`);
  assert.ok(m.position.y > 2.9, 'apenas cae durante el dash');
  assert.ok(!m.isDashing);

  w.addBox({ x: -5, y: 0, z: 6 }, { x: 5, y: 5, z: 6.3 });
  m.teleport({ x: 0, y: 0, z: 4 });
  m.startBurst({ x: 0, z: 1, speed: 26, duration: 0.17 });
  for (let i = 0; i < 12; i++) m.update(1 / 60, { moveX: 0, moveZ: 0 });
  assert.ok(m.position.z < 6);
});

test('speedScale reduce la velocidad al apuntar', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < 60; i++) m.update(1 / 60, { moveX: 0, moveZ: 1, speedScale: 0.5 });
  assert.ok(Math.abs(m.horizontalSpeed - m.cfg.walkSpeed * 0.5) < 1e-6);
});

function flatWorld() {
  const w = new CollisionWorld();
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  return w;
}
const still = { moveX: 0, moveZ: 0 };

test('la esquiva normal recorre una distancia corta (≈2–3 m)', () => {
  const m = new CharacterMotor(flatWorld());
  m.teleport({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < 10; i++) m.update(1 / 60, still);
  m.update(1 / 60, { ...still, dodge: true, facingX: 0, facingZ: 1 });
  for (let i = 0; i < 90; i++) m.update(1 / 60, still);
  assert.ok(m.position.z > 1.8 && m.position.z < 3, `z=${m.position.z}`);
});

test('el picado cae en vertical, aterriza inmune y mide la altura', () => {
  const m = new CharacterMotor(flatWorld());
  m.teleport({ x: 3, y: 12, z: -2 });
  m.velocity.x = 5;
  assert.ok(m.startDive(40));
  let landed = null;
  for (let i = 0; i < 120 && !landed; i++) {
    m.update(1 / 60, still);
    if (m.events.diveLanded) landed = { ...m.events };
  }
  assert.ok(landed, 'aterriza');
  assert.ok(landed.landingImmune);
  assert.ok(Math.abs(landed.diveLanded.fallHeight - 12) < 0.01);
  assert.equal(m.position.x, 3);
  assert.equal(m.position.y, 0);
  assert.ok(!m.isDiving);
});

test('no se puede iniciar un picado desde el suelo', () => {
  const m = new CharacterMotor(flatWorld());
  m.teleport({ x: 0, y: 0, z: 0 });
  m.update(1 / 60, still);
  assert.ok(!m.startDive());
});

test('el desplazamiento dirigido llega al destino, incluida una azotea', () => {
  const w = flatWorld();
  w.addBox({ x: 5, y: 0, z: -5 }, { x: 15, y: 6, z: 5 }); // edificio de 6 m
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  m.update(1 / 60, still);
  assert.ok(m.startTravel({ x: 7, y: 6, z: 0, speed: 45 }));
  let ended = null;
  for (let i = 0; i < 120 && !ended; i++) {
    m.update(1 / 60, still);
    ended = m.events.travelEnded;
  }
  assert.ok(ended && !ended.blocked, 'termina sin bloquearse');
  for (let i = 0; i < 30; i++) m.update(1 / 60, still);
  assert.ok(Math.abs(m.position.y - 6) < 1e-6, `y=${m.position.y}`);
  assert.ok(m.position.x > 6.5);
});

test('el desplazamiento dirigido se detiene contra un muro', () => {
  const w = flatWorld();
  w.addBox({ x: -5, y: 0, z: 4 }, { x: 5, y: 10, z: 4.5 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  m.update(1 / 60, still);
  m.startTravel({ x: 0, y: 0, z: 10 });
  let ended = null;
  for (let i = 0; i < 120 && !ended; i++) {
    m.update(1 / 60, still);
    ended = m.events.travelEnded;
  }
  assert.ok(ended && ended.blocked);
  assert.ok(m.position.z < 4);
});

import { Magazine } from '../../src/powers/Magazine.js';

test('el cargador permite N disparos, recarga y vuelve a estar lleno', () => {
  const m = new Magazine({ size: 10, reloadTime: 1.2 });
  for (let i = 0; i < 10; i++) assert.ok(m.consume(), `disparo ${i + 1}`);
  assert.equal(m.ammo, 0);
  assert.ok(m.reloading, 'empieza a recargar al vaciarse');
  assert.ok(!m.consume(), 'no dispara mientras recarga');
  assert.equal(m.update(0.6), false);
  assert.ok(Math.abs(m.reloadProgress - 0.5) < 1e-9);
  assert.equal(m.update(0.7), true, 'termina la recarga');
  assert.equal(m.ammo, 10);
  assert.ok(m.canFire);
});

test('no se recarga un cargador lleno', () => {
  const m = new Magazine({ size: 5, reloadTime: 1 });
  assert.ok(!m.startReload());
  m.consume();
  assert.ok(m.startReload());
});

import { EnergyReserve } from '../../src/powers/EnergyReserve.js';
import { ENERGY_CONFIG } from '../../src/powers/energy/energyConfig.js';

test('la energía de Energía no se regenera sola; se añade absorbiendo', () => {
  const e = new EnergyPool(ENERGY_CONFIG.pool);
  e.spend(50);
  for (let i = 0; i < 100; i++) e.update(0.1);
  assert.equal(e.value, ENERGY_CONFIG.pool.max - 50, 'sin regeneración pasiva');
  assert.equal(e.add(30), 30);
  assert.equal(e.add(100), 20, 'no supera el máximo');
  assert.ok(e.full);
});

test('una fuente se agota al absorberla y se recupera con el tiempo', () => {
  const r = new EnergyReserve({ capacity: 60, rechargeTime: 20, rechargeDelay: 3 });
  assert.equal(r.drain(40), 40);
  assert.equal(r.drain(40), 20);
  assert.ok(r.empty);
  r.update(2);
  assert.ok(r.empty, 'espera antes de recuperarse');
  r.update(1.5);
  r.update(10);
  assert.ok(r.value > 25 && r.value < 35, `recuperándose (${r.value})`);
  r.update(30);
  assert.equal(r.value, 60);
});

test('la carga básica dura más: 150 de energía y costes reducidos', () => {
  const c = ENERGY_CONFIG;
  assert.equal(c.pool.max, 150);
  assert.equal(c.pool.regenPerSecond, 0);
  // Un cargador completo (10 disparos) gasta 20; caben 7 cargadores
  assert.ok(c.pool.max / (c.projectile.cost * c.projectile.magazineSize) >= 7);
});
