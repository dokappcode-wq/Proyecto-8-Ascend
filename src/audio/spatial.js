/**
 * Cálculo de volumen y panorámica de un sonido en el mundo respecto al
 * oyente (la cámara). Sin Web Audio, para poder probarlo con node:test.
 */

export const SPATIAL = Object.freeze({
  refDistance: 4, // hasta aquí, volumen completo
  maxDistance: 60, // a partir de aquí no se oye
  rolloff: 1.3,
});

/**
 * @param {{x,y,z,yaw}} listener posición y orientación (yaw de la cámara: 0 = mirando a -Z)
 * @param {{x,y,z}} pos posición del sonido
 * @returns {{ gain: number, pan: number, distance: number }} gain 0..1, pan -1 (izq.) .. 1 (der.)
 */
export function spatialize(listener, pos, cfg = SPATIAL) {
  const dx = pos.x - listener.x;
  const dy = pos.y - listener.y;
  const dz = pos.z - listener.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= cfg.maxDistance) return { gain: 0, pan: 0, distance };
  let gain = distance <= cfg.refDistance ? 1 : cfg.refDistance / (cfg.refDistance + cfg.rolloff * (distance - cfg.refDistance));
  // Atenuación suave hasta 0 en la distancia máxima
  const edge = Math.min(1, (cfg.maxDistance - distance) / (cfg.maxDistance * 0.25));
  gain *= edge;
  // Vector derecha de la cámara: (cos yaw, 0, -sin yaw)
  const h = Math.hypot(dx, dz);
  const pan = h < 1e-3 ? 0 : Math.max(-1, Math.min(1, (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / h));
  return { gain, pan: pan * 0.85, distance };
}
