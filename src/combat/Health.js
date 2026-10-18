/**
 * Health — salud con regeneración retardada e invulnerabilidad temporal.
 * La usan el jugador y los enemigos.
 */
export class Health {
  /**
   * @param {object} o { max, regenPerSecond=0, regenDelay=4 }
   */
  constructor({ max, regenPerSecond = 0, regenDelay = 4 }) {
    this.max = max;
    this.value = max;
    this.regenPerSecond = regenPerSecond;
    this.regenDelay = regenDelay;
    this.invulnerable = 0; // segundos restantes
    this.godMode = false; // depuración
    this._sinceHit = Infinity;
  }

  get alive() {
    return this.value > 0;
  }

  get ratio() {
    return this.value / this.max;
  }

  /** Aplica daño; devuelve el daño real. */
  damage(amount) {
    if (!this.alive || amount <= 0 || this.invulnerable > 0 || this.godMode) return 0;
    const dealt = Math.min(amount, this.value);
    this.value -= dealt;
    this._sinceHit = 0;
    return dealt;
  }

  heal(amount) {
    if (!this.alive) return 0;
    const before = this.value;
    this.value = Math.min(this.max, this.value + amount);
    return this.value - before;
  }

  reset(invulnerableFor = 0) {
    this.value = this.max;
    this.invulnerable = invulnerableFor;
    this._sinceHit = Infinity;
  }

  update(dt) {
    this._sinceHit += dt;
    if (this.invulnerable > 0) this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.alive && this.regenPerSecond > 0 && this._sinceHit >= this.regenDelay && this.value < this.max) {
      this.value = Math.min(this.max, this.value + this.regenPerSecond * dt);
    }
  }
}
