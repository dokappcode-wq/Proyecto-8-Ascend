/**
 * Sigilo (cálculos puros): cuánto «ve» un guardia al jugador por segundo.
 * Una detección confirmada (medidor a 1) reinicia desde el punto de control.
 */

export const STEALTH = Object.freeze({
  /** Detección por segundo a quemarropa dentro del cono. */
  baseRate: 2.4,
  /** Agachado se le ve un 55 % menos y a menos distancia. */
  crouchMul: 0.45,
  crouchRange: 0.65,
  /** Iluminado por un foco: se le ve mucho antes. */
  litMul: 2.2,
  /** Cerca y por detrás, el guardia le oye (salvo agachado). */
  hearRange: 2.2,
  hearRate: 0.9,
  /** Al dejar de verle, el medidor baja. */
  decay: 0.45,
});

/**
 * @param {object} o
 * @param {number} o.dist distancia horizontal guardia → jugador (m)
 * @param {number} o.angle ángulo entre la mirada del guardia y el jugador (rad)
 * @param {number} o.range alcance de la vista (m)
 * @param {number} o.fov semiángulo del cono (rad)
 * @param {boolean} o.los ¿hay línea de visión?
 * @param {boolean} [o.crouched]
 * @param {boolean} [o.lit] ¿está dentro de la luz de un foco?
 * @returns {number} detección por segundo (0 = no le ve ni le oye)
 */
export function detectionRate({ dist, angle, range, fov, los, crouched = false, lit = false }) {
  const S = STEALTH;
  let rate = 0;
  const effRange = range * (crouched ? S.crouchRange : 1) * (lit ? 1.25 : 1);
  if (los && dist <= effRange && Math.abs(angle) <= fov) {
    // Más rápido cuanto más cerca y más centrado en el cono
    const near = 1 - dist / effRange;
    const center = 1 - (Math.abs(angle) / fov) * 0.5;
    rate = S.baseRate * (0.25 + 0.75 * near) * center;
    if (crouched) rate *= S.crouchMul;
    if (lit) rate *= S.litMul;
  }
  if (!crouched && dist <= S.hearRange) rate = Math.max(rate, S.hearRate);
  return rate;
}

/** Avanza el medidor de detección (0..1). */
export function stepMeter(meter, rate, dt) {
  const v = rate > 0 ? meter + rate * dt : meter - STEALTH.decay * dt;
  return Math.max(0, Math.min(1, v));
}
