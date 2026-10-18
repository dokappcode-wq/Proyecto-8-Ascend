import { MARKS } from '../data/marks.js';
import { MarkVisual } from '../player/MarkVisual.js';

/**
 * MarkSystem — marcas que posee el protagonista y su representación visual.
 *
 * Posesión: `profile.marks` del guardado. Hasta la Etapa 4 (adquisición por
 * contacto y voluntad) la marca de Energía se concede mediante un ajuste de
 * depuración (`debug.grantEnergy`, activado por defecto en este prototipo).
 *
 * Intensidad visual: `pulse()` la eleva puntualmente (ataques) y decae;
 * `sustain()` la mantiene durante un frame (cargas).
 */
export class MarkSystem {
  constructor({ save, model, events }) {
    this.save = save;
    this.model = model;
    this.events = events;
    this.visuals = new Map();
    this._pulse = 0;
    this._hold = 0;
    this._sustain = 0;
    this.level = 0;
    this.refresh();
  }

  owns(id) {
    if (this.save.data.profile.marks.includes(id)) return true;
    return id === 'energia' && !!this.save.data.debug?.grantEnergy;
  }

  /** Familia de poderes activa (en el prototipo, la única marca copiada disponible). */
  get activeFamily() {
    return this.owns('energia') ? 'energia' : null;
  }

  get activeDef() {
    const f = this.activeFamily;
    return f ? MARKS[f] : null;
  }

  /** Sincroniza los visuales con las marcas poseídas. */
  refresh() {
    for (const id of Object.keys(MARKS)) {
      const def = MARKS[id];
      if (def.original) continue; // la marca del Destino forma parte del modelo
      const has = this.owns(id);
      if (has && !this.visuals.has(id)) this.visuals.set(id, new MarkVisual(this.model, def));
      if (!has && this.visuals.has(id)) {
        this.visuals.get(id).dispose();
        this.visuals.delete(id);
      }
    }
    this.events?.emit('marks:changed', { active: this.activeFamily });
  }

  setDebugGrant(id, value) {
    if (id !== 'energia') return;
    this.save.data.debug.grantEnergy = value;
    this.save.save();
    this.refresh();
  }

  pulse(amount, hold = 0.2) {
    if (amount >= this._pulse) this._hold = Math.max(this._hold, hold);
    this._pulse = Math.max(this._pulse, amount);
  }

  sustain(level) {
    this._sustain = Math.max(this._sustain, level);
  }

  update(dt) {
    if (this._hold > 0) this._hold -= dt;
    else this._pulse = Math.max(0, this._pulse - dt * 1.4);
    let target = Math.max(this._pulse, this._sustain);
    if (this.save.data.debug?.maxMarks) target = 1;
    this._sustain = 0;
    // Subida rápida, bajada suave
    const k = target > this.level ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 6);
    this.level += (target - this.level) * k;
    const v = this.visuals.get(this.activeFamily);
    v?.setIntensity(this.level);
  }

  reset() {
    this._pulse = this._hold = this._sustain = this.level = 0;
  }
}
