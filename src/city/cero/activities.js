import * as THREE from 'three';
import { Vehicle, JunctionBox, SecurityCam, Package, Fire, Blocks, mats } from '../props.js';
import { waves, spotsAround, streetSpot, clock, cameraNet, race, snapshot, showPhoto } from '../kit.js';
import { medalFor } from '../CityState.js';
import { streets, place, cast, spreadSpots } from './world.js';
import { tramRoute, tramRun } from './story.js';

/**
 * Distrito Cero · Seis actividades, cada una con su forma de jugar:
 * oleadas, conducción contrarreloj, puzle de circuitos, sabotaje sigiloso,
 * carrera contra fantasma y búsqueda por fotos. Se abren al tomar la torre.
 */

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Sitios de cada actividad (calculados una vez por partida, con el mundo cargado). */
const cache = new Map();
function spotsOf(d, key, fn) {
  const k = `${key}`;
  if (!cache.has(k)) cache.set(k, fn(d.game));
  return cache.get(k);
}
export function resetActivitySpots() {
  cache.clear();
}

// --- A · Bases acólitas (oleadas) ---------------------------------------------
export const BASES = {
  id: 'cero-act-bases', act: 'cero-base', kind: 'act', repeat: true, title: 'Base acólita', after: ['torre:cero'],
  spots: (d) => spotsOf(d, 'bases', (g) => spreadSpots(g, 5, 101, { near: ['iglesia', 'mercado', 'sub', 'cine', 'autovia'], radius: 420, minSep: 260 })),
  async run(S, { inst }) {
    const g = S.g;
    const c = BASES.spots(S.d)[inst];
    S.prop(new Fire({ x: c.x, z: c.z }));
    const ring = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ring.push({ x: c.x + Math.cos(a) * 7, z: c.z + Math.sin(a) * 7, yaw: a + Math.PI / 2, w: 2.2, h: 1 });
    }
    S.prop(new Blocks(g, ring.filter((p) => g.world.groundHeight(p.x, p.z, 1.2, 30) <= 0.3)));
    const t0 = S.d.time;
    const hp0 = g.playerCombat.health.value;
    let lost = 0;
    const off = S.every(() => {
      const h = g.playerCombat.health.value;
      if (h < hp0) lost = Math.max(lost, hp0 - h);
    });
    await waves(S, [
      [{ type: 'acolyte', n: 4 }],
      [{ type: 'acolyte', n: 4, mods: { health: 1.4 } }, { type: 'acolyte', n: 1, mods: { health: 2 } }],
      [{ type: 'acolyte', n: 3 }, { type: 'acolyte', n: 1, mods: { health: 4, damage: 1.3 } }],
    ], { center: c, label: 'Ronda', text: 'Limpia la base acólita', leash: 75, minD: 18, maxD: 40 });
    off();
    const t = S.d.time - t0;
    return { medal: medalFor(t, { gold: 150, silver: 220, bronze: 9999 }, true), score: `${fmt(t)}` };
  },
};

// --- B · Línea 0 (conducción contrarreloj) -------------------------------------
const LINES = [
  ['sub', 'bar', 'estacion'],
  ['km0', 'cine', 'mercado'],
  ['autovia', 'iglesia', 'neones', 'km0'],
];
export const TRAM = {
  id: 'cero-act-tram', act: 'cero-tram', kind: 'act', repeat: true, title: 'Línea 0', after: ['torre:cero'],
  spots: (d) => spotsOf(d, 'tram', (g) => LINES.map((l) => place(g, l[0], 12, 0))),
  async run(S, { inst }) {
    const g = S.g;
    const route = tramRoute(g, LINES[inst], 1300);
    const tram = S.prop(new Vehicle(g, { kind: 'tram', path: route, speed: 0 }));
    S.objective('Sube al techo del tranvía');
    S.markers([{ ...tram.roofPoint(0), y: tram.roofY, label: 'Tranvía' }]);
    await S.until(() => tram.riding);
    S.markers([]);
    tram.target = 9;
    const charge = await tramRun(S, tram, { boxes: 5, barricades: 2, enemies: 2, text: 'Línea 0: llega al final con carga' });
    return { medal: medalFor(charge, { gold: 60, silver: 35, bronze: 0.01 }), score: `${Math.round(charge)} % de carga` };
  },
};

// --- C · Cabinas de la Centralita (puzle de circuitos) ----------------------------
/** Cable entre dos puntos (tubo fino a 3,2 m). */
function cable(a, b, mat) {
  const A = new THREE.Vector3(a.x, 3.2, a.z);
  const B = new THREE.Vector3(b.x, 3.2, b.z);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), mat);
  m.position.copy(A).lerp(B, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export const CABINAS = {
  id: 'cero-act-cabinas', act: 'cero-cabina', kind: 'act', repeat: true, title: 'Cabina de la Centralita', after: ['torre:cero'],
  spots: (d) => d.districts.get('cero').world.cabinas.map((b) => ({ ...b.position })),
  async run(S, { inst }) {
    const g = S.g;
    const booth = S.district.world.cabinas[inst];
    const n = 3 + (inst % 3);
    const rnd = (() => {
      let s = inst * 9301 + 49297;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    })();
    // Cajas por las calles cercanas, encadenadas con un cable que sale de la cabina
    const pts = spotsAround(S, booth.position, n, 12, 38, rnd);
    const boxes = pts.map((p) => S.prop(new JunctionBox(g, { x: p.x, z: p.z, y: 2.4 })));
    const wire = new THREE.Group();
    let prev = booth.position;
    for (const p of pts) {
      wire.add(cable(prev, p, mats().dark));
      prev = p;
    }
    S.prop(wire);
    let next = 0;
    const t0 = S.d.time;
    boxes.forEach((b, i) => {
      b.onHit = () => {
        if (b.state === 'on') return;
        if (i !== next) {
          S.sfx('fail');
          for (const x of boxes) x.setState('error');
          setTimeout(() => boxes.forEach((x) => x.setState('off')), 500);
          next = 0;
          g.ui.toast('¡Diferencial!', 'Sigue el cable desde la cabina', 1400);
          return;
        }
        b.setState('on');
        S.sfx('zap', b.center);
        next++;
      };
    });
    S.countdown(150, 'La línea sigue cortada');
    await S.until(() => {
      S.objective('Restablece la línea: carga las cajas en orden', [`${next}/${n}`, 'Sigue el cable desde la cabina · dispara a cada caja']);
      return next >= n;
    });
    booth.setRinging(true);
    S.sfx('phone', booth.position);
    await S.interact(booth.position, 'Contestar', 2.6);
    booth.setRinging(false);
    S.line('CENTRALITA', ['Línea restablecida.', 'Otra calle que vuelve a hablar.', 'Te oigo. Sigue así.'][inst % 3], 3);
    const t = S.d.time - t0;
    return { medal: medalFor(t, { gold: 40 + n * 5, silver: 70 + n * 8, bronze: 150 }, true), score: fmt(t) };
  },
};

// --- D · Ojos de Salaberri (sabotaje sigiloso) ---------------------------------
export const CAMS = {
  id: 'cero-act-cams', act: 'cero-cams', kind: 'act', repeat: true, title: 'Ojos de Salaberri', after: ['torre:cero'],
  spots: (d) => spotsOf(d, 'cams', (g) => spreadSpots(g, 6, 404, { minSep: 240 })),
  async run(S, { inst }) {
    const g = S.g;
    const c = CAMS.spots(S.d)[inst];
    const n = 3 + (inst % 3);
    const rnd = (() => {
      let s = inst * 7919 + 13;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    })();
    const pts = spotsAround(S, c, n, 8, 22, rnd);
    const cams = pts.map((p, i) => {
      // Cada cámara mira hacia el centro del grupo (y barre): se vigilan entre sí
      const yaw = Math.atan2(c.x - p.x, c.z - p.z) + (i % 2 ? 0.35 : -0.35);
      return S.prop(new SecurityCam(g, { x: p.x, z: p.z, yaw, sweep: 0.55, range: 15, fov: 24, speed: 0.4 + (i % 3) * 0.1 }));
    });
    const t0 = S.d.time;
    await cameraNet(S, cams);
    const t = S.d.time - t0;
    return { medal: medalFor(t, { gold: 25 + n * 8, silver: 45 + n * 12, bronze: 9999 }, true), score: fmt(t) };
  },
};

// --- E · Carreras de tejados (contra el fantasma de Pello) ---------------------
export const RACES = {
  id: 'cero-act-race', act: 'cero-race', kind: 'act', repeat: true, title: 'Carrera de tejados', after: ['torre:cero'],
  spots: (d) => spotsOf(d, 'race', (g) => spreadSpots(g, 4, 505, { near: ['neones', 'estacion', 'km0', 'bar'], radius: 350, minSep: 200 })),
  /** Ruta de la carrera: por las calles y, donde se puede, por los tejados bajos. */
  course(g, inst) {
    const c = RACES.spots({ game: g })[inst];
    let s = inst * 4421 + 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const walk = streets.wander(c.x, c.z, 14, rnd);
    const pts = [];
    let acc = 0;
    for (let i = 1; i < walk.length && pts.length < 9; i++) {
      acc += Math.hypot(walk[i].x - walk[i - 1].x, walk[i].z - walk[i - 1].z);
      if (acc < 55) continue;
      acc = 0;
      const q = walk[i];
      // A un lado, encima de un edificio si es bajo
      const sp = streets.project(q.x, q.z);
      const side = pts.length % 2 ? 1 : -1;
      const rx = q.x + sp.side.x * (sp.w / 2 + 6) * side;
      const rz = q.z + sp.side.z * (sp.w / 2 + 6) * side;
      const h = g.world.groundHeight(rx, rz, 1.5, 300);
      pts.push(h > 3 && h < 20 && pts.length % 3 === 1 ? { x: rx, y: h, z: rz } : { x: q.x, y: 0, z: q.z });
    }
    return pts;
  },
  async run(S, { inst }) {
    const g = S.g;
    const pts = RACES.course(g, inst);
    const L = pts.reduce((s, p, i) => s + (i ? Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : Math.hypot(p.x - S.pos.x, p.z - S.pos.z)), 0);
    const ghostTime = L / 8.5;
    const pello = cast(S, 'pello', { x: S.pos.x + 1.5, z: S.pos.z + 1.5 });
    pello.name = 'Pello (fantasma)';
    pello.model.root.traverse((m) => {
      if (m.isMesh && m.material) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.opacity = 0.45;
      }
    });
    if (S.state.flags.pello === 'entregado') S.line('JON', 'Pello ya no corre por aquí. Pero me acuerdo de su ruta.', 3);
    else S.line('PELLO', '¡A ver si me pillas!', 2);
    const t = await race(S, pts, { limit: ghostTime * 2.2, ghost: pello, ghostTime, text: 'Carrera de tejados' });
    return { medal: medalFor(t, { gold: ghostTime, silver: ghostTime * 1.3, bronze: ghostTime * 1.8 }, true), score: `${t.toFixed(1)} s · Pello ${ghostTime.toFixed(1)} s` };
  },
};

// --- F · Buzones muertos (búsqueda por fotos) -----------------------------------
export const DROPS = {
  id: 'cero-act-drops', act: 'cero-drop', kind: 'act', repeat: true, title: 'Buzón muerto', after: ['torre:cero'],
  /** Se empieza en una cabina; el buzón está en otra parte. */
  spots: (d) => d.districts.get('cero').world.cabinas.slice(0, 6).map((b) => ({ ...b.position })),
  hidden: (g) => spotsOf({ game: g }, 'drops', (gg) => spreadSpots(gg, 6, 606, { minSep: 260 })),
  async run(S, { inst }) {
    const g = S.g;
    const drop = DROPS.hidden(g)[inst];
    const pkg = S.prop(new Package({ x: drop.x, z: drop.z, glow: false, color: 0x7a5a3a }));
    // Foto desde la calle, a unos metros del buzón
    const sp = streets.project(drop.x, drop.z);
    const from = { x: drop.x - sp.dir.x * 9 + sp.side.x * 2, y: 1.8, z: drop.z - sp.dir.z * 9 + sp.side.z * 2 };
    const url = snapshot(g, from, { x: drop.x, y: 1.2, z: drop.z });
    showPhoto(url, 'Encuentra este sitio');
    S.every(() => {});
    const t0 = S.d.time;
    S.countdown(300, 'El mensaje se ha perdido');
    try {
      await S.until(() => {
        const d = Math.hypot(S.pos.x - drop.x, S.pos.z - drop.z);
        S.objective('Encuentra el sitio de la foto', [d < 25 ? 'Estás cerca' : 'Sin marcador: mira la foto']);
        pkg.object3d.visible = d < 25;
        return d < 3;
      });
      await S.interact(drop, 'Recoger el mensaje', 2.4);
    } finally {
      showPhoto(null);
    }
    const t = S.d.time - t0;
    return { medal: medalFor(t, { gold: 90, silver: 150, bronze: 300 }, true), score: fmt(t) };
  },
};

export const ACTIVITIES = [BASES, TRAM, CABINAS, CAMS, RACES, DROPS];
