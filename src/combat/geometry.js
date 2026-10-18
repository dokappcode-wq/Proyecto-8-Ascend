/**
 * Geometría de impacto contra personajes (sin Three.js).
 * Los personajes se aproximan como cilindros verticales.
 */

/**
 * Rayo contra cilindro vertical con tapas.
 * @param {{x,y,z}} o origen
 * @param {{x,y,z}} d dirección normalizada
 * @param {{x,y,z}} base centro de la base (pies)
 * @param {number} r radio
 * @param {number} h altura
 * @param {number} maxT distancia máxima
 * @returns {number|null} distancia al impacto o null
 */
export function rayVerticalCylinder(o, d, base, r, h, maxT) {
  const ox = o.x - base.x;
  const oz = o.z - base.z;
  const y0 = base.y;
  const y1 = base.y + h;
  let best = null;
  const consider = (t) => {
    if (t >= 0 && t <= maxT && (best === null || t < best)) best = t;
  };

  // Origen dentro del cilindro
  if (ox * ox + oz * oz <= r * r && o.y >= y0 && o.y <= y1) return 0;

  // Superficie lateral
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9) {
    const b = 2 * (ox * d.x + oz * d.z);
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) consider(t);
      }
    }
  }
  // Tapas
  if (Math.abs(d.y) > 1e-9) {
    for (const yc of [y0, y1]) {
      const t = (yc - o.y) / d.y;
      const x = ox + d.x * t;
      const z = oz + d.z * t;
      if (x * x + z * z <= r * r) consider(t);
    }
  }
  return best;
}
