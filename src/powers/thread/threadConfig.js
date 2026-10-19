/**
 * Parámetros de la familia Hilo (ajustables sin tocar la lógica).
 * Distancias en metros, tiempos en segundos.
 */
export const THREAD_CONFIG = Object.freeze({
  // Sin regeneración: se absorbe de tendederos y rollos de tela.
  pool: { max: 150, regenPerSecond: 0, regenDelay: 0.8 },
  drain: { rate: 60, range: 3 },

  /** Disparo (clic izq.): el puño se convierte en hilo y golpea; sin cargador, espera a que vuelva. */
  projectile: {
    id: 'hilos', name: 'Hilos', action: 'attack',
    cost: 2, cooldown: 0,
    damage: 14, range: 24, outSpeed: 70, backSpeed: 80, knockback: 3,
  },
  /** Movimiento (Q, mantener): hilo a la estructura más próxima y balanceo. */
  swing: {
    id: 'balanceo', name: 'Balanceo', action: 'special',
    cost: 4, cooldown: 0.25,
    range: 30, minHeight: 2.5, pump: 16, maxSpeed: 32, releaseBoost: 5, hop: 7,
  },
  /** Habilidad 1 (R): atar a un enemigo (inmovilizado). */
  bind: {
    id: 'atar', name: 'Atar', action: 'charged',
    cost: 15, cooldown: 1.5,
    range: 28, cone: 12, time: 4, damage: 6,
  },
  /** Habilidad 2 (G): lanzar al enemigo por los aires. */
  launch: {
    id: 'lanzar', name: 'Lanzar', action: 'wave',
    cost: 15, cooldown: 1.5,
    range: 26, cone: 12, damage: 12, up: 16, stun: 0.8,
  },
  /** Habilidad 3 (X): atraerse hacia un enemigo (hasta el cuerpo a cuerpo) o hacia una pared. */
  zip: {
    id: 'atraer', name: 'Atraer', action: 'grenade',
    cost: 10, cooldown: 0.8,
    range: 35, cone: 10, speed: 32, meleeDistance: 1.6,
  },
  /** Golpe (F) con carga: la cuerda gruesa como cadena, en barrido. */
  chain: { cost: 5, damage: 26, range: 4.6, arc: 80, knockback: 9 },
  /** Pasiva: mantener el salto da un salto alto (sin saltos extra ni planeo). */
  jumps: { airJumps: 0, airJumpVelocity: 0, holdGravityScale: 0.3, holdTime: 0.6, glide: false, glideFallSpeed: 0, glideSpeed: 0 },
});
