/**
 * Lectura de los datos de Ibaia (cityData.js, generado por
 * tools/ciudad/export_game.py). Sin Three.js: lo usan el mapa, el menú de
 * administración y las pruebas.
 *
 * Coordenadas del juego en metros: X hacia el este, Z hacia el sur.
 */
import { ObbSet } from '../../../physics/ObbSet.js';

export function bytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const int16 = (b64) => {
  const b = bytes(b64);
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength >> 1);
};

/** Polígonos cuantizados: [{ rings: [Float32Array x,z,x,z…], …}] (el primero es el exterior). */
export function decodePolys(b64) {
  const a = int16(b64);
  const out = [];
  let k = 0;
  const n = a[k++];
  for (let p = 0; p < n; p++) {
    const nr = a[k++];
    const rings = [];
    for (let r = 0; r < nr; r++) {
      const np = a[k++];
      const ring = new Float32Array(np * 2);
      for (let i = 0; i < np * 2; i++) ring[i] = a[k++] / 2;
      rings.push(ring);
    }
    out.push(rings);
  }
  return out;
}

/** Puntos (x, z, extra): árboles (escala), farolas y marcas viales (ángulo). */
function decodePoints(b64, extraScale) {
  const a = int16(b64);
  const n = a.length / 3;
  const x = new Float32Array(n);
  const z = new Float32Array(n);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = a[i * 3] / 2;
    z[i] = a[i * 3 + 1] / 2;
    e[i] = a[i * 3 + 2] * extraScale;
  }
  return { n, x, z, e };
}

/** Edificios: cajas orientadas (una o varias por edificio). */
export function decodeBuildings(CITY, BIN) {
  const b = bytes(BIN.buildings);
  const n = CITY.buildings;
  let off = 0;
  const take = (Type) => {
    const a = new Type(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + n * Type.BYTES_PER_ELEMENT));
    off += n * Type.BYTES_PER_ELEMENT;
    return a;
  };
  const cx = take(Int16Array);
  const cz = take(Int16Array);
  const ang = take(Uint16Array);
  const hw = take(Uint16Array);
  const hd = take(Uint16Array);
  const h = take(Uint16Array);
  const kind = take(Uint8Array);
  const variant = take(Uint8Array);
  const district = take(Uint8Array);
  const out = {
    n, kind, variant, district,
    cx: new Float32Array(n), cz: new Float32Array(n), ang: new Float32Array(n),
    hw: new Float32Array(n), hd: new Float32Array(n), h: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    out.cx[i] = cx[i] / 4;
    out.cz[i] = cz[i] / 4;
    out.ang[i] = (ang[i] / 65535) * Math.PI;
    out.hw[i] = hw[i] / 50;
    out.hd[i] = hd[i] / 50;
    out.h[i] = h[i] / 20;
  }
  return out;
}

/** Máscara de tierra (1) y agua (0) en celdas de `cell` metros. */
export function decodeMask(CITY, BIN) {
  const { cols, rows } = CITY.mask;
  const b = bytes(BIN.mask);
  const runs = new Uint16Array(b.buffer, b.byteOffset, b.byteLength >> 1);
  const cells = new Uint8Array(cols * rows);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    let i = 0;
    let land = 0;
    for (;;) {
      const r = runs[k++];
      if (r === 0xffff) break;
      if (land) cells.fill(1, j * cols + i, j * cols + i + r);
      i += r;
      land ^= 1;
    }
  }
  return { ...CITY.mask, cells };
}

export function landAt(mask, x, z) {
  const i = Math.floor((x - mask.x0) / mask.cell);
  const j = Math.floor((z - mask.z0) / mask.cell);
  if (i < 0 || j < 0 || i >= mask.cols || j >= mask.rows) return false;
  return mask.cells[j * mask.cols + i] === 1;
}

/** Relieve (metros) en la rejilla de la sierra. */
export function decodeRelief(CITY, BIN) {
  const a = int16(BIN.relief);
  const heights = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) heights[i] = a[i] / 10;
  return { ...CITY.relief, heights };
}

/** Punto dentro de un polígono dado como anillos planos [x, z, x, z…]. */
export function inRings(rings, x, z) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i];
      const zi = r[i + 1];
      const xj = r[j];
      const zj = r[j + 1];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Barrio que contiene (x, z), o null. */
export function districtAt(CITY, x, z) {
  for (const d of CITY.districts) if (d.outline.some((r) => inRings([r], x, z))) return d;
  return null;
}

export function decodeCity(CITY, BIN) {
  return {
    buildings: decodeBuildings(CITY, BIN),
    land: decodePolys(BIN.land),
    layers: Object.fromEntries(CITY.layers.map((k) => [k, decodePolys(BIN[k])])),
    trees: decodePoints(BIN.trees, 1 / 20),
    lamps: decodePoints(BIN.lamps, Math.PI / 127),
    dashes: decodePoints(BIN.dashes, Math.PI / 127),
    mask: decodeMask(CITY, BIN),
    relief: decodeRelief(CITY, BIN),
  };
}

/** Grupo de colisión de la barrera de cada barrio (1…10). */
export const barrierGroup = (CITY, id) => CITY.districts.findIndex((d) => d.id === id) + 1;

/**
 * Colisión de la ciudad: edificios, tableros y barandillas de los puentes,
 * tren elevado (tablero y pilares) y barreras (un grupo por barrio, para
 * bajarlas desde el menú de administración).
 * @returns {ObbSet}
 */
export function cityColliders(CITY, buildings) {
  const set = new ObbSet({ cell: 48 });
  const noClimb = new Set(['tank', 'chimney', 'wheel', 'antenna', 'container', 'crane', 'fountain']);
  const B = buildings;
  for (let i = 0; i < B.n; i++) {
    const kind = CITY.kinds[B.kind[i]];
    const base = { cx: B.cx[i], cz: B.cz[i], angle: B.ang[i], tag: 'building' };
    // Noria y antenas: su modelo es casi hueco; colisión solo en los soportes (abajo)
    if (kind === 'wheel' || kind === 'antenna') continue;
    if (kind === 'crane') {
      // Grúa: cuatro patas y la plataforma del pórtico (se puede subir a ella)
      const deck = B.h[i] * 0.55;
      const ux = Math.cos(B.ang[i]);
      const uz = Math.sin(B.ang[i]);
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          const lu = a * (B.hw[i] - 1);
          const lv = b * (B.hd[i] - 1);
          set.add({ ...base, cx: B.cx[i] + lu * ux - lv * uz, cz: B.cz[i] + lu * uz + lv * ux, hw: 0.6, hd: 0.6, minY: 0, maxY: deck, climbable: true });
        }
      }
      set.add({ ...base, hw: B.hw[i], hd: B.hd[i], minY: deck, maxY: deck * 1.12, climbable: true });
      continue;
    }
    set.add({ ...base, hw: B.hw[i], hd: B.hd[i], minY: 0, maxY: B.h[i], climbable: !noClimb.has(kind) });
  }
  for (const s of CITY.specials) {
    if (s.k === 'wheel') set.add({ cx: s.x, cz: s.z, angle: 0, hw: 3, hd: 2, minY: 0, maxY: s.h / 2 + 1, tag: 'building', climbable: false });
    if (s.k === 'antenna') set.add({ cx: s.x, cz: s.z, angle: 0, hw: 0.8, hd: 0.8, minY: 0, maxY: s.h, tag: 'building', climbable: false });
  }
  // Puentes: un tramo por par de puntos; la cima sigue la rampa
  for (const br of CITY.bridges) bridgePieces(br, (p) => set.add(p));
  // Tren elevado: tablero continuo y pilares cada ~40 m
  const ry = CITY.rail.y;
  for (const line of CITY.rail.lines) {
    for (let k = 0; k + 1 < line.length; k++) {
      const [x0, z0] = line[k];
      const [x1, z1] = line[k + 1];
      const L = Math.hypot(x1 - x0, z1 - z0);
      if (L < 0.5) continue;
      const a = Math.atan2(z1 - z0, x1 - x0);
      set.add({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, angle: a, hw: L / 2 + 0.3, hd: 4.5, minY: ry - 1.4, maxY: ry, tag: 'rail' });
      set.add({ cx: x0, cz: z0, angle: a, hw: 1.1, hd: 1.1, minY: 0, maxY: ry - 1.4, tag: 'rail' });
    }
  }
  // Barreras: muros finos y muy altos que no se trepan
  CITY.districts.forEach((d, idx) => {
    for (const ring of d.barrier) {
      forRingSegments(ring, (x0, z0, x1, z1) => {
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 0.01) return;
        set.add({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, angle: Math.atan2(z1 - z0, x1 - x0), hw: L / 2 + 0.6, hd: 0.6, minY: -20, maxY: 2400, group: idx + 1, tag: 'barrier', climbable: false, cameraBlocking: false });
      });
    }
  });
  return set;
}

export function forRingSegments(ring, fn) {
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    fn(ring[i * 2], ring[i * 2 + 1], ring[j * 2], ring[j * 2 + 1]);
  }
}

/** Tramos de un puente: tablero (cima en rampa) y barandillas a ambos lados. */
export function bridgePieces(br, add) {
  const hw = br.w / 2;
  for (let k = 0; k + 1 < br.pts.length; k++) {
    const [x0, z0, y0] = br.pts[k];
    const [x1, z1, y1] = br.pts[k + 1];
    if (y0 <= 0.01 && y1 <= 0.01) continue;
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.1) continue;
    const a = Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    // Se solapan 0.3 m para que no queden rendijas entre tramos
    add({ cx, cz, angle: a, hw: L / 2 + 0.3, hd: hw, minY: Math.min(y0, y1) - 1.6, y0, y1, tag: 'bridge', climbable: false });
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    for (const s of [-1, 1]) {
      add({ cx: cx + nx * (hw - 0.25) * s, cz: cz + nz * (hw - 0.25) * s, angle: a, hw: L / 2 + 0.3, hd: 0.25, minY: Math.min(y0, y1) - 1.6, y0: y0 + 1.1, y1: y1 + 1.1, tag: 'bridge', climbable: false });
    }
  }
}
