import { CHECKPOINTS, checkpoint, defaultFlags, flagsAt } from './storyData.js';

/**
 * Estado persistente del prólogo (sin Three.js). Vive en `save.data.story`.
 *
 * - `checkpoint`: el último alcanzado (donde se reanuda).
 * - `flags`: PlayerFlags del guion (marcas, elección, tutorial completado).
 * - `mission`: MissionState (día, compras, documentos, enemigos).
 * - `snapshot`: salud y carga al guardar.
 * Solo se guarda al llegar a un punto de control, nunca a mitad de una cinemática.
 */
export function createStoryState() {
  return {
    version: 1,
    started: false,
    completed: false,
    checkpoint: CHECKPOINTS[0].id,
    flags: defaultFlags(),
    mission: { missionId: 'M01', objectiveIndex: 0, dayIndex: 1, collectedFoodItems: [], discoveredDocuments: [], enemiesDefeated: 0 },
    snapshot: { health: 100, charge: 0 },
  };
}

export class StoryState {
  /** @param {object} data objeto guardado (se modifica en el sitio) */
  constructor(data) {
    this.data = data;
  }

  get checkpoint() {
    return this.data.checkpoint;
  }

  get flags() {
    return this.data.flags;
  }

  get mission() {
    return this.data.mission;
  }

  /** Empieza una partida nueva (conserva si el prólogo ya se completó alguna vez). */
  reset() {
    const completed = this.data.completed;
    Object.assign(this.data, createStoryState(), { started: true, completed });
  }

  /**
   * Llega a un punto de control: lo guarda con la salud y la carga actuales.
   * Las banderas nunca retroceden respecto a las que exige ese punto.
   */
  reach(id, { health, charge } = {}) {
    const cp = checkpoint(id);
    if (!cp) throw new Error(`Punto de control desconocido: ${id}`);
    // Progreso dentro del tramo: empieza de cero en cada punto de control nuevo
    if (this.data.checkpoint !== id) this.data.mission.objectiveIndex = 0;
    this.data.checkpoint = id;
    this.data.started = true;
    this.data.mission.missionId = cp.mission;
    const need = flagsAt(id);
    for (const k of ['HasDestinyMark', 'HasEnergyMark']) this.data.flags[k] = this.data.flags[k] || need[k];
    if (this.data.flags.HasEnergyMark && !this.data.flags.ActiveMark) this.data.flags.ActiveMark = 'energia';
    if (health !== undefined) this.data.snapshot.health = health;
    if (charge !== undefined) this.data.snapshot.charge = charge;
  }

  /** Salta a un punto de control (depuración): banderas coherentes con ese punto. */
  jump(id) {
    const keepChoice = this.data.flags.EnergyEncounterChoice;
    this.data.flags = flagsAt(id);
    const cp = checkpoint(id);
    if (cp.index >= checkpoint('CP17').index) this.data.flags.EnergyEncounterChoice = keepChoice ?? 'SPARE';
    this.reach(id);
  }

  /** Guarda la elección moral (inmediatamente y para siempre). */
  choose(choice) {
    if (choice !== 'KILL' && choice !== 'SPARE') throw new Error(`Elección no válida: ${choice}`);
    this.data.flags.EnergyEncounterChoice = choice;
  }

  /** Marcas que posee Jon en este momento de la historia. */
  get marks() {
    const m = [];
    if (this.data.flags.HasDestinyMark) m.push('destino');
    if (this.data.flags.HasEnergyMark) m.push('energia');
    return m;
  }

  complete() {
    this.data.flags.TutorialComplete = true;
    this.data.completed = true;
    this.data.started = false;
  }
}
