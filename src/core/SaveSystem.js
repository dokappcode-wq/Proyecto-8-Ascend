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
    },
    bindings: null, // null = controles por defecto (ver core/Input.js)
    lastMap: null,
    profile: {
      // Marcas que posee el protagonista. La del Destino es innata.
      marks: ['destino'],
      skillProgress: {},
    },
    // Herramientas de depuración del prototipo (menú F2).
    debug: {
      grantEnergy: true, // concede Energía hasta que exista la adquisición (Etapa 4)
      infiniteEnergy: false,
      maxMarks: false, // fuerza las marcas al máximo para revisar efectos
    },
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
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        profile: { ...base.profile, ...(parsed.profile || {}) },
        debug: { ...base.debug, ...(parsed.debug || {}) },
      };
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
