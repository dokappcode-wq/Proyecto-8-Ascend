import { StreetGraph } from '../streets.js';
import { STREETS } from '../data/streets-cero.js';
import { streetSpot } from '../kit.js';

/**
 * Distrito Cero: lugares, reparto y sitios de las actividades.
 * Coordenadas del juego (X = x − 4500, Z = y − 3500 del plano de diseño).
 */
export const streets = new StreetGraph(STREETS);

/** Lugares con nombre (centro aproximado; en el juego se usa la acera más cercana). */
export const PLACES = {
  autovia: { name: 'Autovía de la Sierra', x: 3200, z: -2980 },
  km0: { name: 'Plaza del Kilómetro Cero', x: 2350, z: -2528 },
  neones: { name: 'Calle de los Neones', x: 2500, z: -2640 },
  bar: { name: 'Bar La Catenaria', x: 2460, z: -2050 },
  estacion: { name: 'Estación del Este', x: 2200, z: -2170 },
  puente: { name: 'Puente de Hierro', x: 1880, z: -2335 },
  sub: { name: 'Subestación del Tranvía', x: 2790, z: -2160 },
  iglesia: { name: 'Iglesia de San Roque', x: 2650, z: -2880 },
  mercado: { name: 'Mercado de la Ribera', x: 1670, z: -2880 },
  cine: { name: 'Cine Ascenso', x: 2100, z: -2740 },
  banco: { name: 'Banco del Este', x: 2250, z: -2400 },
  almacen: { name: 'Almacén embargado', x: 1900, z: -2620 },
  cocheras: { name: 'Cocheras del tranvía', x: 2900, z: -2300 },
};

/** Reparto: paletas de ropa (mismo formato que STORY_PALETTES). */
export const CAST = {
  txema: { name: 'Txema', palette: { skin: 0xc49a80, jacket: 0x2d2a2a, hoodie: 0x7a6a5a, pants: 0x2b2f36, boots: 0x1f1a18, hair: 0x8a8580, hairStyle: 'buzz', beard: true }, scale: 1.06 },
  rosa: { name: 'Rosa', palette: { skin: 0xd8b09a, jacket: 0x23406b, hoodie: 0xd9d0c0, pants: 0x2a2f3a, boots: 0x231d1a, hair: 0xcfcac2, hairStyle: 'bun' }, scale: 0.96 },
  pello: { name: 'Pello', palette: { skin: 0xc28d6a, jacket: 0xb3262b, hoodie: 0x2a2a30, pants: 0x34404f, boots: 0xe0e0e0, hair: 0x241a12, hairStyle: 'messy' }, scale: 0.93 },
  anselmo: { name: 'Anselmo', palette: { skin: 0xc99a7c, jacket: 0x5a4632, hoodie: 0xc9b48a, pants: 0x3a3430, boots: 0x231d1a, hair: 0xd9d5cf, hairStyle: 'short' } },
  julian: { name: 'Don Julián', palette: { skin: 0xd2a07e, jacket: 0x111114, hoodie: 0xf0f0f0, pants: 0x111114, boots: 0x111111, hair: 0x9a948c, hairStyle: 'short' } },
  benito: { name: 'Benito', palette: { skin: 0xc49a80, jacket: 0x4a4f58, hoodie: 0xe6e2da, pants: 0x3a3f48, boots: 0x15120f, hair: 0x6b655d, hairStyle: 'slick' } },
  nekane: { name: 'Nekane', palette: { skin: 0xb98266, jacket: 0xd9a21b, hoodie: 0x2a3440, pants: 0x2f3440, boots: 0x1f1c1a, hair: 0x2a1a12, hairStyle: 'long' } },
  maripaz: { name: 'Maripaz', palette: { skin: 0xd8b09a, jacket: 0x6b2d6b, hoodie: 0x1c1c22, pants: 0x1c1c22, boots: 0x111111, hair: 0xb04a2a, hairStyle: 'long' } },
  charo: { name: 'Charo', palette: { skin: 0xc99a7c, jacket: 0xe6e6e0, hoodie: 0x3a6b8a, pants: 0x2a2f3a, boots: 0x3a6b3a, hair: 0x3a2418, hairStyle: 'bun' } },
  itxaso: { name: 'Itxaso', palette: { skin: 0xd2a07e, jacket: 0x3a5a3a, hoodie: 0x1c1c22, pants: 0x2a2a30, boots: 0x231a1a, hair: 0x1a1410, hairStyle: 'long' } },
  juana: { name: 'Juana', palette: { skin: 0xd8b09a, jacket: 0x4c3a46, hoodie: 0x9a8f86, pants: 0x3a3438, boots: 0x2a2224, hair: 0xd9d5cf, hairStyle: 'bun' }, scale: 0.94 },
  sobrino: { name: 'Mikel', palette: { skin: 0xb07a5c, jacket: 0x3a4a5a, hoodie: 0x8a8f99, pants: 0x2b2f36, boots: 0x231a1a, hair: 0x2a2420, hairStyle: 'short' } },
  salaberri: { name: 'Salaberri', variant: 'pdc', palette: null },
  agente: { name: 'Agente de paisano', palette: { skin: 0xc49a80, jacket: 0x3a3f48, hoodie: 0xd9d0c0, pants: 0x2b2f36, boots: 0x15120f, hair: 0x2a2420, hairStyle: 'short' } },
  acolito: { name: 'Acólito', palette: { skin: 0xb07a5c, jacket: 0x3b2448, hoodie: 0x5a3a6a, pants: 0x231c2a, boots: 0x15120f, hair: 0x1b1511, hairStyle: 'messy' } },
  vecino: { name: 'Vecino', palette: { skin: 0xa77e66, jacket: 0x6b5a3a, hoodie: 0x8a8f99, pants: 0x2b2f36, boots: 0x231a1a, hair: 0x2a2420, hairStyle: 'short', beard: true } },
  vecina: { name: 'Vecina', palette: { skin: 0xd2a07e, jacket: 0x55708a, hoodie: 0xcfc6b8, pants: 0x3c4148, boots: 0x2a2624, hair: 0x5a3b26, hairStyle: 'long' } },
};

/** Personaje del reparto (se crea una vez y se recoloca). */
export function cast(S, key, p, o = {}) {
  const c = CAST[key];
  const npc = S.npc(o.id ?? key, { name: c.name, palette: c.palette, variant: c.variant ?? 'incarnation', scale: c.scale ?? 1, x: p.x, z: p.z, yaw: p.yaw ?? 0, ...o });
  npc.name = c.name;
  return npc;
}

const _spots = new Map();
/** Punto de acera junto a un lugar (se calcula una vez con el mundo cargado). */
export function place(game, key, dx = 0, dz = 0) {
  const k = `${key}:${dx}:${dz}`;
  if (!_spots.has(k)) {
    const p = PLACES[key];
    _spots.set(k, streetSpot(game, streets, p.x + dx, p.z + dz));
  }
  return _spots.get(k);
}

/** Se olvidan los puntos calculados (al volver a montar la ciudad). */
export function resetPlaces() {
  _spots.clear();
}

/** Generador pseudoaleatorio con semilla (sitios de actividades estables entre partidas). */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `n` cruces del barrio repartidos (separados al menos `minSep`), cerca de
 * los lugares `near` si se dan. Siempre en la red de calles.
 */
export function spreadSpots(game, n, seed, { near = [], radius = 380, minSep = 170, inside = null } = {}) {
  const rnd = seeded(seed);
  const out = [];
  const cands = [];
  for (let i = 0; i < streets.n; i++) {
    if (!streets.adj[i].length) continue;
    const x = streets.x[i];
    const z = streets.z[i];
    if (inside && !inside(x, z)) continue;
    if (near.length && !near.some((k) => Math.hypot(PLACES[k].x - x, PLACES[k].z - z) < radius)) continue;
    cands.push(i);
  }
  for (let sep = minSep; out.length < n && sep > 20; sep *= 0.75) {
    for (let k = 0; k < cands.length * 2 && out.length < n; k++) {
      const i = cands[Math.floor(rnd() * cands.length)];
      const x = streets.x[i];
      const z = streets.z[i];
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < sep)) continue;
      out.push({ ...streetSpot(game, streets, x + 4, z + 4), node: i });
    }
  }
  return out;
}
