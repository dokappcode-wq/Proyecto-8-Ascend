/**
 * EnemyBrain — máquina de estados de la IA enemiga (sin Three.js).
 *
 * Estados: patrol (patrulla) → alert (alerta) → attack (ataque) /
 * chase (persecución, incluye búsqueda) → recover (recuperación tras un
 * impacto fuerte) → neutralized (neutralizado, terminal).
 *
 * Recibe percepciones ya calculadas por el enemigo y devuelve una intención
 * (moverse, mirar, disparar). La navegación y el disparo los ejecuta el
 * enemigo, de modo que el mismo cerebro sirve para la PDC y los Acólitos.
 */

export const BRAIN_DEFAULTS = Object.freeze({
  reactionTime: 0.6, // tiempo en alerta antes de actuar
  loseSightTime: 1.5, // sin ver al objetivo → persecución
  searchTime: 6, // búsqueda en la última posición conocida → patrulla
  staggerTime: 0.6, // recuperación tras un impacto fuerte
  attackRange: 26,
  preferredMin: 8,
  preferredMax: 16,
});

export const STATE_NAMES = Object.freeze({
  patrol: 'Patrulla', alert: 'Alerta', chase: 'Persecución', attack: 'Ataque', recover: 'Recuperación', neutralized: 'Neutralizado',
});

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class EnemyBrain {
  constructor(cfg = {}) {
    this.cfg = { ...BRAIN_DEFAULTS, ...cfg };
    this.state = 'patrol';
    this.timer = 0;
    this.lastKnown = null;
    this.sinceSeen = Infinity;
    this.searching = false;
    this._resume = 'chase';
  }

  _enter(state, timer = 0) {
    this.state = state;
    this.timer = timer;
    if (state === 'chase') this.searching = false;
  }

  /**
   * @param {number} dt
   * @param {object} p percepción {
   *   selfPos, canSee, targetPos,
   *   heard: {x,y,z}|null   (ruido, p. ej. un disparo cercano),
   *   damagedFrom: {x,y,z}|null (recibió daño; posición aproximada del atacante),
   *   heavyHit: boolean, dead: boolean, atGoal: boolean }
   * @returns {{ move:'none'|'patrol'|'goto'|'approach'|'retreat'|'strafe'|'hold', goal, run, face, fire }}
   */
  update(dt, p) {
    const c = this.cfg;
    if (this.state === 'neutralized') return { move: 'none', fire: false };
    if (p.dead) {
      this._enter('neutralized');
      return { move: 'none', fire: false };
    }

    if (p.canSee) {
      this.lastKnown = { ...p.targetPos };
      this.sinceSeen = 0;
    } else {
      this.sinceSeen += dt;
    }
    if (p.damagedFrom && !p.canSee) this.lastKnown = { ...p.damagedFrom };

    // Un impacto fuerte interrumpe cualquier estado
    if (p.heavyHit) {
      if (this.state !== 'recover') this._resume = this.state === 'patrol' || this.state === 'alert' ? 'chase' : this.state;
      this._enter('recover', c.staggerTime);
    }

    switch (this.state) {
      case 'patrol': {
        if (p.canSee) this._enter('alert', c.reactionTime);
        else if (p.damagedFrom) this._enter('alert', c.reactionTime * 0.5);
        else if (p.heard) {
          this.lastKnown = { ...p.heard };
          this._enter('alert', c.reactionTime);
        }
        if (this.state === 'patrol') return { move: 'patrol', run: false, fire: false };
        return { move: 'hold', face: this.lastKnown, fire: false };
      }
      case 'alert': {
        this.timer -= dt;
        if (this.timer <= 0) this._enter(p.canSee ? 'attack' : 'chase');
        return { move: 'hold', face: this.lastKnown, fire: false };
      }
      case 'recover': {
        this.timer -= dt;
        if (this.timer <= 0) this._enter(p.canSee ? 'attack' : this._resume === 'attack' ? 'chase' : this._resume);
        return { move: 'none', fire: false };
      }
      case 'attack': {
        if (!p.canSee) {
          if (this.sinceSeen > c.loseSightTime) this._enter('chase');
          return { move: 'goto', goal: this.lastKnown, run: false, face: this.lastKnown, fire: false };
        }
        const d = dist2(p.selfPos, p.targetPos);
        let move = 'strafe';
        if (d > c.attackRange || d > c.preferredMax) move = 'approach';
        else if (d < c.preferredMin) move = 'retreat';
        return { move, goal: p.targetPos, run: d > c.attackRange, face: p.targetPos, fire: d <= c.attackRange };
      }
      case 'chase': {
        if (p.canSee) {
          const d = dist2(p.selfPos, p.targetPos);
          if (d <= c.attackRange) {
            this._enter('attack');
            return { move: 'hold', face: p.targetPos, fire: false };
          }
          return { move: 'goto', goal: p.targetPos, run: true, face: p.targetPos, fire: false };
        }
        if (!this.searching && (p.atGoal || !this.lastKnown)) {
          this.searching = true;
          this.timer = c.searchTime;
        }
        if (this.searching) {
          this.timer -= dt;
          if (this.timer <= 0) {
            this.lastKnown = null;
            this._enter('patrol');
            return { move: 'patrol', run: false, fire: false };
          }
          return { move: 'hold', face: null, fire: false };
        }
        return { move: 'goto', goal: this.lastKnown, run: true, face: this.lastKnown, fire: false };
      }
      default:
        return { move: 'none', fire: false };
    }
  }
}
