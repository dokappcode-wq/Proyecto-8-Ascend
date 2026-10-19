/**
 * Parámetros de la familia Gravedad (ajustables sin tocar la lógica).
 * Distancias en metros, tiempos en segundos.
 */
export const GRAVITY_CONFIG = Object.freeze({
  // Como la Energía, no se regenera sola: se absorbe de objetos pesados
  // (escombros, bloques de hormigón).
  pool: { max: 150, regenPerSecond: 0, regenDelay: 0.8 },
  drain: { rate: 60, range: 3 },

  /** Disparo: un solo proyectil por cargador; al impactar, el objetivo flota. */
  projectile: {
    id: 'disparo', name: 'Disparo gravitatorio', action: 'attack',
    cost: 5, cooldown: 0.3,
    damage: 18, speed: 46, range: 42, radius: 0.24,
    magazineSize: 1, reloadTime: 0.9,
    floatTime: 3, floatHeight: 1.8,
  },
  /** Movilidad (Q): eleva rocas bajo los pies, hasta 3 seguidas. */
  stones: {
    id: 'rocas', name: 'Elevar rocas', action: 'special',
    cost: 10, cooldown: 0.3,
    max: 3, life: 12, size: 1.8, thickness: 0.6,
    groundLift: 2.0, riseTime: 0.25,
  },
  /** Habilidad 1 (R): atrae a un enemigo, le daña y le aturde. */
  pull: {
    id: 'atraer', name: 'Atraer', action: 'charged',
    cost: 15, cooldown: 1.2,
    damage: 14, range: 30, cone: 12, stun: 1,
    pullDistance: 7, meleeDistance: 1.6, speed: 18,
  },
  /** Habilidad 2 (G): empuja todo lo que hay delante. */
  push: {
    id: 'empujar', name: 'Empujar', action: 'wave',
    cost: 18, cooldown: 1.4,
    damage: 20, range: 10, arc: 55, knockback: 18, lift: 0.35,
  },
  /** Habilidad 3 (X o botón central): granada de antigravedad. */
  grenade: {
    id: 'granada', name: 'Granada de gravedad', action: 'grenade',
    cost: 30, cooldown: 6,
    speed: 19, gravity: 16, fuse: 2.5, radius: 5.5, duration: 5,
    damage: 8, floatHeight: 2.2,
  },
  /** Saltos: mantener = más alto, hasta 3 saltos, mantener cayendo = planear. */
  jumps: { airJumps: 2, airJumpVelocity: 8.6, holdGravityScale: 0.45, holdTime: 0.4, glideFallSpeed: 2.2, glideSpeed: 8.5 },
  /** Pasiva: estasis de balas al bajar del 5 % de vida. */
  passive: { threshold: 0.05, duration: 4, cooldown: 30 },
});
