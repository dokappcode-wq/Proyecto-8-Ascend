/**
 * Reputation — relación del protagonista con las facciones (sin Three.js).
 *
 * Arquitectura preparada para varias facciones; en el prototipo solo la PDC
 * reacciona (hostilidad). El resto de facciones existen como datos para que
 * futuras acciones (proteger civiles, ayudar a una Encarnación…) puedan
 * añadir reglas sin cambiar el sistema.
 */

export const FACTIONS = Object.freeze({
  pdc: { id: 'pdc', name: 'PDC', reacts: true },
  encarnaciones: { id: 'encarnaciones', name: 'Encarnaciones', reacts: false },
  acolitos: { id: 'acolitos', name: 'Acólitos', reacts: false },
  ciudadanos: { id: 'ciudadanos', name: 'Ciudadanos', reacts: false },
});

/** Cambios de hostilidad por acción (0..100). */
export const REPUTATION_RULES = Object.freeze({
  'pdc:attacked': { pdc: 70 }, // dañar a un agente
  'pdc:killed': { pdc: 100 }, // neutralizar a un agente
  'pdc:power-seen': { pdc: 22 }, // usar poderes a la vista de la PDC
});

export const HOSTILITY_LEVELS = Object.freeze([
  { id: 'calm', min: 0, name: 'Tranquila' },
  { id: 'watchful', min: 25, name: 'Vigilante' },
  { id: 'hostile', min: 60, name: 'Hostil' },
]);

export const REPUTATION_CONFIG = Object.freeze({
  /** Segundos sin ser visto por la facción antes de que la hostilidad baje. */
  decayDelay: 12,
  /** Puntos por segundo que baja después. */
  decayRate: 4,
});

export class Reputation {
  /** @param {object} [base] hostilidad mínima por facción (p. ej. { pdc: 100 } en un simulacro) */
  constructor(base = {}, cfg = {}) {
    this.cfg = { ...REPUTATION_CONFIG, ...cfg };
    this.reset(base);
  }

  reset(base = {}) {
    this.base = {};
    this.hostility = {};
    this._unseen = {};
    for (const id of Object.keys(FACTIONS)) {
      this.base[id] = base[id] ?? 0;
      this.hostility[id] = this.base[id];
      this._unseen[id] = 0;
    }
  }

  level(faction) {
    const h = this.hostility[faction] ?? 0;
    let lvl = HOSTILITY_LEVELS[0];
    for (const l of HOSTILITY_LEVELS) if (h >= l.min) lvl = l;
    return lvl;
  }

  isHostile(faction) {
    return this.level(faction).id === 'hostile';
  }

  /**
   * Aplica una acción del jugador.
   * @returns {Array<{faction, before, after, from, to}>} cambios de nivel producidos
   */
  report(action) {
    const rule = REPUTATION_RULES[action];
    if (!rule) return [];
    const changes = [];
    for (const [f, delta] of Object.entries(rule)) {
      if (!FACTIONS[f]?.reacts) continue;
      const from = this.level(f).id;
      const before = this.hostility[f];
      this.hostility[f] = Math.max(this.base[f], Math.min(100, before + delta));
      this._unseen[f] = 0;
      const to = this.level(f).id;
      if (from !== to) changes.push({ faction: f, before, after: this.hostility[f], from, to });
    }
    return changes;
  }

  /**
   * La hostilidad baja si la facción no ve al jugador durante un tiempo.
   * @param {object} seen { pdc: true } si algún miembro le ve ahora
   * @returns {Array} cambios de nivel (como `report`)
   */
  update(dt, seen = {}) {
    const changes = [];
    for (const f of Object.keys(FACTIONS)) {
      if (!FACTIONS[f].reacts) continue;
      if (seen[f]) {
        this._unseen[f] = 0;
        continue;
      }
      this._unseen[f] += dt;
      if (this._unseen[f] < this.cfg.decayDelay || this.hostility[f] <= this.base[f]) continue;
      const from = this.level(f).id;
      const before = this.hostility[f];
      this.hostility[f] = Math.max(this.base[f], before - this.cfg.decayRate * dt);
      const to = this.level(f).id;
      if (from !== to) changes.push({ faction: f, before, after: this.hostility[f], from, to });
    }
    return changes;
  }
}
