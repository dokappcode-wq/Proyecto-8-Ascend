/**
 * Coberturas: detección de muros cercanos, comprobación de bordes y punto
 * desde el que asomarse. Sin Three.js (usa CollisionWorld).
 *
 * Una cobertura se describe con la normal del muro (apunta hacia el
 * jugador) y su altura sobre los pies:
 *  - baja (< 1.55 m): al apuntar el personaje se levanta y dispara por encima.
 *  - alta: al apuntar se asoma por el lateral más cercano (si hay borde).
 */

export const COVER = Object.freeze({
  maxDistance: 1.0, // distancia máxima al muro para ponerse a cubierto
  minHeight: 0.8, // por debajo no protege
  highHeight: 1.55,
  probeHeight: 0.55, // altura de los rayos de detección (agachado)
  peekHeight: 1.3, // altura a la que se busca el borde de un muro alto
  peekSearch: 1.8, // distancia lateral máxima para encontrar el borde
});

const IGNORE = ['bounds', 'target', 'prop', 'npc', 'dummy'];

/** Busca el muro más cercano alrededor de `pos` (pies). */
export function findCover(world, pos, radius) {
  let best = null;
  const o = { x: pos.x, y: pos.y + COVER.probeHeight, z: pos.z };
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const d = { x: Math.sin(a), y: 0, z: Math.cos(a) };
    const hit = world.raycastHit(o, d, radius + COVER.maxDistance, { ignoreTags: IGNORE });
    if (!hit || hit.collider.kind !== 'box' || Math.abs(hit.normal.y) > 0.2) continue;
    if (!best || hit.t < best.t) best = { t: hit.t, hit };
  }
  if (!best) return null;
  const c = best.hit.collider;
  const height = c.maxY - pos.y;
  if (height < COVER.minHeight) return null;
  const n = best.hit.normal;
  const l = Math.hypot(n.x, n.z) || 1;
  return { nx: n.x / l, nz: n.z / l, height, high: height >= COVER.highHeight, distance: best.t };
}

/** ¿Hay muro detrás (en dirección -normal) a la altura indicada? */
export function wallBehind(world, pos, cover, radius, height = COVER.probeHeight) {
  const o = { x: pos.x, y: pos.y + height, z: pos.z };
  const hit = world.raycastHit(o, { x: -cover.nx, y: 0, z: -cover.nz }, radius + 0.6, { ignoreTags: IGNORE });
  return !!hit;
}

/**
 * Punto desde el que asomarse por el lateral de un muro alto: primera
 * posición, a cada lado, donde ya no hay muro a la altura de los ojos.
 * Devuelve { x, z, side } o null.
 */
export function findPeek(world, pos, cover, radius) {
  const tx = -cover.nz;
  const tz = cover.nx;
  let best = null;
  for (const side of [-1, 1]) {
    for (let d = 0.3; d <= COVER.peekSearch + 1e-6; d += 0.3) {
      const p = { x: pos.x + tx * side * d, y: pos.y, z: pos.z + tz * side * d };
      if (!wallBehind(world, p, cover, radius, COVER.peekHeight)) {
        const peek = { x: p.x + tx * side * radius * 0.5, z: p.z + tz * side * radius * 0.5, side, d };
        if (!best || d < best.d) best = peek;
        break;
      }
    }
  }
  return best;
}
