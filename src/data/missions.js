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
    /**
     * Enemigos de la misión. No aparecen de la nada: `from` es el camino por
     * el que llegan a su puesto al activarla (la patrulla baja por detrás del
     * camión de la PDC aparcado en la calle norte; el Acólito sale del
     * callejón entre A2 y B3).
     */
    spawns: [
      { type: 'pdc', tag: 'mision-pdc', x: -14, z: -21, yaw: Math.PI / 2, patrol: patrolSouth, from: [{ x: -6.2, z: -29 }, { x: -8.4, z: -29 }, { x: -10, z: -24 }] },
      { type: 'pdc', tag: 'mision-pdc', x: -16.5, z: -21, yaw: Math.PI / 2, patrol: patrolSouth, from: [{ x: -6.2, z: -28.6 }, { x: -8.4, z: -28.6 }, { x: -10.6, z: -23.2 }], delay: 0.9 },
      { type: 'pdc', tag: 'mision-pdc', x: -19, z: -21, yaw: Math.PI / 2, patrol: patrolSouth, from: [{ x: -6.2, z: -29.4 }, { x: -8.4, z: -29.4 }, { x: -11.2, z: -22.6 }], delay: 1.8 },
      { type: 'acolyte', tag: 'mision-acolito', x: 32, z: -18, yaw: Math.PI / 2, patrol: [{ x: 30, z: -18 }, { x: 50, z: -18 }], from: [{ x: 26, z: -42 }, { x: 26, z: -29 }] },
    ],
    xp: 100,
  },
});
