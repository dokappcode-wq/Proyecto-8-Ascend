/**
 * ObbSet — miles de cajas orientadas estáticas (edificios de la ciudad,
 * tableros de puentes, barreras) con una rejilla espacial para las consultas.
 *
 * Independiente de Three.js, como CollisionWorld (se prueba con node:test).
 *
 * Cada caja tiene centro (cx, cz), eje u = (ux, uz) (el otro eje es
 * v = (-uz, ux)), semiejes hw (a lo largo de u) y hd (de v), base minY y
 * cima que va de y0 a y1 a lo largo de u: y0 = y1 es una cima plana; si son
 * distintas es un tramo en rampa (la subida a un puente).
 *
 * `group` (0 = siempre activa) permite apagar y encender conjuntos enteros
 * de cajas (las barreras de cada barrio) sin reconstruir la rejilla.
 *
 * Los impactos devuelven un colisionador (`collider(i)`) con la misma forma
 * que las cajas de CollisionWorld (kind 'box', minX…maxZ, maxY, tag,
 * climbable…) más los datos de la caja orientada (`obb: true`).
 */

const EPS = 1e-6;
const STRIDE = 9; // cx cz ux uz hw hd minY y0 y1

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Colisionador de una caja del conjunto (se crea al primer impacto y se reutiliza). */
class ObbCollider {
  constructor(set, i) {
    const f = set.f;
    const o = i * STRIDE;
    this.kind = 'box';
    this.obb = true;
    this.set = set;
    this.index = i;
    this.cx = f[o];
    this.cz = f[o + 1];
    this.ux = f[o + 2];
    this.uz = f[o + 3];
    this.hw = f[o + 4];
    this.hd = f[o + 5];
    this.minY = f[o + 6];
    this.y0 = f[o + 7];
    this.y1 = f[o + 8];
    this.maxY = Math.max(this.y0, this.y1);
    const ex = Math.abs(this.ux) * this.hw + Math.abs(this.uz) * this.hd;
    const ez = Math.abs(this.uz) * this.hw + Math.abs(this.ux) * this.hd;
    this.minX = this.cx - ex;
    this.maxX = this.cx + ex;
    this.minZ = this.cz - ez;
    this.maxZ = this.cz + ez;
    this.tag = set.tagNames[set.tag[i]] ?? null;
    this.climbable = set.climb[i] === 1;
    this.cameraBlocking = set.noCam[i] === 0;
    this.owner = null;
    this.group = set.group[i];
  }

  get enabled() {
    return this.set.groupOn[this.group] === 1;
  }
}

export class ObbSet {
  /** @param {object} [o] { cell: lado de la celda de la rejilla en metros } */
  constructor({ cell = 48 } = {}) {
    this.cell = cell;
    this.n = 0;
    this._cap = 0;
    this.f = new Float64Array(0);
    this.group = new Uint16Array(0);
    this.tag = new Uint8Array(0);
    this.climb = new Uint8Array(0);
    this.noCam = new Uint8Array(0);
    this.tagNames = [null];
    /** Grupos encendidos (1) o apagados (0). El 0 siempre está encendido. */
    this.groupOn = new Uint8Array(1024).fill(1);
    this._colliders = new Map();
    this._grid = null;
    this._stamp = new Uint32Array(0);
    this._query = 0;
    this._cand = new Uint32Array(256);
  }

  _grow(min) {
    const cap = Math.max(min, this._cap * 2, 64);
    const f = new Float64Array(cap * STRIDE);
    f.set(this.f);
    this.f = f;
    for (const k of ['group', 'tag', 'climb', 'noCam']) {
      const a = new this[k].constructor(cap);
      a.set(this[k]);
      this[k] = a;
    }
    this._cap = cap;
  }

  /**
   * Añade una caja. `angle`: giro del eje u desde +X hacia +Z (radianes).
   * @param {object} o { cx, cz, angle, hw, hd, minY, maxY | y0+y1, group, tag, climbable, cameraBlocking }
   * @returns {number} índice
   */
  add({ cx, cz, angle = 0, hw, hd, minY = 0, maxY, y0, y1, group = 0, tag = null, climbable = true, cameraBlocking = true }) {
    if (this.n >= this._cap) this._grow(this.n + 1);
    const i = this.n++;
    const o = i * STRIDE;
    const f = this.f;
    f[o] = cx;
    f[o + 1] = cz;
    f[o + 2] = Math.cos(angle);
    f[o + 3] = Math.sin(angle);
    f[o + 4] = hw;
    f[o + 5] = hd;
    f[o + 6] = minY;
    f[o + 7] = y0 ?? maxY;
    f[o + 8] = y1 ?? maxY;
    this.group[i] = group;
    let t = this.tagNames.indexOf(tag);
    if (t < 0) {
      t = this.tagNames.length;
      this.tagNames.push(tag);
    }
    this.tag[i] = t;
    this.climb[i] = climbable ? 1 : 0;
    this.noCam[i] = cameraBlocking ? 0 : 1;
    this._grid = null;
    return i;
  }

  /** Enciende o apaga un grupo de cajas. */
  setGroup(group, on) {
    if (group > 0) this.groupOn[group] = on ? 1 : 0;
  }

  collider(i) {
    let c = this._colliders.get(i);
    if (!c) {
      c = new ObbCollider(this, i);
      this._colliders.set(i, c);
    }
    return c;
  }

  /** Rejilla: para cada celda, las cajas cuya huella (AABB) la toca. */
  build() {
    const { n, f, cell } = this;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    const bb = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE;
      const ex = Math.abs(f[o + 2]) * f[o + 4] + Math.abs(f[o + 3]) * f[o + 5];
      const ez = Math.abs(f[o + 3]) * f[o + 4] + Math.abs(f[o + 2]) * f[o + 5];
      bb[i * 4] = f[o] - ex;
      bb[i * 4 + 1] = f[o] + ex;
      bb[i * 4 + 2] = f[o + 1] - ez;
      bb[i * 4 + 3] = f[o + 1] + ez;
      x0 = Math.min(x0, bb[i * 4]);
      x1 = Math.max(x1, bb[i * 4 + 1]);
      z0 = Math.min(z0, bb[i * 4 + 2]);
      z1 = Math.max(z1, bb[i * 4 + 3]);
    }
    if (!n) x0 = z0 = x1 = z1 = 0;
    const cols = Math.max(1, Math.ceil((x1 - x0) / cell) + 1);
    const rows = Math.max(1, Math.ceil((z1 - z0) / cell) + 1);
    const count = new Uint32Array(cols * rows + 1);
    const span = (i) => [
      Math.floor((bb[i * 4] - x0) / cell), Math.floor((bb[i * 4 + 1] - x0) / cell),
      Math.floor((bb[i * 4 + 2] - z0) / cell), Math.floor((bb[i * 4 + 3] - z0) / cell),
    ];
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = span(i);
      for (let r = c; r <= d; r++) for (let q = a; q <= b; q++) count[r * cols + q + 1]++;
    }
    for (let k = 1; k <= cols * rows; k++) count[k] += count[k - 1];
    const items = new Uint32Array(count[cols * rows]);
    const fill = count.slice(0, cols * rows);
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = span(i);
      for (let r = c; r <= d; r++) for (let q = a; q <= b; q++) items[fill[r * cols + q]++] = i;
    }
    this._grid = { x0, z0, cols, rows, start: count, items };
    this._stamp = new Uint32Array(n);
    this._query = 0;
    return this;
  }

  get grid() {
    return this._grid ?? this.build()._grid;
  }

  /** Cajas activas cuya celda toca el rectángulo; quedan en this._cand. */
  _gather(minX, maxX, minZ, maxZ) {
    const G = this.grid;
    const cs = this.cell;
    const a = Math.max(0, Math.floor((minX - G.x0) / cs));
    const b = Math.min(G.cols - 1, Math.floor((maxX - G.x0) / cs));
    const c = Math.max(0, Math.floor((minZ - G.z0) / cs));
    const d = Math.min(G.rows - 1, Math.floor((maxZ - G.z0) / cs));
    if (a > b || c > d) return 0;
    const q = this._nextQuery();
    let k = 0;
    for (let r = c; r <= d; r++) {
      for (let col = a; col <= b; col++) {
        const cell = r * G.cols + col;
        for (let j = G.start[cell]; j < G.start[cell + 1]; j++) {
          const i = G.items[j];
          if (this._stamp[i] === q || this.groupOn[this.group[i]] === 0) continue;
          this._stamp[i] = q;
          if (k >= this._cand.length) {
            const bigger = new Uint32Array(this._cand.length * 2);
            bigger.set(this._cand);
            this._cand = bigger;
          }
          this._cand[k++] = i;
        }
      }
    }
    return k;
  }

  _nextQuery() {
    this._query++;
    if (this._query >= 0xffffffff) {
      this._stamp.fill(0);
      this._query = 1;
    }
    return this._query;
  }

  /** Altura de la cima de la caja i en la coordenada local lu. */
  _top(o, lu) {
    const f = this.f;
    const y0 = f[o + 7];
    const y1 = f[o + 8];
    if (y0 === y1) return y0;
    const hw = f[o + 4];
    return y0 + ((y1 - y0) * (clamp(lu, -hw, hw) + hw)) / Math.max(2 * hw, EPS);
  }

  /** Igual que CollisionWorld.groundHeight, partiendo de `best`. */
  groundHeight(x, z, radius, maxY, best = -Infinity) {
    const k = this._gather(x - radius, x + radius, z - radius, z + radius);
    const f = this.f;
    const r2 = radius * radius;
    for (let m = 0; m < k; m++) {
      const o = this._cand[m] * STRIDE;
      const dx = x - f[o];
      const dz = z - f[o + 1];
      const lu = dx * f[o + 2] + dz * f[o + 3];
      const lv = -dx * f[o + 3] + dz * f[o + 2];
      const cu = clamp(lu, -f[o + 4], f[o + 4]);
      const cv = clamp(lv, -f[o + 5], f[o + 5]);
      const du = lu - cu;
      const dv = lv - cv;
      if (du * du + dv * dv >= r2) continue;
      const top = this._top(o, cu);
      if (top <= maxY && top > best) best = top;
    }
    return best;
  }

  /** Igual que CollisionWorld.ceilingHeight, partiendo de `best`. */
  ceilingHeight(x, z, radius, minY, best = Infinity) {
    const k = this._gather(x - radius, x + radius, z - radius, z + radius);
    const f = this.f;
    const r2 = radius * radius;
    for (let m = 0; m < k; m++) {
      const o = this._cand[m] * STRIDE;
      const base = f[o + 6];
      if (base < minY || base >= best) continue;
      const dx = x - f[o];
      const dz = z - f[o + 1];
      const lu = dx * f[o + 2] + dz * f[o + 3];
      const lv = -dx * f[o + 3] + dz * f[o + 2];
      const du = lu - clamp(lu, -f[o + 4], f[o + 4]);
      const dv = lv - clamp(lv, -f[o + 5], f[o + 5]);
      if (du * du + dv * dv < r2) best = base;
    }
    return best;
  }

  /**
   * Empuja el cilindro fuera de las cajas cuya cima (en el punto de
   * contacto) supera el escalón. Modifica pos. Devuelve los contactos.
   */
  resolveHorizontal(pos, radius, stepTop, head) {
    const k = this._gather(pos.x - radius, pos.x + radius, pos.z - radius, pos.z + radius);
    const f = this.f;
    const r2 = radius * radius;
    let contacts = 0;
    for (let m = 0; m < k; m++) {
      const o = this._cand[m] * STRIDE;
      if (f[o + 6] >= head) continue;
      const ux = f[o + 2];
      const uz = f[o + 3];
      const hw = f[o + 4];
      const hd = f[o + 5];
      const dx = pos.x - f[o];
      const dz = pos.z - f[o + 1];
      let lu = dx * ux + dz * uz;
      let lv = -dx * uz + dz * ux;
      const cu = clamp(lu, -hw, hw);
      const cv = clamp(lv, -hd, hd);
      let du = lu - cu;
      let dv = lv - cv;
      const d2 = du * du + dv * dv;
      if (d2 >= r2) continue;
      if (this._top(o, cu) <= stepTop) continue;
      if (d2 > EPS) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        lu += (du / d) * push;
        lv += (dv / d) * push;
      } else {
        // Centro dentro: sale por el lado de menor penetración
        const left = lu + hw;
        const right = hw - lu;
        const back = lv + hd;
        const front = hd - lv;
        const mn = Math.min(left, right, back, front);
        if (mn === left) lu = -hw - radius;
        else if (mn === right) lu = hw + radius;
        else if (mn === back) lv = -hd - radius;
        else lv = hd + radius;
      }
      pos.x = f[o] + lu * ux - lv * uz;
      pos.z = f[o + 1] + lu * uz + lv * ux;
      contacts++;
    }
    return contacts;
  }

  /** ¿Alguna caja activa se solapa con este volumen alineado con los ejes? */
  overlaps(minX, maxX, minY, maxY, minZ, maxZ) {
    const k = this._gather(minX, maxX, minZ, maxZ);
    const f = this.f;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const ex = (maxX - minX) / 2;
    const ez = (maxZ - minZ) / 2;
    for (let m = 0; m < k; m++) {
      const o = this._cand[m] * STRIDE;
      if (f[o + 6] >= maxY || Math.max(f[o + 7], f[o + 8]) <= minY) continue;
      // Separación por ejes (dos rectángulos en el plano XZ)
      const ux = f[o + 2];
      const uz = f[o + 3];
      const hw = f[o + 4];
      const hd = f[o + 5];
      const dx = f[o] - cx;
      const dz = f[o + 1] - cz;
      if (Math.abs(dx) > ex + Math.abs(ux) * hw + Math.abs(uz) * hd) continue;
      if (Math.abs(dz) > ez + Math.abs(uz) * hw + Math.abs(ux) * hd) continue;
      if (Math.abs(dx * ux + dz * uz) > hw + ex * Math.abs(ux) + ez * Math.abs(uz)) continue;
      if (Math.abs(-dx * uz + dz * ux) > hd + ex * Math.abs(uz) + ez * Math.abs(ux)) continue;
      return true;
    }
    return false;
  }

  /**
   * Rayo contra las cajas (recorre la rejilla celda a celda). Si hay un
   * impacto antes de maxT, escribe { t, i, nx, ny, nz } en `out` y devuelve true.
   * @param {object} [opts] { cameraOnly, ignoreTags, ignore }
   */
  raycast(o, d, maxT, opts, out) {
    const G = this.grid;
    const cs = this.cell;
    let best = maxT;
    let found = false;
    // Un rayo con NaN no avanzaría nunca por la rejilla
    if (!Number.isFinite(o.x + o.y + o.z + d.x + d.y + d.z)) return false;
    // Tramo del rayo dentro de la rejilla (en el plano XZ)
    const gx1 = G.x0 + G.cols * cs;
    const gz1 = G.z0 + G.rows * cs;
    let t0 = 0;
    let t1 = maxT;
    for (const [oa, da, lo, hi] of [[o.x, d.x, G.x0, gx1], [o.z, d.z, G.z0, gz1]]) {
      if (Math.abs(da) < EPS) {
        if (oa < lo || oa > hi) return false;
        continue;
      }
      let a = (lo - oa) / da;
      let b = (hi - oa) / da;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    const sx = o.x + d.x * t0;
    const sz = o.z + d.z * t0;
    let ix = clamp(Math.floor((sx - G.x0) / cs), 0, G.cols - 1);
    let iz = clamp(Math.floor((sz - G.z0) / cs), 0, G.rows - 1);
    const stepX = d.x > 0 ? 1 : -1;
    const stepZ = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) < EPS ? Infinity : cs / Math.abs(d.x);
    const tdz = Math.abs(d.z) < EPS ? Infinity : cs / Math.abs(d.z);
    let tmx = Math.abs(d.x) < EPS ? Infinity : (G.x0 + (ix + (d.x > 0 ? 1 : 0)) * cs - o.x) / d.x;
    let tmz = Math.abs(d.z) < EPS ? Infinity : (G.z0 + (iz + (d.z > 0 ? 1 : 0)) * cs - o.z) / d.z;
    const q = this._nextQuery();
    const tagsOut = opts?.ignoreTags;
    for (let steps = G.cols + G.rows + 2; steps > 0; steps--) {
      const cell = iz * G.cols + ix;
      for (let j = G.start[cell]; j < G.start[cell + 1]; j++) {
        const i = G.items[j];
        if (this._stamp[i] === q) continue;
        this._stamp[i] = q;
        if (this.groupOn[this.group[i]] === 0) continue;
        if (opts?.cameraOnly && this.noCam[i]) continue;
        if (tagsOut && this.tag[i] && tagsOut.includes(this.tagNames[this.tag[i]])) continue;
        if (opts?.ignore && opts.ignore.obb && opts.ignore.set === this && opts.ignore.index === i) continue;
        if (this._rayBox(i, o, d, best, out)) {
          best = out.t;
          found = true;
        }
      }
      const tNext = Math.min(tmx, tmz);
      if (tNext >= best || tNext > t1) break;
      if (tmx < tmz) {
        ix += stepX;
        tmx += tdx;
        if (ix < 0 || ix >= G.cols) break;
      } else {
        iz += stepZ;
        tmz += tdz;
        if (iz < 0 || iz >= G.rows) break;
      }
    }
    return found;
  }

  /** Rayo contra la caja i (Cyrus-Beck con sus seis planos). */
  _rayBox(i, o, d, maxT, out) {
    const f = this.f;
    const b = i * STRIDE;
    const ux = f[b + 2];
    const uz = f[b + 3];
    const hw = f[b + 4];
    const hd = f[b + 5];
    const dx = o.x - f[b];
    const dz = o.z - f[b + 1];
    const ou = dx * ux + dz * uz;
    const ov = -dx * uz + dz * ux;
    const du = d.x * ux + d.z * uz;
    const dv = -d.x * uz + d.z * ux;
    const y0 = f[b + 7];
    const k = (f[b + 8] - y0) / Math.max(2 * hw, EPS);
    let tIn = 0;
    let tOut = maxT;
    let plane = -1;
    // Planos (normal local nu, ny, nv; dentro si n·p <= c)
    for (let p = 0; p < 6; p++) {
      let nu = 0;
      let ny = 0;
      let nv = 0;
      let c;
      if (p === 0) (nu = 1), (c = hw);
      else if (p === 1) (nu = -1), (c = hw);
      else if (p === 2) (nv = 1), (c = hd);
      else if (p === 3) (nv = -1), (c = hd);
      else if (p === 4) (ny = -1), (c = -f[b + 6]);
      else (nu = -k), (ny = 1), (c = y0 + k * hw);
      const den = nu * du + ny * d.y + nv * dv;
      const num = c - (nu * ou + ny * o.y + nv * ov);
      if (Math.abs(den) < EPS) {
        if (num < 0) return false;
        continue;
      }
      const t = num / den;
      if (den < 0) {
        if (t > tIn) {
          tIn = t;
          plane = p;
        }
      } else if (t < tOut) tOut = t;
      if (tIn > tOut) return false;
    }
    if (tIn >= maxT) return false;
    out.t = tIn;
    out.i = i;
    if (plane < 0) {
      out.nx = -d.x;
      out.ny = -d.y;
      out.nz = -d.z;
      return true;
    }
    let nu = 0;
    let ny = 0;
    let nv = 0;
    if (plane === 0) nu = 1;
    else if (plane === 1) nu = -1;
    else if (plane === 2) nv = 1;
    else if (plane === 3) nv = -1;
    else if (plane === 4) ny = -1;
    else {
      const l = Math.hypot(k, 1);
      nu = -k / l;
      ny = 1 / l;
    }
    out.nx = nu * ux - nv * uz;
    out.ny = ny;
    out.nz = nu * uz + nv * ux;
    return true;
  }
}
