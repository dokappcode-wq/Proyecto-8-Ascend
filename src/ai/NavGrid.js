/**
 * NavGrid — rejilla de navegación sobre un suelo plano (sin Three.js; se
 * prueba con node:test). Marca como bloqueadas las celdas donde alguna caja
 * o rampa de la colisión ocupa la franja del cuerpo (de rodillas a la cabeza)
 * y busca caminos con A* en 8 direcciones, sin cortar esquinas, que luego
 * endereza (quita los puntos intermedios que se ven entre sí).
 *
 * La usan los guardias del sigilo para no atravesar paredes ni cajas al
 * investigar un ruido, relevarse o acudir a una alarma.
 */
export class NavGrid {
  /**
   * @param {object} world CollisionWorld (boxes, ramps)
   * @param {object} o { x0, x1, z0, z1, y (suelo), cell, clearance (radio del cuerpo), band: [desde, hasta] sobre el suelo }
   */
  constructor(world, { x0, x1, z0, z1, y = 0, cell = 0.75, clearance = 0.45, band = [0.35, 1.7] }) {
    Object.assign(this, { world, x0, x1, z0, z1, y, cell, clearance, band });
    this.cols = Math.ceil((x1 - x0) / cell);
    this.rows = Math.ceil((z1 - z0) / cell);
    this.blocked = null;
  }

  /** (Re)construye la rejilla con el estado actual de la colisión (puertas abiertas o cerradas). */
  build() {
    const { cols, rows, cell, x0, z0, clearance } = this;
    const b = new Uint8Array(cols * rows);
    const lo = this.y + this.band[0];
    const hi = this.y + this.band[1];
    const mark = (minX, maxX, minZ, maxZ) => {
      const i0 = Math.max(0, Math.floor((minX - clearance - x0) / cell));
      const i1 = Math.min(cols - 1, Math.floor((maxX + clearance - x0) / cell));
      const j0 = Math.max(0, Math.floor((minZ - clearance - z0) / cell));
      const j1 = Math.min(rows - 1, Math.floor((maxZ + clearance - z0) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) b[j * cols + i] = 1;
    };
    for (const box of this.world.boxes) {
      if (box.enabled === false || box.maxY <= lo || box.minY >= hi) continue;
      mark(box.minX, box.maxX, box.minZ, box.maxZ);
    }
    for (const r of this.world.ramps ?? []) {
      if (Math.max(r.y0, r.y1) <= lo) continue;
      mark(r.minX, r.maxX, r.minZ, r.maxZ);
    }
    this.blocked = b;
    return this;
  }

  _cell(x, z) {
    return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)];
  }

  _free(i, j) {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows && !this.blocked[j * this.cols + i];
  }

  _center(i, j) {
    return { x: this.x0 + (i + 0.5) * this.cell, z: this.z0 + (j + 0.5) * this.cell };
  }

  /** ¿Se puede estar en (x, z)? */
  walkable(x, z) {
    if (!this.blocked) this.build();
    const [i, j] = this._cell(x, z);
    return this._free(i, j);
  }

  /** Celda libre más cercana (búsqueda en anillos), o null. */
  _nearestFree(i, j, maxR = 12) {
    if (this._free(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this._free(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = [i + di, j + dj];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** ¿Se ve en línea recta de a a b sin pasar por celdas bloqueadas? */
  clear(a, b) {
    if (!this.blocked) this.build();
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [i, j] = this._cell(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (!this._free(i, j)) return false;
    }
    return true;
  }

  /**
   * Camino de `from` a `to` como lista de puntos {x, z} (sin el de partida;
   * el último es `to` o, si está dentro de un obstáculo, el sitio libre más
   * cercano). null si no hay camino.
   */
  findPath(from, to) {
    if (!this.blocked) this.build();
    const { cols } = this;
    const s = this._nearestFree(...this._cell(from.x, from.z));
    const g = this._nearestFree(...this._cell(to.x, to.z));
    if (!s || !g) return null;
    const goalExact = this._free(...this._cell(to.x, to.z));
    const goal = goalExact ? { x: to.x, z: to.z } : this._center(g[0], g[1]);
    if (this.clear(from, goal)) return [goal];
    const key = (i, j) => j * cols + i;
    const gi = g[0];
    const gj = g[1];
    const h = (i, j) => {
      const dx = Math.abs(i - gi);
      const dz = Math.abs(j - gj);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    const open = new MinHeap();
    const cost = new Map();
    const prev = new Map();
    const k0 = key(s[0], s[1]);
    cost.set(k0, 0);
    open.push(h(s[0], s[1]), [s[0], s[1]]);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    let guard = 0;
    while (open.size && guard++ < 200000) {
      const [i, j] = open.pop();
      if (i === gi && j === gj) {
        found = true;
        break;
      }
      const c = cost.get(key(i, j));
      for (const [di, dj, w] of DIRS) {
        const ni = i + di;
        const nj = j + dj;
        if (!this._free(ni, nj)) continue;
        // Sin cortar esquinas en diagonal
        if (di && dj && (!this._free(i + di, j) || !this._free(i, j + dj))) continue;
        const nk = key(ni, nj);
        const nc = c + w;
        if (nc < (cost.get(nk) ?? Infinity)) {
          cost.set(nk, nc);
          prev.set(nk, key(i, j));
          open.push(nc + h(ni, nj), [ni, nj]);
        }
      }
    }
    if (!found) return null;
    // Reconstruye y endereza
    const cells = [];
    for (let k = key(gi, gj); k !== undefined; k = prev.get(k)) cells.push(this._center(k % cols, Math.floor(k / cols)));
    cells.reverse();
    cells[cells.length - 1] = goal;
    const out = [];
    let anchor = { x: from.x, z: from.z };
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clear(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }
}

/** Montículo binario mínimo (cola de prioridad de A*). */
class MinHeap {
  constructor() {
    this.k = [];
    this.v = [];
  }

  get size() {
    return this.k.length;
  }

  push(key, val) {
    const { k, v } = this;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }

  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop();
    const lv = v.pop();
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}
