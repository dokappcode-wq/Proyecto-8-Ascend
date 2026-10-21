import { createStoryState } from '../story/StoryState.js';

/**
 * SaveSystem — persistencia local del progreso y la configuración.
 *
 * Guarda un único documento JSON versionado. En la Etapa 1 almacena los
 * ajustes, los controles y el último mapa jugado. El bloque `profile` ya
 * reserva el sitio para las marcas adquiridas y la progresión (Etapa 4), que
 * deben sobrevivir a cambios de mapa, reinicios y recargas.
 */

export const SAVE_KEY = 'ascend.save.v1';
export const SAVE_VERSION = 1;

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    settings: {
      mouseSensitivity: 1.0,
      invertY: false,
      fov: 70,
      shadows: true,
      bloom: true,
      showFps: false,
      // Etapa 7: sonido y resolución de render
      volumeMaster: 0.8,
      volumeSfx: 1,
      volumeAmbience: 0.5,
      renderScale: 1,
      // Mejora gráfica: suavizado de bordes (MSAA) y oclusión ambiental (GTAO, costosa)
      antialias: true,
      ao: false,
    },
    bindings: null, // null = controles por defecto (ver core/Input.js)
    // Etapa del prototipo que escribió el guardado (para migraciones).
    stage: 4,
    lastMap: null,
    profile: {
      // Marcas que posee el protagonista. La del Destino es innata.
      marks: ['destino'],
      skillProgress: {},
      // Misiones completadas: { [id]: { completed, bestTime, runs } }
      missions: {},
      // Marca copiada activa (cambio con V o al absorber una fuente de su elemento)
      activeMark: null,
    },
    // Herramientas de depuración del prototipo (menú F2).
    debug: {
      grantEnergy: false, // atajo: concede Energía sin pasar por la estación de adquisición
      grantGravity: false, // atajo: concede Gravedad
      grantThread: false, // atajo: concede Hilo
      grantTemperature: false, // atajo: concede Temperatura
      grantWings: false, // atajo: concede Alas
      infiniteEnergy: false,
      maxMarks: false, // fuerza las marcas al máximo para revisar efectos
      invulnerable: false, // el jugador no recibe daño
      classicZoneE: false, // la Encarnación de la Energía vuelve a la Zona E (práctica)
    },
    // Modo historia: prólogo (ver story/StoryState.js)
    story: createStoryState(),
  };
}

/**
 * Migraciones entre etapas del prototipo:
 *  - < 4: la Energía estaba concedida por depuración; desde la Etapa 4 se
 *    obtiene en la estación de adquisición, así que se retira el atajo.
 */
function migrate(data) {
  if (!(data.stage >= 4)) {
    data.debug.grantEnergy = false;
    data.stage = 4;
  }
  return data;
}

/** Estado de la historia guardado sobre el de por defecto (claves nuevas incluidas). */
function mergeStory(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    flags: { ...base.flags, ...(saved.flags || {}) },
    mission: { ...base.mission, ...(saved.mission || {}) },
    snapshot: { ...base.snapshot, ...(saved.snapshot || {}) },
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__ascend_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Almacenamiento bloqueado (modo privado, iframe…): se usa memoria.
  }
  return memoryStorage();
}

export class SaveSystem {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  load() {
    const base = createDefaultSave();
    let raw = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      return base;
    }
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SAVE_VERSION) return base;
      const merged = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        profile: { ...base.profile, ...(parsed.profile || {}) },
        debug: { ...base.debug, ...(parsed.debug || {}) },
        story: mergeStory(base.story, parsed.story),
        stage: parsed.stage ?? 0, // los guardados anteriores no la tenían
      };
      return migrate(merged);
    } catch {
      return base;
    }
  }

  save() {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  get settings() {
    return this.data.settings;
  }

  updateSettings(patch) {
    Object.assign(this.data.settings, patch);
    this.save();
  }

  reset() {
    this.data = createDefaultSave();
    this.save();
  }
}
