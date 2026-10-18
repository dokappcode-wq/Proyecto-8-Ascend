/**
 * EnergyPool — recurso que consumen las habilidades.
 * Se regenera tras un breve retardo desde el último gasto.
 * Es un límite de gameplay, no un castigo por poseer marcas (Regla VI).
 */
export class EnergyPool {
  constructor({ max = 100, regenPerSecond = 14, regenDelay = 0.8 } = {}) {
    this.max = max;
    this.value = max;
    this.regenPerSecond = regenPerSecond;
    this.regenDelay = regenDelay;
    this.infinite = false;
    this._sinceSpend = Infinity;
  }

  get ratio() {
    return this.value / this.max;
  }

  canSpend(amount) {
    return this.infinite || this.value >= amount;
  }

  /** Gasta `amount` si hay suficiente. Devuelve true si se gastó. */
  spend(amount) {
    if (!this.canSpend(amount)) return false;
    if (!this.infinite) this.value -= amount;
    this._sinceSpend = 0;
    return true;
  }

  refill() {
    this.value = this.max;
  }

  update(dt) {
    this._sinceSpend += dt;
    if (this.infinite) {
      this.value = this.max;
      return;
    }
    if (this._sinceSpend >= this.regenDelay && this.value < this.max) {
      this.value = Math.min(this.max, this.value + this.regenPerSecond * dt);
    }
  }
}
