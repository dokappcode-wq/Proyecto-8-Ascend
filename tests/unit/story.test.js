import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKPOINTS, PHASES, checkpoint, nextCheckpoint, flagsAt, allowedPowers, POWER_ACTIONS } from '../../src/story/storyData.js';
import { StoryState, createStoryState } from '../../src/story/StoryState.js';
import { detectionRate, stepMeter, STEALTH } from '../../src/story/stealthMath.js';
import { BEATS } from '../../src/story/prologue.js';
import { StoryDirector, lineTime } from '../../src/story/StoryDirector.js';
import { BRIDGE_SPANS, BRIDGE_GAPS, DECK_Y, FALLEN } from '../../src/world/maps/Forest.js';
import { CollisionWorld } from '../../src/physics/CollisionWorld.js';
import { CharacterMotor } from '../../src/physics/CharacterMotor.js';
import { SaveSystem } from '../../src/core/SaveSystem.js';
import { ENERGY_CONFIG } from '../../src/powers/energy/energyConfig.js';

// ------------------------------------------------------------------ Datos del prólogo
test('hay 29 puntos de control CP01…CP29, en orden y con su tramo de guion', () => {
  assert.equal(CHECKPOINTS.length, 29);
  CHECKPOINTS.forEach((c, i) => {
    assert.equal(c.id, `CP${String(i + 1).padStart(2, '0')}`);
    assert.ok(BEATS[c.beat], `falta el tramo ${c.beat}`);
    assert.ok(PHASES.includes(c.phase), `fase desconocida ${c.phase}`);
    assert.ok(['pueblo-noche', 'pueblo-dia', 'bosque'].includes(c.map));
  });
  assert.equal(checkpoint('CP10').index, 9);
  assert.equal(nextCheckpoint('CP08').id, 'CP09');
  assert.equal(nextCheckpoint('CP29'), null);
  // M01 de noche, M02–M04 de día, M05 en el bosque
  assert.ok(CHECKPOINTS.filter((c) => c.mission === 'M01').every((c) => c.map === 'pueblo-noche'));
  assert.ok(CHECKPOINTS.filter((c) => c.mission === 'M05').every((c) => c.map === 'bosque'));
});

test('las banderas de cada punto: Destino desde CP06 (tras la carta) y Energía desde CP16 (tras copiarla)', () => {
  assert.equal(flagsAt('CP05').HasDestinyMark, false);
  assert.equal(flagsAt('CP06').HasDestinyMark, true);
  assert.equal(flagsAt('CP15').HasEnergyMark, false);
  assert.equal(flagsAt('CP16').HasEnergyMark, true);
  assert.equal(flagsAt('CP16').ActiveMark, 'energia');
  assert.equal(flagsAt('CP29').TutorialComplete, false);
});

test('los poderes se enseñan de uno en uno: nada antes del bosque, disparo, después R y G, y el dash en el puente', () => {
  for (const id of ['CP01', 'CP06', 'CP16', 'CP17']) assert.deepEqual(allowedPowers(id), [], id);
  assert.deepEqual(allowedPowers('CP18'), ['attack', 'aim']);
  assert.ok(!allowedPowers('CP21').includes('charged'), 'los drones enseñan R y G durante el tramo');
  assert.ok(allowedPowers('CP22').includes('charged') && allowedPowers('CP22').includes('wave'));
  assert.ok(!allowedPowers('CP22').includes('special'));
  assert.ok(allowedPowers('CP23').includes('special'), 'el puente desbloquea Q');
  for (const a of allowedPowers('CP29')) assert.ok(POWER_ACTIONS.includes(a));
});

// ------------------------------------------------------------------ Estado y guardado
test('StoryState: llegar a un punto guarda salud y carga; las banderas nunca retroceden', () => {
  const st = new StoryState(createStoryState());
  st.reset();
  assert.equal(st.checkpoint, 'CP01');
  assert.deepEqual(st.marks, []);
  st.reach('CP06', { health: 80, charge: 0 });
  assert.equal(st.flags.HasDestinyMark, true);
  assert.deepEqual(st.marks, ['destino']);
  assert.equal(st.data.snapshot.health, 80);
  st.reach('CP16', { health: 100, charge: 55 });
  assert.deepEqual(st.marks, ['destino', 'energia']);
  assert.equal(st.flags.ActiveMark, 'energia');
  assert.equal(st.data.mission.missionId, 'M04');
  assert.throws(() => st.reach('CP99'));
});

test('StoryState: el progreso dentro de un punto vuelve a cero al llegar a otro distinto', () => {
  const st = new StoryState(createStoryState());
  st.reset();
  st.data.mission.objectiveIndex = 1;
  st.reach('CP01');
  assert.equal(st.data.mission.objectiveIndex, 1, 'mismo punto: se conserva');
  st.reach('CP02');
  assert.equal(st.data.mission.objectiveIndex, 0);
});

test('StoryState: la elección moral se guarda (KILL | SPARE) y no admite otros valores', () => {
  const st = new StoryState(createStoryState());
  st.choose('KILL');
  assert.equal(st.flags.EnergyEncounterChoice, 'KILL');
  st.choose('SPARE');
  assert.equal(st.flags.EnergyEncounterChoice, 'SPARE');
  assert.throws(() => st.choose('MAYBE'));
});

test('StoryState: saltar a un punto (depuración) deja banderas coherentes y completar marca el tutorial', () => {
  const st = new StoryState(createStoryState());
  st.jump('CP20');
  assert.equal(st.flags.HasEnergyMark, true);
  assert.equal(st.flags.EnergyEncounterChoice, 'SPARE', 'tras CP17 hace falta una elección');
  st.jump('CP03');
  assert.equal(st.flags.HasDestinyMark, false);
  st.complete();
  assert.equal(st.flags.TutorialComplete, true);
  assert.equal(st.data.completed, true);
  st.reset();
  assert.equal(st.data.completed, true, 'empezar de nuevo no borra que se completó');
});

test('el guardado incluye la historia y conserva sus claves al cargar uno antiguo', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const a = new SaveSystem(storage);
  assert.equal(a.data.story.checkpoint, 'CP01');
  a.data.story.checkpoint = 'CP12';
  a.data.story.flags.EnergyEncounterChoice = 'KILL';
  delete a.data.story.mission.dayIndex; // guardado de una versión sin esta clave
  a.save();
  const b = new SaveSystem(storage);
  assert.equal(b.data.story.checkpoint, 'CP12');
  assert.equal(b.data.story.flags.EnergyEncounterChoice, 'KILL');
  assert.equal(b.data.story.mission.dayIndex, 1, 'las claves nuevas se completan');
  assert.equal(b.data.debug.classicZoneE, false);
});

// ------------------------------------------------------------------ Sigilo
test('sigilo: fuera del cono o sin línea de visión no le ven; agachado tarda más', () => {
  const base = { dist: 6, angle: 0.1, range: 12, fov: 0.6, los: true };
  const stand = detectionRate(base);
  const crouch = detectionRate({ ...base, crouched: true });
  assert.ok(stand > 0 && crouch > 0 && crouch < stand * 0.5);
  assert.equal(detectionRate({ ...base, angle: 1.2 }), 0, 'fuera del cono');
  assert.equal(detectionRate({ ...base, los: false }), 0, 'tras un muro');
  assert.equal(detectionRate({ ...base, dist: 9, crouched: true }), 0, 'agachado le ven a menos distancia');
  assert.ok(detectionRate({ ...base, lit: true }) > stand * 2, 'el foco delata');
  assert.ok(detectionRate({ ...base, dist: 20 }) === 0);
});

test('sigilo: de cerca le oyen (salvo agachado) y el medidor sube, se limita y baja', () => {
  assert.equal(detectionRate({ dist: 1.5, angle: Math.PI, range: 12, fov: 0.6, los: true }), STEALTH.hearRate);
  assert.equal(detectionRate({ dist: 1.5, angle: Math.PI, range: 12, fov: 0.6, los: true, crouched: true }), 0);
  let m = 0;
  for (let i = 0; i < 60; i++) m = stepMeter(m, 2.4, 1 / 60);
  assert.ok(m > 0.99 && m <= 1);
  for (let i = 0; i < 60; i++) m = stepMeter(m, 0, 1 / 60);
  assert.ok(Math.abs(m - (1 - STEALTH.decay)) < 1e-6);
  assert.equal(stepMeter(0, 0, 1), 0);
});

// ------------------------------------------------------------------ Puente: huecos y dash
function bridgeWorld() {
  const w = new CollisionWorld();
  for (const s of BRIDGE_SPANS) w.addBox({ x: s.x0, y: DECK_Y - 0.6, z: -3.5 }, { x: s.x1, y: DECK_Y, z: 3.5 }, { climbable: false });
  // Tramo caído: la rampa que recibe al jugador al otro lado del hueco (como en el mapa)
  w.addRamp({ minX: FALLEN.x0, maxX: FALLEN.x1, minZ: -4, maxZ: 4, axis: 'x', y0: FALLEN.y0, y1: FALLEN.y1, base: FALLEN.y1 - 1.2 });
  return w;
}

/** Corre hacia el hueco, salta al borde y (si `dash`) hace el dash en lo alto del salto. */
function tryGap(gap, { dash }) {
  const DT = 1 / 60;
  const m = new CharacterMotor(bridgeWorld());
  m.teleport({ x: gap.from - 14, y: DECK_Y, z: 0 });
  const run = { moveX: 1, moveZ: 0, sprint: true, jump: false, dodge: false };
  for (let i = 0; i < 20; i++) m.update(DT, { ...run, moveX: 0 });
  let jumped = false;
  let dashed = false;
  for (let i = 0; i < 60 * 6; i++) {
    const jump = !jumped && m.grounded && m.position.x > gap.from - 0.45;
    if (jump) jumped = true;
    m.update(DT, { ...run, jump });
    if (dash && jumped && !dashed && m.velocity.y <= 0.5) {
      dashed = m.startBurst({ x: 1, z: 0, speed: ENERGY_CONFIG.dash.speed, duration: ENERGY_CONFIG.dash.duration, gravityScale: 0, exitFactor: 0.5 });
    }
    // Por debajo del borde de la rampa sin haber pasado el hueco: cae al cañón
    if (m.position.x < gap.to && m.position.y < FALLEN.y0 - 2) return { crossed: false, x: m.position.x };
    if (jumped && m.grounded && m.position.x > gap.to) return { crossed: true, x: m.position.x };
  }
  return { crossed: false, x: m.position.x };
}

test('puente: un único hueco de 9 m entre el tramo oeste y el tramo caído', () => {
  assert.deepEqual(BRIDGE_GAPS.map((g) => g.width), [9]);
  assert.equal(BRIDGE_GAPS[0].to, FALLEN.x0, 'el hueco termina donde empieza la rampa');
});

test('puente: un salto con carrera no basta para el hueco; con el dash en el aire se cruza', () => {
  for (const gap of BRIDGE_GAPS) {
    const plain = tryGap(gap, { dash: false });
    assert.equal(plain.crossed, false, `hueco de ${gap.width} m saltado sin dash`);
    const withDash = tryGap(gap, { dash: true });
    assert.equal(withDash.crossed, true, `hueco de ${gap.width} m: no llega con el dash (x ${withDash.x.toFixed(2)})`);
  }
});

test('dash asistido: en el aire junto a un hueco apunta al círculo de aterrizaje; lejos no cambia nada', () => {
  const at = (x, z = 0) => ({ dashAssist: { gaps: BRIDGE_GAPS }, game: { player: { motor: { position: { x, y: DECK_Y + 1, z } } } } });
  const g = BRIDGE_GAPS[0];
  const d = StoryDirector.prototype.assistDash.call(at(g.from - 1, 2.5), { x: 0.8, y: 0, z: 0.6 });
  const tx = g.to + 2.6 - (g.from - 1);
  assert.ok(Math.abs(Math.atan2(d.z, d.x) - Math.atan2(-2.5, tx)) < 1e-6, 'corrige hacia el centro');
  const far = { x: 0.8, y: 0, z: 0.6 };
  assert.equal(StoryDirector.prototype.assistDash.call(at(g.from - 20), far), far);
  const back = { x: -1, y: 0, z: 0 };
  assert.equal(StoryDirector.prototype.assistDash.call(at(g.from - 1), back), back, 'hacia atrás no se corrige');
});

test('los subtítulos duran según su longitud (con tope)', () => {
  assert.ok(lineTime('Vamos.') < lineTime('Llevamos tres meses observando esa base. No habrá otra oportunidad.'));
  assert.ok(lineTime('x'.repeat(500)) <= 6);
});
