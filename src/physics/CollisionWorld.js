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
 *  - Heightfield: terreno con relieve (rejilla de alturas). Cuestas,
 *          laderas y orillas; lo que es demasiado empinado hace de muro.
 */

const EPS = 1e-6;
/** Pendiente máxima del terreno que se sube andando (tan 50°). */
export const MAX_SLOPE = 1.2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.ramps = [];
    this.heightfields = [];
  }

  clear() {
    this.boxes.length = 0;
    this.ramps.length = 0;
    this.heightfields.length = 0;
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
      // Entidad propietaria (diana, objeto físico, enemigo…) para atribuir impactos.
      owner: opts.owner ?? null,
      // false: no se puede escalar (barandillas, límites…)
      climbable: opts.climbable ?? true,
      enabled: true,
    };
    this.boxes.push(box);
    return box;
  }

  /** Recoloca una caja existente (objetos dinámicos). */
  setBox(box, min, max) {
    box.minX = min.x;
    box.minY = min.y;
    box.minZ = min.z;
    box.maxX = max.x;
    box.maxY = max.y;
    box.maxZ = max.z;
  }

  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
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
   * Terreno con relieve: `cols` × `rows` alturas (fila a fila, x primero)
   * separadas `cell` metros desde (minX, minZ). Cada celda son dos
   * triángulos con la diagonal (0,0)–(1,1), igual que la malla visible.
   */
  addHeightfield({ minX, minZ, cell, cols, rows, heights, tag }) {
    if (cols < 2 || rows < 2 || heights.length < cols * rows) throw new Error('Rejilla de alturas incompleta');
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < cols * rows; i++) {
      lo = Math.min(lo, heights[i]);
      hi = Math.max(hi, heights[i]);
    }
    const hf = {
      kind: 'heightfield', minX, minZ, cell, cols, rows, heights,
      maxX: minX + cell * (cols - 1), maxZ: minZ + cell * (rows - 1), minY: lo, maxY: hi, tag: tag ?? null,
    };
    this.heightfields.push(hf);
    return hf;
  }

  /** Altura del terreno en (x, z), o -Infinity fuera de la rejilla. */
  heightfieldAt(hf, x, z) {
    const fx = (x - hf.minX) / hf.cell;
    const fz = (z - hf.minZ) / hf.cell;
    if (fx < 0 || fz < 0 || fx > hf.cols - 1 || fz > hf.rows - 1) return -Infinity;
    const ix = Math.min(hf.cols - 2, Math.floor(fx));
    const iz = Math.min(hf.rows - 2, Math.floor(fz));
    const tx = fx - ix;
    const tz = fz - iz;
    const H = hf.heights;
    const i00 = iz * hf.cols + ix;
    const h00 = H[i00];
    const h10 = H[i00 + 1];
    const h01 = H[i00 + hf.cols];
    const h11 = H[i00 + hf.cols + 1];
    return tx >= tz ? h00 + tx * (h10 - h00) + tz * (h11 - h10) : h00 + tz * (h01 - h00) + tx * (h11 - h01);
  }

  /** Altura del terreno más alto en (x, z) (-Infinity si no hay). */
  terrainHeight(x, z) {
    let best = -Infinity;
    for (const hf of this.heightfields) {
      const h = this.heightfieldAt(hf, x, z);
      if (h > best) best = h;
    }
    return best;
  }

  /**
   * Superficie más alta bajo un círculo (x, z, radius) cuya cima no supere `maxY`.
   * Devuelve -Infinity si no hay suelo.
   */
  groundHeight(x, z, radius, maxY) {
    let best = -Infinity;
    const r2 = radius * radius;
    for (const b of this.boxes) {
      if (!b.enabled || b.maxY > maxY || b.maxY <= best) continue;
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
    for (const hf of this.heightfields) {
      const h = this.heightfieldAt(hf, x, z);
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
      if (!b.enabled || b.minY < minY || b.minY >= best) continue;
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
      if (!b.enabled || b.maxY <= stepTop || b.minY >= head) continue;
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

    // Terreno: las cuestas se suben andando, pero lo que es más empinado que
    // MAX_SLOPE hace de muro (se empuja cuesta abajo, sin ir subiendo a escalones).
    for (const hf of this.heightfields) {
      if (hf.maxY <= feetY) continue;
      for (let i = 0; i < 6; i++) {
        const h = this.heightfieldAt(hf, pos.x, pos.z);
        // Por debajo de los pies no estorba; muy por encima de la cabeza es el techo de una cueva
        if (h <= feetY + 0.02 || h > head + 0.5) break;
        const e = hf.cell * 0.25;
        const gx = (this.heightfieldAt(hf, pos.x + e, pos.z) - this.heightfieldAt(hf, pos.x - e, pos.z)) / (2 * e);
        const gz = (this.heightfieldAt(hf, pos.x, pos.z + e) - this.heightfieldAt(hf, pos.x, pos.z - e)) / (2 * e);
        const g = Math.hypot(gx, gz);
        if (!Number.isFinite(g) || g < EPS || (g <= MAX_SLOPE && h <= stepTop)) break;
        const push = Math.min(0.5, (h - feetY) / g + 0.01);
        pos.x -= (gx / g) * push;
        pos.z -= (gz / g) * push;
        if (i === 0) contacts++;
      }
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
   * @param {object} [opts] ver raycastHit
   */
  raycast(origin, dir, maxDist, opts = {}) {
    return this.raycastHit(origin, dir, maxDist, opts)?.t ?? Infinity;
  }

  /**
   * Rayo con información del impacto.
   * @param {object} [opts] {
   *   cameraOnly: ignora cajas con cameraBlocking=false,
   *   ignoreTags: array de etiquetas a ignorar (p. ej. ['bounds']),
   *   ignore: colisionador a ignorar }
   * @returns {{ t:number, collider:object, normal:{x,y,z} } | null}
   */
  raycastHit(origin, dir, maxDist, opts = {}) {
    let best = maxDist;
    let hit = null;
    const out = { t: 0, axis: 0 };
    for (const b of this.boxes) {
      if (!b.enabled || b === opts.ignore) continue;
      if (opts.cameraOnly && !b.cameraBlocking) continue;
      if (opts.ignoreTags && b.tag && opts.ignoreTags.includes(b.tag)) continue;
      if (rayAabb(origin, dir, b, best, out) && out.t < best) {
        best = out.t;
        const n = { x: 0, y: 0, z: 0 };
        if (out.axis < 0) {
          n.x = -dir.x;
          n.y = -dir.y;
          n.z = -dir.z;
        } else {
          const key = 'xyz'[out.axis];
          n[key] = dir[key] > 0 ? -1 : 1;
        }
        hit = { t: best, collider: b, normal: n };
      }
    }
    for (const r of this.ramps) {
      if (opts.ignoreTags && r.tag && opts.ignoreTags.includes(r.tag)) continue;
      const t = rayRampSurface(this, origin, dir, r, best);
      if (t !== null && t < best) {
        best = t;
        const lo = r.axis === 'x' ? r.minX : r.minZ;
        const hi = r.axis === 'x' ? r.maxX : r.maxZ;
        const k = (r.y1 - r.y0) / Math.max(hi - lo, EPS);
        const n = r.axis === 'x' ? { x: -k, y: 1, z: 0 } : { x: 0, y: 1, z: -k };
        const l = Math.hypot(n.x, n.y, n.z);
        n.x /= l;
        n.y /= l;
        n.z /= l;
        if (n.x * dir.x + n.y * dir.y + n.z * dir.z > 0) {
          n.x = -n.x;
          n.y = -n.y;
          n.z = -n.z;
        }
        hit = { t: best, collider: r, normal: n };
      }
    }
    for (const hf of this.heightfields) {
      if (opts.ignoreTags && hf.tag && opts.ignoreTags.includes(hf.tag)) continue;
      const t = rayHeightfield(this, origin, dir, hf, best);
      if (t !== null && t < best) {
        best = t;
        const x = origin.x + dir.x * t;
        const z = origin.z + dir.z * t;
        const e = hf.cell * 0.25;
        const gx = (this.heightfieldAt(hf, x + e, z) - this.heightfieldAt(hf, x - e, z)) / (2 * e);
        const gz = (this.heightfieldAt(hf, x, z + e) - this.heightfieldAt(hf, x, z - e)) / (2 * e);
        const l = Math.hypot(gx, 1, gz) || 1;
        hit = { t: best, collider: hf, normal: { x: -gx / l, y: 1 / l, z: -gz / l } };
      }
    }
    return hit;
  }
}

/**
 * Rayo contra el terreno: avance a pasos de media celda hasta quedar por
 * debajo de la superficie y bisección para afinar el punto de impacto.
 */
function rayHeightfield(world, o, d, hf, maxT) {
  const below = (t) => {
    const h = world.heightfieldAt(hf, o.x + d.x * t, o.z + d.z * t);
    return h !== -Infinity && o.y + d.y * t < h;
  };
  if (below(0)) return null;
  const step = hf.cell * 0.5;
  let prev = 0;
  for (let t = step; prev < maxT; t += step) {
    const tt = Math.min(t, maxT);
    if (o.y + d.y * tt > hf.maxY && d.y >= 0) return null;
    if (below(tt)) {
      let a = prev;
      let b = tt;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2;
        if (below(m)) b = m;
        else a = m;
      }
      return a;
    }
    prev = tt;
  }
  return null;
}

/** Rayo contra AABB (método de slabs). Escribe en `out` { t, axis } (axis -1 si empieza dentro). */
function rayAabb(o, d, b, maxT, out) {
  let tmin = 0;
  let tmax = maxT;
  let axis = -1;
  const os = [o.x, o.y, o.z];
  const ds = [d.x, d.y, d.z];
  const los = [b.minX, b.minY, b.minZ];
  const his = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    const oa = os[i];
    const da = ds[i];
    if (Math.abs(da) < EPS) {
      if (oa < los[i] || oa > his[i]) return false;
      continue;
    }
    let t1 = (los[i] - oa) / da;
    let t2 = (his[i] - oa) / da;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) {
      tmin = t1;
      axis = i;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  out.t = tmin;
  out.axis = axis;
  return true;
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
