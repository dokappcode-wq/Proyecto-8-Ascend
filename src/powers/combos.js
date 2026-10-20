/**
 * Combos entre marcas (reglas puras, sin Three.js).
 *
 * Un combo salta cuando un ataque de una marca alcanza a un enemigo que está
 * bajo el efecto de otra. Los daños de los combos usan tipos `combo-*`, que
 * nunca disparan otro combo.
 */
export const COMBOS = Object.freeze({
  combustion: {
    id: 'combustion', name: 'Combustión', marks: ['gravedad', 'temperatura'],
    desc: 'Fuego sobre un enemigo que flota: explota.',
    damage: 30, radius: 3.5, knockback: 9,
  },
  cadena: {
    id: 'cadena', name: 'Descarga en cadena', marks: ['hilo', 'energia', 'temperatura'],
    desc: 'Rayos sobre un enemigo atado: la descarga salta a los de alrededor.',
    damage: 15, range: 9, jumps: 3, stun: 1.2,
  },
  plumas: {
    id: 'plumas', name: 'Plumas ardientes', marks: ['alas', 'temperatura'],
    desc: 'La lluvia de plumas sobre un enemigo que arde: las plumas prenden.',
    extraMul: 1,
  },
  escarcha: {
    id: 'escarcha', name: 'Escarcha', marks: ['temperatura', 'gravedad', 'hilo'],
    desc: 'Hielo sobre un enemigo que flota o está atado: se congela.',
    damage: 15, freeze: 3,
  },
});

const FIRE = new Set(['fuego', 'estela']);
const SHOCK = new Set(['tormenta', 'bolt', 'discharge', 'rayo', 'melee-energia']);

/**
 * ¿Provoca este golpe un combo?
 * @param {string} kind tipo de daño
 * @param {{ floating?: boolean, bound?: boolean, burning?: boolean }} st estado del objetivo antes del golpe
 * @returns {string|null} id del combo
 */
export function detectCombo(kind, st) {
  if (!kind || kind.startsWith('combo-')) return null;
  if (st.floating && FIRE.has(kind)) return 'combustion';
  if (st.bound && SHOCK.has(kind)) return 'cadena';
  if (st.burning && kind === 'lluvia') return 'plumas';
  if ((st.floating || st.bound) && kind === 'hielo') return 'escarcha';
  return null;
}

/** Objetivos de la descarga en cadena: los más cercanos al origen, dentro del alcance. */
export function chainTargets(origin, candidates, range, jumps) {
  return candidates
    .map((c) => ({ c, d: Math.hypot(c.x - origin.x, c.y - origin.y, c.z - origin.z) }))
    .filter((e) => e.d <= range)
    .sort((a, b) => a.d - b.d)
    .slice(0, jumps)
    .map((e) => e.c);
}
