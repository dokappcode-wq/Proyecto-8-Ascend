/**
 * Definiciones de marcas (datos configurables).
 *
 * Cada Encarnación se describe con datos, no con código específico, para que
 * el MarkSystem (Etapa 4) y el sistema visual de patrones (Etapa 2) puedan
 * incorporar nuevas marcas sin rehacer el modelo del personaje.
 *
 * `abilities` enumera la familia de habilidades. En la Etapa 2 Energía usa
 * proyectil, dash, descarga y onda; la sobrecarga queda para más adelante.
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
    // Brazo derecho (el Destino conserva su marca en la izquierda). Las regiones
    // se iluminan en orden según la intensidad del poder.
    bodyPattern: { side: 'R', seed: 7, regions: ['wrist', 'forearm', 'upperArm', 'shoulder', 'chest'] },
  },
});
