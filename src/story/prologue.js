import * as THREE from 'three';
import { STORY_PALETTES, SANGRE_DEF } from './actors.js';
import { DecorDrone } from './props.js';
import { MARKS } from '../data/marks.js';
import { Incarnation } from '../world/entities/Incarnation.js';

/**
 * PRÓLOGO — guion jugable (M01–M05). Un tramo (`beat`) por punto de control;
 * cada uno recibe las ayudas del director (`S`) y `{ cp, entered }`
 * (`entered`: se ha cargado directamente en este punto, no se viene del anterior).
 * Un tramo termina devolviendo nada (pasa al siguiente punto de control) o
 * `null` (fin del prólogo). Los diálogos son los del guion, literales.
 *
 * Pendiente de decidir por el creador (aquí no se inventa): quién ataca el
 * convoy, el destino de Iker, las otras cuatro cartas, por qué Narbaiza
 * quiere a Jon vivo y las consecuencias de matar o perdonar.
 */

const PI = Math.PI;
const SANGRE = '#d1162b';
const ENERGIA = MARKS.energia.color;
const GOLD = '#ffd27a';

// ------------------------------------------------------------------ Ayudas
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Plano a dos: cámara a un lado de la línea entre `a` y `b`. */
function twoShot(a, b, { side = 1, dist = 4.2, h = 1.6, lookH = 1.35 } = {}) {
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * side;
  const nz = (dx / l) * side;
  const y = Math.max(a.y, b.y);
  return { pos: { x: mx + nx * dist, y: y + h, z: mz + nz * dist }, look: { x: mx, y: y + lookH, z: mz } };
}

/** Cámara detrás de `from` mirando hacia `to`. */
function overShoulder(from, to, { back = 3.2, h = 1.9, side = 0.8, lookH = 1.2 } = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l;
  const uz = dz / l;
  return {
    pos: { x: from.x - ux * back + uz * side, y: from.y + h, z: from.z - uz * back - ux * side },
    look: { x: to.x, y: (to.y ?? from.y) + lookH, z: to.z },
  };
}

/** Ejecuta algo en segundo plano dentro del tramo (se corta si el tramo se cancela). */
function background(S, fn) {
  fn().catch(() => {});
}

function cine(S, on) {
  S.lock(on);
  S.letterbox(on);
  if (!on) S.release();
}

function iker(S, p, yaw = 0) {
  return S.npc('iker', { name: 'Iker', palette: STORY_PALETTES.iker, x: p.x, y: p.y, z: p.z, yaw });
}

function person(S, id, palette, p, yaw = 0, extra = {}) {
  return S.npc(id, { name: id, palette: STORY_PALETTES[palette] ?? null, x: p.x, y: p.y ?? 0, z: p.z, yaw, ...extra });
}

function agent(S, id, p, yaw = 0, gear = null) {
  return S.npc(id, { name: 'Agente PDC', variant: 'pdc', gear, x: p.x, y: p.y ?? 0, z: p.z, yaw });
}

function narbaiza(S, p, yaw = 0) {
  return S.npc('narbaiza', { name: 'Narbaiza', palette: STORY_PALETTES.narbaiza, x: p.x, y: p.y ?? 0, z: p.z, yaw, marks: [SANGRE_DEF], scale: 1.04 });
}

/** Rayo de Sangre (rojo) de la muñeca de Narbaiza a un punto. */
function sangreBolt(S, from, to) {
  const g = S.g;
  g.vfx.lightning({ x: from.x, y: from.y, z: from.z }, { x: to.x, y: to.y, z: to.z }, SANGRE, { width: 0.06, duration: 0.22, jitter: 0.35, branches: 2 });
  g.vfx.particles.burst(to, { count: 6, speed: 2.5, color: new THREE.Color(SANGRE), size: 0.08, life: 0.4, drag: 2 });
}

/** Rayo de la tormenta: del cielo a un punto, con destello y trueno. */
function strike(S, to, color = '#cfe4ff') {
  const g = S.g;
  g.vfx.lightning({ x: to.x + (Math.random() - 0.5) * 8, y: to.y + 45, z: to.z + (Math.random() - 0.5) * 8 }, to, color, { width: 0.18, duration: 0.35, jitter: 1.6, branches: 4 });
  g.vfx.lights.flash({ x: to.x, y: to.y + 6, z: to.z }, color, 80, 40, 0.25);
  g.vfx.particles.burst(to, { count: 18, speed: 6, color: new THREE.Color(color), size: 0.14, life: 0.5, drag: 2 });
  S.sfx('thunder', to);
}

/** Muñeca izquierda de Jon (donde está la Marca del Destino). */
function jonWrist(S) {
  S.player.updateModelMatrices();
  return S.player.handWorldPosition(new THREE.Vector3(), 'L');
}

/** Jon tumbado (inconsciente o dormido): el modelo se gira y se mantiene así. */
function lieDown(S, on) {
  const root = S.player.model.root;
  if (!on) {
    root.rotation.order = 'XYZ';
    root.rotation.x = 0;
    return () => {};
  }
  // Orden YXZ: primero se tumba y luego se orienta (pies hacia donde mira)
  root.rotation.order = 'YXZ';
  return S.every(() => {
    root.rotation.x = -PI / 2;
  });
}

/** Lanzar piedras para distraer (sigilo de M01): F hace ruido donde apuntas. */
function enableStones(S, guards) {
  S.block('melee');
  let cd = 0;
  S.every((dt) => {
    cd -= dt;
    if (cd > 0 || !S.g.input.wasPressedRaw('melee') || S.d.controlsLocked) return;
    cd = 1.6;
    const p = S.pos;
    const aim = S.g.powers.aimPoint(new THREE.Vector3());
    const dx = aim.x - p.x;
    const dz = aim.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, 16 / d);
    const hit = { x: p.x + dx * k, y: p.y, z: p.z + dz * k };
    S.g.player.model.trigger?.('cast');
    S.g.vfx.particles.burst({ x: hit.x, y: hit.y + 0.3, z: hit.z }, { count: 10, speed: 2.5, color: new THREE.Color(0x9a948a), size: 0.08, life: 0.5, drag: 3, gravity: 9 });
    S.sfx('stone', hit);
    let best = null;
    let bd = 13;
    for (const gd of guards) {
      if (!gd.active) continue;
      const dd = hdist(gd.position, hit);
      if (dd < bd && Math.abs(gd.position.y - hit.y) < 4) {
        bd = dd;
        best = gd;
      }
    }
    best?.investigate(hit);
    S.g.events.emit('story:stone', { point: hit, guard: best?.id ?? null });
  });
}

/** Estado de la base a partir de la alarma (CP06…CP08). */
function baseAfterAlarm(S) {
  const base = S.map.base;
  base.vitrines.setAbsorbed(true);
  base.alarms.set(true);
  base.shutters.stairs.set(true);
  base.shutters.main.set(true);
  // Los guardias ya están en sus puestos de alarma (ante la entrada principal cerrada)
  for (const gd of base.guards) {
    const a = base.alarmPosts?.[gd.id];
    if (!a) gd.setActive(false);
    else if (!gd.responding) gd.post(a.at, a.look);
  }
  for (const l of base.lights) l.active = true;
  S.loop('alarm', true);
}

/** Estado del pueblo de día según el punto de control. */
function dayState(S, cp) {
  const m = S.map;
  const i = cp.index;
  const storm = i >= 12 && i <= 16; // CP13…CP17
  m.jonHouse.setRuined(i >= 14); // desde CP15
  m.storm?.setBlocked(i >= 12 && i <= 13);
  stormLook(S, storm ? 1 : 0);
}

/** Cielo de tormenta: luz apagada, niebla densa y lluvia (0 = día normal). */
function stormLook(S, k) {
  const m = S.map;
  const scene = S.g.scene;
  // Oscuro pero legible: la luz baja menos y un relleno junto a la cámara
  m.hemi.intensity = 1.05 - 0.4 * k;
  m.sun.intensity = 2.3 - 1.4 * k;
  S.g.fillLight.intensity = 0.7 * k;
  if (scene.fog) {
    scene.fog.color.set(k > 0 ? 0x4a5462 : 0xa9bccb);
    scene.fog.density = 0.0045 + 0.008 * k;
  }
  m.sky.visible = k < 0.5;
  S.g.scene.background?.set?.(k > 0 ? 0x2a3038 : 0x05080d);
  m.rain.setIntensity(k);
  S.loop('rain', k > 0);
  S.loop('storm', k > 0);
}

// ================================================================== M01
/** CP01 · Reunión en los tejados y tutorial de parkour. */
async function rooftops(S) {
  const P = S.points;
  const roofs = S.map.roofs;
  const ik = iker(S, P.iker01, PI);
  if (S.state.mission.objectiveIndex < 1) {
    cine(S, true);
    S.d.ui.fadeTo(1, 0, 'EXT. PUEBLO COSTERO — NOCHE, 23:47');
    await S.wait(2.4);
    // Plano de apertura: mar oscuro, casas de piedra, puerto y base con focos
    S.shot({ pos: { x: 24, y: 34, z: 98 }, look: { x: 78, y: 12, z: -42 } }, { pos: { x: -7, y: 9.5, z: 5 }, look: { x: -19, y: 5.6, z: -8 } }, 9);
    await S.fade(0, 1500);
    const climb = ik.walkTo([{ x: -24.6, z: -1.4 }, { x: -24, z: -2.6, y: 1.6, hop: true }, { x: -26, z: -2.6, y: 3.2, hop: true }, { x: -24.4, z: -5.4, y: 5, hop: true }, { x: -20.8, z: -7.6 }], { speed: 2.2 });
    await S.wait(7.8);
    await S.await(climb);
    ik.lookAt(S.pos);
    S.shot(twoShot(S.pos, ik.position, { side: -1, dist: 3.6 }));
    await S.talk([
      ['IKER', '¿Vas a quedarte ahí toda la noche?'],
      ['JON', 'Estoy pensando.'],
      ['IKER', 'Llevamos tres meses observando esa base. No habrá otra oportunidad.'],
      ['JON', '¿Y si nos pillan?'],
      ['IKER', 'Procura que no nos pillen.'],
      ['JON', 'Mi abuela cree que estamos arreglando la barca.'],
      ['IKER', 'Técnicamente estamos juntos. Ya es más verdad que otras excusas tuyas.'],
      ['JON', 'Vamos.'],
    ]);
    // CP01 queda guardado tras la reunión
    S.state.mission.objectiveIndex = 1;
    S.reach('CP01');
    cine(S, false);
  } else {
    ik.place({ x: -20.8, y: 5, z: -7.6 });
    await S.fadeIn();
  }
  S.objective('Sigue a Iker por los tejados', ['Hasta el pie del acantilado']);
  S.tutorial('Movimiento', '[W][A][S][D] moverse · [Shift] correr · [Espacio] saltar · Salta hacia un borde con [W] pulsado para agarrarte y subir');
  ik.lookAt(null);
  // Iker va delante de tejado en tejado y espera a Jon en cada uno
  background(S, async () => {
    for (let i = 0; i < roofs.length - 1; i++) {
      const a = roofs[i];
      const b = roofs[i + 1];
      const zc = (Math.max(a.z - a.d / 2, b.z - b.d / 2) + Math.min(a.z + a.d / 2, b.z + b.d / 2)) / 2;
      S.markers([{ x: b.x, y: b.h, z: b.z, label: 'Iker' }]);
      await S.await(ik.walkTo([{ x: a.x + a.w / 2 - 0.6, z: zc }, { x: b.x - b.w / 2 + 0.6, z: zc, y: b.h, hop: true }, { x: b.x, z: b.z }], { speed: 4.6, run: true }));
      ik.lookAt(S.pos);
      if (i === 2) S.tutorial('Parkour', 'Para subir a un tejado más alto, salta hacia el borde con [W]: Jon se agarra y sube · Colgado: [A][D] desplazarse · [Espacio] subir · [C] soltarse');
      await S.until(() => hdist(S.pos, ik.position) < 7.5 || S.pos.x > b.x + 1.5);
      ik.lookAt(null);
    }
    // Bajada por las cajas hasta el pie del acantilado
    S.markers([{ ...P.cp02, label: 'Acantilado' }]);
    S.objective('Baja al pie del acantilado');
    await S.await(ik.walkTo([{ x: 43.4, z: -20 }, { x: 45.8, z: -20, y: 1.8, hop: true }, { x: 48, z: -20, y: 0, hop: true }, { x: 48.5, z: -18.5 }], { speed: 4.2, run: true }));
  });
  await S.until(() => S.isNear(P.cp02, 5, 2.5));
}

/** CP02 · Acantilado y perímetro de la base (sigilo). */
async function cliff(S, { entered }) {
  const P = S.points;
  const base = S.map.base;
  const ik = iker(S, { x: 48.5, y: 0, z: -18.5 }, PI / 2);
  await S.fadeIn();
  S.tutorial(null);
  S.objective('Trepa por las rocas del acantilado');
  S.markers([{ ...P.cliffTop, label: 'Acantilado' }]);
  S.tutorial('Escalada', 'Salta hacia la roca con [W] pulsado para agarrarte · [Espacio] para subir');
  const climb = ik.walkTo([{ x: 51.2, z: -18.5, y: 3.2, hop: true }, { x: 53.6, z: -18.5, y: 6.6, hop: true }, { x: 56.5, z: -18.8, y: 10, hop: true }, { x: 58.5, z: -17.6 }], { speed: 2 });
  if (!entered) await S.wait(1);
  await S.say('IKER', 'Recuerda el faro. Tú te caíste por las escaleras.');
  await S.say('JON', 'Me empujaste.');
  await S.say('IKER', 'Diferencias de interpretación.');
  await S.until(() => S.pos.y > 9.4 && S.pos.x > 55);
  await S.await(climb);
  // Perímetro: patrullas y focos
  S.setStealth({ guards: base.guards, lights: base.lights });
  enableStones(S, base.guards);
  S.tutorial('Sigilo', '[C] agacharte: te ven menos y más tarde · No entres en los conos de visión ni en la luz de los focos · [F] lanzar una piedra para distraer · Si te descubren, vuelves al último punto de control');
  S.objective('Cruza el patio sin que te vean', ['Reúnete con Iker tras las cajas junto al edificio']);
  S.markers([{ ...P.cp03, label: 'Iker' }]);
  // Iker se adelanta por la brecha de la valla y espera escondido
  background(S, async () => {
    await S.await(ik.walkTo([P.fenceGap, { x: 65.5, z: -18.6 }], { speed: 1.8 }));
    ik.setVisible(false);
    ik.place({ x: 78.6, y: 10, z: -42.8 }, PI / 2);
    ik.setPose('kneel');
    ik.setVisible(true);
  });
  await S.until(() => S.isNear(P.cp03, 2.4, 2));
}

/** CP03 · Cambio de guardia y conducto de ventilación. */
async function vent(S, { entered }) {
  const P = S.points;
  const base = S.map.base;
  const ik = iker(S, { x: 78.6, y: 10, z: -42.8 }, PI / 2);
  ik.setPose('kneel');
  if (entered) S.player.motor.setCrouch(true);
  S.setStealth({ guards: base.guards, lights: base.lights });
  enableStones(S, base.guards);
  await S.fadeIn();
  S.objective('Espera al cambio de guardia', ['Quédate agachado tras las cajas']);
  S.markers([]);
  S.tutorial('Esperar', 'Las patrullas tienen rutina: quédate agachado [C] y observa · El conducto está vigilado por dos guardias');
  await S.wait(3);
  await S.say('AGENTE (RADIO)', 'Patrulla norte, informe de estado.');
  const g1 = base.guards.find((g) => g.id === 'conducto1');
  const g2 = base.guards.find((g) => g.id === 'conducto2');
  // Se van al cuartel (el garaje) a fichar y entran; el relevo tarda en llegar
  const bk = base.barracks;
  g1.leave([bk], 40, { hide: true });
  g2.leave([{ x: bk.x - 1.4, z: bk.z + 0.8 }], 42, { hide: true });
  await S.wait(4.5);
  // Iker abre la tapa del conducto
  ik.setPose('stand');
  await S.await(ik.walkTo([{ x: 82.5, z: -44 }, { x: 86.2, z: -49.5 }, P.ventOutside], { speed: 2.6, run: true }));
  ik.setPose('kneel');
  await S.wait(1.2);
  base.shutters.vent.open(1);
  S.objective('Entra por el conducto de ventilación', ['Agachado [C]: la abertura es baja', 'Los guardias volverán pronto']);
  S.markers([{ ...P.vent, label: 'Conducto' }]);
  S.tutorial('Conducto', 'Agáchate con [C] para pasar por la abertura');
  await S.wait(1);
  ik.setPose('stand');
  await S.await(ik.walkTo([{ x: 87.6, z: -52 }, { x: 90.6, z: -52 }], { speed: 1.4 }));
  ik.place({ x: 91.2, y: 10, z: -49.6 }, PI);
  ik.setPose('kneel');
  await S.until(() => S.pos.x > 88.7 && S.pos.y > 9 && S.pos.y < 12 && Math.abs(S.pos.z + 52) < 7);
}

/** CP04 · Dentro de las instalaciones: almacén, documentos y pasarela. */
async function inside(S) {
  const P = S.points;
  const base = S.map.base;
  base.shutters.vent.set(false);
  const ik = iker(S, { x: 91.2, y: 10, z: -49.6 }, PI);
  ik.setPose('kneel');
  S.setStealth({ guards: base.guards, lights: base.lights });
  enableStones(S, base.guards);
  await S.fadeIn();
  S.objective('Sube a la pasarela norte', ['Usa las cajas del almacén', 'Opcional: lee los documentos [E]']);
  S.markers([{ ...P.catwalk, label: 'Pasarela' }]);
  S.tutorial('Escalada interior', 'Las cajas llevan a la pasarela · Espera a que el guardia del almacén mire a otro lado · Los documentos cuentan qué guarda la PDC');
  documents(S);
  await S.wait(2.5);
  ik.setVisible(false);
  await S.until(() => S.pos.y > 13.4 && S.pos.x > 100.4);
}

/** Documentos de la base (exploración opcional). */
function documents(S) {
  const docs = S.state.mission.discoveredDocuments;
  for (const d of S.map.base.documents) {
    S.interact({ x: d.x, y: d.y - 1, z: d.z }, `Leer: ${d.title}`, 1.8).then(() => {
      if (!docs.includes(d.id)) docs.push(d.id);
      S.tutorial(d.title, d.text);
      S.g.events.emit('story:document', { id: d.id });
    }).catch(() => {});
  }
}

/** CP05 · La cámara de contención y la carta dorada. */
async function cards(S) {
  const P = S.points;
  const base = S.map.base;
  S.setStealth(null);
  const ik = iker(S, { x: 102.6, y: 14, z: -67.2 }, PI / 2);
  documents(S);
  await S.fadeIn();
  S.objective('Entra en la cámara de contención');
  S.markers([{ x: 106, y: 14, z: -66.5, label: 'Cámara' }]);
  await S.until(() => S.isNear({ x: 106, y: 14, z: -67 }, 4.2, 2));
  cine(S, true);
  S.markers([]);
  ik.lookAt({ x: 106, z: -69 });
  S.shot({ pos: { x: 101.5, y: 16.2, z: -63.4 }, look: { x: 106, y: 15.2, z: -69 } }, { pos: { x: 103, y: 15.8, z: -64.6 }, look: { x: 106, y: 15.4, z: -69 } }, 8);
  await S.talk([
    ['IKER', '¿Qué demonios es esto?'],
    ['IKER', 'Aquí pone Proyecto Ascend. Cuatro objetos sin identificar y uno catalogado como Destino.'],
    ['JON', '¿Destino?'],
    ['IKER', 'Jon... creo que deberíamos irnos.'],
    ['JON', 'Espera.'],
  ]);
  cine(S, false);
  S.objective('Toca la carta dorada');
  S.markers([{ ...P.card, y: 14, label: 'Carta dorada' }]);
  await S.interact({ x: 106, y: 14, z: -69 }, 'Tocar la carta dorada', 2.9);
  // Absorción: la carta se deshace en partículas doradas hacia la muñeca izquierda
  cine(S, true);
  S.markers([]);
  const card = new THREE.Vector3(106, 15.5, -69);
  S.player.lookTarget = { x: 106, y: 14, z: -69 };
  S.shot({ pos: { x: 104.3, y: 15.9, z: -66.4 }, look: { x: 105.9, y: 15.1, z: -68.4 } });
  S.sfx('cardHum', card);
  const flow = S.every(() => {
    const w = jonWrist(S);
    for (let i = 0; i < 3; i++) {
      const life = 0.45;
      S.g.vfx.particles.emit({ x: card.x + (Math.random() - 0.5) * 0.3, y: card.y + (Math.random() - 0.5) * 0.4, z: card.z, vx: (w.x - card.x) / life, vy: (w.y - card.y) / life, vz: (w.z - card.z) / life, color: new THREE.Color(GOLD), size: 0.07, life, drag: 0 });
    }
  });
  await S.wait(1.4);
  base.vitrines.setAbsorbed(true);
  S.g.cameraController.shake(0.5);
  await S.say('JON', '¡Ahhh!', 1.4);
  flow();
  S.d.grantDestiny();
  const w = jonWrist(S);
  S.g.vfx.lights.flash(w, GOLD, 60, 10, 0.6);
  S.g.vfx.ring({ x: S.pos.x, y: S.pos.y + 0.05, z: S.pos.z }, 3, GOLD, 0.7);
  S.g.marks.pulse(1, 1.2);
  S.sfx('acquired');
  S.g.events.emit('story:destiny', {});
  ik.lookAt(S.pos);
  S.shot(twoShot(S.pos, ik.position, { side: 1, dist: 3.4 }));
  await S.say('IKER', '¡Jon, mírame!');
  S.player.lookTarget = null;
  base.alarms.set(true);
  // Los guardias corren a la entrada principal (creen que el intruso sigue dentro)
  for (const gd of base.guards) {
    const a = base.alarmPosts?.[gd.id];
    if (a) gd.respond(a.at, a.look);
  }
  S.loop('alarm', true);
  await S.say('SISTEMA', 'Anomalía detectada. Contención comprometida.');
  cine(S, false);
}

/** CP06 · Alarma: la salida principal se cierra. */
async function alarm(S) {
  baseAfterAlarm(S);
  S.map.base.shutters.stairs.set(false);
  const ik = iker(S, { x: 105.6, y: 14, z: -63.6 }, 0);
  await S.fadeIn();
  S.objective('ESCAPAR');
  S.markers([{ x: 108.6, y: 14, z: -58.6, label: 'Escaleras' }]);
  await S.await(ik.walkTo([{ x: 105.6, z: -60.6 }, { x: 108.6, z: -58.2 }], { speed: 4, run: true }));
  cine(S, true);
  S.shot({ pos: { x: 106.4, y: 16.3, z: -55.4 }, look: { x: 109, y: 15, z: -59.6 } });
  S.map.base.shutters.stairs.close(0.8);
  S.sfx('shutter', { x: 109, y: 15, z: -59.6 });
  await S.wait(0.6);
  ik.lookAt(S.pos);
  await S.say('IKER', '¡La salida principal está cerrada!');
  await S.say('JON', '¡Por arriba!');
  cine(S, false);
}

/** CP07 · Huida contrarreloj por el balcón, el andamio y las azoteas. */
async function escape(S) {
  const P = S.points;
  baseAfterAlarm(S);
  const ik = iker(S, { x: 107.4, y: 14, z: -56 }, 0);
  await S.fadeIn();
  const LIMIT = 150;
  let left = LIMIT;
  let step = 'Sal al balcón sur';
  S.every((dt) => {
    left -= dt;
    S.d.ui.objective({ mission: 'M01 · La última noche', text: 'ESCAPAR', extra: [step], timer: `${Math.max(0, Math.ceil(left))} s` });
    if (left <= 0) S.d.reload('Te han atrapado');
  });
  S.tutorial('Huida', 'Sin combate: corre [Shift], salta y trepa · El andamio del balcón sube a la azotea');
  // Iker corre delante por toda la ruta; el progreso depende solo de Jon
  ik.walkTo([{ x: 104, z: -48 }, P.balconyDoor, P.balcony, { x: 106.2, z: -43.4 }, { x: 106.9, z: -44.6, y: 18.4, hop: true }, P.roof, { x: 111.2, z: -55 }, { x: 115, z: -55, y: 15, hop: true }, { x: 116, z: -49 }, { x: 116, z: -18 }], { speed: 4.6, run: true });
  const end = { x: 116, y: 15, z: -17 };
  const stageOf = () => {
    const p = S.pos;
    if (S.isNear(end, 3.2, 2.5)) return 3;
    if (p.y > 17.8 || (p.x > 111.6 && p.y > 14.5)) return 2; // azotea o anexo
    if (p.z > -45.3 && p.y > 13.5) return 1; // balcón o andamio
    return 0;
  };
  const STAGES = [
    { step: 'Sal al balcón sur', mark: { ...P.balcony, label: 'Balcón' } },
    { step: 'Trepa por el andamio hasta la azotea', mark: { ...P.roof, label: 'Azotea' } },
    { step: 'Salta a la azotea del anexo y cruza la pasarela', mark: { ...P.annexRoof, label: 'Anexo' } },
  ];
  let stage = -1;
  let radio = false;
  while (stage < 3) {
    const now = stageOf();
    if (now > stage) {
      stage = now;
      if (stage < 3) {
        step = STAGES[stage].step;
        S.markers([STAGES[stage].mark]);
      }
      if (stage >= 2 && !radio) {
        radio = true;
        S.line('AGENTE (RADIO)', 'Dos intrusos en cubierta norte.');
      }
    }
    if (stage < 3) await S.until(() => stageOf() > stage);
  }
}

/** CP08 · La tirolina hasta la playa y el desmayo. */
async function zipline(S) {
  const P = S.points;
  baseAfterAlarm(S);
  const zip = S.map.base.zipline;
  const ik = iker(S, { x: 116.6, y: 15, z: -11 }, PI);
  await S.fadeIn();
  S.objective('Agárrate a la tirolina');
  S.markers([{ ...P.zipStart, label: 'Tirolina' }]);
  await S.say('IKER', '¡La tirolina! ¡Es nuestra salida!');
  // Iker baja primero
  ik.setPose('hang');
  let ik_k = 0;
  const ikRide = S.every((dt) => {
    ik_k = Math.min(1, ik_k + dt / 4.2);
    const p = zip.at(ik_k);
    ik.place({ x: p.x, y: p.y - 2.05, z: p.z }, PI);
    if (ik_k >= 1) {
      ik.setPose('stand');
      ik.place({ x: 109, y: 0, z: 36 });
    }
  });
  await S.interact(P.zipStart, 'Agarrarse a la tirolina', 2.6);
  ikRide();
  ik.setPose('stand');
  ik.place({ x: 108.2, y: 0, z: 35.4 });
  cine(S, true);
  S.markers([]);
  S.objective(null);
  let k = 0;
  const ride = S.every((dt) => {
    k = Math.min(1, k + dt / 4);
    const p = zip.at(k);
    S.g.player.motor.teleport({ x: p.x, y: p.y - 2.05, z: p.z });
    const ahead = zip.at(Math.min(1, k + 0.12));
    S.g.cameraController.setShot({ pos: { x: p.x + 3.5, y: p.y + 0.6, z: p.z - 6 }, look: { x: ahead.x, y: ahead.y - 1.5, z: ahead.z } });
  });
  S.sfx('zipline');
  await S.until(() => k >= 1);
  ride();
  S.place({ ...P.beach, yaw: PI });
  S.release();
  S.shot({ pos: { x: 104, y: 2.2, z: 30 }, look: { x: 109, y: 0.8, z: 35 } });
  await S.walkTo({ x: 108.6, z: 34 });
  ik.lookAt(S.pos);
  await S.say('JON', 'Iker... no veo bien...', 2.4);
  S.player.motor.setCrouch(true);
  await S.wait(0.8);
  lieDown(S, true);
  S.loop('alarm', false);
  await S.fade(1, 1600, 'A la mañana siguiente');
  await S.wait(1.2);
}

// ================================================================== M02
/** CP09 · Despertar en casa, la marca dorada y la plaza de Narbaiza. */
async function wake(S, { cp }) {
  const P = S.points;
  dayState(S, cp);
  const ab = person(S, 'abuela', 'abuela', { x: P.abuela.x, y: 0, z: P.abuela.z }, PI / 2);
  ab.lookAt(P.stove);
  cine(S, true);
  S.place({ x: P.bed.x, y: 0.6, z: P.bed.z, yaw: PI / 2 });
  const lie = lieDown(S, true);
  S.shot({ pos: { x: -31.2, y: 2.6, z: 18.4 }, look: { x: -33.6, y: 0.7, z: 20.6 } });
  S.d.ui.fadeTo(1, 0, 'INT. CASA DE JON — MAÑANA');
  await S.wait(1.6);
  await S.fade(0, 1200);
  await S.say('ABUELA', '¡Jon! ¡Levanta, que ya es tarde!');
  lie();
  lieDown(S, false);
  S.place(P.cp09);
  // Primer plano de la muñeca izquierda: la Marca del Destino sigue ahí
  await S.wait(0.3);
  const w = jonWrist(S);
  S.shot({ pos: { x: w.x + 0.9, y: w.y + 0.5, z: w.z - 0.7 }, look: w });
  S.g.marks.pulse(0.6, 0.6);
  await S.say('JON', 'No fue un sueño...', 2.6);
  cine(S, false);
  // Exploración libre: la PDC interroga a los vecinos
  person(S, 'vecina', 'vecina', { x: -7, z: 9.5 }, 0);
  agent(S, 'agente1', { x: -6.6, z: 11.6 }, PI);
  person(S, 'vecino', 'vecino', { x: 14, z: 6 }, -PI / 2);
  agent(S, 'agente2', { x: 11.8, z: 6.4 }, PI / 2);
  S.objective('Sal de casa y ve a la plaza', ['La PDC está interrogando a los vecinos']);
  S.markers([{ ...P.plaza, label: 'Plaza' }]);
  // Escena de la plaza
  const mart = person(S, 'martin', 'martin', { x: 3, z: 1.2 }, PI);
  mart.setPose('kneel');
  const nb = narbaiza(S, { x: 3.2, z: -1.4 }, 0);
  agent(S, 'agente3', { x: -1, z: -2.6 }, 0.5);
  agent(S, 'agente4', { x: 7.4, z: -2 }, -0.6);
  agent(S, 'agente5', { x: 7, z: 4.4 }, -2.4);
  agent(S, 'agente6', { x: -1.6, z: 4.8 }, 2.4);
  await S.until(() => hdist(S.pos, P.plaza) < 13);
  cine(S, true);
  S.markers([]);
  S.objective(null);
  S.g.player.autopilot = null;
  const ik = iker(S, { x: S.pos.x - 1.2, y: 0, z: S.pos.z + 1.4 }, PI / 2);
  ik.lookAt(nb.position);
  S.shot({ pos: { x: -3.4, y: 2.4, z: 6.8 }, look: { x: 3, y: 1.1, z: 0 } }, { pos: { x: -1.2, y: 2.1, z: 5.2 }, look: { x: 3.1, y: 1.2, z: -0.2 } }, 6);
  nb.lookAt(mart.position);
  await S.say('NARBAIZA', 'Anoche alguien entró en una instalación militar. Quiero nombres.');
  await S.say('MARTÍN', '¡No sé nada!');
  // Sangre: Narbaiza tortura a Martín
  nb.setPose('reach');
  nb.markIntensity = 1;
  mart.setPose('lifted');
  const torture = S.every(() => {
    if (Math.random() < 0.45) sangreBolt(S, { x: nb.position.x + 0.3, y: 1.35, z: nb.position.z + 0.5 }, { x: mart.position.x, y: 1.2, z: mart.position.z });
  });
  S.sfx('sangre', nb.position);
  S.shot({ pos: { x: 5.6, y: 1.9, z: 3.4 }, look: { x: 3.1, y: 1.3, z: -0.4 } });
  await S.say('NARBAIZA', '¿Sabes qué es lo que más me gusta de la sangre? Que nunca miente.', 4);
  // Jon interviene: ataque impulsivo
  S.shot(overShoulder(S.pos, nb.position, { back: 3, side: 0.9 }));
  S.tutorial('Intervenir', 'Pulsa [F]');
  await S.until(() => S.g.input.wasPressedRaw('melee') || S.g.input.wasPressedRaw('attack'));
  S.tutorial(null);
  S.line('JON', '¡Déjalo en paz!', 1.4);
  await S.wait(0.3);
  S.line('IKER', '¡No hagas nada!', 1.4);
  torture();
  mart.setPose('kneel');
  S.player.autopilot = { x: nb.position.x - 1.6, z: nb.position.z + 2.2, sprint: true, radius: 0.5 };
  S.shot({ pos: { x: -2.2, y: 2.6, z: 7.6 }, look: { x: 2.4, y: 1.1, z: 0.8 } });
  await S.until(() => S.player.autopilot?.done || hdist(S.pos, nb.position) < 2.8);
  S.player.autopilot = null;
  // Inmovilizado con Sangre: queda a 1 PV
  nb.lookAt(S.pos);
  const start = S.g.playerCombat.health.value;
  let t = 0;
  const pin = S.every((dt) => {
    t += dt;
    const hp = Math.max(1, Math.round(start - (start - 1) * Math.min(1, t / 2.4)));
    S.g.playerCombat.setHealth(hp);
    if (Math.random() < 0.5) sangreBolt(S, { x: nb.position.x, y: 1.4, z: nb.position.z }, { x: S.pos.x, y: S.pos.y + 1.1, z: S.pos.z });
    S.g.cameraController.shake(0.04);
  });
  S.player.motor.setCrouch(true);
  S.shot(twoShot(S.pos, nb.position, { side: -1, dist: 3.4, h: 1.2 }));
  await S.wait(2.6);
  pin();
  S.g.playerCombat.setHealth(1);
  S.g.events.emit('story:pinned', { health: S.g.playerCombat.health.value });
  await S.say('NARBAIZA', 'El valor sin poder es una forma bastante estúpida de morir.', 3.4);
  nb.setPose('stand');
  nb.markIntensity = 0;
  nb.lookAt(null);
  nb.walkTo([{ x: 10, z: -12 }, { x: 20, z: -30 }], { speed: 1.6 });
  await S.wait(1.6);
  await S.fade(1, 900);
}

/** CP10 · El callejón: la discusión con Iker. */
async function alley(S, { cp }) {
  const P = S.points;
  dayState(S, cp);
  S.place(P.cp10);
  const ik = iker(S, { x: -21.2, y: 0, z: 18.4 }, PI);
  // Jon sigue a 1 PV hasta que acaba la conversación
  const hold = S.every(() => {
    if (S.g.playerCombat.health.value > 1) S.g.playerCombat.setHealth(1);
  });
  S.player.motor.setCrouch(true);
  cine(S, true);
  ik.lookAt(S.pos);
  S.shot(twoShot(S.pos, ik.position, { side: 1, dist: 3.2, h: 1.1 }));
  await S.fade(0, 900);
  await S.talk([
    ['IKER', 'En la ciudad hay gente que lucha contra la PDC. Aquí no podemos hacer nada.'],
    ['JON', '¿Y mi abuela?'],
    ['IKER', 'Podemos buscar cómo sacarla después.'],
    ['JON', 'Ella me crió. No voy a abandonarla.'],
    ['IKER', 'Algún día tendrás que decidir qué estás dispuesto a perder para cambiar las cosas.'],
    ['JON', 'Hoy no.'],
  ]);
  hold();
  S.player.motor.setCrouch(false);
  cine(S, false);
  // La salud vuelve poco a poco
  ik.walkTo([{ x: -20, z: 26 }, { x: -6, z: 30 }], { speed: 1.6 });
  S.objective('Vuelve a casa');
  S.markers([{ ...P.houseDoor, label: 'Casa' }]);
  await S.near(P.houseDoor, 2.2);
  ik.setVisible(false);
  await S.fade(1, 700);
}

// ================================================================== M03
const DAY_TASKS = {
  1: { title: 'Ayuda a reparar el puerto', where: 'pier', label: 'Reparar el amarre' },
  2: { title: 'Escucha los rumores en la plaza', where: 'rumor', label: 'Escuchar a los vecinos' },
  3: { title: 'Mira la foto familiar', where: 'photo', label: 'Mirar la foto' },
  4: { title: 'Observa las patrullas desde el mirador', where: 'lookout', label: 'Observar' },
};

/** CP11 · Cinco días de normalidad (montaje jugable). */
async function days(S, { cp }) {
  const P = S.points;
  const st = S.state;
  dayState(S, cp);
  const ab = person(S, 'abuela', 'abuela', { x: P.abuela.x, y: 0, z: P.abuela.z }, PI / 2);
  ab.lookAt(P.stove);
  for (let day = st.mission.dayIndex || 1; day <= 5; day++) {
    if (st.mission.dayIndex !== day) {
      st.mission.dayIndex = day;
      S.reach('CP11');
    }
    S.g.playerCombat.setHealth(S.g.playerCombat.health.max); // un nuevo día: Jon está recuperado
    S.place(P.cp11);
    cine(S, true);
    S.d.ui.fadeTo(1, 0);
    await S.dayCard(`DÍA ${day}`, day === 5 ? 'El día del mercado' : 'Pueblo costero');
    await S.fade(0, 700);
    cine(S, false);
    // Interacciones opcionales: la abuela y los vecinos
    const talks = optionalTalks(S, day, ab);
    if (day < 5) {
      const task = DAY_TASKS[day];
      S.objective(task.title, ['Opcional: habla con la abuela y con los vecinos [E]']);
      await dayTask(S, day, task);
      S.objective('Vuelve a casa a descansar');
      S.markers([{ ...P.bed, y: 0, label: 'Cama' }]);
      await S.interact({ x: P.bed.x + 1, y: 0, z: P.bed.z }, 'Dormir hasta mañana', 2.2);
      talks.stop();
      S.markers([]);
      await S.fade(1, 800);
    } else {
      // Día 5: el encargo de la abuela
      S.objective('Habla con la abuela');
      S.markers([{ ...P.abuela, label: 'Abuela' }]);
      talks.stop();
      await S.interact(P.abuela, 'Hablar con la abuela', 2.4);
      S.markers([]);
      cine(S, true);
      ab.lookAt(S.pos);
      S.shot(twoShot(S.pos, ab.position, { side: -1, dist: 3 }));
      await S.talk([
        ['ABUELA', 'Jon, cariño, ¿puedes acercarte al mercado?'],
        ['JON', '¿Qué necesitas?'],
        ['ABUELA', 'Pan, patatas y algo de pescado, si queda.'],
        ['JON', 'Ahora vuelvo.'],
        ['ABUELA', 'Y no tardes, que comemos juntos.'],
      ]);
      cine(S, false);
      S.objective('Sal hacia el mercado');
      S.markers([{ ...P.houseDoor, label: 'Salir' }]);
      await S.until(() => S.pos.z < 13.4);
    }
  }
}

/** Charlas opcionales del día (cuentan para MissionState). */
function optionalTalks(S, day, ab) {
  const P = S.points;
  const m = S.state.mission;
  m.optionalTalks = m.optionalTalks ?? [];
  const lines = {
    abuela: ['ABUELA', day < 3 ? 'Anda, come algo antes de salir.' : 'Hoy hay más uniformes que gaviotas en el puerto.'],
    vecina: ['VECINA', day < 3 ? 'Dicen que la PDC sigue buscando a quien entró en la base.' : 'Cada día traen más patrullas al pueblo.'],
    vecino: ['VECINO', 'Martín no ha vuelto a salir a faenar desde lo de la plaza.'],
  };
  const vecina = person(S, 'vecina', 'vecina', { x: -40, z: 9 }, PI / 2);
  const vecino = person(S, 'vecino', 'vecino', { x: 18, z: 12 }, -PI / 2);
  const its = [['abuela', ab], ['vecina', vecina], ['vecino', vecino]].map(([id, npc]) => {
    const it = S.g.interactions.add({
      getPosition: () => ({ x: npc.position.x, y: npc.position.y + 1, z: npc.position.z }),
      radius: 2.2,
      label: id === 'abuela' ? 'Hablar con la abuela' : 'Hablar',
      onInteract: () => {
        npc.lookAt(S.pos);
        const key = `${day}:${id}`;
        if (!m.optionalTalks.includes(key)) m.optionalTalks.push(key);
        S.g.events.emit('story:optional', { id, day });
        S.line(lines[id][0], lines[id][1], 3.2);
      },
    });
    S.d._interactions.push(it);
    return it;
  });
  return {
    stop() {
      for (const it of its) S.g.interactions.remove(it);
      ab.lookAt(P.stove);
    },
  };
}

async function dayTask(S, day, task) {
  const P = S.points;
  if (task.where === 'pier') {
    const spot = { x: -20, y: 0, z: 51.5 };
    S.markers([{ ...spot, label: 'Puerto' }]);
    const v = person(S, 'pescador', 'vecino', { x: -18.6, z: 50.4 }, -PI / 2);
    v.lookAt(spot);
    await S.interact(spot, task.label, 2.4);
    cine(S, true);
    S.shot(overShoulder({ ...S.pos }, { x: -20, y: -0.5, z: 56 }, { back: 2.6, side: 1.2 }));
    S.sfx('repair', spot);
    await S.wait(2.2);
    cine(S, false);
    S.g.ui.toast('Amarre reparado', 'El puerto vuelve a estar en pie', 1800);
  } else if (task.where === 'rumor') {
    const a = person(S, 'rumor1', 'vecina', { x: -1.2, z: 5.6 }, PI / 2);
    const b = person(S, 'rumor2', 'vecino', { x: 1.4, z: 5.6 }, -PI / 2);
    S.markers([{ x: 0, y: 0, z: 5.6, label: 'Vecinos' }]);
    await S.interact({ x: 0, y: 0, z: 6.4 }, task.label, 2.6);
    a.lookAt(S.pos);
    b.lookAt(S.pos);
    await S.talk([
      ['VECINA', 'Dicen que el general no se irá hasta encontrar a quien entró en la base.'],
      ['VECINO', 'Y que han traído más drones de la ciudad.'],
    ]);
  } else if (task.where === 'photo') {
    S.markers([{ ...P.photo, y: 0, label: 'Foto' }]);
    await S.interact({ x: P.photo.x, y: 0, z: P.photo.z - 0.9 }, task.label, 2);
    cine(S, true);
    S.shot({ pos: { x: P.photo.x, y: 1.65, z: P.photo.z - 1.1 }, look: { x: P.photo.x, y: 1.6, z: P.photo.z + 0.2 } });
    await S.wait(3.2);
    cine(S, false);
  } else if (task.where === 'lookout') {
    S.markers([{ ...P.lookout, label: 'Mirador' }]);
    const ags = [agent(S, 'patrulla1', { x: 30, z: -2 }, PI), agent(S, 'patrulla2', { x: 31.4, z: -0.8 }, PI)];
    const drone = new DecorDrone({ group: S.g.mapManager.current.group }, { x: 26, y: 9, z: 4, orbit: 8, speed: 0.5 });
    S.g.mapManager.current.entities.push(drone);
    await S.interact(P.lookout, task.label, 2.6);
    ags[0].walkTo([{ x: 10, z: -2 }, { x: -6, z: 0 }], { speed: 1.5 });
    ags[1].walkTo([{ x: 11.4, z: -0.8 }, { x: -4.6, z: 1.2 }], { speed: 1.5 });
    cine(S, true);
    S.shot({ pos: { x: 48, y: 4, z: 3 }, look: { x: 20, y: 2, z: 0 } }, { pos: { x: 47, y: 4.6, z: 1 }, look: { x: 6, y: 3, z: 0 } }, 4);
    await S.wait(4);
    cine(S, false);
    S.g.ui.toast('Cada día hay más patrullas', 'Agentes y drones de la PDC en las calles', 2200);
  }
}

// ================================================================== M04
/** CP12 · El mercado: comprar pan, patatas y pescado. */
async function market(S, { cp }) {
  const st = S.state;
  dayState(S, cp);
  await S.fadeIn();
  const items = st.mission.collectedFoodItems;
  const names = { pan: 'Pan', patatas: 'Patatas', pescado: 'Pescado' };
  const vendors = S.map.stalls.map((s, i) => person(S, `vendedor${i}`, i === 1 ? 'vendedora' : i ? 'vecino' : 'vecina', { x: s.x, z: s.z - 2.6 }, 0));
  const show = () => S.objective(`Compra para la abuela (${items.length}/3)`, S.map.stalls.map((s) => `${items.includes(s.id) ? '✓' : '·'} ${names[s.id]}`));
  show();
  S.tutorial('Mercado', 'Acércate a cada puesto y pulsa [E] para comprar');
  const markers = () => S.markers(S.map.stalls.filter((s) => !items.includes(s.id)).map((s) => ({ ...s, label: names[s.id] })));
  markers();
  await Promise.all(S.map.stalls.map(async (s, i) => {
    if (items.includes(s.id)) return;
    await S.interact(s, `Comprar ${names[s.id].toLowerCase()}`, 2.2);
    items.push(s.id);
    vendors[i].lookAt(S.pos);
    S.sfx('buy', s);
    S.g.events.emit('story:bought', { item: s.id, count: items.length });
    show();
    markers();
  }));
  S.tutorial(null);
  S.markers([]);
  // La compra completa desencadena la tormenta
  const vend = vendors[1];
  cine(S, true);
  vend.lookAt(S.pos);
  S.shot(twoShot(S.pos, vend.position, { side: 1, dist: 3.4 }));
  await S.say('VENDEDORA', 'Qué raro... esta mañana no había ni una nube.');
  S.shot({ pos: { x: S.pos.x, y: 2, z: S.pos.z + 2 }, look: { x: S.pos.x - 6, y: 30, z: S.pos.z - 20 } }, null);
  let k = 0;
  const dark = S.every((dt) => {
    k = Math.min(1, k + dt / 2.5);
    stormLook(S, k);
  });
  S.g.events.emit('story:storm', {});
  await S.wait(2.6);
  dark();
  strike(S, { x: 14, y: 6, z: -36 });
  await S.wait(0.8);
  cine(S, false);
}

/** CP13 · La tormenta: la esfera eléctrica cae sobre la casa de Jon. */
async function storm(S, { cp }) {
  dayState(S, cp);
  S.map.jonHouse.setRuined(false);
  await S.fadeIn();
  cine(S, true);
  S.shot({ pos: { x: 2, y: 3, z: -1.5 }, look: { x: -30, y: 5, z: 17 } });
  // La esfera eléctrica
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, toneMapped: false }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sphere.add(glow);
  S.g.mapManager.current.group.add(sphere);
  const from = new THREE.Vector3(-18, 55, -10);
  const to = new THREE.Vector3(-30, 4.4, 18);
  let k = 0;
  const fall = S.every((dt) => {
    k = Math.min(1, k + dt / 2.2);
    sphere.position.copy(from).lerp(to, k * k);
    if (Math.random() < 0.4) S.g.vfx.lightning(sphere.position, { x: sphere.position.x + (Math.random() - 0.5) * 6, y: sphere.position.y - 3, z: sphere.position.z + (Math.random() - 0.5) * 6 }, ENERGIA, { width: 0.06, duration: 0.15, jitter: 0.6, branches: 1 });
  });
  S.sfx('sphere', from);
  await S.until(() => k >= 1);
  fall();
  sphere.visible = false;
  S.map.jonHouse.setRuined(true);
  S.g.vfx.impact(to, null, ENERGIA, 4);
  S.g.vfx.lights.flash(to, ENERGIA, 120, 40, 0.6);
  S.g.vfx.particles.burst(to, { count: 80, speed: 10, color: new THREE.Color(0x8a7a6a), size: 0.25, life: 1.4, drag: 1.2, gravity: 12 });
  S.g.cameraController.shake(0.7);
  S.sfx('explosion', to);
  S.g.events.emit('story:sphere', {});
  S.d.ui.flash('#cfe8ff', 700);
  await S.say('JON', '¡AMAMA!', 1.6);
  S.map.storm.setBlocked(true);
  cine(S, false);
  // Carrera hasta casa (sin temporizador): la calle se corta, hay que ir por los tejados
  S.objective('Corre a casa', ['La calle está cortada: sube a los tejados']);
  S.markers([{ x: -9.5, y: 5.5, z: -10, label: 'Tejados' }]);
  S.tutorial('Rodeo', 'Los escombros cortan la calle · Sube al tejado por las cajas junto al puesto de pan');
  stormStrikes(S);
  await S.until(() => S.pos.y > 5 && S.pos.x > -14 && S.pos.x < -5 && S.pos.z < -7.5 && S.pos.z > -16.5);
  S.line('JON', '¡AGUANTA! ¡YA VOY!', 2);
}

/** Rayos alrededor de Jon durante la carrera (sin daño). */
function stormStrikes(S) {
  let t = 1.5;
  S.every((dt) => {
    t -= dt;
    if (t > 0) return;
    t = 1.6 + Math.random() * 2.2;
    const p = S.pos;
    const a = Math.random() * PI * 2;
    const r = 9 + Math.random() * 14;
    const x = p.x + Math.cos(a) * r;
    const z = p.z + Math.sin(a) * r;
    const y = S.g.world.groundHeight(x, z, 0.3, 40);
    strike(S, { x, y: Number.isFinite(y) ? y : 0, z });
  });
}

/** CP14 · Mitad de la carrera: de los tejados a la puerta de casa. */
async function run(S, { cp }) {
  const P = S.points;
  dayState(S, cp);
  S.map.jonHouse.setRuined(true);
  await S.fadeIn();
  S.objective('Corre a casa');
  S.markers([{ ...P.houseDoor, label: 'Casa' }]);
  S.tutorial('Parkour', 'Salta al tejado de al lado y baja por las cajas');
  stormStrikes(S);
  await S.near(P.houseDoor, 2.6);
}

/** CP15 · La pérdida y la Encarnación de la Energía: copia por contacto y voluntad. */
async function contact(S, { cp }) {
  dayState(S, cp);
  S.tutorial(null);
  const ab = person(S, 'abuela', 'abuela', { x: -32.6, y: 0.05, z: 20 }, PI / 2);
  ab.setPose('lying');
  const enc = encarnacion(S);
  await S.fadeIn();
  // Acercamiento lento
  S.block('sprint');
  S.objective('Entra en casa');
  S.markers([]);
  await S.until(() => hdist(S.pos, ab.position) < 3.2);
  cine(S, true);
  S.player.lookTarget = ab.position;
  S.shot({ pos: { x: -30.8, y: 1.3, z: 18 }, look: { x: -32.6, y: 0.4, z: 20.2 } }, { pos: { x: -31.4, y: 1.1, z: 18.9 }, look: { x: -32.6, y: 0.4, z: 20.2 } }, 5);
  await S.say('JON', '¿Amama? ... No, por favor...', 3.4);
  S.player.lookTarget = null;
  S.shot(overShoulder(S.pos, enc.position, { back: 2.6, side: 0.7 }));
  await S.talk([
    ['DESCONOCIDO', '¡Eh! ¡Tú! ¡Normie! ¡Ayúdame!'],
    ['JON', 'Has sido tú...'],
    ['DESCONOCIDO', '¡Mi vida vale bastante más que la de cualquiera de vosotros!'],
    ['JON', 'Mi abuela está muerta.'],
    ['DESCONOCIDO', '¿Y qué quieres que haga? ¿Pedirte perdón?'],
    ['JON', 'No vuelvas a llamarme así.'],
  ]);
  cine(S, false);
  S.objective('Agarra su muñeca y copia su marca', ['[E] contacto · mantén [E] para ejercer tu voluntad']);
  S.markers([{ ...enc.position, label: 'Encarnación' }]);
  S.tutorial('Copiar una marca', 'Acércate y pulsa [E] para agarrar su muñeca · Mantén [E]: tu voluntad llena la barra · Soltar antes de tiempo cancela la copia · La fuente conserva su poder');
  await S.until(() => S.state.flags.HasEnergyMark);
  S.markers([]);
  S.tutorial(null);
  await S.until(() => !S.g.acquisition.active);
  S.unblock('sprint');
}

/** Encarnación de la Energía (herida) en la casa en ruinas. */
function encarnacion(S) {
  const d = S.d;
  if (d._enc && d._enc.map === S.g.mapManager.current) return d._enc.entity;
  const cur = S.g.mapManager.current;
  const ctx = { group: cur.group, world: S.g.world };
  const e = new Incarnation(ctx, { x: -27.6, y: 0, z: 17.4, yaw: -PI / 2, markId: 'energia', palette: STORY_PALETTES.encarnacion });
  e.source.name = 'Desconocido';
  cur.entities.push(e);
  const it = S.g.acquisition.registerSource(e);
  d._interactions.push(it);
  d._enc = { map: cur, entity: e };
  return e;
}

/** Encarnación caída (muerta) en el suelo. */
function encFall(enc) {
  enc.update = () => {};
  enc.model.root.rotation.set(-PI / 2, enc.yaw, 0);
  enc.model.root.position.y = 0.2;
}

/** CP16 · Decisión irreversible: MATAR o PERDONAR. */
async function choice(S, { cp }) {
  dayState(S, cp);
  const ab = person(S, 'abuela', 'abuela', { x: -32.6, y: 0.05, z: 20 }, PI / 2);
  ab.setPose('lying');
  const enc = encarnacion(S);
  // La interacción de copia ya no hace falta
  for (const it of [...S.d._interactions]) S.g.interactions.remove(it);
  await S.fadeIn();
  cine(S, true);
  S.shot(overShoulder(S.pos, enc.position, { back: 2.8, side: 0.8 }));
  const i = await S.choice('Decisión irreversible', [
    { label: 'MATAR', desc: 'Jon acaba con la Encarnación', danger: true },
    { label: 'PERDONAR', desc: 'Jon la deja vivir' },
  ]);
  const pick = i === 0 ? 'KILL' : 'SPARE';
  S.state.choose(pick);
  S.g.save.save();
  S.g.events.emit('story:choice-made', { choice: pick });
  const nb = narbaiza(S, { x: -30, z: 8 }, 0);
  const a1 = agent(S, 'captor1', { x: -31.4, z: 7 }, 0);
  const a2 = agent(S, 'captor2', { x: -28.6, z: 7 }, 0);
  if (pick === 'KILL') {
    // Descarga narrativa (el jugador aún no usa la Energía libremente)
    S.shot(twoShot(S.pos, enc.position, { side: 1, dist: 3.4 }));
    S.player.lookTarget = enc.position;
    const zap = S.every(() => {
      S.player.updateModelMatrices();
      const h = S.player.handWorldPosition(new THREE.Vector3());
      S.g.vfx.lightning(h, { x: enc.position.x, y: 1.2, z: enc.position.z }, ENERGIA, { width: 0.08, duration: 0.12, jitter: 0.4, branches: 2 });
      S.g.marks.sustain(1);
    });
    S.sfx('discharge', enc.position);
    await S.wait(1.3);
    zap();
    S.g.vfx.impact({ x: enc.position.x, y: 1.2, z: enc.position.z }, null, ENERGIA, 2);
    encFall(enc);
    S.player.lookTarget = null;
    await S.wait(1);
    S.shot({ pos: { x: -28.4, y: 2.2, z: 15.2 }, look: { x: -30, y: 1.4, z: 11 } });
    nb.walkTo([{ x: -30, z: 13.2 }], { speed: 1.4 });
    a1.walkTo([{ x: -31.6, z: 12.6 }], { speed: 1.4 });
    a2.walkTo([{ x: -28.4, z: 12.6 }], { speed: 1.4 });
    await S.wait(2.2);
    nb.lookAt(S.pos);
    await S.say('NARBAIZA', 'Interesante. Un chico sin entrenamiento acaba de matar a una Encarnación.', 4);
  } else {
    S.player.lookTarget = null;
    S.shot({ pos: { x: -28.4, y: 2.2, z: 15.2 }, look: { x: -30, y: 1.4, z: 11 } });
    nb.walkTo([{ x: -30, z: 13.2 }], { speed: 1.4 });
    a1.walkTo([{ x: -31.6, z: 12.6 }], { speed: 1.4 });
    a2.walkTo([{ x: -28.4, z: 12.6 }], { speed: 1.4 });
    await S.wait(2.2);
    nb.lookAt(enc.position);
    await S.say('NARBAIZA', 'Qué conmovedor. Lástima que yo no tenga tanta compasión.', 3.6);
    nb.setPose('reach');
    nb.markIntensity = 1;
    S.shot(twoShot(nb.position, enc.position, { side: -1, dist: 3.8 }));
    const bolt = S.every(() => {
      if (Math.random() < 0.6) sangreBolt(S, { x: nb.position.x, y: 1.4, z: nb.position.z + 0.4 }, { x: enc.position.x, y: 1.2, z: enc.position.z });
    });
    S.sfx('sangre', nb.position);
    await S.wait(1.8);
    bolt();
    encFall(enc);
    nb.setPose('stand');
    nb.markIntensity = 0;
    await S.wait(1);
  }
  cine(S, false);
}

/** CP17 · Esposados: camino del autobús de presos (y el convoy en el puente). */
async function capture(S, { cp }) {
  dayState(S, cp);
  const enc = encarnacion(S);
  encFall(enc);
  for (const it of [...S.d._interactions]) S.g.interactions.remove(it);
  const nb = narbaiza(S, { x: -30, z: 13.2 }, 0);
  agent(S, 'captor1', { x: -31.6, z: 12.6 }, 0);
  agent(S, 'captor2', { x: -28.4, z: 12.6 }, 0);
  await S.fadeIn();
  cine(S, true);
  // Las esposas
  const cuffs = S.every(() => S.player.model.setReload(0.5));
  const ik = iker(S, { x: -30.4, y: 0, z: 6 }, 0);
  const a3 = agent(S, 'captor3', { x: -31.4, z: 5.4 }, 0);
  ik.setPose('cuffed');
  ik.walkTo([{ x: -30.6, z: 12 }], { speed: 1.3 });
  a3.walkTo([{ x: -31.6, z: 11.4 }], { speed: 1.3 });
  S.shot(twoShot(S.pos, nb.position, { side: 1, dist: 3.6 }));
  await S.wait(2.4);
  nb.lookAt(S.pos);
  await S.talk([
    ['JON', '¿Por qué llevan esposas?'],
    ['NARBAIZA', 'Porque no os estamos rescatando. Os llevamos a la ciudad como prisioneros.'],
    ['NARBAIZA', 'Aseguraos de que este llegue vivo.'],
  ]);
  cuffs();
  S.player.model.setReload(null);
  // El autobús de presos
  S.loop('rain', false);
  S.loop('storm', false);
  await S.loadMap('bosque', null, 'INT. AUTOBÚS DE PRISIONEROS — ATARDECER');
  await busRide(S);
}

/** El convoy por el viaducto, el ataque, el vuelco y el destello de Energía. */
async function busRide(S) {
  const g = S.g;
  const v = S.map.viaduct;
  const bus = v.bus;
  v.setBroken(false);
  cine(S, true);
  g.player.object3d.visible = false;
  const hide = S.every(() => {
    g.player.object3d.visible = false;
  });
  // Jon (doble para la cinemática) e Iker esposados en sus asientos
  const jon = S.npc('jonBus', { name: 'Jon', variant: 'protagonist', marks: [MARKS.energia], x: 0, y: 0, z: 0 });
  if (jon.model.destinoMark) jon.model.destinoMark.plane.visible = jon.model.destinoMark.band.visible = true;
  const ik = iker(S, { x: 0, y: 0, z: 0 }, 0);
  for (const [n, seat] of [[jon, bus.seats.jon], [ik, bus.seats.iker]]) {
    bus.group.add(n.model.root);
    n.lodDistance = Infinity; // posición local al autobús: sin LOD
    n.place({ x: seat.x, y: seat.y, z: seat.z }, PI);
    n.setPose('sit');
  }
  ik.lookAt({ x: -0.7, z: 0.4 });
  // Convoy en marcha
  let x = -160;
  let speed = 11;
  let driving = true;
  const drive = S.every((dt) => {
    if (!driving) return;
    x += speed * dt;
    bus.group.position.x = x;
    v.vans[0].position.x = x + 17;
    v.vans[1].position.x = x - 16;
  });
  const interior = (local, look) => {
    const p = bus.worldPoint(new THREE.Vector3(local.x, local.y, local.z));
    const l = bus.worldPoint(new THREE.Vector3(look.x, look.y, look.z));
    g.cameraController.setShot({ pos: p, look: l });
  };
  // Exterior
  S.shot({ pos: { x: -128, y: 6, z: -28 }, look: { x: -150, y: 14, z: -60 } }, { pos: { x: -126, y: 8, z: -32 }, look: { x: -132, y: 14.5, z: -60 } }, 3.6);
  await S.fade(0, 900);
  await S.wait(3.4);
  // Interior: la conversación
  const cam = S.every(() => interior({ x: 0.95, y: 2.25, z: 2.6 }, { x: -0.2, y: 1.5, z: 0.3 }));
  driving = false;
  await S.talk([
    ['IKER', 'Me han contado lo de tu casa. Lo siento.'],
    ['JON', 'Le dije que volvería.'],
    ['IKER', 'No podías saberlo.'],
    ['JON', 'No pude hacer nada.'],
    ['IKER', 'Ahora tienes algo que ellos no entienden.'],
  ]);
  cam();
  S.sfx('radio');
  // El ataque: explosión en el tramo de delante
  x = -140;
  speed = 12;
  driving = true;
  S.shot({ pos: { x: -92, y: 18, z: -44 }, look: { x: -112, y: 14, z: -60 } });
  await S.say('SOLDADO (RADIO)', '¡Contacto en el puente! ¡Nos están atacando!', 2.2);
  const boom = { x: -103, y: 14.5, z: -60 };
  v.setBroken(true);
  g.vfx.impact(boom, null, '#ffb15a', 5);
  g.vfx.lights.flash(boom, '#ffb15a', 160, 60, 0.8);
  g.vfx.particles.burst(boom, { count: 120, speed: 14, color: new THREE.Color(0x8a8070), size: 0.35, life: 1.8, drag: 0.8, gravity: 12 });
  g.vfx.particles.burst(boom, { count: 60, speed: 9, color: new THREE.Color(0xffa040), size: 0.3, life: 0.8, drag: 1.5 });
  g.cameraController.shake(1);
  S.sfx('explosion', boom);
  g.events.emit('story:convoy-attacked', {});
  // Frenazo, derrape y vuelco sobre el hueco
  driving = false;
  const p0 = bus.group.position.clone();
  const q0 = bus.group.quaternion.clone();
  v.placeWreck();
  const p1 = bus.group.position.clone();
  const q1 = bus.group.quaternion.clone();
  bus.group.position.copy(p0);
  bus.group.quaternion.copy(q0);
  let k = 0;
  const tip = S.every((dt) => {
    k = Math.min(1, k + dt / 1.8);
    const e = k * k * (3 - 2 * k);
    bus.group.position.lerpVectors(p0, p1, e);
    bus.group.quaternion.slerpQuaternions(q0, q1, e);
  });
  S.shot({ pos: { x: -118, y: 17, z: -48 }, look: { x: -109, y: 13, z: -60 } });
  await S.until(() => k >= 1);
  tip();
  // Destello de Energía: Jon desaparece del autobús
  const c = bus.worldPoint(new THREE.Vector3(bus.seats.jon.x, 1.2, bus.seats.jon.z));
  for (let i = 0; i < 6; i++) g.vfx.lightning(c, { x: c.x + (Math.random() - 0.5) * 5, y: c.y + Math.random() * 3, z: c.z + (Math.random() - 0.5) * 5 }, ENERGIA, { width: 0.07, duration: 0.4, jitter: 0.6, branches: 2 });
  g.vfx.lights.flash(c, ENERGIA, 200, 40, 0.6);
  S.d.ui.flash('#cfe8ff', 1400);
  S.sfx('teleport', c);
  jon.setVisible(false);
  g.events.emit('story:teleport', {});
  await S.wait(0.6);
  await S.fade(1, 1200);
  hide();
  g.player.object3d.visible = true;
  ik.setVisible(false); // el destino de Iker queda sin resolver
  await S.wait(0.8);
}

// ================================================================== M05
const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Estado del valle tras el accidente (y lo que ya se rompió sigue roto). */
function forestState(S) {
  const v = S.map.viaduct;
  v.setBroken(true);
  v.placeWreck();
  for (const m of S.map.bridge.markers) m.setVisible(false);
  const i = S.d.current?.index ?? 0;
  if (i >= 19) S.map.barricade?.clear(); // desde CP20
  if (i >= 20) S.map.debris?.clear(); // desde CP21
}

/** La niebla se abre al subir a la colina: la ciudad se ve sobre su llanura (k 0…1). */
function clearFog(S, k) {
  const f = S.g.scene.fog;
  const base = S.g.mapManager.current?.def.fog;
  if (f && base) f.density = base + (0.0011 - base) * k;
}

/** CP18 · Despertar en el bosque. */
async function forest(S, { entered }) {
  const P = S.points;
  forestState(S);
  for (const id of ['jonBus', 'iker']) S.d.npcs.get(id)?.setVisible(false);
  if (!entered) S.setCharge(24);
  S.place(P.cp18);
  cine(S, true);
  const lie = lieDown(S, true);
  S.shot({ pos: { x: -42.4, y: 1.4, z: 12.4 }, look: { x: -45, y: 0.3, z: 10 } });
  S.d.ui.fadeTo(1, 0, 'EXT. BOSQUE — TARDE');
  await S.wait(1.4);
  await S.fade(0, 1400);
  await S.wait(0.8);
  lie();
  lieDown(S, false);
  S.place(P.cp18);
  S.shot({ pos: { x: -41.6, y: 2, z: 12.6 }, look: { x: -45, y: 1.4, z: 10 } });
  await S.say('JON', '¿Iker? ¡IKER!', 2);
  // A lo lejos: el autobús colgando del viaducto
  S.shot({ pos: { x: -44, y: 2.4, z: 11 }, look: { x: -108, y: 12, z: -60 } }, { pos: { x: -44.4, y: 2.2, z: 10.6 }, look: { x: -104, y: 12.5, z: -60 } }, 4);
  await S.wait(1);
  await S.say('JON', '¿Cómo he llegado hasta aquí?', 2.6);
  cine(S, false);
  S.tutorial('Cámara', 'Mueve el ratón para mirar alrededor · El autobús ha caído del viaducto');
  S.objective('Sal del valle hacia el este', ['Sigue el arroyo entre los árboles']);
  S.markers([{ ...P.creek, label: 'Arroyo' }]);
  await S.until(() => S.pos.x > P.cp19.x + 0.5);
}

/** CP19 · El arroyo (saltos), la barricada de la PDC (a golpes) y la cuesta. */
async function climb(S) {
  const P = S.points;
  const bar = S.map.barricade;
  forestState(S);
  await S.fadeIn();
  S.objective('Cruza el arroyo', ['Salta de piedra en piedra']);
  S.markers([{ ...P.creekEnd, label: 'Otra orilla' }]);
  S.tutorial('Saltar', '[Espacio] saltar · Corriendo con [Shift] llegas más lejos · Río arriba hay un tronco caído');
  await S.until(() => S.pos.x > P.creekEnd.x - 1);
  S.tutorial(null);
  if (bar.alive) {
    S.objective('Abre paso', ['La PDC ha cerrado la senda con tablones']);
    S.markers([{ ...P.barricade, y: P.barricade.y + 1, label: 'Barricada' }]);
    await S.until(() => hdist(S.pos, P.barricade) < 6 || !bar.alive);
    S.tutorial('Golpear', '[F] golpear · La madera clara y astillada se puede romper');
    await S.until(() => !bar.alive);
    S.tutorial(null);
    await S.say('JON', 'Hasta el bosque lo tienen cerrado...', 2.4);
  }
  S.objective('Sube la cuesta', ['Sigue el sendero entre los árboles']);
  S.markers([{ ...P.terrace, label: 'Sendero' }]);
  await S.until(() => S.pos.x > P.cp20.x);
}

/** CP20 · La roca de vetas (primer disparo) y la absorción del generador. */
async function debris(S) {
  const P = S.points;
  const g = S.g;
  forestState(S);
  const deb = S.map.debris;
  await S.fadeIn();
  if (deb.alive) {
    deb.hint(1.2);
    S.objective('Despeja el paso', ['Una roca con vetas azules bloquea el sendero']);
    S.markers([{ ...P.debris, y: P.debris.y + 2, label: 'Roca' }]);
    await S.until(() => hdist(S.pos, P.debris) < 11);
    S.tutorial('Disparo de Energía', '[Clic derecho] apuntar · [Clic izquierdo] disparar · Cada disparo gasta carga');
    // Nunca bloquearse por falta de carga
    let warned = false;
    const safety = S.every(() => {
      if (deb.alive && g.powers.energy.value < g.powers.cfg.projectile.cost) {
        g.powers.energy.value = 8;
        if (!warned) g.ui.toast('La marca palpita', 'Un resto de carga para disparar', 1800);
        warned = true;
      }
    });
    await S.until(() => !deb.alive);
    safety();
    S.markers([]);
    S.tutorial(null);
    await S.say('JON', '¿Cómo he hecho eso?', 2.2);
  }
  // Absorción
  const gen = S.map.generators.debris;
  S.objective('Recarga Energía en el generador', ['La Energía no se regenera sola']);
  S.markers([{ ...gen.position, label: 'Generador' }]);
  S.tutorial('Recargar Energía', 'Mantén [E] junto al generador · También sirven farolas, armarios eléctricos y máquinas');
  // Cuenta la carga absorbida de verdad (aunque entretanto dispare)
  let absorbed = 0;
  let last = g.powers.energy.value;
  S.every(() => {
    const v = g.powers.energy.value;
    if (g.drain.active && v > last) absorbed += v - last;
    last = v;
  });
  await S.until(() => (absorbed >= 15 || g.powers.energy.value >= g.powers.energy.max - 1) && !g.drain.active);
  S.tutorial(null);
  S.markers([]);
  await S.say('JON', 'Vale... creo que empiezo a entenderlo.', 2.6);
  S.objective('Sigue el sendero', ['Un barranco corta el camino']);
  S.markers([{ ...P.ravine, label: 'Barranco' }]);
  await S.until(() => S.pos.x > P.cp21.x + 1.5);
}

/**
 * CP21 · Del barranco al puente (pilares, pared de escalada y meseta) y, en
 * el tramo oeste, tres drones: proyectil, descarga (R) y onda (G), de uno en uno.
 */
async function drones(S) {
  const g = S.g;
  const P = S.points;
  forestState(S);
  g.factions.reputation.reset({ pdc: 100 });
  // Los tres drones esperan posados en su estación del tramo oeste (despegan de uno en uno)
  g.enemies.clear('drones');
  const fleet = S.map.bridge.droneRack.map((p) => g.enemies.spawn('dronTutorial', { x: p.x, y: p.y, z: p.z, yaw: -PI / 2, tag: 'drones', dormant: true }));
  await S.fadeIn();
  if (S.pos.x < P.clearing.x) {
    S.objective('Cruza el barranco', ['Salta de pilar en pilar']);
    S.markers([{ ...P.ravine, label: 'Pilares' }]);
    S.tutorial('Saltos', 'Corre [Shift] y salta [Espacio] de pilar en pilar · Si caes al río, vuelves al borde');
    await S.until(() => S.pos.x > 16 && S.pos.y > 4.5);
    S.tutorial(null);
    S.objective('Sube a la meseta', ['Trepa por la pared marcada en blanco']);
    S.markers([{ ...P.climb, label: 'Pared' }]);
    S.tutorial('Escalada', 'Salta hacia la pared con [W] pulsado para agarrarte · [Espacio] subir · Las repisas marcadas en blanco son la ruta · Detrás de la cascada hay algo escondido');
    await S.until(() => S.pos.y > P.climb.y - 1 && S.pos.x > P.climb.x);
    S.tutorial(null);
    S.objective('Sigue hacia el puente');
    S.markers([{ ...P.clearing, label: 'Puente' }]);
    await S.until(() => S.pos.x > P.clearing.x);
  }
  S.markers([]);
  const Y = (P.deckY ?? 3) + 0.1;
  // Despega de su plataforma, sube y vuela a su puesto de patrulla
  const launch = (d, n, x, z) => {
    const p = d.position;
    d.patrol = [{ x, z }, { x: x - 4, z: z + 1.5 }];
    if (d.alive) d.wake({ path: [{ x: p.x, y: p.y, z: p.z }, { x: p.x, y: p.y + 2.2, z: p.z }, { x, y: Y + 3.8, z }], speed: 4 });
    S.g.events.emit('story:drone', { n });
    return d;
  };
  S.objective('Neutraliza los drones (0/3)');
  // Dron 1: proyectil
  const d1 = launch(fleet[0], 1, P.clearing.x + 18, 0);
  await S.say('DRON', 'Individuo no identificado. Permanezca inmóvil.');
  await S.say('JON', 'No, gracias.', 1.6);
  S.tutorial('Proyectil', '[Clic derecho] apuntar · [Clic izquierdo] disparar · El láser rojo avisa antes de cada disparo del dron');
  await S.until(() => !d1.alive);
  S.objective('Neutraliza los drones (1/3)');
  await S.say('JON', 'Esto es lo que podía hacer aquel hombre... y ahora puedo hacerlo yo.', 3.4);
  // Dron 2: descarga concentrada
  S.allow('charged');
  S.tutorial('Descarga concentrada', 'Mantén [R] para cargar y suelta para disparar · Más carga, más daño · Recarga en el generador [E]');
  const d2 = launch(fleet[1], 2, P.clearing.x + 23, -2);
  await S.until(() => !d2.alive);
  S.objective('Neutraliza los drones (2/3)');
  // Dron 3: onda expansiva
  S.allow('wave');
  S.tutorial('Onda expansiva', 'Acércate y pulsa [G]: la onda golpea a todo lo que tienes cerca · En el aire, [G] cae en forma de rayo');
  const d3 = launch(fleet[2], 3, P.clearing.x + 14, 2.2);
  await S.until(() => !d3.alive);
  S.objective('Neutraliza los drones (3/3)');
  S.tutorial(null);
  await S.wait(1);
}

/** CP22 · Hacia el puente. */
async function toBridge(S) {
  const P = S.points;
  forestState(S);
  await S.fadeIn();
  S.objective('Cruza el puente destruido');
  S.markers([{ ...P.bridgeStart, label: 'Puente' }]);
  await S.until(() => S.pos.x > P.bridgeStart.x - 1);
}

/** Muestra el marcador de aterrizaje del hueco `i` y activa el dash asistido. */
function gapGuide(S, i) {
  const br = S.map.bridge;
  br.markers.forEach((m, k) => m.setVisible(k === i));
  S.d.dashAssist = { gaps: br.gaps };
  const m = br.markers[i];
  S.markers([{ ...m.point, label: br.gaps.length > 1 ? `Salto ${i + 1}/${br.gaps.length}` : 'Aterrizaje' }]);
}

/** CP23 · El hueco del puente (dash) y el tramo caído hasta la pila partida. */
async function dash(S) {
  const P = S.points;
  const br = S.map.bridge;
  forestState(S);
  await S.fadeIn();
  S.objective('Cruza el hueco del puente');
  await S.say('JON', 'Tiene que haber alguna manera de cruzar...', 2.6);
  S.tutorial('Dash de Energía', 'Corre hacia el borde, salta con [Espacio] y pulsa [Q] en el aire: el dash te lleva hacia el círculo azul · Recarga en el generador [E] antes de saltar');
  gapGuide(S, 0);
  await S.until(() => S.pos.x > br.gaps[0].to + 0.5 && S.pos.y > br.pier.top + 3);
  br.markers.forEach((m) => m.setVisible(false));
  S.d.dashAssist = null;
  S.tutorial(null);
  await S.say('JON', '¡WOAH!', 1.2);
  await S.say('JON', 'Eso ha sido... increíble.', 2.2);
  S.objective('Baja por el tramo caído', ['El puente se ha partido: sigue hacia abajo']);
  S.markers([{ ...P.pier, label: 'Pila' }]);
  await S.until(() => S.pos.x > br.pier.x0 + 0.5 && S.pos.y < br.pier.top + 1.5);
}

/** CP24 · De la pila partida al tramo descolgado: salto y escalada por sus vigas. */
async function dash2(S) {
  const P = S.points;
  const br = S.map.bridge;
  forestState(S);
  // El primer bloqueo ya está en su puesto (desde arriba se le ve); aún no le han visto
  S.g.factions.reputation.reset({ pdc: 0 });
  block1Squad(S);
  await S.fadeIn();
  S.objective('Sube al otro lado', ['Salta al tramo descolgado y trepa por sus vigas', 'Recarga en el generador [E] si lo necesitas']);
  S.markers([{ ...P.hangTop, label: 'Arriba' }]);
  S.tutorial('Trepar', 'Corre y salta hacia las vigas con [W] pulsado para agarrarte · [Espacio] subir · Las vigas marcadas en blanco son los asideros');
  await S.until(() => S.pos.x > br.hang.hinge.x - 1.5 && S.pos.y > P.deckY - 0.5);
  S.tutorial(null);
}

/**
 * Dificultad de los bloqueos del puente (el primer combate del juego): menos
 * vida y daño, disparos más espaciados, menos puntería y reacción más lenta.
 */
const BRIDGE_EASY = { health: 0.65, damage: 0.5, cadence: 1.6, spread: 1.6, reaction: 1.5 };
const BRIDGE_HEAVY = { health: 0.55, damage: 0.5, cadence: 1.8, spread: 1.5, reaction: 1.4 };

/** Enemigos de un tramo de combate (con el diálogo antes de que disparen). */
function spawnSquad(S, tag, list) {
  const y = (S.points.deckY ?? 3) + 0.1;
  return list.map(([type, x, z]) => S.g.enemies.spawn(type, { x, y, z, yaw: -PI / 2, tag, mods: BRIDGE_EASY, patrol: [{ x, z }, { x: x - 3, z }] }));
}

/** Los dos agentes y el dron del primer bloqueo (si no están ya en su puesto, se colocan). */
function block1Squad(S) {
  const live = S.g.enemies.list.filter((e) => e.tag === 'block1');
  if (live.length) return live;
  const b = S.points.block1;
  return spawnSquad(S, 'block1', [['pdc', b.x, -1.5], ['pdc', b.x + 3.5, 1.6], ['dron', b.x - 3, 0]]);
}

/** Un enemigo que sale de la caja de un camión del bloqueo y va a su puesto. */
function fromTruck(S, type, truck, via, to, mods) {
  const y = (S.points.deckY ?? 3) + 0.1;
  const path = [truck.inside, truck.out, ...via, to].map((p) => ({ x: p.x, y, z: p.z }));
  return S.g.enemies.spawn(type, { x: path[0].x, y, z: path[0].z, yaw: PI / 2, tag: 'block2', mods, entrance: { path, speed: 3 }, patrol: [{ x: to.x, z: to.z }, { x: to.x - 2.5, z: to.z }] });
}

/** CP25 · Primer bloqueo: 2 agentes y 1 dron. */
async function block1(S) {
  const g = S.g;
  forestState(S);
  const P = S.points;
  // En su puesto, tranquilos hasta que Jon se acerque (o les ataque)
  const ready = g.enemies.list.some((e) => e.tag === 'block1');
  if (!ready) g.factions.reputation.reset({ pdc: 0 });
  const squad = block1Squad(S);
  await S.fadeIn();
  S.markers([]);
  S.objective('Sigue por el puente');
  const attacked = () => squad.some((e) => !e.alive || e.health.value < e.health.max);
  await S.until(() => S.pos.x > P.cp25.x + 3 || attacked());
  g.events.emit('story:encounter', { id: 'block1', types: squad.map((e) => e.type.id) });
  if (!attacked()) {
    // Vigilantes: se detienen y apuntan mientras hablan
    g.factions.reputation.reset({ pdc: 40 });
    const b = P.block1;
    cine(S, true);
    S.shot(overShoulder(S.pos, { x: b.x + 1, y: b.y, z: 0 }, { back: 3.2, side: 1 }));
    await S.say('AGENTE 1', '¡Al suelo!', 1.4);
    await S.say('JON', 'No quiero problemas.', 1.8);
    await S.say('AGENTE 2', '¡Está marcado! ¡Fuego!', 1.6);
    cine(S, false);
  }
  g.factions.reputation.reset({ pdc: 100 });
  S.objective('Abre paso (0/3)');
  S.tutorial('Cobertura y esquiva', '[C] junto a un bloque: cubrirte · [Ctrl] esquivar · Alterna moverte y disparar');
  S.every(() => {
    const n = squad.filter((e) => !e.alive).length;
    S.d.ui.objective({ mission: 'M05 · El despertar', text: `Abre paso (${n}/3)` });
  });
  await S.until(() => squad.every((e) => !e.alive));
  S.tutorial(null);
}

/** CP26 · Hacia la sección final. */
async function toBlock2(S) {
  forestState(S);
  S.g.enemies.clear('block1');
  await S.fadeIn();
  S.objective('Sigue por el puente');
  const gen = S.map.generators.s4.position;
  S.markers([{ ...gen, label: 'Generador' }]);
  await S.until(() => S.pos.x > S.points.cp27.x - 1);
}

/** CP27 · Último bloqueo: agente reforzado y después 2 agentes. */
async function block2(S) {
  const g = S.g;
  forestState(S);
  await S.fadeIn();
  S.markers([]);
  const P = S.points;
  g.factions.reputation.reset({ pdc: 40 });
  // El agente reforzado salta de la caja del primer camión del bloqueo
  g.enemies.clear('block2');
  const [t1, t2] = S.map.bridge.trucks;
  const heavy = fromTruck(S, 'reforzado', t1, [], { x: P.block2.x - 3, z: 0 }, BRIDGE_HEAVY);
  g.events.emit('story:encounter', { id: 'block2a', types: ['reforzado'] });
  cine(S, true);
  S.shot(overShoulder(S.pos, heavy.position, { back: 3.4, side: -1 }));
  await S.say('AGENTE REFORZADO', '¡Se acabó el paseo, chaval!', 2);
  g.factions.reputation.reset({ pdc: 100 });
  cine(S, false);
  S.objective('Derrota al agente reforzado');
  S.tutorial('Agente reforzado', 'Dispara en ráfagas: muévete entre coberturas y ataca mientras recarga');
  await S.until(() => !heavy.alive);
  S.tutorial(null);
  await S.say('AGENTE (RADIO)', '¡El sujeto sigue avanzando! ¡Necesitamos refuerzos!', 2.6);
  // Refuerzos: bajan de los dos camiones
  const wave = [
    fromTruck(S, 'pdc', t2, [{ x: t2.out.x - 1.4, z: t2.out.z }], { x: P.block2.x + 5.5, z: 2.2 }, BRIDGE_EASY),
    fromTruck(S, 'pdc', t1, [{ x: t1.out.x - 3, z: t1.out.z + 0.3 }], { x: P.block2.x - 1.2, z: -2.6 }, BRIDGE_EASY),
  ];
  g.events.emit('story:encounter', { id: 'block2b', types: wave.map((e) => e.type.id) });
  S.line('JON', '¡No pienso volver a ese autobús!', 2.4);
  S.objective('Derrota a los refuerzos');
  await S.until(() => wave.every((e) => !e.alive));
  S.objective('Sal del puente');
  S.markers([{ ...P.bridgeEnd, label: 'Salida' }]);
  await S.until(() => S.pos.x > P.bridgeEnd.x - 2);
}

/** CP28 · Fuera del puente: subir a la colina. */
async function leaveBridge(S) {
  const P = S.points;
  forestState(S);
  S.g.enemies.clear('block2');
  await S.fadeIn();
  S.objective('Sube a la colina');
  S.markers([{ ...P.hill, label: 'Colina' }]);
  S.every(() => clearFog(S, smooth01(P.bridgeEnd.x, P.hill.x + 4, S.pos.x)));
  await S.until(() => S.pos.x > P.hill.x && S.pos.y > P.hill.y - 2);
}

/** CP29 · La ciudad: cámara fija, dash fuera de plano, menú principal. */
async function city(S) {
  const g = S.g;
  const top = S.points.hillTop;
  forestState(S);
  clearFog(S, 1);
  S.markers([]);
  S.objective(null);
  S.tutorial(null);
  await S.fadeIn();
  cine(S, true);
  // Cámara panorámica fija: Jon de espaldas y la ciudad al fondo, sobre su llanura
  const cam = { pos: { x: top.x - 7.5, y: top.y + 2.6, z: 3.4 }, look: { x: top.x + 300, y: top.y + 22, z: -10 } };
  S.shot(cam);
  await S.walkTo({ x: top.x - 0.5, z: 0.6 });
  S.place({ x: S.pos.x, y: S.pos.y, z: S.pos.z, yaw: PI / 2 });
  S.shot(cam);
  const t0 = S.d.time;
  await S.say('JON', 'Así que esta es la ciudad...', 2.8);
  await S.say('IKER (RECUERDO)', 'Si de verdad queremos cambiar las cosas, tenemos que ir a la ciudad.', 3.8);
  await S.say('JON', 'Aguanta, Iker. Voy a encontrarte.', 2.8);
  // Pausa total de 5–8 s con la cámara fija
  await S.until(() => S.d.time - t0 >= 6.5);
  // Dash fuera de plano
  const p = { ...S.pos };
  g.vfx.lights.flash({ x: p.x, y: p.y + 1, z: p.z }, ENERGIA, 60, 14, 0.4);
  for (let i = 0; i < 24; i++) {
    const k = i / 24;
    g.vfx.particles.emit({ x: p.x + k * 30, y: p.y + 1 + Math.random() * 0.4, z: p.z - k * 2, vx: 30, vy: 0, vz: 0, color: new THREE.Color(ENERGIA), size: 0.14, life: 0.35 + k * 0.2, drag: 3 });
  }
  g.vfx.afterimage?.({ x: p.x, y: p.y, z: p.z }, g.player.facing, ENERGIA);
  S.sfx('dash', p);
  g.player.object3d.visible = false;
  const hide = S.every(() => {
    g.player.object3d.visible = false;
  });
  g.events.emit('story:final-dash', {});
  await S.wait(1.4);
  await S.fade(1, 1400, 'ASCEND');
  // Progreso: tutorial completado y Energía en el perfil del modo libre
  S.state.complete();
  const prof = g.save.data.profile;
  if (!prof.marks.includes('energia')) prof.marks.push('energia');
  g.save.save();
  g.events.emit('story:completed', { choice: S.state.flags.EnergyEncounterChoice });
  await S.wait(1.6);
  hide();
  g.player.object3d.visible = true;
  g.returnToMenu();
  return null;
}

export const BEATS = {
  rooftops, cliff, vent, inside, cards, alarm, escape, zipline,
  wake, alley, days, market, storm, run, contact, choice, capture,
  forest, climb, debris, drones, toBridge, dash, dash2, block1, toBlock2, block2, leaveBridge, city,
};
