/**
 * Tipos de enemigo (datos ajustables).
 * Velocidades en m/s, distancias en metros, tiempos en segundos, ángulos en grados.
 */
export const ENEMY_TYPES = Object.freeze({
  pdc: {
    id: 'pdc',
    name: 'Agente PDC',
    variant: 'pdc',
    health: 80,
    walkSpeed: 2.2,
    runSpeed: 4.6,
    strafeSpeed: 2.6,
    viewRange: 28,
    fov: 110,
    hearRange: 20,
    heavyHit: 25, // daño que provoca recuperación (aturdimiento)
    brain: { reactionTime: 0.7, loseSightTime: 1.6, searchTime: 7, staggerTime: 0.5, attackRange: 26, preferredMin: 9, preferredMax: 18 },
    weapon: {
      kind: 'bullet', damage: 6, speed: 90, range: 40, radius: 0.05, color: '#ffcf6a',
      cadence: 0.32, magazineSize: 12, reloadTime: 2.0, spread: 0.035, knockback: 0.5,
    },
  },
  acolyte: {
    id: 'acolyte',
    name: 'Acólito de Energía',
    variant: 'acolyte',
    glow: '#b45cff',
    health: 110,
    walkSpeed: 2.4,
    runSpeed: 4.8,
    strafeSpeed: 3.4,
    viewRange: 26,
    fov: 120,
    hearRange: 18,
    heavyHit: 30,
    brain: { reactionTime: 0.5, loseSightTime: 1.4, searchTime: 6, staggerTime: 0.6, attackRange: 24, preferredMin: 8, preferredMax: 15 },
    weapon: {
      kind: 'orb', damage: 12, speed: 32, range: 35, radius: 0.18, color: '#b45cff',
      cadence: 0.85, magazineSize: 4, reloadTime: 2.2, spread: 0.02, knockback: 2,
    },
  },
});
