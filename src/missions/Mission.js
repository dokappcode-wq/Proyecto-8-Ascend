/**
 * Mission — estado de una misión (sin Three.js).
 *
 * inactive → active → completed. Los objetivos de tipo «neutralize» cuentan
 * enemigos neutralizados con una etiqueta concreta. La detección se registra
 * para el mensaje final y el HUD.
 */
export class Mission {
  constructor(def) {
    this.def = def;
    this.reset();
  }

  reset() {
    this.state = 'inactive';
    this.time = 0;
    this.detected = false;
    this.damageTaken = 0;
    this.objectives = this.def.objectives.map((o) => ({ ...o, done: 0 }));
  }

  get active() {
    return this.state === 'active';
  }

  get completed() {
    return this.state === 'completed';
  }

  activate() {
    if (this.state !== 'inactive') return false;
    this.state = 'active';
    return true;
  }

  update(dt) {
    if (this.active) this.time += dt;
  }

  /** Primera detección por un enemigo de la misión. Devuelve true la primera vez. */
  markDetected() {
    if (!this.active || this.detected) return false;
    this.detected = true;
    return true;
  }

  /**
   * Un enemigo con `tag` ha sido neutralizado.
   * @returns {{ objective: object|null, completed: boolean }}
   */
  onNeutralized(tag) {
    if (!this.active) return { objective: null, completed: false };
    const o = this.objectives.find((x) => x.kind === 'neutralize' && x.tag === tag && x.done < x.count);
    if (!o) return { objective: null, completed: false };
    o.done++;
    const completed = this.objectives.every((x) => x.done >= x.count);
    if (completed) this.state = 'completed';
    return { objective: o, completed };
  }

  /** Etiquetas cuyos enemigos siguen siendo objetivo. */
  get pendingTags() {
    return this.objectives.filter((o) => o.done < o.count).map((o) => o.tag);
  }
}
