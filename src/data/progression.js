/**
 * Árboles de habilidades por marca (Regla V: adquirir una marca da acceso a
 * las capacidades fundamentales; el dominio llega entrenando).
 *
 * Tipos de nodo:
 *  - 'base': capacidad fundamental, disponible al adquirir la marca.
 *  - 'upgrade': mejora que cuesta puntos; puede requerir otros nodos.
 *  - 'future': prevista pero no implementada en el prototipo.
 *
 * `effects` se suman en los modificadores que lee el PowerSystem.
 */
export const PROGRESSION = Object.freeze({
  energia: {
    xpPerLevel: 100,
    /** Energía máxima extra por cada nivel por encima del 1. */
    energyPerLevel: 15,
    xpRewards: { pdc: 40, acolyte: 60, dummy: 5 },
    nodes: [
      { id: 'proyectil', name: 'Proyectil energético', type: 'base', desc: 'Disparo a distancia con cargador.' },
      { id: 'dash', name: 'Dash energético', type: 'base', desc: 'Impulso rápido; apuntando, dash dirigido.' },
      { id: 'descarga', name: 'Descarga concentrada', type: 'base', desc: 'Ataque cargado con daño de área.' },
      { id: 'onda', name: 'Onda expansiva', type: 'base', desc: 'Ataque radial; en el aire, caída en rayo.' },
      { id: 'cargador', name: 'Cargador ampliado', type: 'upgrade', cost: 1, requires: ['proyectil'], desc: '+5 disparos por cargador.', effects: { magazineBonus: 5 } },
      { id: 'recarga', name: 'Recarga rápida', type: 'upgrade', cost: 1, requires: ['cargador'], desc: 'Recarga un 35 % más rápida.', effects: { reloadMul: 0.65 } },
      { id: 'carga-rapida', name: 'Carga rápida', type: 'upgrade', cost: 1, requires: ['descarga'], desc: 'La descarga completa se carga en 0.9 s.', effects: { fullCharge: 0.9 } },
      { id: 'onda-amplia', name: 'Onda amplia', type: 'upgrade', cost: 2, requires: ['onda'], desc: '+2 m de radio y +10 de daño en la onda y en la caída en rayo.', effects: { waveRadiusAdd: 2, waveDamageAdd: 10 } },
      { id: 'dash-eficiente', name: 'Dash eficiente', type: 'upgrade', cost: 1, requires: ['dash'], desc: 'Los dashes cuestan 5 de energía menos; el dirigido llega 5 m más lejos.', effects: { dashCostSub: 5, targetedRangeAdd: 5 } },
      { id: 'absorcion', name: 'Absorción rápida', type: 'upgrade', cost: 2, requires: ['recarga', 'dash-eficiente'], desc: 'Absorbes la energía de las fuentes un 60 % más rápido.', effects: { drainMul: 1.6 } },
      { id: 'sobrecarga', name: 'Sobrecarga', type: 'future', cost: 3, requires: ['absorcion'], desc: 'Potenciación temporal de todas las habilidades. Llegará en una versión posterior.' },
    ],
  },
});
