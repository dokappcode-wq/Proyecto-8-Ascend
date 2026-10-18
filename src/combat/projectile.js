/**
 * Simulación de proyectiles (sin Three.js).
 *
 * Un proyectil avanza en línea recta y comprueba con un rayo el tramo
 * recorrido en cada paso, por lo que no atraviesa paredes finas aunque
 * sea muy rápido.
 */

/**
 * @typedef {object} ProjectileState
 * @property {{x,y,z}} pos
 * @property {{x,y,z}} dir   normalizado
 * @property {number} speed
 * @property {number} range
 * @property {number} traveled
 */

/**
 * Avanza un proyectil `dt` segundos.
 * @returns {{ type:'hit', point, normal, collider } | { type:'expired', point } | null}
 */
export function stepProjectile(p, dt, world) {
  const remaining = p.range - p.traveled;
  const step = Math.min(p.speed * dt, remaining);
  if (step <= 0) return { type: 'expired', point: { ...p.pos } };
  const hit = world.raycastHit(p.pos, p.dir, step, { ignoreTags: ['bounds'] });
  if (hit) {
    const point = { x: p.pos.x + p.dir.x * hit.t, y: p.pos.y + p.dir.y * hit.t, z: p.pos.z + p.dir.z * hit.t };
    p.pos = point;
    p.traveled += hit.t;
    return { type: 'hit', point, normal: hit.normal, collider: hit.collider };
  }
  p.pos = { x: p.pos.x + p.dir.x * step, y: p.pos.y + p.dir.y * step, z: p.pos.z + p.dir.z * step };
  p.traveled += step;
  if (p.traveled >= p.range - 1e-6) return { type: 'expired', point: { ...p.pos } };
  return null;
}
