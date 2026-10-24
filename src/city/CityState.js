/**
 * Estado persistente de la campaña de la ciudad (sin Three.js). Vive en
 * `save.data.city`.
 *
 * - `done`: misiones terminadas (historia y secundarias) → true.
 * - `active`: misión en curso { id, step } (se reanuda en su punto de control).
 * - `flags`: decisiones y hechos de la historia (p. ej. pello: 'entregado').
 * - `towers`: torres de la PDC tomadas por barrio.
 * - `acts`: medalla de cada sitio de actividad ('base-2' → 0..3).
 * - `found`: secretos y coleccionables.
 * - `events`: sucesos resueltos por barrio.
 * - `snapshot`: salud y carga al guardar.
 */
export function createCityState() {
  return {
    version: 1,
    started: false,
    done: {},
    active: null,
    flags: {},
    towers: {},
    acts: {},
    found: {},
    events: {},
    snapshot: { health: 100, charge: 60 },
  };
}

/** Mezcla un estado guardado con los valores por defecto (guardados antiguos o parciales). */
export function mergeCityState(base, saved) {
  if (!saved || saved.version !== base.version) return base;
  const out = { ...base, ...saved };
  for (const k of ['done', 'flags', 'towers', 'acts', 'found', 'events', 'snapshot']) out[k] = { ...base[k], ...(saved[k] || {}) };
  return out;
}

/** Cuánto baja el control de la PDC cada cosa (suma 100 por barrio). */
export const CONTROL = Object.freeze({ tower: 15, side: 35, acts: 40, events: 10, eventsNeeded: 5 });

/**
 * Control de la PDC en un barrio (0..100, entero). `content` describe lo que
 * hay en el barrio: { sides: [ids], acts: [{ id, count }] }.
 */
export function districtControl(state, district, content) {
  let c = 100;
  if (state.towers[district]) c -= CONTROL.tower;
  const sides = content.sides ?? [];
  if (sides.length) c -= (CONTROL.side * sides.filter((id) => state.done[id]).length) / sides.length;
  const total = (content.acts ?? []).reduce((s, a) => s + a.count, 0);
  if (total) {
    let n = 0;
    for (const a of content.acts) for (let i = 0; i < a.count; i++) if (state.acts[`${a.id}-${i}`] > 0) n++;
    c -= (CONTROL.acts * n) / total;
  }
  c -= (CONTROL.events * Math.min(CONTROL.eventsNeeded, state.events[district] ?? 0)) / CONTROL.eventsNeeded;
  return Math.max(0, Math.round(c));
}

/**
 * ¿Se puede empezar una misión? Pide que estén hechas las misiones de su
 * lista `after` ('torre:cero' = torre del barrio tomada) y no estar ya hecha,
 * salvo las repetibles.
 */
export function missionAvailable(state, def) {
  if (!def.repeat && state.done[def.id]) return false;
  const ok = (id) => (id.startsWith('torre:') ? !!state.towers[id.slice(6)] : !!state.done[id]);
  return (def.after ?? []).every(ok);
}

/** Medalla según el resultado y los umbrales { gold, silver, bronze } (más es mejor salvo `lower`). */
export function medalFor(value, t, lower = false) {
  const better = (a, b) => (lower ? a <= b : a >= b);
  if (better(value, t.gold)) return 3;
  if (better(value, t.silver)) return 2;
  if (better(value, t.bronze)) return 1;
  return 0;
}

export const MEDALS = ['Sin medalla', 'Bronce', 'Plata', 'Oro'];
