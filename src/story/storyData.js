/**
 * Prólogo de la historia (datos, sin Three.js): fases del flujo de juego y
 * puntos de control. Cada punto de control es la entrada de un tramo del
 * guion (`beat` en `prologue.js`) y dice en qué mapa y en qué punto empieza.
 */

/** Flujo general (GameFlow del guion). */
export const PHASES = Object.freeze([
  'INTRO_VILLAGE', 'STEALTH_BASE', 'DESTINY_ACQUIRED', 'ESCAPE_BASE', 'NARBAIZA_SQUARE', 'FIVE_DAYS', 'MARKET',
  'STORM', 'ENERGY_COPY', 'MORAL_CHOICE', 'PRISON_BUS', 'FOREST', 'DRONE_TUTORIAL', 'BRIDGE', 'CITY_REVEAL', 'MAIN_MENU',
]);

/** Misiones del prólogo (títulos del panel de objetivos). */
export const STORY_MISSIONS = Object.freeze({
  M01: 'M01 · La última noche',
  M02: 'M02 · La plaza',
  M03: 'M03 · Cinco días de normalidad',
  M04: 'M04 · La tormenta',
  M05: 'M05 · El despertar',
});

/**
 * Puntos de control en orden. `at` es el nombre del punto de aparición que
 * devuelve el mapa; `beat`, el tramo del guion que empieza ahí.
 */
export const CHECKPOINTS = Object.freeze([
  { id: 'CP01', mission: 'M01', phase: 'INTRO_VILLAGE', map: 'pueblo-noche', at: 'cp01', beat: 'rooftops', title: 'Reunión en los tejados' },
  { id: 'CP02', mission: 'M01', phase: 'STEALTH_BASE', map: 'pueblo-noche', at: 'cp02', beat: 'cliff', title: 'El acantilado' },
  { id: 'CP03', mission: 'M01', phase: 'STEALTH_BASE', map: 'pueblo-noche', at: 'cp03', beat: 'vent', title: 'Cambio de guardia' },
  { id: 'CP04', mission: 'M01', phase: 'STEALTH_BASE', map: 'pueblo-noche', at: 'cp04', beat: 'inside', title: 'Las instalaciones' },
  { id: 'CP05', mission: 'M01', phase: 'DESTINY_ACQUIRED', map: 'pueblo-noche', at: 'cp05', beat: 'cards', title: 'Las cinco cartas' },
  { id: 'CP06', mission: 'M01', phase: 'ESCAPE_BASE', map: 'pueblo-noche', at: 'cp06', beat: 'alarm', title: 'Contención comprometida' },
  { id: 'CP07', mission: 'M01', phase: 'ESCAPE_BASE', map: 'pueblo-noche', at: 'cp07', beat: 'escape', title: 'Huida por arriba' },
  { id: 'CP08', mission: 'M01', phase: 'ESCAPE_BASE', map: 'pueblo-noche', at: 'cp08', beat: 'zipline', title: 'La tirolina' },
  { id: 'CP09', mission: 'M02', phase: 'NARBAIZA_SQUARE', map: 'pueblo-dia', at: 'cp09', beat: 'wake', title: 'No fue un sueño' },
  { id: 'CP10', mission: 'M02', phase: 'NARBAIZA_SQUARE', map: 'pueblo-dia', at: 'cp10', beat: 'alley', title: 'La discusión con Iker' },
  { id: 'CP11', mission: 'M03', phase: 'FIVE_DAYS', map: 'pueblo-dia', at: 'cp11', beat: 'days', title: 'Cinco días' },
  { id: 'CP12', mission: 'M04', phase: 'MARKET', map: 'pueblo-dia', at: 'cp12', beat: 'market', title: 'El mercado' },
  { id: 'CP13', mission: 'M04', phase: 'STORM', map: 'pueblo-dia', at: 'cp13', beat: 'storm', title: 'La tormenta' },
  { id: 'CP14', mission: 'M04', phase: 'STORM', map: 'pueblo-dia', at: 'cp14', beat: 'run', title: '¡Ya voy!' },
  { id: 'CP15', mission: 'M04', phase: 'ENERGY_COPY', map: 'pueblo-dia', at: 'cp15', beat: 'contact', title: 'La pérdida' },
  { id: 'CP16', mission: 'M04', phase: 'MORAL_CHOICE', map: 'pueblo-dia', at: 'cp16', beat: 'choice', title: 'Decisión irreversible' },
  { id: 'CP17', mission: 'M04', phase: 'PRISON_BUS', map: 'pueblo-dia', at: 'cp17', beat: 'capture', title: 'Prisioneros' },
  { id: 'CP18', mission: 'M05', phase: 'FOREST', map: 'bosque', at: 'cp18', beat: 'forest', title: 'El bosque' },
  { id: 'CP19', mission: 'M05', phase: 'FOREST', map: 'bosque', at: 'cp19', beat: 'climb', title: 'La ladera' },
  { id: 'CP20', mission: 'M05', phase: 'FOREST', map: 'bosque', at: 'cp20', beat: 'debris', title: 'El escombro' },
  { id: 'CP21', mission: 'M05', phase: 'DRONE_TUTORIAL', map: 'bosque', at: 'cp21', beat: 'drones', title: 'Tres drones' },
  { id: 'CP22', mission: 'M05', phase: 'DRONE_TUTORIAL', map: 'bosque', at: 'cp22', beat: 'toBridge', title: 'Hacia el puente' },
  { id: 'CP23', mission: 'M05', phase: 'BRIDGE', map: 'bosque', at: 'cp23', beat: 'dash', title: 'El puente destruido' },
  { id: 'CP24', mission: 'M05', phase: 'BRIDGE', map: 'bosque', at: 'cp24', beat: 'dash2', title: 'Mitad del puente' },
  { id: 'CP25', mission: 'M05', phase: 'BRIDGE', map: 'bosque', at: 'cp25', beat: 'block1', title: 'Primer bloqueo' },
  { id: 'CP26', mission: 'M05', phase: 'BRIDGE', map: 'bosque', at: 'cp26', beat: 'toBlock2', title: 'Sección final' },
  { id: 'CP27', mission: 'M05', phase: 'BRIDGE', map: 'bosque', at: 'cp27', beat: 'block2', title: 'Último bloqueo' },
  { id: 'CP28', mission: 'M05', phase: 'CITY_REVEAL', map: 'bosque', at: 'cp28', beat: 'leaveBridge', title: 'Fuera del puente' },
  { id: 'CP29', mission: 'M05', phase: 'CITY_REVEAL', map: 'bosque', at: 'cp29', beat: 'city', title: 'La ciudad' },
]);

const BY_ID = new Map(CHECKPOINTS.map((c, i) => [c.id, { ...c, index: i }]));

/** Datos de un punto de control (con su posición en la lista). */
export function checkpoint(id) {
  return BY_ID.get(id) ?? null;
}

/** El punto de control que sigue a `id` (null tras el último). */
export function nextCheckpoint(id) {
  const c = BY_ID.get(id);
  return c ? CHECKPOINTS[c.index + 1] ?? null : null;
}

/** Banderas del jugador al empezar (PlayerFlags del guion). */
export function defaultFlags() {
  return {
    HasDestinyMark: false,
    HasEnergyMark: false,
    ActiveMark: null,
    TutorialComplete: false,
    /** 'KILL' | 'SPARE' | null */
    EnergyEncounterChoice: null,
  };
}

/** Lo que cada punto de control exige de las banderas (para reconstruir el estado al cargar). */
export function flagsAt(id) {
  const c = BY_ID.get(id);
  const f = defaultFlags();
  if (!c) return f;
  const after = (cp) => c.index >= BY_ID.get(cp).index;
  f.HasDestinyMark = after('CP06');
  f.HasEnergyMark = after('CP16');
  f.ActiveMark = f.HasEnergyMark ? 'energia' : null;
  return f;
}

/**
 * Habilidades de Energía que el jugador puede usar en cada tramo: la historia
 * las enseña de una en una (bosque: disparo; drones: descarga y onda; puente: dash).
 * Devuelve las acciones del teclado permitidas.
 */
export function allowedPowers(id) {
  const c = BY_ID.get(id);
  if (!c) return [];
  const at = (cp) => c.index >= BY_ID.get(cp).index;
  if (!at('CP18')) return [];
  const list = ['attack', 'aim'];
  if (at('CP22')) list.push('charged', 'wave');
  if (at('CP23')) list.push('special');
  return list;
}

/** Acciones de poder que existen (las que no estén permitidas se bloquean). */
export const POWER_ACTIONS = Object.freeze(['attack', 'aim', 'special', 'charged', 'wave', 'grenade', 'switchMark']);
