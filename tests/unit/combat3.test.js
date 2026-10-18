import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayVerticalCylinder } from '../../src/combat/geometry.js';
import { CombatSystem } from '../../src/combat/CombatSystem.js';
import { Health } from '../../src/combat/Health.js';
import { EnemyBrain } from '../../src/ai/EnemyBrain.js';
import { stepProjectile } from '../../src/combat/projectile.js';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';

test('rayo contra cilindro vertical: lateral, tapa, fallo y origen interior', () => {
  const base = { x: 0, y: 0, z: 10 };
  assert.ok(Math.abs(rayVerticalCylinder({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, base, 0.5, 1.8, 50) - 9.5) < 1e-9);
  assert.equal(rayVerticalCylinder({ x: 0, y: 2.5, z: 0 }, { x: 0, y: 0, z: 1 }, base, 0.5, 1.8, 50), null);
  assert.ok(Math.abs(rayVerticalCylinder({ x: 0, y: 5, z: 10 }, { x: 0, y: -1, z: 0 }, base, 0.5, 1.8, 50) - 3.2) < 1e-9);
  assert.equal(rayVerticalCylinder({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, base, 0.5, 1.8, 5), null);
  assert.equal(rayVerticalCylinder({ x: 0, y: 1, z: 10 }, { x: 1, y: 0, z: 0 }, base, 0.5, 1.8, 5), 0);
});

function actor(faction, x, z, hp = 100) {
  return {
    faction, hp, alive: true, radius: 0.4, center: { x, y: 1, z },
    capsule: () => ({ x, y: 0, z, r: 0.4, h: 1.8 }),
    takeDamage(a) { const d = Math.min(a, this.hp); this.hp -= d; if (this.hp <= 0) this.alive = false; return d; },
  };
}

test('las facciones no se dañan a sí mismas', () => {
  const cs = new CombatSystem(null);
  const player = actor('player', 0, 0);
  const enemy = actor('enemy', 2, 0);
  const enemy2 = actor('enemy', -2, 0);
  cs.registerActor(player);
  cs.registerActor(enemy);
  cs.registerActor(enemy2);
  cs.radial({ x: 0, y: 1, z: 0 }, 6, 30, { faction: 'player' });
  assert.equal(player.hp, 100, 'la onda del jugador no le daña');
  assert.ok(enemy.hp < 100 && enemy2.hp < 100);
  assert.equal(cs.applyDamage(enemy, 10, { faction: 'enemy' }), 0, 'sin fuego amigo');
  assert.equal(cs.applyDamage(player, 10, { faction: 'enemy' }), 10);
});

test('los proyectiles impactan en actores y excluyen la facción del tirador', () => {
  const w = new CollisionWorld();
  const cs = new CombatSystem(null);
  const shooter = actor('enemy', 0, 0);
  const ally = actor('enemy', 0, 5);
  const player = actor('player', 0, 10);
  [shooter, ally, player].forEach((a) => cs.registerActor(a));
  const test = (o, d, t) => cs.raycastActors(o, d, t, { excludeFaction: 'enemy' });
  const p = { pos: { x: 0, y: 1, z: 0.5 }, dir: { x: 0, y: 0, z: 1 }, speed: 600, range: 50, traveled: 0 };
  const r = stepProjectile(p, 1 / 30, w, test);
  assert.equal(r.type, 'hit');
  assert.equal(r.actor, player, 'atraviesa al aliado y golpea al jugador');
  assert.ok(Math.abs(r.point.z - 9.6) < 1e-6);
});

test('un muro protege al actor que hay detrás', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -2, y: 0, z: 4 }, { x: 2, y: 3, z: 4.5 });
  const cs = new CombatSystem(null);
  const player = actor('player', 0, 10);
  cs.registerActor(player);
  const p = { pos: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: 1 }, speed: 600, range: 50, traveled: 0 };
  const r = stepProjectile(p, 1 / 30, w, (o, d, t) => cs.raycastActors(o, d, t, { excludeFaction: 'enemy' }));
  assert.equal(r.actor, null);
  assert.ok(r.collider);
});

test('salud: daño, invulnerabilidad, regeneración retardada y muerte', () => {
  const h = new Health({ max: 100, regenPerSecond: 10, regenDelay: 2 });
  assert.equal(h.damage(30), 30);
  h.update(1);
  assert.equal(h.value, 70, 'sin regenerar durante el retardo');
  h.update(1.5);
  assert.ok(h.value > 70);
  h.reset(1);
  assert.equal(h.damage(50), 0, 'invulnerable tras reaparecer');
  h.update(1.1);
  assert.equal(h.damage(150), 100);
  assert.ok(!h.alive);
  h.update(10);
  assert.equal(h.value, 0, 'no regenera muerto');
});

const P = (canSee, extra = {}) => ({
  selfPos: { x: 0, y: 0, z: 0 }, canSee, targetPos: { x: 0, y: 0, z: 12 },
  heard: null, damagedFrom: null, heavyHit: false, dead: false, atGoal: false, ...extra,
});

test('IA: patrulla → alerta → ataque al ver al objetivo, y dispara', () => {
  const b = new EnemyBrain({ reactionTime: 0.5 });
  assert.equal(b.update(0.1, P(false)).move, 'patrol');
  b.update(0.1, P(true));
  assert.equal(b.state, 'alert');
  for (let i = 0; i < 6; i++) b.update(0.1, P(true));
  assert.equal(b.state, 'attack');
  const i = b.update(0.1, P(true));
  assert.ok(i.fire);
  assert.equal(i.move, 'strafe');
});

test('IA: mantiene la distancia preferida (se acerca o retrocede)', () => {
  const b = new EnemyBrain({ reactionTime: 0, preferredMin: 8, preferredMax: 16 });
  b.update(0.1, P(true));
  b.update(0.1, P(true));
  assert.equal(b.update(0.1, P(true, { targetPos: { x: 0, y: 0, z: 4 } })).move, 'retreat');
  assert.equal(b.update(0.1, P(true, { targetPos: { x: 0, y: 0, z: 22 } })).move, 'approach');
});

test('IA: pierde de vista → persecución → búsqueda → vuelve a patrullar', () => {
  const b = new EnemyBrain({ reactionTime: 0, loseSightTime: 1, searchTime: 2 });
  b.update(0.1, P(true));
  b.update(0.1, P(true));
  assert.equal(b.state, 'attack');
  for (let i = 0; i < 12; i++) b.update(0.1, P(false));
  assert.equal(b.state, 'chase');
  const go = b.update(0.1, P(false));
  assert.equal(go.move, 'goto');
  assert.deepEqual(go.goal, { x: 0, y: 0, z: 12 }, 'va a la última posición conocida');
  b.update(0.1, P(false, { atGoal: true }));
  assert.ok(b.searching);
  for (let i = 0; i < 25; i++) b.update(0.1, P(false));
  assert.equal(b.state, 'patrol');
});

test('IA: recibir daño sin ver al atacante le alerta hacia su posición', () => {
  const b = new EnemyBrain({ reactionTime: 0.4 });
  b.update(0.1, P(false, { damagedFrom: { x: 5, y: 0, z: 5 } }));
  assert.equal(b.state, 'alert');
  assert.deepEqual(b.lastKnown, { x: 5, y: 0, z: 5 });
  for (let i = 0; i < 4; i++) b.update(0.1, P(false));
  assert.equal(b.state, 'chase');
});

test('IA: un impacto fuerte provoca recuperación y luego reanuda', () => {
  const b = new EnemyBrain({ reactionTime: 0, staggerTime: 0.5 });
  b.update(0.1, P(true));
  b.update(0.1, P(true));
  const i = b.update(0.1, P(true, { heavyHit: true }));
  assert.equal(b.state, 'recover');
  assert.equal(i.fire, false);
  for (let k = 0; k < 6; k++) b.update(0.1, P(true));
  assert.equal(b.state, 'attack');
});

test('IA: neutralizado es terminal', () => {
  const b = new EnemyBrain();
  b.update(0.1, P(true, { dead: true }));
  assert.equal(b.state, 'neutralized');
  assert.equal(b.update(0.1, P(true)).fire, false);
  assert.equal(b.state, 'neutralized');
});

test('IA: el estado neutralizado se alcanza en el mismo instante de la muerte', () => {
  const b = new EnemyBrain();
  b.update(0, { dead: true });
  assert.equal(b.state, 'neutralized');
});
