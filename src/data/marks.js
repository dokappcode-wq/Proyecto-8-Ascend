/**
 * Definiciones de marcas (datos configurables).
 *
 * Cada Encarnación se describe con datos, no con código específico, para que
 * el MarkSystem (Etapa 4) y el sistema visual de patrones (Etapa 2) puedan
 * incorporar nuevas marcas sin rehacer el modelo del personaje.
 *
 * Estado en la Etapa 1: solo se usan `destino.color` y `destino.symbol` para
 * dibujar la marca innata en la muñeca. Las habilidades de Energía aún NO
 * están implementadas; `abilities` es la lista prevista para la Etapa 2.
 */
export const MARKS = Object.freeze({
  destino: {
    id: 'destino',
    name: 'Marca del Destino',
    concept: 'Destino',
    original: true, // innata del protagonista
    color: '#f2c45a',
    glowColor: '#ffe7a3',
    symbol: 'destino',
    abilities: [],
    bodyPattern: null, // diseño definitivo pendiente (sección 10)
  },
  energia: {
    id: 'energia',
    name: 'Marca de la Energía',
    concept: 'Energía',
    original: false, // copia generada por el Destino
    color: '#2f8bff',
    glowColor: '#9fd0ff',
    symbol: 'energia',
    abilities: ['proyectil', 'dash', 'descarga', 'onda', 'sobrecarga'],
    bodyPattern: { regions: ['wrist', 'forearm', 'upperArm', 'shoulder', 'chest'] },
  },
});
