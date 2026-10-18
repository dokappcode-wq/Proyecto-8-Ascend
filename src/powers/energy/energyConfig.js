/**
 * Parámetros de la familia Energía (ajustables sin tocar la lógica).
 * Distancias en metros, tiempos en segundos.
 */
export const ENERGY_CONFIG = Object.freeze({
  pool: { max: 100, regenPerSecond: 16, regenDelay: 0.8 },

  projectile: {
    id: 'proyectil', name: 'Proyectil energético', action: 'attack',
    cost: 4, cooldown: 0.2,
    damage: 10, speed: 60, range: 45, radius: 0.12,
    // Cargador: 10 disparos y recarga automática al vaciarse.
    magazineSize: 10, reloadTime: 1.3,
  },
  dash: {
    id: 'dash', name: 'Dash energético', action: 'special',
    cost: 15, cooldown: 1.0,
    speed: 26, duration: 0.17, airDashes: 1,
    // Dash dirigido: apuntar (clic der.) + mantener Q muestra la silueta; soltar = desplazarse allí.
    targetedCost: 25, targetedMaxDistance: 20, targetedSpeed: 45,
  },
  discharge: {
    id: 'descarga', name: 'Descarga concentrada', action: 'charged',
    cost: 30, cooldown: 1.5,
    minCharge: 0.35, fullCharge: 1.4,
    damageMin: 25, damageMax: 60,
    speed: 70, range: 60, radius: 0.35,
    splashRadius: 2.5, splashKnockback: 7,
  },
  wave: {
    id: 'onda', name: 'Onda expansiva', action: 'wave',
    cost: 35, cooldown: 5,
    radius: 7.5, damage: 30, knockback: 14,
    // En el aire (G): caída en forma de rayo y explosión al tocar suelo.
    // El daño y el radio crecen con la altura de la caída. Sin daño por caída.
    diveMinHeight: 1.5, diveSpeed: 42,
    diveRadius: 6, diveRadiusPerMeter: 0.25, diveRadiusMax: 11,
    diveDamage: 40, diveDamagePerMeter: 1.5, diveDamageMax: 80, diveKnockback: 18,
  },
});
