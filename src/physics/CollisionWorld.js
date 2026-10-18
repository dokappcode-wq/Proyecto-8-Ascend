/**
 * CollisionWorld — geometría de colisión estática del mapa.
 *
 * Independiente de Three.js (solo usa objetos {x, y, z}) para poder probarse
 * con node:test sin navegador.
 *
 * Tipos de colisionador:
 *  - Box:  caja alineada con los ejes (AABB). Muros, plataformas, edificios.
 *  - Ramp: cuña sólida con superficie inclinada a lo largo de un eje.
 *          Rampas y tramos de escalera (la escalera visual usa una rampa
 *          como colisión para que el desplazamiento sea suave).
 */

const EPS = 1e-6;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.ramps = [];
  }

  clear() {
    this.boxes.length = 0;
    this.ramps.length = 0;
  }

  /**
   * @param {{x:number,y:number,z:number}} min
   * @param {{x:number,y:number,z:number}} max
   * @param {object} [opts] { tag, cameraBlocking (por defecto true) }
   */
  addBox(min, max, opts = {}) {
    const box = {
      kind: 'box',
      minX: Math.min(min.x, max.x),
      minY: Math.min(min.y, max.y),
      minZ: Math.min(min.z, max.z),
      maxX: Math.max(min.x, max.x),
      maxY: Math.max(min.y, max.y),
      maxZ: Math.max(min.z, max.z),
      tag: opts.tag ?? null,
      cameraBlocking: opts.cameraBlocking ?? true,
    };
    this.boxes.push(box);
    return box;
  }

  /**
   * Rampa sólida. La altura de la superficie varía linealmente a lo largo de
   * `axis` desde `y0` (en el mínimo del eje) hasta `y1` (en el máximo).
   * La base de la cuña está en `base` (por defecto min(y0, y1) - 0).
   */
  addRamp({ minX, maxX, minZ, maxZ, axis, y0, y1, base, tag }) {
    if (axis !== 'x' && axis !== 'z') throw new Error(`Eje de rampa no válido: ${axis}`);
    const ramp = {
      kind: 'ramp',
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      axis,
      y0,
      y1,
      minY: base ?? Math.min(y0, y1, 0),
      maxY: Math.max(y0, y1),
      tag: tag ?? null,
    };
    this.ramps.push(ramp);
    return ramp;
  }

  /** Altura de la superficie de la rampa en (x, z), con (x, z) limitado a su huella. */
  rampHeightAt(ramp, x, z) {
    if (ramp.axis === 'x') {
      const t = (clamp(x, ramp.minX, ramp.maxX) - ramp.minX) / Math.max(ramp.maxX - ramp.minX, EPS);
      return ramp.y0 + (ramp.y1 - ramp.y0) * t;
    }
    const t = (clamp(z, ramp.minZ, ramp.maxZ) - ramp.minZ) / Math.max(ramp.maxZ - ramp.minZ, EPS);
    return ramp.y0 + (ramp.y1 - ramp.y0) * t;
  }

  /**
   * Superficie más alta bajo un círculo (x, z, radius) cuya cima no supere `maxY`.
   * Devuelve -Infinity si no hay suelo.
   */
  groundHeight(x, z, radius, maxY) {
    let best = -Infinity;
    const r2 = radius * radius;
    for (const b of this.boxes) {
      if (b.maxY > maxY || b.maxY <= best) continue;
      const cx = clamp(x, b.minX, b.maxX);
      const cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r2) best = b.maxY;
    }
    for (const r of this.ramps) {
      const cx = clamp(x, r.minX, r.maxX);
      const cz = clamp(z, r.minZ, r.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz >= r2) continue;
      const h = this.rampHeightAt(r, cx, cz);
      if (h <= maxY && h > best) best = h;
    }
    return best;
  }

  /**
   * Techo más bajo sobre un círculo cuya base esté por encima de `minY`.
   * Devuelve Infinity si no hay techo.
   */
  ceilingHeight(x, z, radius, minY) {
    let best = Infinity;
    const r2 = radius * radius;
    for (const b of this.boxes) {
      if (b.minY < minY || b.minY >= best) continue;
      const cx = clamp(x, b.minX, b.maxX);
      const cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r2) best = b.minY;
    }
    // Parte inferior de rampas elevadas (p. ej. tramos de escalera exteriores).
    for (const r of this.ramps) {
      if (r.minY < minY || r.minY >= best) continue;
      const cx = clamp(x, r.minX, r.maxX);
      const cz = clamp(z, r.minZ, r.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r2) best = r.minY;
    }
    return best;
  }

  /**
   * Empuja horizontalmente un cilindro vertical (pies en feetY) fuera de los
   * colisionadores que no puede superar como escalón.
   * Modifica `pos` (x, z). Devuelve el número de contactos resueltos.
   */
  resolveHorizontal(pos, radius, feetY, height, stepHeight) {
    let contacts = 0;
    const stepTop = feetY + stepHeight;
    const head = feetY + height;

    for (const b of this.boxes) {
      if (b.maxY <= stepTop || b.minY >= head) continue;
      if (this._pushCircleOutOfRect(pos, radius, b)) contacts++;
    }

    for (const r of this.ramps) {
      if (r.minY >= head) continue;
      const cx = clamp(pos.x, r.minX, r.maxX);
      const cz = clamp(pos.z, r.minZ, r.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      if (dx * dx + dz * dz >= radius * radius) continue;
      // La rampa solo bloquea donde su superficie supera el escalón.
      if (this.rampHeightAt(r, cx, cz) <= stepTop) continue;
      if (this._pushCircleOutOfRect(pos, radius, r)) contacts++;
    }
    return contacts;
  }

  _pushCircleOutOfRect(pos, radius, rect) {
    const cx = clamp(pos.x, rect.minX, rect.maxX);
    const cz = clamp(pos.z, rect.minZ, rect.maxZ);
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) return false;

    if (d2 > EPS) {
      const d = Math.sqrt(d2);
      const push = radius - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
      return true;
    }

    // Centro dentro del rectángulo: salir por el lado de menor penetración.
    const left = pos.x - rect.minX;
    const right = rect.maxX - pos.x;
    const back = pos.z - rect.minZ;
    const front = rect.maxZ - pos.z;
    const m = Math.min(left, right, back, front);
    if (m === left) pos.x = rect.minX - radius;
    else if (m === right) pos.x = rect.maxX + radius;
    else if (m === back) pos.z = rect.minZ - radius;
    else pos.z = rect.maxZ + radius;
    return true;
  }

  /**
   * Rayo contra la geometría. Devuelve la distancia al primer impacto o
   * Infinity. `dir` debe estar normalizado.
   * @param {object} [opts] { cameraOnly: ignora cajas con cameraBlocking=false }
   */
  raycast(origin, dir, maxDist, opts = {}) {
    let best = maxDist;
    let hit = false;
    for (const b of this.boxes) {
      if (opts.cameraOnly && !b.cameraBlocking) continue;
      const t = rayAabb(origin, dir, b, best);
      if (t !== null && t < best) {
        best = t;
        hit = true;
      }
    }
    for (const r of this.ramps) {
      const t = rayRampSurface(this, origin, dir, r, best);
      if (t !== null && t < best) {
        best = t;
        hit = true;
      }
    }
    return hit ? best : Infinity;
  }
}

function rayAabb(o, d, b, maxT) {
  let tmin = 0;
  let tmax = maxT;
  const axes = [
    [o.x, d.x, b.minX, b.maxX],
    [o.y, d.y, b.minY, b.maxY],
    [o.z, d.z, b.minZ, b.maxZ],
  ];
  for (const [oa, da, lo, hi] of axes) {
    if (Math.abs(da) < EPS) {
      if (oa < lo || oa > hi) return null;
      continue;
    }
    let t1 = (lo - oa) / da;
    let t2 = (hi - oa) / da;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Intersección con el plano inclinado de la rampa (ignora las caras laterales). */
function rayRampSurface(world, o, d, r, maxT) {
  const along = r.axis === 'x' ? 'x' : 'z';
  const lo = r.axis === 'x' ? r.minX : r.minZ;
  const hi = r.axis === 'x' ? r.maxX : r.maxZ;
  const k = (r.y1 - r.y0) / Math.max(hi - lo, EPS);
  // y(t) = o.y + d.y t ; h(t) = y0 + k (o.a + d.a t - lo)
  const denom = d.y - k * d[along];
  if (Math.abs(denom) < EPS) return null;
  const t = (r.y0 + k * (o[along] - lo) - o.y) / denom;
  if (t < 0 || t > maxT) return null;
  const x = o.x + d.x * t;
  const z = o.z + d.z * t;
  if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return null;
  return t;
}
