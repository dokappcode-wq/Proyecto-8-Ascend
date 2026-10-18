/**
 * EnergyReserve — energía almacenada en una fuente del entorno (farola,
 * armario eléctrico, máquina expendedora…). Se agota al absorberla y se
 * recupera sola con el tiempo, para que nunca falte carga en el mapa.
 * Sin Three.js.
 */
export class EnergyReserve {
  /** @param {object} o { capacity, rechargeTime (s para recuperarse del todo), rechargeDelay } */
  constructor({ capacity = 80, rechargeTime = 20, rechargeDelay = 3 } = {}) {
    this.capacity = capacity;
    this.value = capacity;
    this.rechargeTime = rechargeTime;
    this.rechargeDelay = rechargeDelay;
    this._sinceDrain = Infinity;
  }

  get ratio() {
    return this.value / this.capacity;
  }

  get empty() {
    return this.value <= 1e-6;
  }

  /** Extrae hasta `amount`. Devuelve lo extraído. */
  drain(amount) {
    const taken = Math.min(this.value, Math.max(0, amount));
    this.value -= taken;
    if (taken > 0) this._sinceDrain = 0;
    return taken;
  }

  update(dt) {
    this._sinceDrain += dt;
    if (this._sinceDrain >= this.rechargeDelay && this.value < this.capacity) {
      this.value = Math.min(this.capacity, this.value + (this.capacity / this.rechargeTime) * dt);
    }
  }

  reset() {
    this.value = this.capacity;
    this._sinceDrain = Infinity;
  }
}
