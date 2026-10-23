/**
 * La PDC y los enemigos de Ibaia (sin Three.js; se prueba con node:test).
 *
 * Los datos del diseño (CITY.pdc, de export_game.py) se convierten en grupos:
 * cada puesto (torre de vigilancia, control de un puente o del metro), cada
 * patrulla, cada francotirador y cada campamento de Acólitos es un grupo con
 * sus unidades en su sitio. Un grupo está en el mapa siempre; solo se crean
 * sus enemigos mientras el jugador anda cerca (`plan`), así 30 km² no cuestan
 * más que un barrio. Los neutralizados no vuelven hasta pasado un rato.
 */

export const POP = Object.freeze({
  /** Distancia (horizontal) a la que un grupo se crea… */
  activate: 300,
  /** …y a la que se retira (más lejos: sin parpadeos en el borde). */
  deactivate: 380,
  /** Unidades vivas a la vez como máximo (las más cercanas primero). */
  maxUnits: 32,
  /** Segundos hasta que un neutralizado vuelve a su puesto. */
  respawn: 300,
});

/** Marco de la calle de un puesto: u a lo largo de la calle, v a lo ancho. */
export function postFrame(p) {
  const ux = Math.cos(p.ang);
  const uz = Math.sin(p.ang);
  return { ux, uz, vx: -uz, vz: ux, half: p.w / 2 };
}

/** Punto del mundo a (u, v) metros del centro del puesto. */
export function at(p, u, v) {
  const f = postFrame(p);
  return { x: p.x + f.ux * u + f.vx * v, z: p.z + f.uz * u + f.vz * v };
}

/** Orientación (yaw del modelo: mira hacia (sin, cos)) de (x, z) hacia (tx, tz). */
export const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

/**
 * Unidades de un puesto según su tipo y el nivel PDC del barrio.
 * Los refuerzos (`reserve`) esperan dentro del camión y solo salen con la alarma.
 */
function postUnits(p, lvl) {
  const f = postFrame(p);
  const h = Math.max(4, f.half - 2);
  const guard = (u, v, type = 'pdc') => {
    const a = at(p, u, v);
    const b = at(p, u + 5, v);
    return { type, ...a, yaw: yawTo(a.x, a.z, p.x, p.z), patrol: [a, b] };
  };
  const units = [];
  if (p.kind === 'tower') {
    units.push(guard(-3, h), guard(3, -h));
    if (lvl >= 2) units.push(guard(0, h - 2, 'blindado'));
    if (lvl >= 4) units.push(guard(-6, -h + 1, 'reforzado'));
    if (lvl >= 3) {
      // Dron posado en lo alto de la torre: despega con la alarma
      const t = at(p, -6, f.half + 3);
      units.push({ type: 'dron', ...t, y: 15.4, yaw: 0, dormant: true, alarm: true });
    }
  } else if (p.kind === 'bridge') {
    units.push(guard(-2, h), guard(2, -h));
    if (lvl >= 3) units.push(guard(-5, 1, 'blindado'));
  } else {
    units.push(guard(0, h));
    if (lvl >= 3) units.push(guard(2, -h));
  }
  return units;
}

/** Punto de la puerta trasera del camión de un puesto (de ahí bajan los refuerzos). */
export function truckDoor(p) {
  const f = postFrame(p);
  return at(p, 10, -(f.half - 3));
}

/**
 * Grupos de la ciudad a partir de CITY.pdc.
 * @param {object} CITY datos de la ciudad
 * @returns {Array<{id, kind, d, lvl, x, z, name, units, post?}>}
 */
export function buildGroups(CITY) {
  const lvl = Object.fromEntries(CITY.districts.map((d) => [d.id, d.pdc]));
  const groups = [];
  for (const p of CITY.pdc.posts) {
    groups.push({ id: p.id, kind: 'post', postKind: p.kind, d: p.d, lvl: lvl[p.d], x: p.x, z: p.z, name: p.name, post: p, truck: p.kind !== 'metro', units: postUnits(p, lvl[p.d]) });
  }
  for (const t of CITY.pdc.patrols) {
    const [a, b] = t.pts;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L;
    const nz = dx / L;
    const route = (o) => [{ x: a[0] + nx * o, z: a[1] + nz * o }, { x: b[0] + nx * o, z: b[1] + nz * o }];
    const units = t.kind === 'drone'
      ? [{ type: 'dron', x: a[0], y: 5, z: a[1], yaw: yawTo(a[0], a[1], b[0], b[1]), patrol: route(0) }]
      : [0.8, -0.8].map((o, i) => ({
        type: lvl[t.d] >= 4 && i === 1 ? 'reforzado' : 'pdc',
        x: a[0] + nx * o - (dx / L) * i * 1.5, z: a[1] + nz * o - (dz / L) * i * 1.5,
        yaw: yawTo(a[0], a[1], b[0], b[1]), patrol: route(o),
      }));
    groups.push({ id: t.id, kind: 'patrol', d: t.d, lvl: lvl[t.d], x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, name: t.kind === 'drone' ? 'Dron de vigilancia' : 'Patrulla PDC', units });
  }
  for (const s of CITY.pdc.snipers) {
    groups.push({ id: s.id, kind: 'sniper', d: s.d, lvl: lvl[s.d], x: s.x, z: s.z, name: 'Francotirador PDC', units: [{ type: 'francotirador', x: s.x, y: s.y + 0.1, z: s.z, yaw: s.yaw }] });
  }
  for (const c of CITY.pdc.acolytes) {
    const units = [];
    for (let i = 0; i < c.n; i++) {
      const a = (i / c.n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 3.2;
      const z = c.z + Math.sin(a) * 3.2;
      units.push({ type: 'acolyte', x, z, yaw: yawTo(x, z, c.x, c.z), patrol: [{ x, z }, { x: c.x + Math.cos(a + 0.9) * 5, z: c.z + Math.sin(a + 0.9) * 5 }] });
    }
    groups.push({ id: c.id, kind: 'acolytes', d: c.d, lvl: lvl[c.d], x: c.x, z: c.z, name: c.name, units });
  }
  return groups;
}

/**
 * Qué grupos crear y cuáles retirar con el jugador en (px, pz).
 * @param {Array} groups con `active` (bool) y `units` (con `deadUntil`)
 * @param {object} o { time, busy(id) → true si el grupo está en combate, cfg }
 * @returns {{ activate: string[], deactivate: string[] }}
 */
export function plan(groups, px, pz, { time = 0, busy = () => false, cfg = POP } = {}) {
  const dist = (g) => Math.hypot(g.x - px, g.z - pz);
  const living = (g) => g.units.filter((u) => !(u.deadUntil > time)).length;
  const deactivate = [];
  let count = 0;
  for (const g of groups) {
    if (!g.active) continue;
    if (dist(g) > cfg.deactivate && !busy(g.id)) deactivate.push(g.id);
    else count += g.liveCount ?? living(g);
  }
  const activate = [];
  const cands = groups.filter((g) => !g.active && dist(g) < cfg.activate && living(g) > 0).sort((a, b) => dist(a) - dist(b));
  for (const g of cands) {
    const n = living(g);
    if (count + n > cfg.maxUnits) break;
    activate.push(g.id);
    count += n;
  }
  return { activate, deactivate };
}
