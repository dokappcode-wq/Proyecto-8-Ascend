import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { GRAVITY_CONFIG } from '../../src/powers/gravity/gravityConfig.js';

/** Generador pseudoaleatorio reproducible. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Mundo aleatorio: suelo, cajas de distintas alturas, muros, plataformas elevadas y rampas. */
function randomWorld(r) {
  const w = new CollisionWorld();
  w.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
  for (const [x, z, ww, d] of [[0, -40, 80, 1], [0, 40, 80, 1], [-40, 0, 1, 80], [40, 0, 1, 80]]) {
    w.addBox({ x: x - ww / 2, y: -5, z: z - d / 2 }, { x: x + ww / 2, y: 60, z: z + d / 2 }, { tag: 'bounds' });
  }
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 70;
    const z = (r() - 0.5) * 70;
    const sx = 0.3 + r() * 6;
    const sz = 0.3 + r() * 6;
    const y = r() < 0.2 ? 1 + r() * 4 : 0;
    const h = r() < 0.5 ? 0.2 + r() * 1.5 : 1 + r() * 12;
    w.addBox({ x, y, z }, { x: x + sx, y: y + h, z: z + sz });
  }
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 60;
    const z = (r() - 0.5) * 60;
    w.addRamp({ minX: x, maxX: x + 3, minZ: z, maxZ: z + 6, axis: 'z', y0: 0, y1: 1 + r() * 3 });
  }
  return w;
}

/** ¿El cuerpo está metido dentro de una caja (más allá de una tolerancia)? */
function penetration(w, m) {
  const p = m.position;
  const r = m.cfg.radius * 0.8;
  for (const b of w.boxes) {
    if (!b.enabled || b.tag === 'bounds') continue;
    const insideY = p.y + 0.5 > b.minY + 0.05 && p.y + 0.5 < b.maxY - 0.05;
    if (!insideY) continue;
    if (p.x > b.minX + r && p.x < b.maxX - r && p.z > b.minZ + r && p.z < b.maxZ - r) return b;
  }
  return null;
}

test('estrés del motor: entradas aleatorias en mundos aleatorios sin atravesar geometría ni valores no finitos', () => {
  const DT = 1 / 60;
  let steps = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const r = rng(seed * 7919);
    const w = randomWorld(r);
    const m = new CharacterMotor(w, { parkour: true });
    // La mitad de los mundos con los saltos de Gravedad (triple salto y planeo)
    if (seed % 2) m.jumpAbilities = GRAVITY_CONFIG.jumps;
    m.setSpawn({ x: 0, y: 30, z: 0 });
    m.respawn();
    let input = {};
    for (let i = 0; i < 3000; i++) {
      if (i % 20 === 0) {
        const a = r() * Math.PI * 2;
        const mv = r() < 0.85;
        input = {
          moveX: mv ? Math.cos(a) : 0, moveZ: mv ? Math.sin(a) : 0, sprint: r() < 0.5,
          jump: r() < 0.3, jumpHeld: r() < 0.4, dodge: r() < 0.08, drop: r() < 0.05, noParkour: r() < 0.1,
        };
        if (r() < 0.05) m.startBurst({ x: Math.cos(a), z: Math.sin(a), speed: 30, duration: 0.2 });
        if (r() < 0.03) m.startTravel({ x: (r() - 0.5) * 60, y: r() * 10, z: (r() - 0.5) * 60 });
        if (r() < 0.03) m.startDive();
        if (r() < 0.05) m.setCrouch(!m.crouched);
      } else {
        input = { ...input, jump: false, dodge: false, drop: false };
      }
      // Pasos de duración variable (frames lentos)
      m.update(r() < 0.1 ? 0.1 : DT, input);
      steps++;
      const p = m.position;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `semilla ${seed}, paso ${i}: posición no finita`);
      assert.ok(p.y > -41, `semilla ${seed}, paso ${i}: por debajo del límite (${p.y})`);
      assert.ok(Math.abs(p.x) < 40 && Math.abs(p.z) < 40, `semilla ${seed}, paso ${i}: fuera de los límites (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
      const b = penetration(w, m);
      assert.equal(b, null, b && `semilla ${seed}, paso ${i}: dentro de una caja en (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) estado ${m.climbState}`);
    }
  }
  assert.equal(steps, 12 * 3000);
});
