/**
 * AutoQuality — resolución dinámica (sin Three.js, se prueba con node:test).
 *
 * Mide los fotogramas por segundo en ventanas de `window` segundos y ajusta
 * un factor de escala de la resolución de render entre `min` y 1:
 *  - por debajo de `low` FPS baja un escalón (`step`);
 *  - por encima de `high` FPS, varias ventanas seguidas, sube un escalón;
 *  - tras cada cambio espera `cooldown` segundos (el cambio de tamaño de los
 *    búferes cuesta y no debe oscilar);
 *  - si ya está en el mínimo y sigue muy lento (< `critical`), pide quitar el
 *    MSAA (`msaa = false`); al recuperarse, lo devuelve antes de subir la escala.
 */
export class AutoQuality {
  constructor({ min = 0.6, step = 0.1, low = 45, high = 57, critical = 30, window = 1.5, cooldown = 4, upWindows = 3 } = {}) {
    Object.assign(this, { min, step, low, high, critical, window, cooldown, upWindows });
    this.reset();
  }

  reset() {
    this.scale = 1;
    this.msaa = true;
    this._frames = 0;
    this._time = 0;
    this._wait = 0;
    this._good = 0;
  }

  /**
   * Registra un fotograma de `dt` segundos reales. Devuelve true si cambió
   * `scale` o `msaa` (hay que redimensionar los búferes).
   */
  frame(dt) {
    if (!(dt > 0)) return false;
    this._frames++;
    this._time += dt;
    this._wait = Math.max(0, this._wait - dt);
    if (this._time < this.window) return false;
    const fps = this._frames / this._time;
    this._frames = 0;
    this._time = 0;
    if (this._wait > 0) return false;
    if (fps < this.low) {
      this._good = 0;
      if (this.scale > this.min + 1e-6) {
        this.scale = Math.max(this.min, +(this.scale - this.step).toFixed(3));
        return this._changed();
      }
      if (this.msaa && fps < this.critical) {
        this.msaa = false;
        return this._changed();
      }
      return false;
    }
    if (fps > this.high) {
      this._good++;
      if (this._good < this.upWindows) return false;
      this._good = 0;
      if (!this.msaa) {
        this.msaa = true;
        return this._changed();
      }
      if (this.scale < 1 - 1e-6) {
        this.scale = Math.min(1, +(this.scale + this.step).toFixed(3));
        return this._changed();
      }
      return false;
    }
    this._good = 0;
    return false;
  }

  _changed() {
    this._wait = this.cooldown;
    return true;
  }
}
