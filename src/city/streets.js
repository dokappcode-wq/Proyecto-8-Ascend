/**
 * Red de calles de un barrio (sin Three.js; se prueba con node:test).
 *
 * Sirve para que todo lo de las misiones esté en la calle: el punto más
 * cercano de la calzada o de la acera, rutas por las calles (A*) para
 * persecuciones, el tranvía y las carreras, y paseos al azar.
 */
export class StreetGraph {
  /** @param {{nodes:number[], edges:number[]}} data */
  constructor(data) {
    const n = data.nodes.length / 2;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = data.nodes[i * 2];
      this.z[i] = data.nodes[i * 2 + 1];
    }
    /** Aristas: [{ a, b, w, len }] */
    this.edges = [];
    /** Vecinos de cada nodo: [{ to, e }] */
    this.adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < data.edges.length; i += 3) {
      const a = data.edges[i];
      const b = data.edges[i + 1];
      const w = data.edges[i + 2];
      const len = Math.hypot(this.x[b] - this.x[a], this.z[b] - this.z[a]);
      const e = this.edges.length;
      this.edges.push({ a, b, w, len });
      this.adj[a].push({ to: b, e });
      this.adj[b].push({ to: a, e });
    }
    this.n = n;
  }

  node(i) {
    return { x: this.x[i], z: this.z[i] };
  }

  /** Nodo más cercano a (x, z). */
  nearestNode(x, z) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      if (!this.adj[i].length) continue;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Punto más cercano sobre el eje de alguna calle: { x, z, e, t, dist, w,
   * dir: {x,z} (dirección de la calle), side: {x,z} (normal) }.
   */
  project(x, z, minWidth = 0) {
    let best = null;
    for (let k = 0; k < this.edges.length; k++) {
      const ed = this.edges[k];
      if (ed.w < minWidth || ed.len < 1e-6) continue;
      const ax = this.x[ed.a];
      const az = this.z[ed.a];
      const dx = (this.x[ed.b] - ax) / ed.len;
      const dz = (this.z[ed.b] - az) / ed.len;
      const t = Math.max(0, Math.min(ed.len, (x - ax) * dx + (z - az) * dz));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.dist) best = { x: px, z: pz, e: k, t, dist: d, w: ed.w, dir: { x: dx, z: dz }, side: { x: -dz, z: dx } };
    }
    return best;
  }

  /**
   * Punto en la acera junto a (x, z): sobre la calle más cercana, desplazado
   * hacia el lado de (x, z) hasta el borde de la calzada más `margin`.
   */
  sidewalk(x, z, margin = 1.6) {
    const p = this.project(x, z);
    if (!p) return { x, z };
    const s = Math.sign((x - p.x) * p.side.x + (z - p.z) * p.side.z) || 1;
    const off = p.w / 2 + margin;
    return { x: p.x + p.side.x * off * s, z: p.z + p.side.z * off * s, yaw: Math.atan2(-p.side.x * s, -p.side.z * s), street: p };
  }

  /** Camino más corto entre dos nodos (A*): lista de índices de nodo, o null. */
  path(from, to) {
    if (from === to) return [from];
    const n = this.n;
    const g = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const h = (i) => Math.hypot(this.x[i] - this.x[to], this.z[i] - this.z[to]);
    const open = [[h(from), from]];
    g[from] = 0;
    while (open.length) {
      // Cola de prioridad sencilla (las redes de barrio son pequeñas)
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === to) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      for (const { to: nb, e } of this.adj[cur]) {
        const ng = g[cur] + this.edges[e].len;
        if (ng < g[nb]) {
          g[nb] = ng;
          prev[nb] = cur;
          open.push([ng + h(nb), nb]);
        }
      }
    }
    if (prev[to] < 0) return null;
    const out = [to];
    for (let c = to; c !== from; c = prev[c]) out.push(prev[c]);
    return out.reverse();
  }

  /** Ruta por las calles entre dos puntos del mundo: [{x,z}…] (incluye los extremos). */
  route(a, b) {
    const ia = this.nearestNode(a.x, a.z);
    const ib = this.nearestNode(b.x, b.z);
    const p = this.path(ia, ib);
    if (!p) return [a, b];
    return [{ x: a.x, z: a.z }, ...p.map((i) => this.node(i)), { x: b.x, z: b.z }];
  }

  /** Ruta que pasa por varios puntos en orden. */
  routeThrough(points) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const r = this.route(points[i], points[i + 1]);
      out.push(...(i === 0 ? r : r.slice(1)));
    }
    return out;
  }

  /** Paseo al azar de `steps` tramos desde el nodo más cercano a (x, z), sin volver atrás. */
  wander(x, z, steps, rnd = Math.random) {
    let cur = this.nearestNode(x, z);
    let last = -1;
    const out = [this.node(cur)];
    for (let s = 0; s < steps; s++) {
      const opts = this.adj[cur].filter((o) => o.to !== last);
      const pick = (opts.length ? opts : this.adj[cur])[Math.floor(rnd() * (opts.length || this.adj[cur].length))];
      if (!pick) break;
      last = cur;
      cur = pick.to;
      out.push(this.node(cur));
    }
    return out;
  }
}

/** Longitud de una polilínea [{x,z}…]. */
export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
}

/** Punto y dirección a la distancia `s` de una polilínea (se queda en el extremo). */
export function alongPolyline(pts, s) {
  let rest = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (rest <= l || i === pts.length - 1) {
      const t = l > 0 ? Math.min(1, rest / l) : 0;
      const dx = l > 0 ? (b.x - a.x) / l : 0;
      const dz = l > 0 ? (b.z - a.z) / l : 1;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dir: { x: dx, z: dz }, i, done: rest >= l && i === pts.length - 1 };
    }
    rest -= l;
  }
  const p = pts[pts.length - 1] ?? { x: 0, z: 0 };
  return { x: p.x, z: p.z, dir: { x: 0, z: 1 }, i: pts.length - 1, done: true };
}
