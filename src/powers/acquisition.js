/**
 * Reglas de adquisición de marcas (canon, sección 4). Sin Three.js.
 *
 *  Regla I   — La marca pertenece a una Encarnación original.
 *  Regla II  — Hace falta contacto físico directo con una Encarnación
 *              original; los Acólitos no son fuentes válidas.
 *  Regla III — Hace falta la voluntad del protagonista; el contacto por sí
 *              solo no basta. No se requiere el consentimiento de la fuente.
 *  Regla IV  — Se genera una copia: la fuente conserva su marca y su poder.
 */

export const ACQUISITION_CONFIG = Object.freeze({
  contactRange: 1.9, // distancia máxima para establecer contacto (m)
  willTime: 2.4, // segundos manteniendo la voluntad para completar la copia
  contactTimeout: 8, // sin ejercer la voluntad, el contacto se pierde
  copyDuration: 2.2, // duración del efecto de copia
});

export const REASONS = Object.freeze({
  ok: 'Copia completada',
  'not-original': 'No posee una marca original: su poder es prestado. No hay nada que copiar.',
  'already-owned': 'Ya posees esta marca.',
  'no-contact': 'Necesitas contacto físico directo.',
  'no-will': 'El contacto no basta: la copia requiere tu voluntad.',
  'no-mark': 'No tiene ninguna marca.',
});

/**
 * Evalúa si una adquisición puede completarse.
 * @param {object} source { kind: 'incarnation' | 'acolyte' | …, markId }
 * @param {string[]} owned marcas que ya posee el protagonista
 * @param {object} state { contact: boolean, will: number (0..1) }
 * @returns {{ ok: boolean, reason: keyof REASONS }}
 */
export function evaluateAcquisition(source, owned, { contact, will }) {
  if (!source?.markId) return { ok: false, reason: 'no-mark' };
  if (source.kind !== 'incarnation') return { ok: false, reason: 'not-original' };
  if (owned.includes(source.markId)) return { ok: false, reason: 'already-owned' };
  if (!contact) return { ok: false, reason: 'no-contact' };
  if (!(will >= 1)) return { ok: false, reason: 'no-will' };
  return { ok: true, reason: 'ok' };
}
