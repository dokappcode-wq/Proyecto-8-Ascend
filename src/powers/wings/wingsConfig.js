/**
 * Parámetros de la familia Alas. Las plumas son a la vez la munición y la
 * carga: 100 plumas (más con el nivel), que se regeneran solas con el tiempo.
 * Distancias en metros, tiempos en segundos.
 */
export const WINGS_CONFIG = Object.freeze({
  // Plumas: se regeneran (más rápido absorbiendo de palomares y cojines)
  pool: { max: 100, regenPerSecond: 5, regenDelay: 1.5 },
  drain: { rate: 40, range: 3 },

  /** Disparo: cada pluma es una bala (gasta una pluma). */
  projectile: {
    id: 'plumas', name: 'Plumas', action: 'attack',
    cost: 1, cooldown: 0.09,
    damage: 6, speed: 70, range: 40, radius: 0.08,
  },
  /** Q (alterna): modo vuelo. La velocidad va de minSpeed (sin plumas) a maxSpeed (todas). */
  flight: {
    id: 'vuelo', name: 'Vuelo', action: 'special',
    cost: 0, cooldown: 0.3, minSpeed: 6, maxSpeed: 20, response: 4,
  },
  /** Habilidad 1 (R): espada de plumas. Mantener R la agranda (más plumas, más daño). */
  sword: {
    id: 'espada', name: 'Espada de plumas', action: 'charged',
    cost: 20, cooldown: 0.4, growCost: 10, growEvery: 0.45, maxLevel: 3,
    bonus: 0.2, bonusPerLevel: 0.1, rangeAdd: 0.5, rangePerLevel: 0.35, life: 30,
  },
  /** Habilidad 2 (G): lluvia de plumas sobre la zona señalada. */
  rain: {
    id: 'lluvia', name: 'Lluvia de plumas', action: 'wave',
    cost: 50, cooldown: 6, range: 24, radius: 4.5, feathers: 30, damage: 4, hitRadius: 1.6,
    airTime: 0.7, groundTime: 1.5, apex: 12,
  },
  /** Pasiva (Plumaje): las plumas absorben el 20 % del daño recibido (1 pluma por punto). */
  passive: { absorb: 0.2, feathersPerPoint: 1 },
  /** Habilidad 3 (X): escudo de plumas delante; aguanta un ataque. */
  shield: {
    id: 'escudo', name: 'Escudo de plumas', action: 'grenade',
    cost: 10, cooldown: 1.5, distance: 1.6, width: 2.6, height: 2.3, thickness: 0.3, hits: 1, life: 20,
  },
});
