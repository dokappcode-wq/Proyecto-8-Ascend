import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';

const DT = 1 / 60;
const idle = { moveX: 0, moveZ: 0, sprint: false, jump: false, dodge: false };

function makeWorld() {
  const w = new CollisionWorld();
  // Suelo amplio
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  return w;
}

function run(motor, seconds, input = idle) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) motor.update(DT, input);
}

test('el personaje cae y se apoya en el suelo', () => {
  const m = new CharacterMotor(makeWorld());
  m.teleport({ x: 0, y: 5, z: 0 });
  run(m, 2);
  assert.ok(m.grounded);
  assert.ok(Math.abs(m.position.y) < 1e-6);
});

test('caminar y sprint alcanzan sus velocidades', () => {
  const m = new CharacterMotor(makeWorld());
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  run(m, 1, { ...idle, moveZ: 1 });
  assert.ok(Math.abs(m.horizontalSpeed - m.cfg.walkSpeed) < 1e-6);
  run(m, 1, { ...idle, moveZ: 1, sprint: true });
  assert.ok(Math.abs(m.horizontalSpeed - m.cfg.sprintSpeed) < 1e-6);
  run(m, 1);
  assert.equal(m.horizontalSpeed, 0);
});

test('el salto alcanza la altura esperada y vuelve al suelo', () => {
  const m = new CharacterMotor(makeWorld());
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  m.update(DT, { ...idle, jump: true });
  assert.ok(m.events.jumped);
  let maxY = 0;
  for (let i = 0; i < 120; i++) {
    m.update(DT, idle);
    maxY = Math.max(maxY, m.position.y);
  }
  const expected = (m.cfg.jumpVelocity ** 2) / (2 * m.cfg.gravity);
  assert.ok(Math.abs(maxY - expected) < 0.2, `altura ${maxY} vs ${expected}`);
  assert.ok(m.grounded);
});

test('un muro bloquea el avance', () => {
  const w = makeWorld();
  w.addBox({ x: -5, y: 0, z: 5 }, { x: 5, y: 4, z: 6 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 3, { ...idle, moveZ: 1, sprint: true });
  assert.ok(m.position.z <= 5 - m.cfg.radius + 1e-6, `z=${m.position.z}`);
});

test('el muro no se atraviesa ni a velocidad de esquiva', () => {
  const w = makeWorld();
  w.addBox({ x: -5, y: 0, z: 2 }, { x: 5, y: 4, z: 2.3 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  for (let i = 0; i < 60; i++) m.update(DT, { ...idle, moveZ: 1, dodge: i % 20 === 0 });
  assert.ok(m.position.z < 2);
});

test('sube escalones bajos pero no obstáculos altos', () => {
  const w = makeWorld();
  w.addBox({ x: -2, y: 0, z: 3 }, { x: 2, y: 0.3, z: 20 }); // escalón 0.3
  w.addBox({ x: 10, y: 0, z: 3 }, { x: 14, y: 0.8, z: 20 }); // obstáculo 0.8
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 2, { ...idle, moveZ: 1 });
  assert.ok(Math.abs(m.position.y - 0.3) < 1e-6);

  m.teleport({ x: 12, y: 0, z: 0 });
  run(m, 2, { ...idle, moveZ: 1 });
  assert.ok(m.position.z < 3);
  assert.equal(m.position.y, 0);
});

test('se puede saltar sobre un obstáculo de 1.2 m', () => {
  const w = makeWorld();
  w.addBox({ x: -2, y: 0, z: 3 }, { x: 2, y: 1.2, z: 20 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 1.5 });
  run(m, 0.1);
  m.update(DT, { ...idle, moveZ: 1, jump: true });
  run(m, 1.5, { ...idle, moveZ: 1 });
  assert.ok(Math.abs(m.position.y - 1.2) < 1e-6, `y=${m.position.y}`);
});

test('sube y baja una rampa manteniendo el contacto', () => {
  const w = makeWorld();
  w.addRamp({ minX: -2, maxX: 2, minZ: 2, maxZ: 12, axis: 'z', y0: 0, y1: 4 });
  w.addBox({ x: -2, y: 0, z: 12 }, { x: 2, y: 4, z: 20 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  run(m, 2.6, { ...idle, moveZ: 1 });
  assert.ok(m.position.z > 12 && m.position.z < 20);
  assert.ok(Math.abs(m.position.y - 4) < 1e-6, `y=${m.position.y}`);

  // Baja sin despegarse
  let airborneFrames = 0;
  for (let i = 0; i < 240; i++) {
    m.update(DT, { ...idle, moveZ: -1 });
    if (!m.grounded) airborneFrames++;
  }
  assert.equal(airborneFrames, 0);
  assert.ok(Math.abs(m.position.y) < 1e-6);
});

test('el lateral alto de una rampa bloquea', () => {
  const w = makeWorld();
  w.addRamp({ minX: 0, maxX: 4, minZ: 0, maxZ: 10, axis: 'z', y0: 0, y1: 4 });
  const m = new CharacterMotor(w);
  m.teleport({ x: -3, y: 0, z: 9 });
  run(m, 2, { ...idle, moveX: 1 });
  assert.ok(m.position.x < 0);
});

test('un techo detiene el salto', () => {
  const w = makeWorld();
  w.addBox({ x: -3, y: 2.5, z: -3 }, { x: 3, y: 3, z: 3 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  m.update(DT, { ...idle, jump: true });
  let maxHead = 0;
  for (let i = 0; i < 60; i++) {
    m.update(DT, idle);
    maxHead = Math.max(maxHead, m.position.y + m.cfg.height);
  }
  assert.ok(maxHead <= 2.5 + 1e-6);
});

test('el coyote time permite saltar justo después de dejar el borde', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -2, y: -1, z: -10 }, { x: 2, y: 0, z: 0 });
  const m = new CharacterMotor(w);
  m.teleport({ x: 0, y: 0, z: -1 });
  run(m, 0.1);
  // Avanza hasta salir del borde
  let frames = 0;
  while (m.grounded && frames++ < 200) m.update(DT, { ...idle, moveZ: 1 });
  assert.ok(!m.grounded);
  m.update(DT, { ...idle, moveZ: 1, jump: true });
  assert.ok(m.events.jumped);
});

test('caer fuera del mapa reaparece en el punto de inicio', () => {
  const w = new CollisionWorld();
  const m = new CharacterMotor(w);
  m.setSpawn({ x: 1, y: 2, z: 3 });
  m.teleport({ x: 50, y: 0, z: 50 });
  let respawned = false;
  for (let i = 0; i < 600 && !respawned; i++) {
    m.update(DT, idle);
    respawned = m.events.respawned;
  }
  assert.ok(respawned);
});

test('la esquiva tiene tiempo de reutilización', () => {
  const m = new CharacterMotor(makeWorld());
  m.teleport({ x: 0, y: 0, z: 0 });
  run(m, 0.1);
  m.update(DT, { ...idle, dodge: true, facingX: 0, facingZ: 1 });
  assert.ok(m.events.dodged);
  m.update(DT, { ...idle, dodge: true });
  assert.ok(!m.events.dodged);
  run(m, 1);
  m.update(DT, { ...idle, dodge: true });
  assert.ok(m.events.dodged);
});

test('raycast detecta cajas y rampas', () => {
  const w = new CollisionWorld();
  w.addBox({ x: -1, y: 0, z: 5 }, { x: 1, y: 2, z: 6 });
  assert.ok(Math.abs(w.raycast({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, 20) - 5) < 1e-6);
  assert.equal(w.raycast({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 1 }, 20), Infinity);

  const w2 = new CollisionWorld();
  w2.addRamp({ minX: -5, maxX: 5, minZ: -5, maxZ: 5, axis: 'x', y0: 0, y1: 2 });
  const t = w2.raycast({ x: 0, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, 20);
  assert.ok(Math.abs(t - 9) < 1e-6);
});
