/**
 * Ability — base de una habilidad: coste de energía y tiempo de reutilización.
 * Las subclases implementan `activate(ctx)` y, si lo necesitan, `update(dt, ctx)`.
 */
export class Ability {
  /**
   * @param {object} def { id, name, action, cost, cooldown }
   */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.cooldown = 0;
  }

  get cooldownRatio() {
    return this.def.cooldown > 0 ? this.cooldown / this.def.cooldown : 0;
  }

  get ready() {
    return this.cooldown <= 0;
  }

  /** Comprueba tiempo de reutilización y energía disponible. */
  canActivate(energy, cost = this.def.cost) {
    return this.ready && energy.canSpend(cost);
  }

  /** Gasta la energía y arranca el tiempo de reutilización. */
  commit(energy, cost = this.def.cost) {
    if (!this.canActivate(energy, cost)) return false;
    energy.spend(cost);
    this.cooldown = this.def.cooldown;
    return true;
  }

  tick(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
  }

  reset() {
    this.cooldown = 0;
  }
}
