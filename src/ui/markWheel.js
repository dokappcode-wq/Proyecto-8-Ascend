/**
 * Rueda de marcas: elección por dirección del ratón (pura, sin DOM).
 * El primer sector está arriba y siguen en el sentido de las agujas del reloj.
 *
 * @param {number} dx desplazamiento acumulado del ratón (derecha +)
 * @param {number} dy desplazamiento acumulado del ratón (abajo +)
 * @param {number} n número de sectores
 * @param {number} dead radio muerto (sin elección)
 * @returns {number} índice del sector o -1
 */
export function wheelPick(dx, dy, n, dead = 30) {
  if (n <= 0 || Math.hypot(dx, dy) < dead) return -1;
  // Ángulo desde arriba, en sentido horario
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  const step = (Math.PI * 2) / n;
  return Math.floor((a + step / 2) / step) % n;
}

/** Limita el vector acumulado a un radio máximo (para que volver atrás sea rápido). */
export function clampWheel(v, max = 140) {
  const l = Math.hypot(v.x, v.y);
  if (l > max) {
    v.x *= max / l;
    v.y *= max / l;
  }
  return v;
}
