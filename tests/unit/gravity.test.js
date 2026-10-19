import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { GRAVITY_CONFIG } from '../../src/powers/gravity/gravityConfig.js';
import { Progression } from '../../src/powers/Progression.js';
import { MARKS, COPY_ORDER } from '../../src/data/marks.js';
import { PROGRESSION } from '../../src/data/progression.js';
import { evaluateAcquisition } from '../../src/powers/acquisition.js';

const DT = 1 / 60;

function motor(gravityJumps = true) {
  const w = new CollisionWorld();
  w.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  m.jumpAbilities = gravityJumps ? GRAVITY_CONFIG.jumps : null;
  for (let i = 0; i < 10; i++) m.update(DT, {});
  return m;
}

/** Salta y devuelve la altura máxima alcanzada. */
function jumpPeak(m, held) {
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    m.update(DT, { jump: i === 0, jumpHeld: held });
    peak = Math.max(peak, m.position.y);
  }
  return peak;
}

test('Gravedad: mantener el salto lo hace más alto', () => {
  const tap = jumpPeak(motor(), false);
  const held = jumpPeak(motor(), true);
  assert.ok(held > tap * 1.3, `normal ${tap.toFixed(2)} m, mantenido ${held.toFixed(2)} m`);
});

test('Gravedad: hasta 3 saltos seguidos (uno desde el suelo y dos en el aire)', () => {
  const m = motor();
  let jumps = 0;
  let peak = 0;
  for (let i = 0; i < 200; i++) {
    // Pulsa saltar cada 0.3 s
    m.update(DT, { jump: i % 18 === 0 });
    if (m.events.jumped) jumps++;
    peak = Math.max(peak, m.position.y);
    if (m.grounded && i > 20) break;
  }
  assert.equal(jumps, 3);
  assert.ok(peak > 3.5, `altura con 3 saltos: ${peak.toFixed(2)} m`);
});

test('Gravedad: mantener el salto cayendo planea (caída lenta)', () => {
  const m = motor();
  m.teleport({ x: 0, y: 30, z: 0 });
  let minVy = 0;
  for (let i = 0; i < 120; i++) {
    m.update(DT, { jumpHeld: true, moveX: 0, moveZ: -1 });
    minVy = Math.min(minVy, m.velocity.y);
  }
  assert.ok(m.gliding);
  assert.ok(minVy >= -GRAVITY_CONFIG.jumps.glideFallSpeed - 1e-6, `velocidad vertical mínima ${minVy.toFixed(2)}`);
  assert.ok(m.horizontalSpeed > 7, `avanza planeando (${m.horizontalSpeed.toFixed(1)} m/s)`);
});

test('Energía (sin saltos de Gravedad): un solo salto y sin planeo', () => {
  const m = motor(false);
  let jumps = 0;
  for (let i = 0; i < 60; i++) {
    m.update(DT, { jump: i % 15 === 0 && i < 40, jumpHeld: true });
    if (m.events.jumped) jumps++;
  }
  assert.equal(jumps, 1);
  m.teleport({ x: 0, y: 30, z: 0 });
  for (let i = 0; i < 60; i++) m.update(DT, { jumpHeld: true });
  assert.ok(!m.gliding && m.velocity.y < -10);
});

test('Gravedad: datos de la marca, pasiva y árbol de mejoras', () => {
  assert.deepEqual(COPY_ORDER.slice(0, 2), ['energia', 'gravedad']);
  assert.equal(MARKS.gravedad.original, false);
  assert.ok(MARKS.gravedad.passive && MARKS.energia.passive);
  assert.equal(GRAVITY_CONFIG.projectile.magazineSize, 1);
  assert.equal(GRAVITY_CONFIG.stones.max, 3);
  assert.equal(GRAVITY_CONFIG.passive.threshold, 0.05);
  const p = new Progression({});
  p.state('gravedad').points = 5;
  assert.ok(p.unlock('gravedad', 'roca-extra').ok);
  assert.ok(p.unlock('gravedad', 'burbuja').ok);
  const m = p.modifiers('gravedad');
  assert.equal(m.stoneBonus, 1);
  assert.equal(m.bubbleRadiusAdd, 1.5);
  assert.equal(p.canUnlock('gravedad', 'colapso').reason, 'future');
  // Las mejoras de una marca no afectan a la otra
  assert.equal(p.modifiers('energia').stoneBonus, 0);
  assert.ok(PROGRESSION.gravedad.nodes.filter((n) => n.type === 'base').length === 5);
});

test('Gravedad: se copia de su Encarnación aunque ya se tenga la Energía', () => {
  const source = { kind: 'incarnation', markId: 'gravedad' };
  const r = evaluateAcquisition(source, ['destino', 'energia'], { contact: true, will: 1 });
  assert.equal(r.ok, true);
  assert.equal(evaluateAcquisition(source, ['destino', 'energia', 'gravedad'], { contact: true, will: 1 }).reason, 'already-owned');
});
