import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { isClimbable } from '../../src/physics/Parkour.js';

const DT = 1 / 60;

function world(boxes = [], opts = {}) {
  const w = new CollisionWorld();
  w.addBox({ x: -100, y: -1, z: -100 }, { x: 100, y: 0, z: 100 });
  for (const [min, max, o] of boxes) w.addBox(min, max, o ?? opts);
  return w;
}

function motor(w, at = { x: 0, y: 0, z: 0 }, cfg = { parkour: true }) {
  const m = new CharacterMotor(w, cfg);
  m.teleport(at);
  return m;
}

/** Simula `secs` segundos; `inp(i, m)` devuelve la entrada de cada paso. Devuelve los estados y eventos vistos. */
function run(m, secs, inp) {
  const states = new Set();
  const events = new Set();
  for (let i = 0; i < secs / DT; i++) {
    m.update(DT, typeof inp === 'function' ? inp(i, m) : inp);
    if (m.climbState) states.add(m.climbState);
    if (m.events.parkour) events.add(m.events.parkour);
  }
  return { states, events };
}

const fwd = (extra = {}) => ({ moveX: 0, moveZ: -1, ...extra });

test('correr contra una valla baja y estrecha la salta por encima', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -5.3 }, { x: 2, y: 1, z: -4.7 }]]));
  const { states } = run(m, 1.2, fwd({ sprint: true }));
  assert.ok(states.has('vault'));
  assert.ok(m.position.z < -6, `al otro lado (${m.position.z.toFixed(2)})`);
  assert.equal(m.position.y, 0);
});

test('caminar contra un bloque de 1.2 m sube encima sin saltar', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -9 }, { x: 2, y: 1.2, z: -5 }]]));
  const { states } = run(m, 1.6, fwd());
  assert.ok(states.has('mantle'));
  assert.ok(Math.abs(m.position.y - 1.2) < 1e-6);
  assert.ok(m.grounded);
});

test('un muro de 1.2 m sin sitio encima no se sube', () => {
  // Techo justo encima del bloque
  const m = motor(world([
    [{ x: -2, y: 0, z: -9 }, { x: 2, y: 1.2, z: -5 }],
    [{ x: -2, y: 2, z: -9 }, { x: 2, y: 3, z: -5 }],
  ]));
  const { states } = run(m, 1, fwd());
  assert.equal(states.size, 0);
  assert.equal(m.position.y, 0);
});

test('saltar hacia un borde de 3 m: se agarra y sube', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -9 }, { x: 2, y: 3, z: -5 }]]), { x: 0, y: 0, z: -4 });
  const { events } = run(m, 1.5, (i) => fwd({ jump: i === 2 }));
  assert.ok(events.has('hang') || events.has('mantle'));
  assert.ok(Math.abs(m.position.y - 3) < 1e-6, `arriba (${m.position.y.toFixed(2)})`);
});

test('muro de 8 m: se engancha al saltar y trepa hasta arriba', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -5.8 }, { x: 2, y: 8, z: -5 }]]), { x: 0, y: 0, z: -4 });
  let t = null;
  const { events } = run(m, 4, (i, mm) => {
    if (t === null && mm.grounded && mm.position.y > 7.9) t = i * DT;
    return t === null ? fwd({ jump: i === 2 }) : {};
  });
  assert.ok(events.has('wall'));
  assert.ok(events.has('mantle'));
  assert.ok(t !== null && t < 2.5, `tarda ${t?.toFixed(2)} s`);
  assert.ok(Math.abs(m.position.y - 8) < 1e-6);
});

test('fachada con cornisas estrechas: se pasa de cornisa en cornisa hasta la azotea', () => {
  const boxes = [[{ x: -5, y: 0, z: 11.5 }, { x: 5, y: 12, z: 12.5 }]];
  for (let i = 1; i <= 4; i++) boxes.push([{ x: -5, y: i * 2.6, z: 11.1 }, { x: 5, y: i * 2.6 + 0.25, z: 11.5 }]);
  const m = motor(world(boxes), { x: 0, y: 0, z: 9.5 });
  let top = false;
  run(m, 6, (i, mm) => {
    if (mm.grounded && mm.position.y > 11.9) top = true;
    return top ? {} : { moveX: 0, moveZ: 1, jump: i === 2 };
  });
  assert.ok(top, `altura final ${m.position.y.toFixed(2)}`);
});

test('colgado de una cornisa: se desplaza de lado sin salirse y C le suelta', () => {
  // Muro de 3 m de 4 m de ancho (x de -2 a 2)
  const m = motor(world([[{ x: -2, y: 0, z: -9 }, { x: 2, y: 3, z: -5 }]]), { x: 0, y: 0, z: -4 });
  // Salta y suelta W antes de subir: queda colgado
  run(m, 0.6, (i, mm) => (mm.climbState === 'hang' ? {} : fwd({ jump: i === 2 })));
  assert.equal(m.climbState, 'hang');
  const y = m.position.y;
  run(m, 3, { moveX: 1, moveZ: 0 });
  assert.equal(m.climbState, 'hang');
  assert.ok(m.position.x > 1.4 && m.position.x <= 2.05, `en el borde (${m.position.x.toFixed(2)})`);
  assert.equal(m.position.y, y);
  m.update(DT, { drop: true });
  assert.equal(m.climbState, null);
  run(m, 1.5, {});
  assert.ok(m.grounded && m.position.y === 0);
});

test('salto hacia atrás desde la pared', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -5.8 }, { x: 2, y: 12, z: -5 }]]), { x: 0, y: 0, z: -4 });
  run(m, 0.8, (i) => fwd({ jump: i === 2 }));
  assert.equal(m.climbState, 'wall');
  const z0 = m.position.z;
  m.update(DT, { moveX: 0, moveZ: 1, jump: true });
  assert.equal(m.climbState, null);
  assert.equal(m.events.parkour, 'walljump');
  run(m, 0.4, {});
  assert.ok(m.position.z > z0 + 1.5, 'se aleja de la pared');
});

test('en la pared, W trepa y S baja hasta el suelo', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -5.8 }, { x: 2, y: 12, z: -5 }]]), { x: 0, y: 0, z: -4 });
  run(m, 1, (i) => fwd({ jump: i === 2 }));
  const y1 = m.position.y;
  assert.equal(m.climbState, 'wall');
  run(m, 2, { moveX: 0, moveZ: 1 });
  assert.equal(m.climbState, null);
  assert.ok(y1 > 2 && m.grounded && m.position.y === 0);
});

test('los límites invisibles, los objetos móviles y las fuentes no se escalan', () => {
  assert.equal(isClimbable({ kind: 'box', tag: 'bounds' }), false);
  assert.equal(isClimbable({ kind: 'box', tag: 'source' }), false);
  assert.equal(isClimbable({ kind: 'box', owner: {} }), false);
  assert.equal(isClimbable({ kind: 'box', climbable: false }), false);
  assert.equal(isClimbable({ kind: 'box', tag: 'B1' }), true);
  const m = motor(world([[{ x: -2, y: 0, z: -5.8 }, { x: 2, y: 12, z: -5 }, { tag: 'bounds' }]]), { x: 0, y: 0, z: -4 });
  const { states } = run(m, 1.5, (i) => fwd({ jump: i === 2 }));
  assert.equal(states.size, 0);
});

test('sin parkour (enemigos) o con noParkour no hay agarre', () => {
  const w = world([[{ x: -2, y: 0, z: -9 }, { x: 2, y: 1.2, z: -5 }]]);
  const enemy = motor(w, { x: 0, y: 0, z: 0 }, {});
  assert.equal(run(enemy, 1, fwd()).states.size, 0);
  const aiming = motor(w);
  assert.equal(run(aiming, 1, fwd({ noParkour: true })).states.size, 0);
});

test('subir a una cornisa no causa daño por caída', () => {
  const m = motor(world([[{ x: -2, y: 0, z: -9 }, { x: 2, y: 3, z: -5 }]]), { x: 0, y: 0, z: -4 });
  let landed = null;
  run(m, 1.5, (i, mm) => {
    if (i > 10 && mm.events.landed && landed === null) landed = { immune: mm.events.landingImmune, speed: mm.events.landingSpeed };
    return fwd({ jump: i === 2 });
  });
  assert.ok(landed && landed.immune && landed.speed === 0);
});
