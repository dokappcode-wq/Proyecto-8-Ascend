/**
 * Magazine — cargador para habilidades de proyectiles.
 *
 * Permite disparar `size` veces; al vaciarse empieza una recarga de
 * `reloadTime` segundos y después vuelve a estar lleno. Es independiente del
 * tipo de proyectil, así que sirve para poderes, armas de la PDC o Acólitos.
 */
export class Magazine {
  constructor({ size, reloadTime }) {
    this.size = size;
    this.reloadTime = reloadTime;
    this.ammo = size;
    this.reloading = false;
    this._timer = 0;
  }

  get canFire() {
    return !this.reloading && this.ammo > 0;
  }

  /** 0..1 durante la recarga (0 si no está recargando). */
  get reloadProgress() {
    return this.reloading ? 1 - this._timer / this.reloadTime : 0;
  }

  /** Gasta una bala. Si se vacía, empieza a recargar. Devuelve false si no podía disparar. */
  consume() {
    if (!this.canFire) return false;
    this.ammo--;
    if (this.ammo === 0) this.startReload();
    return true;
  }

  /** Inicia la recarga (si no está lleno ni recargando ya). */
  startReload() {
    if (this.reloading || this.ammo === this.size) return false;
    this.reloading = true;
    this._timer = this.reloadTime;
    return true;
  }

  /** Devuelve true en el frame en que termina la recarga. */
  update(dt) {
    if (!this.reloading) return false;
    this._timer -= dt;
    if (this._timer > 0) return false;
    this.reloading = false;
    this._timer = 0;
    this.ammo = this.size;
    return true;
  }

  refill() {
    this.ammo = this.size;
    this.reloading = false;
    this._timer = 0;
  }
}
