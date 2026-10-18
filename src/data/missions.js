/**
 * Misiones (datos). No es una campaña: solo la misión de prueba del
 * Distrito Cero. Posiciones en coordenadas del mapa.
 */
const patrolSouth = [{ x: -18, z: -21 }, { x: 18, z: -21 }];

export const MISSIONS = Object.freeze({
  'op-distrito-cero': {
    id: 'op-distrito-cero',
    name: 'Operación: Distrito Cero',
    map: 'distrito',
    brief: 'Una patrulla de la PDC registra el barrio en busca de Encarnaciones y un Acólito hostil ataca a quien se cruza. Neutralízalos.',
    /** Activación: teléfono público de la plaza. */
    giver: { x: -6, z: 10, yaw: Math.PI / 2, label: 'Teléfono público' },
    objectives: [
      { id: 'patrulla', kind: 'neutralize', tag: 'mision-pdc', count: 3, label: 'Neutraliza la patrulla PDC' },
      { id: 'acolito', kind: 'neutralize', tag: 'mision-acolito', count: 1, label: 'Neutraliza al Acólito hostil' },
    ],
    /** Enemigos que aparecen al activar la misión. */
    spawns: [
      { type: 'pdc', tag: 'mision-pdc', x: -14, z: -21, yaw: Math.PI / 2, patrol: patrolSouth },
      { type: 'pdc', tag: 'mision-pdc', x: -16.5, z: -21, yaw: Math.PI / 2, patrol: patrolSouth },
      { type: 'pdc', tag: 'mision-pdc', x: -19, z: -21, yaw: Math.PI / 2, patrol: patrolSouth },
      { type: 'acolyte', tag: 'mision-acolito', x: 32, z: -18, yaw: Math.PI / 2, patrol: [{ x: 30, z: -18 }, { x: 50, z: -18 }] },
    ],
    xp: 100,
  },
});
