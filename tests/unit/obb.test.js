import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { ObbSet } from '../../src/physics/ObbSet.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';

const DT = 1 / 60;
const near = (a, b, e = 1e-6) => a === b || Math.abs(a - b) < e;

function world(boxes, cell = 16) {
  const w = new CollisionWorld();
  w.addBox({ x: -200, y: -1, z: -200 }, { x: 200, y: 0, z: 200 });
  const set = new ObbSet({ cell });
  for (const b of boxes) set.add(b);
  w.addObbSet(set);
  return { w, set };
}

test('caja girada 45°: suelo dentro de su huella y no fuera de ella', () => {
  const { w } = world([{ cx: 0, cz: 0, angle: Math.PI / 4, hw: 5, hd: 5, minY: 0, maxY: 10 }]);
  // (5, 0) queda dentro del rombo (vértices a 7.07 en los ejes)
  assert.equal(w.groundHeight(5, 0, 0.1, 100), 10);
  // (6, 6) está fuera (en la esquina del cuadrado sin girar)
  assert.equal(w.groundHeight(6, 6, 0.1, 100), 0);
  assert.equal(w.ceilingHeight(5, 0, 0.1, -0.5), 0);
  assert.equal(w.ceilingHeight(5, 0, 0.1, 0.5), Infinity);
});

test('empuja el cilindro fuera de una cara girada, en la dirección de su normal', () => {
  const a = Math.PI / 6;
  const { w } = world([{ cx: 0, cz: 0, angle: a, hw: 4, hd: 2, minY: 0, maxY: 6 }]);
  // Punto a 0.2 m dentro de la cara +u
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const pos = { x: ux * 3.8, z: uz * 3.8 };
  const n = w.resolveHorizontal(pos, 0.4, 0, 1.8, 0.35);
  assert.equal(n, 1);
  assert.ok(near(pos.x * ux + pos.z * uz, 4.4, 1e-9), 'queda a radio de la cara');
  assert.ok(near(-pos.x * uz + pos.z * ux, 0, 1e-9), 'sin moverse de lado');
});

test('rayo contra una cara girada: distancia y normal correctas', () => {
  const a = 0.5;
  const { w } = world([{ cx: 10, cz: 0, angle: a, hw: 2, hd: 2, minY: 0, maxY: 6, tag: 'edificio' }]);
  const dir = { x: 1, y: 0, z: 0 };
  const hit = w.raycastHit({ x: 0, y: 1, z: 0 }, dir, 100);
  assert.ok(hit);
  assert.equal(hit.collider.obb, true);
  assert.equal(hit.collider.tag, 'edificio');
  // La normal es horizontal y apunta hacia el rayo
  assert.ok(near(hit.normal.y, 0));
  assert.ok(hit.normal.x < 0);
  assert.ok(near(Math.hypot(hit.normal.x, hit.normal.z), 1, 1e-9));
  // El punto de impacto está sobre la superficie de la caja
  const px = hit.t - 10;
  const lu = px * Math.cos(a);
  const lv = -px * Math.sin(a);
  assert.ok(near(Math.max(Math.abs(lu), Math.abs(lv)), 2, 1e-6));
  // Ignorar por etiqueta
  assert.equal(w.raycastHit({ x: 0, y: 1, z: 0 }, dir, 100, { ignoreTags: ['edificio'] })?.collider.obb, undefined);
});

test('la rejilla da los mismos impactos que probar todas las cajas', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const boxes = [];
  for (let i = 0; i < 300; i++) {
    boxes.push({ cx: rnd() * 400 - 200, cz: rnd() * 400 - 200, angle: rnd() * Math.PI, hw: 1 + rnd() * 12, hd: 1 + rnd() * 12, minY: 0, maxY: 2 + rnd() * 60 });
  }
  const { set } = world(boxes, 24);
  const out = { t: 0 };
  const ref = { t: 0 };
  for (let k = 0; k < 400; k++) {
    const o = { x: rnd() * 500 - 250, y: rnd() * 40, z: rnd() * 500 - 250 };
    const a = rnd() * Math.PI * 2;
    const e = (rnd() - 0.5) * 0.6;
    const d = { x: Math.cos(a) * Math.cos(e), y: Math.sin(e), z: Math.sin(a) * Math.cos(e) };
    const got = set.raycast(o, d, 600, null, out) ? out.t : Infinity;
    let best = 600;
    let hit = false;
    for (let i = 0; i < set.n; i++) {
      if (set._rayBox(i, o, d, best, ref)) {
        best = ref.t;
        hit = true;
      }
    }
    assert.ok(near(got, hit ? best : Infinity, 1e-6), `rayo ${k}: ${got} ≠ ${best}`);
  }
});

test('los grupos apagan cajas (barreras de un barrio) sin reconstruir la rejilla', () => {
  const { w, set } = world([{ cx: 0, cz: -5, angle: 0.3, hw: 20, hd: 0.6, minY: -5, maxY: 400, group: 3, tag: 'barrier', climbable: false, cameraBlocking: false }]);
  const ray = () => w.raycastHit({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 50);
  assert.ok(ray());
  assert.equal(ray().collider.climbable, false);
  assert.equal(ray().collider.enabled, true);
  set.setGroup(3, false);
  assert.equal(ray(), null);
  const pos = { x: 0, z: -5 };
  assert.equal(w.resolveHorizontal(pos, 0.4, 0, 1.8, 0.35), 0);
  set.setGroup(3, true);
  assert.ok(ray());
  // La cámara no choca con los muros de luz (son translúcidos)
  assert.equal(w.raycastHit({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 50, { cameraOnly: true }), null);
  assert.equal(ray().collider.cameraBlocking, false);
});

test('tramo en rampa: la altura sube a lo largo del eje y se puede subir andando', () => {
  // Rampa girada 90° (sube hacia -Z): de 0 a 5 m en 40 m
  const { w } = world([{ cx: 0, cz: -25, angle: -Math.PI / 2, hw: 20, hd: 4, minY: -1, y0: 0, y1: 5 }]);
  assert.ok(near(w.groundHeight(0, -5, 0.05, 100), 0, 1e-9));
  assert.ok(near(w.groundHeight(0, -25, 0.05, 100), 2.5, 1e-9));
  assert.ok(near(w.groundHeight(0, -44.9, 0.05, 100), 4.9875, 1e-6));
  const m = new CharacterMotor(w, { parkour: true });
  m.teleport({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < 10 / DT; i++) m.update(DT, { moveX: 0, moveZ: -1 });
  assert.ok(m.position.z < -45, `sigue avanzando (${m.position.z.toFixed(1)})`);
  // Al final de la rampa cae a la calle
  const top = w.groundHeight(0, -30, 0.05, 100);
  assert.ok(top > 2 && top < 5);
});

test('rayo hacia abajo sobre la rampa: normal inclinada hacia arriba', () => {
  const { w } = world([{ cx: 0, cz: 0, angle: 0, hw: 10, hd: 3, minY: -1, y0: 0, y1: 4 }]);
  const hit = w.raycastHit({ x: 5, y: 20, z: 0 }, { x: 0, y: -1, z: 0 }, 50);
  assert.ok(near(20 - hit.t, 3, 1e-9));
  assert.ok(hit.normal.y > 0.9 && hit.normal.x < 0);
});

/** Trepa un muro alto girado `ang` saltando hacia él. */
function climbRotated(ang) {
  // Muro de 8 m cuya cara mira hacia el jugador (que está en el origen)
  const nx = Math.cos(ang);
  const nz = Math.sin(ang);
  const dist = 1.2;
  const { w } = world([{ cx: -nx * (dist + 2), cz: -nz * (dist + 2), angle: ang, hw: 2, hd: 3, minY: 0, maxY: 8 }]);
  const m = new CharacterMotor(w, { parkour: true });
  m.teleport({ x: 0, y: 0, z: 0 });
  const events = new Set();
  let t = null;
  for (let i = 0; i < 4 / DT; i++) {
    if (t === null && m.grounded && m.position.y > 7.9) t = i * DT;
    m.update(DT, t === null ? { moveX: -nx, moveZ: -nz, jump: i === 2 } : {});
    if (m.events.parkour) events.add(m.events.parkour);
  }
  return { m, events, t };
}

test('escalada en un muro girado (30° y 45°): se engancha, trepa y sube arriba', () => {
  for (const ang of [Math.PI / 6, Math.PI / 4, 2.2]) {
    const { m, events, t } = climbRotated(ang);
    assert.ok(events.has('wall') || events.has('hang'), `engancha (${(ang * 57.3).toFixed(0)}°): ${[...events]}`);
    assert.ok(t !== null, `llega arriba (${(ang * 57.3).toFixed(0)}°), y = ${m.position.y.toFixed(2)}`);
    assert.ok(near(m.position.y, 8, 1e-6));
  }
});
