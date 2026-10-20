import { MARKS, COPY_ORDER } from '../data/marks.js';
import { MarkVisual } from '../player/MarkVisual.js';

/**
 * MarkSystem — marcas que posee el protagonista y su representación visual.
 *
 * Posesión: `profile.marks` del guardado (persistente). Las marcas copiadas
 * se añaden con `acquire()` (PowerAcquisitionSystem). Para pruebas existe el
 * atajo de depuración `debug.grantEnergy`.
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
    /**
     * Perfil del modo historia: { marks, activeMark }. Mientras existe, sustituye
     * al perfil del modo libre (Jon empieza sin marcas y las gana en el guion)
     * y no cuentan los atajos de depuración.
     */
    this.storyProfile = null;
    this.refresh();
  }

  /** Perfil de marcas en uso (el de la historia o el del modo libre). */
  get profile() {
    return this.storyProfile ?? this.save.data.profile;
  }

  /** Activa (o quita, con null) el perfil de la historia. */
  useStoryProfile(profile) {
    this.storyProfile = profile;
    this.refresh();
  }

  owns(id) {
    if (this.profile.marks.includes(id)) return true;
    if (this.storyProfile) return false;
    const d = this.save.data.debug ?? {};
    return (id === 'energia' && !!d.grantEnergy) || (id === 'gravedad' && !!d.grantGravity) || (id === 'hilo' && !!d.grantThread) || (id === 'temperatura' && !!d.grantTemperature) || (id === 'alas' && !!d.grantWings);
  }

  /** Marcas copiadas que posee, en orden. */
  get ownedCopies() {
    return COPY_ORDER.filter((id) => this.owns(id));
  }

  /**
   * Familia de poderes activa: la elegida (guardada en el perfil) si la
   * posee; si no, la primera marca copiada que tenga.
   */
  get activeFamily() {
    const chosen = this.profile.activeMark;
    if (chosen && this.owns(chosen)) return chosen;
    return this.ownedCopies[0] ?? null;
  }

  /** Cambia la marca activa (si la posee). Devuelve true si cambió. */
  setActive(id) {
    if (!this.owns(id) || this.activeFamily === id) return false;
    this.profile.activeMark = id;
    this.save.save();
    this._pulse = Math.max(this._pulse, 0.7);
    this._hold = 0.25;
    this.events?.emit('marks:changed', { active: this.activeFamily });
    this.events?.emit('mark:switched', { active: id });
    return true;
  }

  /** Pasa a la siguiente marca copiada (tecla V). */
  cycle() {
    const list = this.ownedCopies;
    if (list.length < 2) return false;
    const i = list.indexOf(this.activeFamily);
    return this.setActive(list[(i + 1) % list.length]);
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
    // La marca del Destino forma parte del modelo: solo se ve si se posee
    const dm = this.model.destinoMark;
    if (dm) dm.plane.visible = dm.band.visible = this.owns('destino');
    this.events?.emit('marks:changed', { active: this.activeFamily });
  }

  /** Registra una marca adquirida y la guarda. */
  acquire(id) {
    const marks = this.profile.marks;
    if (!marks.includes(id)) marks.push(id);
    this.save.save();
    this.refresh();
  }

  /** Quita una marca adquirida (depuración: reiniciar la adquisición). */
  revoke(id) {
    const p = this.profile;
    p.marks = p.marks.filter((m) => m !== id);
    this.save.save();
    this.refresh();
  }

  /** ¿La posee de verdad (adquirida), sin contar el atajo de depuración? */
  acquired(id) {
    return this.profile.marks.includes(id);
  }

  setDebugGrant(id, value) {
    if (id === 'energia') this.save.data.debug.grantEnergy = value;
    else if (id === 'gravedad') this.save.data.debug.grantGravity = value;
    else if (id === 'hilo') this.save.data.debug.grantThread = value;
    else if (id === 'temperatura') this.save.data.debug.grantTemperature = value;
    else if (id === 'alas') this.save.data.debug.grantWings = value;
    else return;
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
    // Solo la marca activa se enciende; las demás quedan en reposo
    const active = this.activeFamily;
    for (const [id, v] of this.visuals) v.setIntensity(id === active ? this.level : 0);
  }

  reset() {
    this._pulse = this._hold = this._sustain = this.level = 0;
  }
}
