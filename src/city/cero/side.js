import * as THREE from 'three';
import { StealthGuard } from '../../story/actors.js';
import { Vehicle, JunctionBox, Package, PhoneBooth } from '../props.js';
import { waves, holdZone, interactMoving, interactAny, tail, spotsAround, streetSpot, clock, photoMode } from '../kit.js';
import { streets, place, cast, PLACES, spreadSpots } from './world.js';
import { tramRoute } from './story.js';

/**
 * Distrito Cero · Secundarias. Cada una la da un personaje en la calle.
 * Textos provisionales hasta que llegue el guion.
 */
const C = 'CENTRALITA';

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

/** Presentación con quien da la misión (en su sitio). */
async function intro(S, key, at, lines, { retry } = {}) {
  const npc = cast(S, key, at);
  if (!retry) {
    await scene(S, async () => {
      npc.lookAt(S.pos);
      for (const [sp, t] of lines) await S.say(sp, t);
    });
  }
  return npc;
}

/** Guardias de sigilo (PDC). */
function guards(S, routes, o = {}) {
  const group = new THREE.Group();
  const ctx = { group, world: S.g.world, vfx: S.g.vfx };
  const gs = routes.map((route, i) => new StealthGuard(ctx, { id: `sg${i}`, route, range: o.range ?? 14, fov: o.fov ?? 36, speed: 1.4 }));
  S.prop({ object3d: group, update: (dt) => gs.forEach((x) => x.update(dt)) });
  S.setStealth({ guards: gs, lights: [] });
  return gs;
}

function beat(p, len = 12) {
  const s = streets.project(p.x, p.z);
  const d = s ? s.dir : { x: 1, z: 0 };
  return [{ x: p.x - d.x * len / 2, z: p.z - d.z * len / 2, wait: 2.5 }, { x: p.x + d.x * len / 2, z: p.z + d.z * len / 2, wait: 2.5 }];
}

/** Puntos de calle a lo largo de una ruta (cada `every` metros). */
function along(route, n) {
  const out = [];
  let L = 0;
  const seg = [];
  for (let i = 1; i < route.length; i++) {
    const l = Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    seg.push(l);
    L += l;
  }
  for (let k = 1; k <= n; k++) {
    let s = (L * k) / (n + 1);
    for (let i = 0; i < seg.length; i++) {
      if (s <= seg[i]) {
        const a = route[i];
        const b = route[i + 1];
        out.push({ x: a.x + (b.x - a.x) * (s / seg[i]), z: a.z + (b.z - a.z) * (s / seg[i]) });
        break;
      }
      s -= seg[i];
    }
  }
  return out;
}

// --- S1 · Las siete letras ---------------------------------------------------
export const S1 = {
  id: 'cero-s1', kind: 'side', title: 'Las siete letras', after: ['cero-h2'], giver: 'anselmo',
  where: (d) => place(d.game, 'cine'),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'cine');
    const anselmo = await intro(S, 'anselmo', at, [
      ['ANSELMO', 'Este cine se llamaba Ascenso. Yo proyectaba aquí cuando nadie sabía lo que era una marca.'],
      ['ANSELMO', 'El letrero lleva apagado desde el Cierre. Cada letra va a un cuadro distinto del barrio.'],
      ['ANSELMO', 'Enciéndelas y te enseño lo que guardé en la cabina.'],
    ], { retry });
    const letters = 'ASCENSO'.split('');
    const pts = spreadSpots(g, 7, 707, { near: ['cine'], radius: 300, minSep: 70 });
    const boxes = pts.map((p, i) => S.prop(new JunctionBox(g, { x: p.x, z: p.z, label: letters[i] })));
    boxes.forEach((b) => b.setState('hint'));
    let lit = 0;
    for (const b of boxes) {
      b.onHit = () => {
        if (b.state === 'on') return;
        b.setState('on');
        lit++;
        S.sfx('zap', b.center);
      };
    }
    let t = 0;
    const tick = clock(S);
    await S.until(() => {
      t -= tick();
      if (t <= 0) {
        t = 0.3;
        S.objective('Enciende las letras del Cine Ascenso', [`${boxes.filter((b) => b.state === 'on').map((b) => b.label).join(' ') || '—'} · ${lit}/7`, 'Dispara a cada caja de empalme']);
        S.markers(boxes.filter((b) => b.state !== 'on').map((b) => ({ ...b.position, y: 0, label: `Letra ${b.label}` })));
      }
      return lit >= 7;
    });
    S.markers([{ ...at, label: 'Anselmo' }]);
    S.objective('Vuelve con Anselmo');
    await S.near(at, 5, 6);
    await scene(S, async () => {
      anselmo.lookAt(S.pos);
      await S.say('ANSELMO', 'A-S-C-E-N-S-O. Como en el 58.');
      await S.say('ANSELMO', 'Toma. Un noticiario que la PDC quemó en todas partes menos aquí: «Proyecto Ascend, primera fase».');
      await S.say('JON', 'Salen las cartas. Las de la base.');
    });
    S.state.found['cero:noticiario'] = true;
  },
};

// --- S2 · El tranvía fantasma --------------------------------------------------
export const S2 = {
  id: 'cero-s2', kind: 'side', title: 'El tranvía fantasma', after: ['cero-h4'], giver: 'rosa',
  where: (d) => place(d.game, 'sub', -40, 30),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'sub', -40, 30);
    await intro(S, 'rosa', at, [
      ['ROSA', 'Por las noches un tranvía cruza el barrio sin conductor. Sin luces.'],
      ['ROSA', 'Dicen que es un fantasma. Yo digo que son los Acólitos moviendo algo que no quieren que veamos.'],
    ], { retry });
    const route = tramRoute(g, [place(g, 'sub', -40, 30), 'neones', 'km0', 'cine']);
    const tram = S.prop(new Vehicle(g, { kind: 'tram', path: route, s: 60, speed: 6 }));
    tram.target = 6;
    S.objective('Súbete al tranvía fantasma');
    let t = 0;
    const tick = clock(S);
    await S.until(() => {
      t -= tick();
      if (t <= 0) {
        t = 0.2;
        S.markers([{ ...tram.roofPoint(0), y: tram.roofY, label: 'Tranvía fantasma' }]);
      }
      if (tram.done) S.fail('El tranvía se ha ido');
      return tram.riding;
    });
    S.objective('Llega al freno de la cabina delantera');
    S.markers([]);
    await interactMoving(S, () => tram.roofPoint(tram.length / 2 - 1), 'Echar el freno', 2.4);
    tram.target = 0;
    S.sfx('clank');
    await S.until(() => tram.speed < 0.3);
    const crew = spotsAround(S, tram.position, 4, 6, 14).map((p) => S.enemy('acolyte', p));
    S.objective('Los Acólitos salen del tranvía');
    await S.defeated(crew);
    await S.say('JON', 'Cajas con el sello de la PDC. Los Acólitos y la PDC compran en la misma tienda.');
  },
};

// --- S3 · Fianza -----------------------------------------------------------------
export const S3 = {
  id: 'cero-s3', kind: 'side', title: 'Fianza', after: ['cero-h2'], giver: 'txema',
  where: (d) => place(d.game, 'bar', 0, 0),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'bar');
    await intro(S, 'txema', at, [
      ['TXEMA', 'Se han llevado a Mikel, mi sobrino. Lo llevan en un furgón hacia la autovía.'],
      ['TXEMA', 'Si cruza el control, no lo vuelvo a ver. Corre.'],
    ], { retry });
    const route = streets.routeThrough([place(g, 'bar', 120, -60), place(g, 'km0'), PLACES.autovia]);
    const van = S.prop(new Vehicle(g, { kind: 'van', path: route, speed: 7 }));
    van.target = 7;
    S.objective('Alcanza el furgón antes del control', ['Abre la puerta trasera con E']);
    let t = 0;
    const tick = clock(S);
    const watch = S.every(() => {
      t -= tick();
      if (t <= 0) {
        t = 0.2;
        S.markers([{ ...van.roofPoint(0), y: 0, label: 'Furgón' }]);
      }
      if (van.done) S.fail('El furgón ha cruzado el control');
    });
    await interactMoving(S, () => ({ ...van.roofPoint(-van.length / 2 - 0.6), y: 0 }), 'Abrir la puerta trasera', 2.6);
    watch();
    van.target = 0;
    S.sfx('clank');
    const mikel = cast(S, 'sobrino', { ...van.roofPoint(-van.length / 2 - 1.5), y: 0 });
    mikel.setPose('kneel');
    const guards = spotsAround(S, van.position, 3, 5, 10).map((p) => S.enemy('pdc', p));
    S.objective('Protege a Mikel');
    await S.defeated(guards);
    mikel.setPose('stand');
    await S.say('MIKEL', 'Gracias. Dile a mi tío que vuelvo por el mercado. Por las vías no.');
  },
};

// --- S4 · Campanas mudas -------------------------------------------------------
export const S4 = {
  id: 'cero-s4', kind: 'side', title: 'Campanas mudas', after: ['cero-h4'], giver: 'julian',
  where: (d) => place(d.game, 'iglesia', 30, 20),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'iglesia', 30, 20);
    await intro(S, 'julian', at, [
      ['DON JULIÁN', 'La PDC ha llenado el claustro de micrófonos. Ya no se confiesa nadie.'],
      ['DON JULIÁN', 'Quítalos. Y que no te vea el de la sacristía, que es de los suyos.'],
    ], { retry });
    S.spawnIf(retry, at);
    const c = place(g, 'iglesia');
    const mics = spotsAround(S, c, 5, 6, 30);
    guards(S, spotsAround(S, c, 2, 8, 20).map((p) => beat(p, 12)));
    const left = new Set(mics.map((_, i) => i));
    while (left.size) {
      S.objective('Quita los micrófonos sin que te vean', [`${5 - left.size}/5`]);
      S.markers([...left].map((i) => ({ ...mics[i], label: 'Micrófono' })));
      const ids = [...left];
      const k = ids[await interactAny(S, ids.map((i) => mics[i]), 'Arrancar el micrófono', 1.8)];
      left.delete(k);
      S.sfx('ui');
    }
    S.setStealth(null);
    await S.say('DON JULIÁN', 'Esta noche tocaré las campanas. Que se oiga en todo el barrio.');
  },
};

// --- S5 · Escrituras -----------------------------------------------------------
export const S5 = {
  id: 'cero-s5', kind: 'side', title: 'Escrituras', after: ['cero-h3'], giver: 'benito',
  where: (d) => place(d.game, 'km0', 30, 25),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'km0', 30, 25);
    const benito = await intro(S, 'benito', at, [
      ['BENITO', 'Fui director del Banco del Este. En mi despacho están las escrituras de medio barrio.'],
      ['BENITO', 'La PDC quiere expropiarlo todo. Si las saco, no pueden. Pero no llego solo.'],
    ], { retry });
    const bank = place(g, 'banco');
    const route = streets.route(at, bank);
    const legs = along(route, 3).concat([bank]);
    for (let i = 0; i < legs.length; i++) {
      // Benito solo avanza con Jon cerca
      S.objective('Escolta a Benito hasta el banco', [`Tramo ${i + 1}/${legs.length}`, 'Quédate cerca de él']);
      S.markers([{ ...benito.position, label: 'Benito' }]);
      await S.until(() => S.isNear(benito.position, 20, 8));
      await benito.walkTo(streets.route(benito.position, legs[i]), { speed: 1.9 * S.d.speed });
      if (i === 1 || i === 2) {
        benito.setPose('kneel');
        const es = spotsAround(S, benito.position, i + 2, 18, 32).map((p) => S.enemy('acolyte', p));
        S.objective('¡Emboscada! Protege a Benito');
        await S.defeated(es);
        benito.setPose('stand');
      }
    }
    await S.interact(bank, 'Abrir el despacho', 3);
    await S.say('BENITO', 'Las escrituras. Y la cámara acorazada… cerrada con una cerradura que escucha. Eso no lo abre nadie.');
    await S.say('JON', 'Todavía.');
  },
};

// --- S6 · Cables cruzados ----------------------------------------------------
export const S6 = {
  id: 'cero-s6', kind: 'side', title: 'Cables cruzados', after: ['cero-h4'], giver: 'nekane',
  where: (d) => place(d.game, 'neones', -30, 20),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'neones', -30, 20);
    await intro(S, 'nekane', at, [
      ['NEKANE', 'La red de cabinas de la Centralita está cortada en cuatro cajas.'],
      ['NEKANE', 'Cárgalas en orden: primero la que tiene la luz encendida. Si te saltas una, salta el diferencial.'],
    ], { retry });
    const pts = spreadSpots(g, 4, 66, { near: ['neones', 'km0'], radius: 260, minSep: 90 });
    const boxes = pts.map((p) => S.prop(new JunctionBox(g, { x: p.x, z: p.z })));
    let next = 0;
    boxes[0].setState('hint');
    boxes.forEach((b, i) => {
      b.onHit = () => {
        if (b.state === 'on') return;
        if (i !== next) {
          S.sfx('fail');
          boxes.forEach((x) => x.setState('off'));
          next = 0;
          boxes[0].setState('hint');
          g.ui.toast('¡Diferencial!', 'Vuelve a empezar por la primera caja', 1600);
          return;
        }
        b.setState('on');
        S.sfx('zap', b.center);
        next++;
        if (next < boxes.length) boxes[next].setState('hint');
      };
    });
    await S.until(() => {
      S.objective('Carga las cajas en orden', [`${next}/4`, 'Dispárales: la que parpadea es la siguiente']);
      S.markers(next < boxes.length ? [{ ...boxes[next].position, y: 0, label: `Caja ${next + 1}` }] : []);
      return next >= boxes.length;
    });
    await S.say(C, 'Vuelvo a oír el barrio entero. Gracias, chico. A Nekane también.');
  },
};

// --- S7 · Neón -----------------------------------------------------------------
export const S7 = {
  id: 'cero-s7', kind: 'side', title: 'Neón', after: ['cero-h3'], giver: 'maripaz',
  where: (d) => place(d.game, 'neones', 40, -30),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'neones', 40, -30);
    await intro(S, 'maripaz', at, [
      ['MARIPAZ', 'Un Acólito pasa cada viernes a cobrar «protección». Hoy es viernes.'],
      ['MARIPAZ', 'Ahí está. ¡Que no se escape!'],
    ], { retry });
    const thug = cast(S, 'acolito', { ...place(g, 'neones', 70, -40) }, { id: 'cobrador', variant: 'acolyte' });
    thug.name = 'El cobrador';
    const route = streets.routeThrough([thug.position, place(g, 'km0'), place(g, 'iglesia')]);
    thug.walkTo(route, { speed: 5.2, run: true });
    const stop = S.countdown(70, 'Se ha escapado');
    await interactMoving(S, () => ({ x: thug.position.x, y: 0, z: thug.position.z }), 'Atrapar al cobrador', 2.4);
    stop();
    thug.stop();
    thug.setVisible(false);
    const boss = S.enemy('acolyte', { x: thug.position.x, z: thug.position.z }, { mods: { health: 2.5 } });
    const pals = spotsAround(S, thug.position, 3, 10, 20).map((p) => S.enemy('acolyte', p));
    S.objective('Han venido sus amigos');
    await S.defeated([boss, ...pals]);
    await S.say('MARIPAZ', 'Los viernes vuelven a ser solo viernes.');
  },
};

// --- S8 · Frío ---------------------------------------------------------------
export const S8 = {
  id: 'cero-s8', kind: 'side', title: 'Frío', after: ['cero-h4'], giver: 'charo',
  where: (d) => place(d.game, 'mercado', 30, 30),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'mercado', 30, 30);
    await intro(S, 'charo', at, [
      ['CHARO', 'En las cámaras del mercado la PDC guarda medicinas que no llegan al barrio.'],
      ['CHARO', 'Tres portales las esperan. La insulina no espera mucho fuera del frío.'],
    ], { retry });
    const m = place(g, 'mercado');
    const box = S.prop(new Package({ x: m.x, z: m.z, color: 0xe6e6e0 }));
    const gs = spotsAround(S, m, 3, 6, 16).map((p) => S.enemy('pdc', p, { calm: true, alert: false, patrol: [p, { x: p.x + 6, z: p.z + 4 }] }));
    S.objective('Roba la caja de medicinas', ['Con sigilo o a las bravas']);
    S.markers([{ ...m, label: 'Medicinas' }]);
    await S.interact(m, 'Coger la caja de medicinas', 2.4);
    box.object3d.visible = false;
    const doors = spreadSpots(g, 3, 88, { near: ['km0', 'neones', 'bar'], radius: 400, minSep: 150 });
    S.countdown(150, 'La insulina se ha estropeado');
    for (let i = 0; i < doors.length; i++) {
      S.objective('Reparte las medicinas', [`Portal ${i + 1}/3`]);
      S.markers([{ ...doors[i], label: `Portal ${i + 1}` }]);
      await S.interact(doors[i], 'Dejar las medicinas', 2.6);
      S.sfx('ui');
    }
    gs.length = 0;
    await S.say('CHARO', 'Tres portales con insulina. Esta noche se duerme mejor en Cero.');
  },
};

// --- S9 · Retratos -------------------------------------------------------------
const AGENTS = [
  { name: 'El del paraguas', jacket: 0xb3262b },
  { name: 'La de la gabardina', jacket: 0xc9b48a },
  { name: 'El cojo', jacket: 0x3a3f48 },
  { name: 'La del perro', jacket: 0x55708a },
  { name: 'El del periódico', jacket: 0x2d2a2a },
  { name: 'El de las gafas', jacket: 0x3a5a3a },
  { name: 'La del bolso rojo', jacket: 0x7a3b3b },
  { name: 'El del chándal', jacket: 0x2a3440 },
];

export const S9 = {
  id: 'cero-s9', kind: 'side', title: 'Retratos', after: ['cero-h5'], giver: 'itxaso',
  where: (d) => place(d.game, 'estacion', 30, -20),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'estacion', 30, -20);
    await intro(S, 'itxaso', at, [
      ['ITXASO', 'Salaberri tiene agentes de paisano por todo el barrio. Si les ponemos cara, la gente sabrá de quién esconderse.'],
      ['ITXASO', 'Apunta con el botón derecho y pulsa E para la foto. Ojo: no todo el que mira raro es de la PDC.'],
    ], { retry });
    const spots = spreadSpots(g, 12, 99, { minSep: 120 });
    const people = spots.map((p, i) => {
      const agent = i < AGENTS.length ? AGENTS[i] : null;
      const pal = { skin: 0xc49a80, jacket: agent ? agent.jacket : [0x6b5a3a, 0x8a8f99, 0x55708a, 0x4c3a46][i % 4], hoodie: 0xd9d0c0, pants: 0x2b2f36, boots: 0x15120f, hair: 0x2a2420, hairStyle: i % 2 ? 'short' : 'long' };
      const n = S.npc(`retrato${i}`, { name: agent ? agent.name : 'Vecino', palette: pal, x: p.x, z: p.z, yaw: p.yaw });
      n.agent = !!agent;
      n.name = agent ? agent.name : 'Vecino';
      n.photographed = false;
      n.walkTo(streets.wander(p.x, p.z, 6), { speed: 1.2 });
      return n;
    });
    let got = 0;
    photoMode(S, people, (n) => {
      if (!n.agent) {
        g.ui.toast('No es un agente', 'Es un vecino cualquiera', 1400);
        return;
      }
      n.photographed = true;
      got++;
      g.ui.toast('Foto', n.name, 1200);
    });
    await S.until(() => {
      S.objective('Fotografía a los agentes de paisano', [`${got}/8`, 'Botón derecho para apuntar · E para la foto']);
      S.markers(people.filter((n) => n.agent && !n.photographed && Math.hypot(n.position.x - S.pos.x, n.position.z - S.pos.z) < 90).map((n) => ({ ...n.position, label: '¿Agente?' })));
      return got >= 8;
    });
    await S.say('ITXASO', 'Ocho caras. Mañana estarán en todas las paredes de Cero.');
  },
};

// --- S10 · La radio de la amama ----------------------------------------------
export const S10 = {
  id: 'cero-s10', kind: 'side', title: 'La radio de la amama', after: ['cero-h6'], giver: 'juana',
  where: (d) => place(d.game, 'mercado', -30, 20),
  async run(S, { retry }) {
    const g = S.g;
    const at = place(g, 'mercado', -30, 20);
    await intro(S, 'juana', at, [
      ['JUANA', '¿Tú eres el nieto de la del puerto? Tu abuela y yo vendíamos conservas juntas, antes de todo esto.'],
      ['JUANA', 'Me dejó su radio para que se la arreglara. La PDC se la llevó con todo lo del almacén.'],
      ['JON', 'Mi abuela… murió en la tormenta.'],
      ['JUANA', 'Lo sé, hijo. Por eso tiene que tenerla alguien.'],
    ], { retry });
    const wh = place(g, 'almacen');
    const box = S.prop(new Package({ x: wh.x, z: wh.z, color: 0x5a4632 }));
    const gs = spotsAround(S, wh, 4, 6, 18).map((p, i) => S.enemy(i === 3 ? 'reforzado' : 'pdc', p, { calm: true, alert: false }));
    S.objective('Recupera la radio del almacén embargado');
    S.markers([{ ...wh, label: 'Almacén' }]);
    await S.interact(wh, 'Coger la radio', 2.4);
    box.object3d.visible = false;
    S.objective('Llévale la radio a Juana');
    S.markers([{ ...at, label: 'Juana' }]);
    await S.near(at, 4, 6);
    await scene(S, async () => {
      await S.say('JUANA', 'Mírala. Con su pegatina de la Virgen y todo.');
      S.sfx('radio');
      await S.say('CENTRALITA (RADIO)', '…aquí la Centralita… si alguien me oye en Cero, mañana a las nueve, La Catenaria…', 4);
      await S.say('JON', 'Mi abuela escuchaba a la Centralita.');
      await S.say('JUANA', 'Todo el puerto la escuchaba. Quédatela. Es tuya.');
    });
    S.state.found['cero:radio'] = true;
    gs.length = 0;
  },
};

export const SIDE = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10];
