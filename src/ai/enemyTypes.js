/**
 * Tipos de enemigo (datos ajustables).
 * Velocidades en m/s, distancias en metros, tiempos en segundos, ángulos en grados.
 */
export const ENEMY_TYPES = Object.freeze({
  pdc: {
    id: 'pdc',
    name: 'Agente PDC',
    variant: 'pdc',
    /** Facción para la reputación: la PDC solo ataca si es hostil. */
    faction: 'pdc',
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
    faction: 'acolitos',
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
  /**
   * Agente reforzado (prólogo): armadura pesada, mucha salud y ráfagas de
   * fusil. Sin escudo: no es un Blindado.
   */
  reforzado: {
    id: 'reforzado',
    name: 'Agente reforzado',
    variant: 'pdc',
    gear: 'heavy',
    faction: 'pdc',
    health: 220,
    walkSpeed: 2,
    runSpeed: 3.8,
    strafeSpeed: 2.2,
    viewRange: 30,
    fov: 120,
    hearRange: 22,
    heavyHit: 45,
    brain: { reactionTime: 0.8, loseSightTime: 2, searchTime: 8, staggerTime: 0.4, attackRange: 26, preferredMin: 7, preferredMax: 14 },
    weapon: {
      kind: 'bullet', damage: 7, speed: 95, range: 40, radius: 0.05, color: '#ff9d5c',
      cadence: 0.12, magazineSize: 6, reloadTime: 2.2, spread: 0.04, knockback: 1,
    },
  },
  /** Dron del tutorial (prólogo): poca salud, lento, avisa con un láser antes de cada disparo. */
  dronTutorial: {
    id: 'dronTutorial',
    name: 'Dron PDC',
    model: 'drone',
    faction: 'pdc',
    health: 24,
    walkSpeed: 3,
    runSpeed: 4,
    strafeSpeed: 3,
    viewRange: 30,
    fov: 360,
    hearRange: 22,
    heavyHit: 15,
    height: 0.6,
    radius: 0.45,
    meleeMul: 0.25,
    flying: { hover: 3.8, response: 2.5 },
    brain: { reactionTime: 0.9, loseSightTime: 2, searchTime: 6, staggerTime: 0.5, attackRange: 24, preferredMin: 8, preferredMax: 14 },
    weapon: {
      kind: 'bullet', damage: 3, speed: 60, range: 30, radius: 0.05, color: '#7fd8ff',
      cadence: 1.4, magazineSize: 3, reloadTime: 2.5, spread: 0.12, knockback: 0.2, aimTime: 0.7, lockTime: 0.35,
    },
  },
  /**
   * Blindado: escudo antidisturbios delante. Por delante solo le llega el 10 %
   * del daño; hay que rodearlo, atacarlo desde arriba (tormenta, lluvia,
   * estela) o quitarle el apoyo (flotar, lanzar, atar, congelar).
   */
  blindado: {
    id: 'blindado',
    name: 'Blindado PDC',
    variant: 'pdc',
    gear: 'shield',
    faction: 'pdc',
    health: 150,
    walkSpeed: 1.8,
    runSpeed: 3.4,
    strafeSpeed: 1.8,
    viewRange: 26,
    fov: 110,
    hearRange: 20,
    heavyHit: 40,
    shield: { arc: 75, mul: 0.1 },
    brain: { reactionTime: 0.8, loseSightTime: 2, searchTime: 8, staggerTime: 0.4, attackRange: 13, preferredMin: 3, preferredMax: 7 },
    weapon: {
      kind: 'bullet', damage: 5, pellets: 5, speed: 80, range: 16, radius: 0.05, color: '#ffb26a',
      cadence: 1.2, magazineSize: 4, reloadTime: 2.4, spread: 0.09, knockback: 2,
    },
  },
  /**
   * Francotirador: quieto en alto, ve muy lejos y apunta con un láser antes
   * de disparar (1.3 s): da tiempo a cubrirse o a salir de la línea.
   */
  francotirador: {
    id: 'francotirador',
    name: 'Francotirador PDC',
    variant: 'pdc',
    gear: 'rifle',
    faction: 'pdc',
    health: 60,
    walkSpeed: 0,
    runSpeed: 0.01,
    strafeSpeed: 0,
    stationary: true,
    viewRange: 65,
    fov: 150,
    hearRange: 25,
    heavyHit: 20,
    brain: { reactionTime: 0.9, loseSightTime: 2.5, searchTime: 6, staggerTime: 0.6, attackRange: 65, preferredMin: 0, preferredMax: 99 },
    weapon: {
      kind: 'bullet', damage: 28, speed: 200, range: 75, radius: 0.06, color: '#ff3b3b',
      cadence: 3, magazineSize: 5, reloadTime: 3, spread: 0.004, knockback: 4, aimTime: 1.3, lockTime: 0.3,
    },
  },
  /**
   * Dron: vuela a unos metros del suelo; los golpes cuerpo a cuerpo apenas le
   * hacen daño (25 %). Atado, aturdido o congelado cae y se daña al chocar.
   */
  dron: {
    id: 'dron',
    name: 'Dron de vigilancia',
    model: 'drone',
    faction: 'pdc',
    health: 45,
    walkSpeed: 5,
    runSpeed: 7,
    strafeSpeed: 5,
    viewRange: 30,
    fov: 360,
    hearRange: 22,
    heavyHit: 20,
    height: 0.6,
    radius: 0.45,
    meleeMul: 0.25,
    flying: { hover: 4.5, response: 3 },
    brain: { reactionTime: 0.4, loseSightTime: 1.5, searchTime: 6, staggerTime: 0.3, attackRange: 24, preferredMin: 7, preferredMax: 13 },
    weapon: {
      kind: 'bullet', damage: 4, speed: 85, range: 30, radius: 0.04, color: '#7fd8ff',
      cadence: 0.22, magazineSize: 8, reloadTime: 1.8, spread: 0.05, knockback: 0.3,
    },
  },
});

/**
 * Tipo con la dificultad ajustada (pura, para las pruebas): mismo id y
 * aspecto, otros números. `mods`: { health, damage (multiplicadores),
 * cadence (multiplica el tiempo entre disparos), spread (multiplica la
 * dispersión), reaction (multiplica el tiempo de reacción) }.
 */
export function scaleType(type, mods = {}) {
  const k = (v, m) => (m === undefined ? v : v * m);
  return {
    ...type,
    health: Math.max(1, Math.round(k(type.health, mods.health))),
    brain: { ...type.brain, reactionTime: k(type.brain.reactionTime, mods.reaction) },
    weapon: { ...type.weapon, damage: k(type.weapon.damage, mods.damage), cadence: k(type.weapon.cadence, mods.cadence), spread: k(type.weapon.spread, mods.spread) },
  };
}

/** Daños que llegan desde arriba o desde el suelo: el escudo no los para. */
const UNBLOCKABLE = new Set(['burn', 'tormenta', 'lluvia', 'estela', 'fall', 'granada', 'caída']);

/**
 * Daño que recibe un enemigo según su tipo (pura, para las pruebas).
 * @param {object} type tipo de enemigo
 * @param {number} amount daño
 * @param {object} o { kind, facing (rad), self {x,z}, from {x,z}|null, vulnerable (flota, aturdido, en el aire…) }
 * @returns {{ amount: number, blocked: boolean }}
 */
export function enemyDamage(type, amount, { kind = 'generic', facing = 0, self = null, from = null, vulnerable = false } = {}) {
  let out = amount;
  let blocked = false;
  if (type.meleeMul !== undefined && /^melee/.test(kind)) out *= type.meleeMul;
  const sh = type.shield;
  if (sh && !vulnerable && from && self && !UNBLOCKABLE.has(kind) && !kind.startsWith('combo-')) {
    const dx = from.x - self.x;
    const dz = from.z - self.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01) {
      const cos = (Math.sin(facing) * dx + Math.cos(facing) * dz) / d;
      if (cos >= Math.cos((sh.arc * Math.PI) / 180)) {
        out *= sh.mul;
        blocked = true;
      }
    }
  }
  return { amount: out > 0 ? Math.max(1, Math.round(out)) : 0, blocked };
}
