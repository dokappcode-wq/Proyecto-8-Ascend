/**
 * Quemadura (pasiva de Temperatura): 1 de daño cada `interval` segundos hasta
 * `total`. No se acumula: mientras arde, volver a encenderla no hace nada.
 */
export class BurnStatus {
  constructor({ total, interval }) {
    this.total = total;
    this.interval = interval;
    this.left = 0;
    this._t = 0;
  }

  get active() {
    return this.left > 0;
  }

  /** Enciende la quemadura. Devuelve false si ya estaba ardiendo. */
  ignite() {
    if (this.active) return false;
    this.left = this.total;
    this._t = 0;
    return true;
  }

  clear() {
    this.left = 0;
    this._t = 0;
  }

  /** Avanza el tiempo y devuelve el daño a aplicar en este paso. */
  update(dt) {
    if (!this.active) return 0;
    this._t += dt;
    let dmg = 0;
    while (this._t >= this.interval && this.left > 0) {
      this._t -= this.interval;
      this.left--;
      dmg++;
    }
    return dmg;
  }
}
