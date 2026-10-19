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
    /** Pasiva: cada golpe de Energía tiene un 5 % de probabilidad de detener (aturdir) al enemigo. */
    passive: { name: 'Cortocircuito', desc: '5 % de probabilidad de detener a un enemigo al golpearle con Energía.' },
  },
  gravedad: {
    id: 'gravedad',
    name: 'Marca de la Gravedad',
    concept: 'Gravedad',
    original: false,
    color: '#a24dff',
    glowColor: '#d9b3ff',
    symbol: 'gravedad',
    abilities: ['disparo', 'rocas', 'atraer', 'empujar', 'granada'],
    // Brazo izquierdo; el símbolo se desplaza hacia el antebrazo para no tapar
    // la marca del Destino de la muñeca.
    bodyPattern: { side: 'L', seed: 13, wristOffset: 0.09, regions: ['wrist', 'forearm', 'upperArm', 'shoulder', 'chest'] },
    passive: { name: 'Estasis', desc: 'Al bajar al 5 % de vida, durante 4 s las balas enemigas se quedan flotando.' },
  },
  hilo: {
    id: 'hilo',
    name: 'Marca del Hilo',
    concept: 'Hilo',
    original: false,
    color: '#f2f4f8',
    glowColor: '#ffffff',
    symbol: 'hilo',
    abilities: ['hilos', 'balanceo', 'atar', 'lanzar', 'atraer', 'cadena'],
    // Brazo derecho, sobre el antebrazo (por encima del símbolo de la Energía)
    bodyPattern: { side: 'R', seed: 21, wristOffset: 0.17, layer: 1.1, regions: ['wrist', 'forearm', 'upperArm', 'shoulder'] },
    passive: { name: 'Impulso', desc: 'Manteniendo el salto, das un salto lo bastante alto para empezar a balancearte.' },
  },
});

/** Orden de las marcas copiadas (cambio de marca con V). */
export const COPY_ORDER = Object.freeze(['energia', 'gravedad', 'hilo']);
