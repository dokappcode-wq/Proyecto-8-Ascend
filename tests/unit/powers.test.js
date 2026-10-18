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
