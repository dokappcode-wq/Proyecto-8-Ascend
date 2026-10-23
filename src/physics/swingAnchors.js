/**
 * Selección de puntos de enganche para el balanceo (sin Three.js; se prueba
 * con node:test).
 *
 * Se lanzan rayos en un abanico alrededor de la dirección de la cámara. Un
 * rayo válido choca primero con una superficie (eso ya garantiza línea de
 * visión: nada tapa el punto), está a una distancia permitida, a una altura
 * suficiente por encima de los pies y dentro del ángulo de la vista. Entre los
 * válidos gana el de mejor puntuación; un punto que ya está en uso recibe un
 * bonus para no cambiar de objetivo por nada.
 *
 * Costo: ~45 rayos, solo al engancharse o al re-enganchar (nunca cada fotograma).
 */

export const SWING_ANCHOR_CONFIG = Object.freeze({
  /** Distancia máxima y mínima del enganche (m). */
  range: 30,
  minRange: 4,
  /** Altura mínima del punto sobre los pies (m): nada que esté a ras de suelo. */
  minHeight: 3,
  /** Altura ideal sobre los pies: más alto que esto, cada metro penaliza un poco. */
  idealHeight: 10,
  /** Distancia ideal (m): el punto que mejor se alcanza con un balanceo normal. */
  idealRange: 16,
  /** Ángulo máximo entre la cámara y el punto (grados). */
  maxViewAngle: 55,
  /** Elevaciones (grados) y desplazamientos laterales (grados) del abanico. */
  elevations: [18, 32, 46, 60, 74],
  yawOffsets: [0, 14, -14, 28, -28, 42, -42, 56, -56],
  /** Pesos de la puntuación (menor es mejor). */
  wDist: 1,
  wHeight: 0.6,
  wView: 2.5,
  wMove: 1.2,
  /** Bonus para el punto que ya se usa (evita parpadeos entre objetivos). */
  stick: 1.2,
  stickRadius: 1.5,
  /** Etiquetas que no son enganchables (límites, barreras de la Defensa, etc.). */
  ignoreTags: ['bounds', 'barrier', 'water'],
  // --- Anclaje direccional (como en Marvel's Spider-Man) ---
  /** Distancia por delante del jugador: base y extra por cada m/s de velocidad (m). */
  aheadMin: 11,
  aheadPerSpeed: 0.45,
  aheadMax: 24,
  /** Altura ideal del anclaje sobre el jugador y mínima aceptable (m). */
  riseIdeal: 17,
  riseMin: 6,
  /** Radio en el que tiene que haber estructuras a esa altura (m) y margen sobre su cima. */
  structRadius: 30,
  structSlack: 3,
});

const DEG = Math.PI / 180;

/**
 * @param {object} world CollisionWorld (raycastHit)
 * @param {{x,y,z}} origin punto de salida del hilo (mano)
 * @param {object} o {
 *   feetY: altura de los pies,
 *   view: {x,y,z} dirección de la cámara (unitaria),
 *   move: {x,z} dirección horizontal del movimiento (puede ser null),
 *   prev: {x,y,z} anclaje en uso (para el bonus de permanencia) o null,
 *   cfg: configuración (SWING_ANCHOR_CONFIG por defecto)
 * }
 * @returns {{x,y,z,score,dist} | null}
 */
export function findSwingAnchor(world, origin, o) {
  const cfg = o.cfg ?? SWING_ANCHOR_CONFIG;
  const view = o.view;
  const vh = Math.hypot(view.x, view.z) || 1;
  const baseYaw = Math.atan2(view.x / vh, view.z / vh);
  const hitOpts = { ignoreTags: cfg.ignoreTags };
  let best = null;
  for (const el of cfg.elevations) {
    const e = el * DEG;
    for (const off of cfg.yawOffsets) {
      const yaw = baseYaw + off * DEG;
      const dx = Math.sin(yaw) * Math.cos(e);
      const dy = Math.sin(e);
      const dz = Math.cos(yaw) * Math.cos(e);
      // Ángulo respecto a la vista: lo que queda fuera del cono no se considera
      const cosV = dx * view.x + dy * view.y + dz * view.z;
      if (cosV < Math.cos(cfg.maxViewAngle * DEG)) continue;
      const hit = world.raycastHit(origin, { x: dx, y: dy, z: dz }, cfg.range, hitOpts);
      if (!hit || hit.t < cfg.minRange) continue;
      const px = origin.x + dx * hit.t;
      const py = origin.y + dy * hit.t;
      const pz = origin.z + dz * hit.t;
      const height = py - o.feetY;
      if (height < cfg.minHeight) continue;
      // Puntuación
      const dist = hit.t;
      let score = cfg.wDist * Math.abs(dist - cfg.idealRange) / cfg.range;
      score += cfg.wHeight * Math.abs(height - cfg.idealHeight) / cfg.idealHeight;
      score += cfg.wView * (1 - cosV);
      if (o.move) {
        const hx = px - origin.x;
        const hz = pz - origin.z;
        const hl = Math.hypot(hx, hz) || 1;
        const ml = Math.hypot(o.move.x, o.move.z) || 1;
        const align = (hx * o.move.x + hz * o.move.z) / (hl * ml); // −1..1
        score += cfg.wMove * (1 - align) / 2;
      }
      if (o.prev && Math.hypot(px - o.prev.x, py - o.prev.y, pz - o.prev.z) < cfg.stickRadius) score -= cfg.stick;
      if (!best || score < best.score) best = { x: px, y: py, z: pz, score, dist };
    }
  }
  return best;
}

/**
 * ¿Sigue habiendo línea libre hasta el anclaje? (comprobación barata durante
 * el balanceo: un único rayo).
 */
export function anchorVisible(world, origin, anchor, cfg = SWING_ANCHOR_CONFIG) {
  const dx = anchor.x - origin.x;
  const dy = anchor.y - origin.y;
  const dz = anchor.z - origin.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.5) return true;
  const hit = world.raycastHit(origin, { x: dx / d, y: dy / d, z: dz / d }, d - 0.3, { ignoreTags: cfg.ignoreTags });
  return !hit;
}

/**
 * Anclaje direccional: el punto no es una pared que se ve, sino un punto
 * delante y arriba del jugador en la dirección en la que quiere ir (como en
 * Marvel's Spider-Man). Así el péndulo le lleva hacia delante por la calle y
 * no hacia los edificios. Los edificios solo deciden si se puede: tiene que
 * haber estructuras cerca con altura suficiente (el anclaje no pasa de su
 * cima + `structSlack`), el punto no puede quedar dentro de un edificio y el
 * hilo no puede atravesar ninguno.
 *
 * @param {object} world CollisionWorld
 * @param {{x,y,z}} origin punto de salida del hilo (mano)
 * @param {object} o { feetY, dir: {x,z} dirección deseada (horizontal), speed (m/s), cfg }
 * @returns {{x,y,z,virtual:true} | null}
 */
export function directionalAnchor(world, origin, o) {
  const cfg = o.cfg ?? SWING_ANCHOR_CONFIG;
  const dl = Math.hypot(o.dir.x, o.dir.z);
  if (dl < 1e-6) return null;
  const dx = o.dir.x / dl;
  const dz = o.dir.z / dl;
  const ahead = Math.min(cfg.aheadMax, cfg.aheadMin + cfg.aheadPerSpeed * (o.speed ?? 0));
  for (const k of [1, 0.75, 0.5]) {
    const ax = origin.x + dx * ahead * k;
    const az = origin.z + dz * ahead * k;
    // Altura de las estructuras alrededor del punto: el hilo necesita dónde agarrarse
    const top = world.groundHeight(ax, az, cfg.structRadius, origin.y + 400);
    if (!Number.isFinite(top)) continue;
    const ay = Math.min(o.feetY + cfg.riseIdeal, top + cfg.structSlack);
    if (ay < o.feetY + cfg.riseMin) continue;
    // Dentro de un edificio no vale
    if (world.groundHeight(ax, az, 0.5, ay + 400) > ay - 0.5) continue;
    // El hilo no puede atravesar nada
    const vx = ax - origin.x;
    const vy = ay - origin.y;
    const vz = az - origin.z;
    const d = Math.hypot(vx, vy, vz);
    if (world.raycastHit(origin, { x: vx / d, y: vy / d, z: vz / d }, d - 0.3, { ignoreTags: cfg.ignoreTags })) continue;
    return { x: ax, y: ay, z: az, virtual: true };
  }
  return null;
}
