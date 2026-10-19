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
  gravedad: {
    xpPerLevel: 100,
    energyPerLevel: 15,
    xpRewards: { pdc: 40, acolyte: 60, dummy: 5 },
    nodes: [
      { id: 'disparo', name: 'Disparo gravitatorio', type: 'base', desc: 'Un disparo por cargador; el objetivo queda flotando.' },
      { id: 'rocas', name: 'Elevar rocas', type: 'base', desc: 'Q eleva una roca bajo tus pies; en el aire, otra (hasta 3).' },
      { id: 'atraer', name: 'Atraer', type: 'base', desc: 'Atrae, daña y aturde; si flota, lo trae a tu lado.' },
      { id: 'empujar', name: 'Empujar', type: 'base', desc: 'Empuja y daña a todo lo que tienes delante.' },
      { id: 'granada', name: 'Granada de gravedad', type: 'base', desc: 'Burbuja de antigravedad que deja flotando a los enemigos.' },
      { id: 'roca-extra', name: 'Cuarta roca', type: 'upgrade', cost: 1, requires: ['rocas'], desc: 'Puedes encadenar una roca más (4).', effects: { stoneBonus: 1 } },
      { id: 'atraccion', name: 'Atracción férrea', type: 'upgrade', cost: 1, requires: ['atraer'], desc: '+10 de daño al atraer y +0.5 s de aturdimiento.', effects: { pullDamageAdd: 10, pullStunAdd: 0.5 } },
      { id: 'empuje', name: 'Empuje violento', type: 'upgrade', cost: 1, requires: ['empujar'], desc: '+10 de daño y más retroceso al empujar.', effects: { pushDamageAdd: 10, pushKnockbackAdd: 6 } },
      { id: 'burbuja', name: 'Burbuja amplia', type: 'upgrade', cost: 2, requires: ['granada'], desc: '+1.5 m de radio y +2 s de duración de la burbuja.', effects: { bubbleRadiusAdd: 1.5, bubbleTimeAdd: 2 } },
      { id: 'colapso', name: 'Colapso', type: 'future', cost: 3, requires: ['burbuja', 'atraccion'], desc: 'La burbuja implosiona y aplasta a quien flota. Llegará en una versión posterior.' },
    ],
  },
  hilo: {
    xpPerLevel: 100,
    energyPerLevel: 15,
    xpRewards: { pdc: 40, acolyte: 60, dummy: 5 },
    nodes: [
      { id: 'hilos', name: 'Hilos', type: 'base', desc: 'Tus puños se vuelven hilos y golpean a distancia; sin balas, pero esperas a que vuelvan.' },
      { id: 'balanceo', name: 'Balanceo', type: 'base', desc: 'Mantén Q: hilo a la estructura más próxima y te balanceas.' },
      { id: 'atar', name: 'Atar', type: 'base', desc: 'Ata a un enemigo y lo inmoviliza.' },
      { id: 'lanzar', name: 'Lanzar', type: 'base', desc: 'Lanza a un enemigo por los aires.' },
      { id: 'atraer', name: 'Atraer', type: 'base', desc: 'Te lleva hasta un enemigo (cuerpo a cuerpo) o hasta una pared.' },
      { id: 'hilo-largo', name: 'Hilo largo', type: 'upgrade', cost: 1, requires: ['balanceo'], desc: '+8 m de alcance al balancearte y al atraerte.', effects: { swingRangeAdd: 8 } },
      { id: 'nudo', name: 'Nudo firme', type: 'upgrade', cost: 1, requires: ['atar'], desc: 'Atar inmoviliza 2 s más.', effects: { bindTimeAdd: 2 } },
      { id: 'puño-rapido', name: 'Puño rápido', type: 'upgrade', cost: 1, requires: ['hilos'], desc: 'El puño de hilo va y vuelve un 40 % más rápido.', effects: { fistSpeedMul: 1.4 } },
      { id: 'cadena', name: 'Cadena pesada', type: 'upgrade', cost: 2, requires: ['hilos', 'lanzar'], desc: '+10 de daño y más alcance con el golpe de cadena.', effects: { chainDamageAdd: 10 } },
      { id: 'telarana', name: 'Telaraña', type: 'future', cost: 3, requires: ['cadena', 'nudo'], desc: 'Atrapa a varios enemigos a la vez. Llegará en una versión posterior.' },
    ],
  },
});
