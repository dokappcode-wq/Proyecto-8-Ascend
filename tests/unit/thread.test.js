import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { THREAD_CONFIG } from '../../src/powers/thread/threadConfig.js';
import { Progression } from '../../src/powers/Progression.js';
import { MARKS, COPY_ORDER } from '../../src/data/marks.js';
import { PROGRESSION } from '../../src/data/progression.js';

const DT = 1 / 60;
const R = CharacterMotor.ROPE_POINT;

function world() {
  const w = new CollisionWorld();
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  return w;
}

test('Hilo: el balanceo mantiene la cuerda tensa y el péndulo oscila', () => {
  const m = new CharacterMotor(world());
  m.teleport({ x: 0, y: 6, z: 8 });
  const anchor = { x: 0, y: 16, z: 0 };
  assert.ok(m.startSwing(anchor, THREAD_CONFIG.swing));
  const len = m.swingAnchor.len;
  let minZ = Infinity;
  let maxDev = 0;
  for (let i = 0; i < 120; i++) {
    m.update(DT, {});
    const p = m.position;
    const d = Math.hypot(p.x - anchor.x, p.y + R - anchor.y, p.z - anchor.z);
    maxDev = Math.max(maxDev, d - len);
    minZ = Math.min(minZ, p.z);
  }
  assert.ok(m.isSwinging);
  assert.ok(maxDev < 0.05, `la cuerda no se estira (${maxDev.toFixed(3)} m)`);
  assert.ok(minZ < -4, `pasa al otro lado del anclaje (z mínima ${minZ.toFixed(2)})`);
});

test('Hilo: al soltar conserva la velocidad del balanceo', () => {
  const m = new CharacterMotor(world());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  for (let i = 0; i < 40; i++) m.update(DT, {});
  const v = { ...m.velocity };
  m.endSwing(THREAD_CONFIG.swing.releaseBoost);
  assert.ok(!m.isSwinging);
  assert.ok(Math.hypot(v.x, v.z) > 8, `velocidad al soltar ${Math.hypot(v.x, v.z).toFixed(1)} m/s`);
  m.update(DT, {});
  assert.ok(Math.abs(m.velocity.z - v.z) < 1, 'sigue volando en la misma dirección');
});

test('Hilo: con la cuerda más corta que la distancia, tira del cuerpo hacia el anclaje', () => {
  const m = new CharacterMotor(world());
  m.teleport({ x: 0, y: 0, z: 10 });
  m.velocity.y = 7;
  m.grounded = false;
  m.startSwing({ x: 0, y: 10, z: 0 }, { ...THREAD_CONFIG.swing, maxLen: 7 });
  for (let i = 0; i < 30; i++) m.update(DT, {});
  const p = m.position;
  assert.ok(Math.hypot(p.x, p.y + R - 10, p.z) <= 7.05);
  assert.ok(p.y > 1, `despega del suelo (y=${p.y.toFixed(2)})`);
});

test('Hilo: tocar el suelo suelta el hilo', () => {
  const m = new CharacterMotor(world());
  // Cuerda larga: el punto más bajo del arco queda bajo el suelo
  m.teleport({ x: 0, y: 1, z: 6 });
  m.velocity.y = 3;
  m.grounded = false;
  m.startSwing({ x: 0, y: 8, z: 0 }, THREAD_CONFIG.swing);
  for (let i = 0; i < 120 && m.isSwinging; i++) m.update(DT, {});
  assert.ok(!m.isSwinging && m.grounded);
});

test('Hilo (pasiva): mantener el salto da un salto alto, sin planeo ni saltos extra', () => {
  const peak = (jumps) => {
    const m = new CharacterMotor(world());
    m.teleport({ x: 0, y: 0, z: 0 });
    m.jumpAbilities = jumps;
    for (let i = 0; i < 5; i++) m.update(DT, {});
    let top = 0;
    let n = 0;
    let glided = false;
    for (let i = 0; i < 150; i++) {
      m.update(DT, { jump: i === 0 || i === 30, jumpHeld: true });
      if (m.events.jumped) n++;
      glided ||= m.gliding;
      top = Math.max(top, m.position.y);
    }
    return { top, n, glided };
  };
  const normal = peak(null);
  const hilo = peak(THREAD_CONFIG.jumps);
  assert.ok(hilo.top > 4, `salto alto: ${hilo.top.toFixed(2)} m (normal ${normal.top.toFixed(2)} m)`);
  assert.equal(hilo.n, 1);
  assert.equal(hilo.glided, false);
});

test('Hilo: datos de la marca y árbol de mejoras', () => {
  assert.deepEqual(COPY_ORDER.slice(0, 3), ['energia', 'gravedad', 'hilo']);
  assert.equal(MARKS.hilo.color.toLowerCase(), '#f2f4f8');
  assert.ok(MARKS.hilo.passive);
  assert.equal(PROGRESSION.hilo.nodes.filter((n) => n.type === 'base').length, 5);
  const p = new Progression({});
  p.state('hilo').points = 5;
  assert.ok(p.unlock('hilo', 'hilo-largo').ok);
  assert.ok(p.unlock('hilo', 'puño-rapido').ok);
  const mods = p.modifiers('hilo');
  assert.equal(mods.swingRangeAdd, 8);
  assert.equal(mods.fistSpeedMul, 1.4);
  assert.equal(p.modifiers('gravedad').swingRangeAdd, 0);
});

test('Hilo: empujar en el sentido del arco da energía; hacia el anclaje no', () => {
  // Columpio sin entrada, después con el empuje en el sentido del movimiento
  const swing = (mode) => {
    const m = new CharacterMotor(world());
    m.teleport({ x: 0, y: 6, z: 8 });
    m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      const p = m.position;
      const v = m.velocity;
      let input = {};
      if (mode === 'ritmo') {
        // Empuja hacia donde va en horizontal
        const h = Math.hypot(v.x, v.z) || 1;
        input = { moveX: v.x / h, moveZ: v.z / h };
      } else if (mode === 'anclaje') {
        // Empuja hacia el anclaje (radial)
        input = { moveX: -p.x / Math.max(1e-6, Math.hypot(p.x, p.z)), moveZ: -p.z / Math.max(1e-6, Math.hypot(p.x, p.z)) };
      }
      m.update(DT, input);
      peak = Math.max(peak, Math.hypot(m.velocity.x, m.velocity.z));
    }
    return peak;
  };
  const ritmo = swing('ritmo');
  const anclaje = swing('anclaje');
  const quieto = swing('quieto');
  assert.ok(ritmo > quieto + 3, `a ritmo se gana velocidad (${ritmo.toFixed(1)} frente a ${quieto.toFixed(1)} m/s)`);
  assert.ok(anclaje < ritmo - 3, `empujar al anclaje no ayuda (${anclaje.toFixed(1)} m/s)`);
});

test('Hilo: S recoge hilo y acorta la cuerda hasta un mínimo', () => {
  const m = new CharacterMotor(world());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  const len0 = m.swingAnchor.len;
  for (let i = 0; i < 60; i++) m.update(DT, { reel: true });
  assert.ok(m.swingAnchor.len < len0 - 4, `la cuerda se acorta (${len0.toFixed(1)} → ${m.swingAnchor.len.toFixed(1)})`);
  for (let i = 0; i < 600; i++) m.update(DT, { reel: true });
  assert.equal(m.swingAnchor.len, THREAD_CONFIG.swing.minLen);
});

test('Hilo: al soltar con impulso horizontal se sale en la dirección del movimiento', () => {
  const m = new CharacterMotor(world());
  m.teleport({ x: 0, y: 6, z: 8 });
  m.startSwing({ x: 0, y: 16, z: 0 }, THREAD_CONFIG.swing);
  for (let i = 0; i < 40; i++) m.update(DT, {});
  const s0 = Math.hypot(m.velocity.x, m.velocity.z);
  const dir = { x: m.velocity.x, z: m.velocity.z };
  m.endSwing(0, 3);
  const s1 = Math.hypot(m.velocity.x, m.velocity.z);
  assert.ok(Math.abs(s1 - (s0 + 3)) < 1e-6);
  assert.ok(m.velocity.x * dir.x + m.velocity.z * dir.z > 0);
});
