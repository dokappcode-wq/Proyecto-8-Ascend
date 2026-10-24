import * as THREE from 'three';
import { StealthGuard } from '../../story/actors.js';
import { CITY } from '../../world/maps/ibaia/cityData.js';
import { at as postAt, postFrame } from '../../world/maps/ibaia/pdcPlan.js';
import { Vehicle, Fire, JunctionBox, TrackBarricade, Blocks, mats } from '../props.js';
import { waves, holdZone, interactMoving, interactAny, tail, spotsAround, streetSpot, clock } from '../kit.js';
import { alongPolyline } from '../streets.js';
import { streets, place, cast, PLACES } from './world.js';

/**
 * Distrito Cero · Historia «Línea Cero» (thriller noir de espionaje).
 * Diez misiones; los textos son provisionales hasta que llegue el guion.
 */

const C = 'CENTRALITA';

/** Guardias de sigilo de la misión (PDC o Acólitos) con su cono de visión. */
function stealthGuards(S, routes, o = {}) {
  const group = new THREE.Group();
  const ctx = { group, world: S.g.world, vfx: S.g.vfx };
  const gs = routes.map((route, i) => new StealthGuard(ctx, { id: `g${i}`, route, range: o.range ?? 15, fov: o.fov ?? 38, speed: o.speed ?? 1.5, variant: o.variant, palette: o.palette }));
  S.prop({ object3d: group, update: (dt) => gs.forEach((g) => g.update(dt)) });
  S.setStealth({ guards: gs, lights: [] });
  return gs;
}

/** Ruta corta de patrulla a lo largo de la calle en `p` (ida y vuelta). */
function beat(p, len = 12, wait = 2.5) {
  const s = streets.project(p.x, p.z);
  const d = s ? s.dir : { x: 1, z: 0 };
  return [
    { x: p.x - d.x * len / 2, z: p.z - d.z * len / 2, wait },
    { x: p.x + d.x * len / 2, z: p.z + d.z * len / 2, wait },
  ];
}

/** La cabina suena hasta que Jon contesta. */
async function answer(S, booth, label = 'Contestar el teléfono') {
  booth.setRinging(true);
  const off = S.every(() => {
    if (Math.floor(S.d.time * 0.6) !== booth._lastRing) {
      booth._lastRing = Math.floor(S.d.time * 0.6);
      S.sfx('phone', booth.position);
    }
  });
  await S.interact({ x: booth.position.x, y: 0, z: booth.position.z }, label, 2.6);
  off();
  booth.setRinging(false);
}

/** Cinemática corta: bandas, sin control, y al final se recupera. */
async function scene(S, fn) {
  S.lock(true);
  S.letterbox(true);
  try {
    await fn();
  } finally {
    S.letterbox(false);
    S.release();
    S.lock(false);
  }
}

// ---------------------------------------------------------------------------
export const H1 = {
  id: 'cero-h1', kind: 'story', n: 1, title: 'El teléfono de la plaza', auto: true, autoRadius: 1e9,
  where: (d) => place(d.game, 'autovia'),
  async run(S, { step, retry }) {
    const g = S.g;
    const w = S.district.world;
    const spawn = { x: CITY.spawn.x, y: 0.1, z: CITY.spawn.z, yaw: Math.atan2(CITY.spawn.dx, CITY.spawn.dz) };
    const route = streets.route(spawn, PLACES.km0);
    if (step === 0) {
      S.spawnIf(retry, spawn);
      if (!retry) {
        await scene(S, async () => {
          await S.say('JON', 'Ibaia. Desde la sierra parecía más pequeña.');
          await S.say('JON', 'Y está llena de la PDC.');
        });
      }
      // Control en la autovía: dos agentes vigilan la calle hacia la plaza
      const a = route[Math.floor(route.length * 0.25)];
      const b = route[Math.floor(route.length * 0.4)];
      stealthGuards(S, [beat(a, 14), beat(b, 18)], { range: 16 });
      const goal = route[Math.floor(route.length * 0.55)];
      S.objective('Pasa el control sin que te vean', ['Agáchate (C) para que te vean menos']);
      S.markers([{ ...goal, label: 'Más allá del control' }]);
      await S.near(goal, 8, 20);
      S.setStealth(null);
      S.reach(1);
    }
    if (step <= 1) {
      S.spawnIf(retry && step === 1, streetSpot(g, streets, route[Math.floor(route.length * 0.55)].x, route[Math.floor(route.length * 0.55)].z));
      const booth = w.booths.km0;
      S.objective('Llega a la plaza del Kilómetro Cero');
      S.markers([{ ...booth.position, label: 'Plaza del Kilómetro Cero' }]);
      await S.near(booth.position, 40, 20);
      S.objective('Contesta el teléfono de la cabina');
      S.markers([{ ...booth.position, label: 'Cabina' }]);
      await answer(S, booth);
      await scene(S, async () => {
        await S.say(C, 'No digas tu nombre. Ya lo sé.');
        await S.say(C, 'El convoy, el autobús, el puente. Llevamos días siguiéndote.');
        await S.say('JON', '¿Quién eres?');
        await S.say(C, 'Alguien que tiene una red de teléfonos y cada vez menos gente que los coja.');
        await S.say(C, 'La PDC te está buscando. Y ahora mismo te ha encontrado su perro.');
      });
      S.reach(2);
    }
    // El dron sabueso sigue la carga de los marcados
    const booth = w.booths.km0;
    S.spawnIf(retry && step === 2, streetSpot(g, streets, booth.position.x + 6, booth.position.z + 6));
    const sp = spotsAround(S, S.pos, 1, 30, 45)[0];
    const drone = S.enemy('dron', { x: sp.x, y: 8, z: sp.z }, { mods: { health: 1.4 } });
    drone.name = 'Dron sabueso';
    const start = { ...S.pos };
    let t = 0;
    const tick = clock(S);
    await S.until(() => {
      t -= tick();
      const d = Math.hypot(S.pos.x - start.x, S.pos.z - start.z);
      if (t <= 0) {
        t = 0.25;
        S.objective('Despista al dron sabueso', [`Aléjate de la plaza: ${Math.round(d)}/150 m`, 'o derríbalo']);
        S.markers(drone.alive ? [{ x: drone.position.x, y: drone.position.y - 2, z: drone.position.z, label: 'Dron sabueso' }] : []);
      }
      return !drone.alive || d > 150;
    });
    S.markers([]);
    await S.say(C, 'Bien. Ahora ve al bar La Catenaria, bajo las vías. Pregunta por Txema.');
    await S.say(C, 'Y no le digas que te mando yo. No le gusta que le mande nadie.');
  },
};

// ---------------------------------------------------------------------------
export const H2 = {
  id: 'cero-h2', kind: 'story', n: 2, title: 'La Catenaria', after: ['cero-h1'],
  where: (d) => place(d.game, 'bar'),
  async run(S, { step, retry }) {
    const bar = place(S.g, 'bar');
    const txema = cast(S, 'txema', { x: bar.x, z: bar.z, yaw: bar.yaw + Math.PI });
    if (step === 0) {
      S.spawnIf(retry, streetSpot(S.g, streets, bar.x + 8, bar.z + 8));
      await scene(S, async () => {
        txema.lookAt(S.pos);
        await S.say('TXEMA', 'Está cerrado.');
        await S.say('JON', 'Busco a Txema.');
        await S.say('TXEMA', 'Pues ya lo has encontrado. Y ahora te vas.');
        await S.say('TXEMA', 'Esta semana la PDC ha vaciado cuatro pisos. Cada vez que alguien nuevo pregunta por mí, cae uno.');
        await S.say('JON', 'Yo no soy de la PDC.');
        await S.say('TXEMA', 'Eso decían todos. Oye eso? Ya vienen.');
      });
      S.reach(1);
    }
    S.spawnIf(retry && step === 1, streetSpot(S.g, streets, bar.x + 5, bar.z + 5));
    txema.setPose('kneel');
    await waves(S, [[{ type: 'pdc', n: 3 }], [{ type: 'pdc', n: 2 }, { type: 'reforzado', n: 1 }]], { center: bar, label: 'Redada', text: 'Defiende el bar', leash: 70 });
    txema.setPose('stand');
    S.objective(null);
    await scene(S, async () => {
      txema.lookAt(S.pos);
      await S.say('TXEMA', 'Vale. Un chivato no se juega el pellejo por mi barra.');
      await S.say('TXEMA', 'Arriba hay una cama y un teléfono que no está pinchado. Úsalos.');
      await S.say('TXEMA', 'Y si quieres que te ayudemos, encuentra a quien vende nuestras casas.');
    });
    S.state.flags.pisoFranco = true;
    S.g.ui.toast('Piso franco', 'Encima de La Catenaria: si caes, vuelves aquí', 3200);
  },
};

// ---------------------------------------------------------------------------
const FLATS = [
  { key: 'neones', dx: 0, dz: 0, name: 'Neones 14', clues: ['Una puerta reventada: la PDC no llamó.', 'Un calendario: el martes marcado con una P.', 'Un recibo de La Catenaria: «recado, 5 euros».'] },
  { key: 'neones', dx: 120, dz: 70, name: 'Ribera 3', clues: ['Colchones rajados: buscaban algo concreto.', 'Una nota: «el chaval trae el pan los martes».', 'Huellas de zapatillas blancas, pequeñas.'] },
  { key: 'km0', dx: 90, dz: -80, name: 'Plaza 7', clues: ['La radio, todavía en la frecuencia de la Centralita.', 'Un paquete sin abrir: pan del día.', 'Botas de la PDC hasta la ventana.'] },
  { key: 'cine', dx: 60, dz: 90, name: 'Calle del Cine 22', clues: ['Una lista de pisos francos rota en cuatro trozos.', 'Una chapa de bicicleta roja.', 'Una pintada fresca: «CHIVATO».'] },
];

export const H3 = {
  id: 'cero-h3', kind: 'story', n: 3, title: 'Cuatro pisos vacíos', after: ['cero-h2'],
  where: (d) => place(d.game, 'neones'),
  async run(S, { step, retry }) {
    const g = S.g;
    if (step === 0 && !retry) {
      await S.say(C, 'Cuatro pisos, cuatro redadas. Mira lo que dejaron. La PDC no es tan limpia como cree.');
    }
    for (let i = step; i < FLATS.length; i++) {
      const f = FLATS[i];
      const p = place(g, f.key, f.dx, f.dz);
      if (retry && i === step) S.spawnIf(true, streetSpot(g, streets, p.x + 10, p.z + 10));
      S.objective(`Registra el piso de ${f.name}`, [`Piso ${i + 1}/4`]);
      S.markers([{ ...p, label: f.name }]);
      await S.near(p, 14, 10);
      // Tres pistas alrededor del portal
      const s = streets.project(p.x, p.z);
      const spots = [-3, 0, 3].map((o) => ({ x: p.x + s.dir.x * o, y: 0, z: p.z + s.dir.z * o }));
      const left = new Set([0, 1, 2]);
      while (left.size) {
        S.objective(`Busca pistas en ${f.name}`, [`Pistas ${3 - left.size}/3`]);
        S.markers([...left].map((k) => ({ ...spots[k], label: 'Pista' })));
        const ids = [...left];
        const k = ids[await interactAny(S, ids.map((j) => spots[j]), 'Examinar', 1.8)];
        left.delete(k);
        S.sfx('ui');
        await S.say('JON', f.clues[k], 3.2);
      }
      S.reach(i + 1);
    }
    S.markers([]);
    let ok = false;
    while (!ok) {
      const pick = await S.choice('¿Qué tienen en común las cuatro redadas?', [
        { label: 'Los recados', desc: 'La PDC llegó justo después de un recado de los mensajeros' },
        { label: 'Las llamadas', desc: 'La PDC llegó después de una llamada de la Centralita' },
        { label: 'El bar', desc: 'Todos los pisos están cerca de La Catenaria' },
      ]);
      ok = pick === 0;
      if (!ok) await S.say('JON', 'No. Eso no encaja con lo que he visto.');
    }
    await S.say('JON', 'Pan los martes, recibos de recados, zapatillas pequeñas. Es uno de los mensajeros.');
    await S.say(C, 'Solo hay tres que hagan recados en este barrio. Y uno es casi un niño.');
    await S.say(C, 'Antes de seguir, necesitamos ojos. La PDC tiene una torre al oeste. Quiero esa torre.');
  },
};

// ---------------------------------------------------------------------------
/** Torre de la PDC del barrio: posición de la torre de escaneo y de su plataforma. */
export function towerInfo() {
  const post = CITY.pdc.posts.find((p) => p.id === 'cero-tower-0');
  const f = postFrame(post);
  const t = postAt(post, -6, f.half + 2.5);
  return { post, x: t.x, z: t.z, top: 14.4 };
}

/** Escalones de mantenimiento en espiral alrededor de la torre. */
function towerSteps(S, t) {
  const pieces = [];
  for (let k = 0; k < 13; k++) {
    const a = k * 1.05;
    pieces.push({ x: t.x + Math.cos(a) * 1.9, z: t.z + Math.sin(a) * 1.9, w: 1.3, d: 1.3, h: 1.1 * (k + 1), yaw: a, mat: mats().steel });
  }
  // Se dibujan como columnas finas: el último tramo es el que pisa Jon
  return S.prop(new Blocks(S.g, pieces));
}

export const H4 = {
  id: 'cero-h4', kind: 'story', n: 4, title: 'Ojos sobre el barrio', after: ['cero-h3'],
  where: () => {
    const t = towerInfo();
    return { x: t.post.x, y: 0, z: t.post.z };
  },
  async run(S, { step, retry }) {
    const g = S.g;
    const t = towerInfo();
    const base = streetSpot(g, streets, t.post.x, t.post.z, { road: true });
    if (step === 0) {
      S.spawnIf(retry, streetSpot(g, streets, base.x + 40, base.z + 20));
      S.objective('Acércate a la torre de la PDC');
      S.markers([{ x: t.x, y: 0, z: t.z, label: 'Torre de la PDC' }]);
      await S.near(t, 70, 30);
      const spots = spotsAround(S, base, 4, 6, 20);
      const guards = spots.map((p, i) => S.enemy(i === 3 ? 'reforzado' : 'pdc', p));
      S.objective('Neutraliza a los guardias de la torre');
      await S.defeated(guards);
      S.reach(1);
    }
    S.spawnIf(retry && step === 1, base);
    towerSteps(S, t);
    S.objective('Sube a lo alto de la torre', ['Por los escalones de mantenimiento']);
    S.markers([{ x: t.x, y: t.top, z: t.z, label: 'Consola' }]);
    await S.until(() => S.pos.y > t.top - 1.2 && Math.hypot(S.pos.x - t.x, S.pos.z - t.z) < 3);
    await S.interact({ x: t.x, y: t.top - 0.5, z: t.z }, 'Conectar el pirateo', 2.6);
    for (let i = 0; i < 2; i++) {
      const sp = spotsAround(S, t, 1, 25, 40)[0];
      S.enemy('dron', { x: sp.x, y: 18, z: sp.z });
    }
    await holdZone(S, { x: t.x, y: t.top, z: t.z }, 14, { radius: 3.2, text: 'Protege el pirateo en lo alto', decay: 0.04 });
    S.state.towers.cero = true;
    S.d._refreshControl(true);
    S.objective(null);
    S.markers([]);
    await S.say(C, 'Tengo sus cámaras. Y tú tienes el barrio entero en el mapa.');
    g.ui.toast('Torre tomada', 'Actividades del Distrito Cero descubiertas', 3600);
  },
};

// ---------------------------------------------------------------------------
/** Vía del elevado desde la Estación del Este hacia el oeste. */
function railPath() {
  const S0 = PLACES.estacion;
  const end = (l) => Math.min(Math.hypot(l[0][0] - S0.x, l[0][1] - S0.z), Math.hypot(l[l.length - 1][0] - S0.x, l[l.length - 1][1] - S0.z));
  const line = CITY.rail.lines.reduce((best, l) => (!best || end(l) < end(best) ? l : best), null);
  const pts = line.map(([x, z]) => ({ x, z }));
  // Empieza en el extremo de la estación y va hacia el oeste
  return Math.hypot(pts[0].x - S0.x, pts[0].z - S0.z) <= Math.hypot(pts[pts.length - 1].x - S0.x, pts[pts.length - 1].z - S0.z) ? pts : pts.reverse();
}

/** Primer tramo de la vía con el tren libre de edificios (para que el techo se pueda pisar). */
function clearTrack(g, path) {
  for (let s = 24; s < 600; s += 3) {
    let ok = true;
    for (let u = -22; u <= 22 && ok; u += 2) {
      const a = alongPolyline(path, s + u);
      if (g.world.groundHeight(a.x, a.z, 1.6, 40) > 12.3) ok = false;
    }
    if (ok) return s;
  }
  return 40;
}

/** Escalera hasta la marquesina de la estación (rampa con colisión). */
function stationStairs(S, p0, dir) {
  const g = S.g;
  let side = { x: -dir.z, z: dir.x };
  // La marquesina, al lado de la vía donde no haya edificio
  if (g.world.groundHeight(p0.x + side.x * 4.6, p0.z + side.z * 4.6, 1.8, 40) > 12.5) side = { x: -side.x, z: -side.z };
  // Marquesina a 16,4 m junto a la vía (un metro por encima del techo del tren)
  const H = 16.4;
  const cx = p0.x + side.x * 4.6;
  const cz = p0.z + side.z * 4.6;
  const parts = [{ x: cx, z: cz, w: 3.4, d: 3.4, h: H, mat: mats().steel }];
  // Escalones hasta la marquesina
  for (let k = 0; k < 14; k++) {
    const u = -2.4 - k * 1.5;
    parts.push({ x: cx + dir.x * u + side.x * 1.4, z: cz + dir.z * u + side.z * 1.4, w: 1.5, d: 1.5, h: H - (k + 1) * 1.15, mat: mats().concrete });
  }
  S.prop(new Blocks(g, parts));
  return { x: cx, y: H, z: cz };
}

export const H5 = {
  id: 'cero-h5', kind: 'story', n: 5, title: 'La voz de Salaberri', after: ['cero-h4'],
  where: (d) => place(d.game, 'estacion'),
  async run(S, { step, retry }) {
    const g = S.g;
    const path = railPath();
    const s0 = clearTrack(g, path);
    const a0 = alongPolyline(path, s0);
    const dir = a0.dir;
    const roof = stationStairs(S, { x: a0.x, z: a0.z }, dir);
    const stairsFoot = { x: roof.x - dir.x * 22 + (-dir.z) * 1.2, z: roof.z - dir.z * 22 + dir.x * 1.2 };
    if (!retry) {
      await S.say(C, 'A las nueve y cuarenta sale un tren de la PDC hacia la Isla. Lleva la línea de Salaberri.');
      await S.say(C, 'Súbete al techo y pincha el cable antes de que llegue a la barrera.');
    }
    S.spawnIf(retry, streetSpot(g, streets, stairsFoot.x, stairsFoot.z));
    S.objective('Sube a la marquesina de la estación');
    S.markers([{ ...roof, y: roof.y, label: 'Marquesina' }]);
    await S.until(() => S.pos.y > roof.y - 0.6 && Math.hypot(S.pos.x - roof.x, S.pos.z - roof.z) < 3.5);
    // El tren sale de la estación
    const train = S.prop(new Vehicle(g, { kind: 'train', path, y: 12, s: s0 - 26, speed: 0 }));
    train.target = 7;
    S.objective('¡Salta al techo del tren!');
    let t = 0;
    const tick = clock(S);
    await S.until(() => {
      t += tick();
      S.markers([{ ...train.roofPoint(0), y: train.roofY, label: 'Tren' }]);
      if (t > 12 && !train.riding) S.fail('Has perdido el tren');
      return train.riding;
    });
    train.target = 11;
    S.objective('Conecta el pinchazo en el techo');
    const plug = () => ({ ...train.roofPoint(8), y: train.roofY });
    S.markers([]);
    const fallWatch = S.every(() => {
      if (S.pos.y < 9) S.fail('Te has caído del tren');
    });
    await interactMoving(S, plug, 'Pinchar el cable', 2.8);
    S.sfx('zap');
    for (let i = 0; i < 3; i++) {
      const p = train.roofPoint(-30 - i * 10);
      S.enemy('dron', { x: p.x + (i - 1) * 6, y: 22, z: p.z });
    }
    S.line('SALABERRI (RADIO)', 'Aquí Salaberri. El paquete de la Torre sigue estable. Que nadie se acerque al chico.', 5);
    let held = 0;
    const tick2 = clock(S);
    await S.until(() => {
      const dt = tick2();
      if (train.riding) held += dt;
      S.objective('Aguanta en el techo mientras graba', [`${Math.min(100, Math.round((held / 22) * 100))} %`]);
      return held >= 22;
    });
    fallWatch();
    S.line('SALABERRI (RADIO)', 'Y del marcado del convoy, nada. Seguid buscando en Cero. Tiene que dormir en algún sitio.', 5);
    // El tren frena antes de la barrera
    train.target = 0;
    S.objective('Baja del tren antes de la barrera');
    await S.until(() => !train.riding && S.pos.y < 13);
    await S.say('JON', '«El chico de la Torre.» ¿Qué chico?');
    await S.say(C, 'No lo sé. Pero ahora tengo su voz. Y su voz me dice que tiene miedo de algo.');
  },
};

// ---------------------------------------------------------------------------
export const H6 = {
  id: 'cero-h6', kind: 'story', n: 6, title: 'Misa de medianoche', after: ['cero-h5'],
  where: (d) => place(d.game, 'iglesia'),
  async run(S, { step, retry }) {
    const g = S.g;
    const c = place(g, 'iglesia');
    const fire = S.prop(new Fire({ x: c.x, z: c.z }));
    const ring = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = { x: c.x + Math.cos(a) * 3, z: c.z + Math.sin(a) * 3 };
      const n = cast(S, 'acolito', { ...p, yaw: Math.atan2(c.x - p.x, c.z - p.z) }, { id: `acolito${i}`, variant: 'acolyte' });
      n.lookAt(fire.object3d.position);
      ring.push(n);
    }
    const diacono = cast(S, 'acolito', { x: c.x + 1, z: c.z - 1.2, yaw: 0 }, { id: 'diacono', variant: 'acolyte', scale: 1.08 });
    diacono.name = 'El Diácono';
    if (step === 0) {
      S.spawnIf(retry, streetSpot(g, streets, c.x + 60, c.z + 40));
      if (!retry) await S.say(C, 'Los Acólitos rezan en San Roque a medianoche. Alguien les vende lo mismo que a la PDC. Acércate y escucha.');
      const pts = spotsAround(S, c, 2, 14, 24);
      stealthGuards(S, pts.map((p) => beat(p, 10, 3)), { variant: 'acolyte', range: 14 });
      S.objective('Acércate a la reunión sin que te vean');
      S.markers([{ ...c, label: 'Reunión' }]);
      await S.near(c, 13, 6);
      S.setStealth(null);
      await scene(S, async () => {
        S.shot({ pos: { x: c.x + 9, y: 4, z: c.z + 9 }, look: { x: c.x, y: 1.4, z: c.z } });
        await S.say('EL DIÁCONO', 'El maestro nos presta su poder. A cambio, le damos lo que la ciudad esconde.');
        await S.say('EL DIÁCONO', 'Y la ciudad esconde gente en pisos. Tenemos un chaval que nos dice dónde.');
        await S.say('ACÓLITO', '¿El mismo chaval que trabaja para la PDC?');
        await S.say('EL DIÁCONO', 'Un chivato vende a quien le pague. Esta noche, nos paga a nosotros.');
        await S.say('EL DIÁCONO', '…Huele a ozono. Hay un marcado aquí.');
      });
      S.reach(1);
    }
    S.spawnIf(retry && step === 1, streetSpot(g, streets, c.x + 14, c.z + 10));
    for (const n of [...ring, diacono]) n.setVisible(false);
    const spots = spotsAround(S, c, 4, 4, 12);
    const boss = S.enemy('acolyte', { x: c.x + 1, z: c.z - 1 }, { mods: { health: 5, damage: 1.3 } });
    boss.name = 'El Diácono';
    const crew = spots.map((p) => S.enemy('acolyte', p));
    S.objective('Derrota al Diácono');
    S.every(() => S.markers(boss.alive ? [{ x: boss.position.x, y: boss.position.y, z: boss.position.z, label: 'El Diácono' }] : []));
    await S.defeated([boss, ...crew]);
    await S.say('JON', 'Un poder que no es suyo. Se le apagaba en las manos.');
    await S.say(C, 'Entonces es verdad: alguien les presta las marcas. Pero lo urgente es el chaval. Mañana sale a hacer recados.');
  },
};

// ---------------------------------------------------------------------------
export const H7 = {
  id: 'cero-h7', kind: 'story', n: 7, title: 'Recados', after: ['cero-h6'],
  where: (d) => place(d.game, 'bar'),
  async run(S, { retry }) {
    const g = S.g;
    const bar = place(g, 'bar');
    const pello = cast(S, 'pello', { x: bar.x, z: bar.z, yaw: bar.yaw });
    if (!retry) {
      const txema = cast(S, 'txema', { x: bar.x + 2, z: bar.z + 1, yaw: bar.yaw + Math.PI });
      await scene(S, async () => {
        await S.say('PELLO', '¡Txema, me llevo el pan y las cartas! ¡Vuelvo antes de cenar!');
        await S.say('TXEMA', 'Pello hace los recados desde los doce años. Si es él… no quiero saberlo. Pero tú sí.');
      });
      txema.setVisible(false);
    }
    S.spawnIf(retry, streetSpot(g, streets, bar.x - 25, bar.z - 25));
    const route = streets.routeThrough([bar, place(g, 'km0'), place(g, 'cine')]);
    await tail(S, pello, route, { speed: 3, tooClose: 9, tooFar: 80, text: 'Sigue a Pello sin que te vea' });
    const m = place(g, 'cine');
    const agent = cast(S, 'agente', { x: m.x + 2, z: m.z + 2, yaw: Math.atan2(pello.position.x - m.x, pello.position.z - m.z) });
    await scene(S, async () => {
      S.shot({ pos: { x: m.x + 14, y: 5, z: m.z + 10 }, look: { x: m.x + 1, y: 1.2, z: m.z + 1 } });
      pello.lookAt(agent.position);
      await S.say('AGENTE', '¿Lo tienes?');
      await S.say('PELLO', 'Calle de la Ribera, el tercero. Ahora soltad a mi hermana.');
      await S.say('AGENTE', 'Cuando el comisario lo diga.');
      await S.say('JON', 'Pello…');
    });
    agent.setVisible(false);
    pello.setVisible(false);
  },
};

// ---------------------------------------------------------------------------
export const H8 = {
  id: 'cero-h8', kind: 'story', n: 8, title: 'Pello', after: ['cero-h7'],
  where: (d) => place(d.game, 'puente'),
  async run(S, { step, retry }) {
    const g = S.g;
    const p = place(g, 'puente');
    if (step === 0) {
      S.spawnIf(retry, streetSpot(g, streets, p.x + 60, p.z));
      const pello = cast(S, 'pello', { x: p.x - 4, z: p.z, yaw: -Math.PI / 2 });
      S.objective('Encuentra a Pello en el Puente de Hierro');
      S.markers([{ ...pello.position, label: 'Pello' }]);
      await S.near(pello.position, 7, 6);
      await scene(S, async () => {
        pello.lookAt(S.pos);
        await S.say('PELLO', 'Sabía que vendrías. Txema siempre dice que los marcados lo huelen todo.');
        await S.say('JON', 'Has vendido cuatro casas, Pello.');
        await S.say('PELLO', '¡Tienen a mi hermana! Ane. Catorce años. Está ahí, en el estadio, al otro lado de esa luz.');
        await S.say('PELLO', 'Salaberri dijo que si le daba diez pisos la soltaba. Llevo cuatro.');
      });
      const pick = await S.choice('¿Qué haces con Pello?', [
        { label: 'Entregarlo', desc: 'La resistencia decidirá qué hacer con él' },
        { label: 'Dejarle huir', desc: 'Que busque a su hermana en Los Bloques' },
      ]);
      S.state.flags.pello = pick === 0 ? 'entregado' : 'huido';
      await S.say('JON', pick === 0 ? 'Lo siento. Txema tiene que saberlo.' : 'Vete. Y no vuelvas a vender a nadie.');
      if (pick === 1) pello.walkTo([{ x: p.x - 40, z: p.z }], { speed: 4.5, run: true });
      S.reach(1);
    }
    S.spawnIf(retry && step === 1, p);
    await S.say('SALABERRI (MEGÁFONO)', 'Jon. Te llamas Jon, ¿verdad? Tengo tu voz grabada. Ríndete y nadie más del barrio pierde su casa.', 4.5);
    const spots = spotsAround(S, p, 5, 14, 30);
    const squad = spots.map((q, i) => S.enemy(i === 4 ? 'reforzado' : 'pdc', q));
    const start = { ...p };
    let t = 0;
    const tick = clock(S);
    await S.until(() => {
      t -= tick();
      const d = Math.hypot(S.pos.x - start.x, S.pos.z - start.z);
      if (t <= 0) {
        t = 0.25;
        S.objective('Escapa del puente', [`Aléjate ${Math.round(d)}/220 m`, `o neutralízalos (${S.alive(squad)})`]);
      }
      return d > 220 || squad.every((e) => !e.alive);
    });
    await S.say(C, 'Ya sabe tu nombre. Se acabó esconderse. Vamos a por su Ancla.');
  },
};

// ---------------------------------------------------------------------------
/** Ruta del tranvía por las calles del barrio entre paradas (como mucho `max` metros). */
export function tramRoute(game, stops, max = 1600) {
  const pts = streets.routeThrough(stops.map((k) => (typeof k === 'string' ? place(game, k) : k)));
  const out = [pts[0]];
  let L = 0;
  for (let i = 1; i < pts.length && L < max; i++) {
    L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    out.push(pts[i]);
  }
  return out;
}

/**
 * Viaje en el tranvía: carga que se gasta, cajas de empalme junto a la vía
 * (un disparo: +30) y barricadas que lo paran hasta romperlas.
 */
export async function tramRun(S, tram, { drain = null, boxes = 6, barricades = 3, enemies = 2, text = 'Lleva el tranvía hasta el final' } = {}) {
  const g = S.g;
  const total = tram.total;
  let charge = 100;
  // Gasto equilibrado con el viaje: llega con algo de margen si se recargan casi todas las cajas
  const cruiseSpeed = tram.target || 8;
  const D = total / cruiseSpeed + barricades * 6;
  drain ??= (100 + boxes * 30 * 0.8) / (1.1 * D);
  // Cajas de empalme y barricadas a lo largo de la vía
  const along = (s, side) => {
    const a = tram.pointAt(s);
    const n = { x: -a.dir.z, z: a.dir.x };
    return { x: a.x + n.x * side, z: a.z + n.z * side, s };
  };
  for (let i = 0; i < boxes; i++) {
    const q = along(total * ((i + 0.7) / (boxes + 0.5)), 6.5 * (i % 2 ? 1 : -1));
    const jb = S.prop(new JunctionBox(g, { x: q.x, z: q.z, y: 2.6 }));
    jb.setState('hint');
    jb.onHit = (b) => {
      if (b.state === 'on') return;
      b.setState('on');
      charge = Math.min(100, charge + 30);
      S.sfx('zap', b.center);
    };
  }
  const blocks = [];
  for (let i = 0; i < barricades; i++) {
    const q = along(total * ((i + 1) / (barricades + 1.3)), 0);
    const a = tram.pointAt(q.s);
    blocks.push({ s: q.s, b: S.prop(new TrackBarricade(g, { x: q.x, z: q.z, yaw: Math.atan2(a.dir.x, a.dir.z) + Math.PI / 2 })) });
  }
  for (let i = 0; i < enemies; i++) {
    const q = along(total * ((i + 0.5) / enemies), 10);
    S.enemy('pdc', { x: q.x, z: q.z }, { alert: false });
  }
  const cruise = tram.target || 8;
  let t = 0;
  const tick = clock(S);
  await S.until(() => {
    const dt = tick();
    charge -= drain * dt;
    if (charge <= 0) S.fail('El tranvía se ha quedado sin carga');
    if (!tram.riding && S.pos.y < tram.roofY - 1.2 && Math.hypot(S.pos.x - tram.position.x, S.pos.z - tram.position.z) > 30) S.fail('Te has quedado atrás');
    const ahead = blocks.find((k) => k.b.alive && k.s - tram.s < tram.length / 2 + 9 && k.s > tram.s - 2);
    tram.target = ahead ? 0 : cruise;
    t -= dt;
    if (t <= 0) {
      t = 0.2;
      S.objective(text, [`Carga ${Math.max(0, Math.round(charge))} %`, ahead ? '¡Barricada en la vía: dispárale!' : 'Dispara a las cajas de empalme para recargar']);
      S.markers(ahead ? [{ x: ahead.b.position.x, y: 0.5, z: ahead.b.position.z, label: 'Barricada' }] : []);
    }
    return tram.done;
  });
  S.markers([]);
  return charge;
}

export const H9 = {
  id: 'cero-h9', kind: 'story', n: 9, title: 'La línea 0', after: ['cero-h8'],
  where: (d) => place(d.game, 'cocheras'),
  async run(S, { retry }) {
    const g = S.g;
    const coch = place(g, 'cocheras');
    const rosa = cast(S, 'rosa', { x: coch.x, z: coch.z, yaw: coch.yaw });
    const route = tramRoute(g, ['cocheras', 'km0', 'sub'], 1700);
    const tram = S.prop(new Vehicle(g, { kind: 'tram', path: route, speed: 0 }));
    if (!retry) {
      await scene(S, async () => {
        rosa.lookAt(S.pos);
        await S.say('ROSA', 'Treinta años conduje la línea 0. La cerraron el día del Cierre, con el tranvía dentro.');
        await S.say('ROSA', 'Si quieres meterle Energía a ese Ancla, necesitas una batería que se mueva. Esta.');
        await S.say('ROSA', 'Yo lo conduzco. Tú mantenlo vivo: cada caja de la catenaria le da carga.');
      });
    }
    S.spawnIf(retry, streetSpot(g, streets, coch.x + 6, coch.z + 6));
    rosa.setVisible(false);
    S.objective('Sube al techo del tranvía');
    S.markers([{ ...tram.roofPoint(0), y: tram.roofY, label: 'Tranvía' }]);
    await S.until(() => tram.riding);
    S.markers([]);
    tram.target = 9;
    S.line('ROSA', '¡Agárrate, que esta vieja todavía corre!', 3);
    await tramRun(S, tram, { boxes: 7, barricades: 3, enemies: 3, text: 'Lleva el tranvía hasta la subestación' });
    await S.say('ROSA', 'Hasta aquí llega la vía. El resto es cosa tuya, chaval.');
  },
};

// ---------------------------------------------------------------------------
export const H10 = {
  id: 'cero-h10', kind: 'story', n: 10, title: 'Sobrecarga', after: ['cero-h9'],
  where: () => {
    const d = CITY.districts.find((x) => x.id === 'cero');
    return { x: d.anchor.x + 8, y: 0, z: d.anchor.z + 8 };
  },
  async run(S, { step, retry }) {
    const g = S.g;
    const adm = g.mapManager.current.admin;
    const anc = adm.anchors.items.find((a) => a.id === 'cero');
    const A = { x: anc.x, y: 0, z: anc.z };
    if (step === 0) {
      S.spawnIf(retry, streetSpot(g, streets, A.x + 25, A.z + 25));
      if (!retry) {
        await S.say(C, 'El Ancla de la Subestación. La PDC dice que es una máquina. Yo no estoy tan segura.');
        await S.say(C, 'Conéctala a la catenaria y no te separes de ella. Van a venir todos.');
      }
      S.objective('Conecta la catenaria al Ancla');
      S.markers([{ ...A, label: 'Ancla' }]);
      await S.interact({ x: A.x, y: 0, z: A.z }, 'Conectar la catenaria al Ancla', 6);
      S.reach(1);
    }
    S.spawnIf(retry && step === 1, streetSpot(g, streets, A.x + 8, A.z + 8));
    S.markers([{ ...A, label: 'Ancla' }]);
    const plan = [
      [{ type: 'pdc', n: 3 }],
      [{ type: 'pdc', n: 3 }, { type: 'dron', n: 1 }],
      [{ type: 'pdc', n: 2 }, { type: 'reforzado', n: 1 }, { type: 'dron', n: 2 }],
      [{ type: 'blindado', n: 2 }, { type: 'pdc', n: 2 }],
    ];
    let v = 0;
    let wave = 0;
    let es = [];
    let t = 0;
    const tick = clock(S);
    const spawnWave = () => {
      const list = plan[wave++];
      const n = list.reduce((s, w) => s + w.n, 0);
      const sp = spotsAround(S, A, n, 30, 55);
      let k = 0;
      for (const w of list) for (let j = 0; j < w.n; j++) es.push(S.enemy(w.type, { ...sp[k], y: w.type === 'dron' ? 12 : 0.2, z: sp[k++].z }));
      S.sfx('radio');
    };
    spawnWave();
    await S.until(() => {
      const dt = tick();
      const near = S.isNear(A, 14, 8);
      v = Math.min(1, v + (near ? dt / 150 : 0));
      if (wave < plan.length && v >= wave / plan.length) spawnWave();
      t -= dt;
      if (t <= 0) {
        t = 0.2;
        S.objective('Sobrecarga el Ancla', [`${Math.round(v * 100)} %${near ? '' : ' · vuelve junto al Ancla'}`, `Oleada ${wave}/${plan.length} · quedan ${S.alive(es)}`]);
      }
      return v >= 1 && es.every((e) => !e.alive || e.type.id === 'dron');
    });
    // Cae la barrera de la Avenida de la Fundición
    S.objective(null);
    await scene(S, async () => {
      S.shot({ pos: { x: A.x + 22, y: 9, z: A.z + 22 }, look: { x: A.x, y: 30, z: A.z } });
      S.sfx('thunder');
      g._saveBarriers(adm.setBarrier('cero', true));
      g.vfx.lights.flash({ x: A.x, y: 20, z: A.z }, 0xffb547, 120, 60, 0.8);
      await S.wait(1.5);
      await S.say('JON', 'Ha gritado. Las barreras no son máquinas…, eso ha gritado.');
    });
    g.enemies.clear('mision');
    const booth = S.district.world.booths.km0;
    S.objective('La cabina de la plaza está sonando');
    S.markers([{ ...booth.position, label: 'Cabina' }]);
    await answer(S, booth, 'Escuchar el mensaje');
    await S.say('SALABERRI (GRABACIÓN)', 'Enhorabuena, Jon. Has abierto una puerta. Y yo tengo tu voz. En La Fundición nos vemos.', 5);
    await S.say(C, 'Has abierto la Avenida de la Fundición. Descansa. Mañana empieza lo difícil.');
    S.state.flags['historia:cero'] = true;
  },
};

export const STORY = [H1, H2, H3, H4, H5, H6, H7, H8, H9, H10];
