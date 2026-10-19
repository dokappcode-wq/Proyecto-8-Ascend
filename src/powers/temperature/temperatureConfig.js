/**
 * Parámetros de la familia Temperatura (frío y calor).
 * Distancias en metros, tiempos en segundos.
 */
export const TEMPERATURE_CONFIG = Object.freeze({
  // Sin regeneración: se absorbe de arcones congeladores y bidones con fuego.
  pool: { max: 150, regenPerSecond: 0, regenDelay: 0.8 },
  drain: { rate: 60, range: 3 },

  /** Disparo: 10 balas; alterna hielo (mano derecha) y fuego (mano izquierda), mismo daño. */
  projectile: {
    id: 'hielo-fuego', name: 'Hielo y fuego', action: 'attack',
    cost: 2, cooldown: 0.16,
    damage: 10, speed: 58, range: 45, radius: 0.16, magazineSize: 10, reloadTime: 1.3,
  },
  /** Q (alterna): suelo sin fricción para patinar; en una pared, se patina por ella cayendo en U. */
  skate: {
    id: 'patinar', name: 'Patinar', action: 'special',
    cost: 4, cooldown: 0.3, drainPerSecond: 3,
    maxSpeed: 13, accel: 14, decel: 1.2,
    wallMinSpeed: 6, wallGravity: 0.5, wallLift: 0.75, wallTime: 2.4,
  },
  /** Shift patinando: fuego hacia atrás (más velocidad) y plataforma de hielo hacia donde se apunta. */
  iceRun: { drainPerSecond: 14, speed: 17, maxPitch: 35, tileEvery: 0.9, tileLife: 7, tileSize: 1.8 },
  /** Habilidad 1 (R): muro de hielo delante. */
  wall: {
    id: 'muro', name: 'Muro de hielo', action: 'charged',
    cost: 18, cooldown: 4, distance: 2.6, width: 4.8, height: 2.6, thickness: 0.5, life: 10,
  },
  /** Habilidad 2 (G): estela de fuego delante. */
  trail: {
    id: 'estela', name: 'Estela de fuego', action: 'wave',
    cost: 18, cooldown: 4, length: 11, width: 1.6, life: 5, dps: 9,
  },
  /** Habilidad 3 (X): fuego frío, una nube que descarga una tormenta. */
  storm: {
    id: 'tormenta', name: 'Fuego frío', action: 'grenade',
    cost: 30, cooldown: 8, radius: 6.5, height: 7, life: 8, dps: 7,
  },
  /** Pasiva: los golpes físicos queman: 1 de daño por tic hasta 10 (no se acumula). */
  burn: { total: 10, interval: 0.5 },
});
