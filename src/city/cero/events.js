import { Vehicle, JunctionBox } from '../props.js';
import { spotsAround, streetSpot, interactMoving, clock } from '../kit.js';
import { streets, cast } from './world.js';

/**
 * Distrito Cero · Sucesos: aparecen solos por la calle (cada uno o dos
 * minutos, a 60–130 m de Jon). Si Jon no acude, se resuelven sin él.
 */

/** Punto de calle a una distancia razonable de Jon, por la red de calles. */
function nearby(d, min = 60, max = 130) {
  const p = d.game.player.motor.position;
  for (let k = 0; k < 20; k++) {
    const walk = streets.wander(p.x, p.z, 6 + (k % 6));
    for (let i = walk.length - 1; i >= 0; i--) {
      const q = walk[i];
      const dist = Math.hypot(q.x - p.x, q.z - p.z);
      if (dist >= min && dist <= max) return streetSpot(d.game, streets, q.x, q.z);
    }
  }
  return null;
}

/** Espera a que Jon llegue (o se acaba el suceso sin él). */
async function arrive(S, at, label, secs = 75) {
  const t0 = S.d.time;
  S.markers([{ ...at, label, kind: 'city-event' }]);
  S.objective(label, ['Suceso: acude si quieres']);
  let late = false;
  await S.until(() => {
    if (S.d.time - t0 > secs) late = true;
    return late || S.isNear(at, 22, 10);
  });
  return !late;
}

export const REDADA = {
  id: 'cero-ev-redada', kind: 'event', title: 'Redada', after: ['cero-h2'],
  place: (d) => nearby(d),
  async run(S, { at }) {
    const v = [cast(S, 'vecino', { x: at.x + 1.5, z: at.z }, { id: 'ev-vecino' }), cast(S, 'vecina', { x: at.x - 1.5, z: at.z + 1 }, { id: 'ev-vecina' })];
    v.forEach((n) => n.setPose('kneel'));
    if (!(await arrive(S, at, 'Redada en un portal'))) return { ok: false };
    const es = spotsAround(S, at, 3, 4, 10).map((p) => S.enemy('pdc', p));
    S.objective('Para la redada');
    await S.defeated(es);
    v.forEach((n) => n.setPose('stand'));
    S.line('VECINA', '¡Gracias! Que no se te olvide la cara de este portal.', 2.6);
    return { ok: true };
  },
};

export const CORTO = {
  id: 'cero-ev-corto', kind: 'event', title: 'Cortocircuito', after: ['cero-h2'],
  place: (d) => nearby(d),
  async run(S, { at }) {
    const g = S.g;
    const box = S.prop(new JunctionBox(g, { x: at.x, z: at.z, shootable: false }));
    box.setState('error');
    S.every(() => {
      if (Math.random() < 0.08) g.vfx.sparks.burst(box.center, { count: 6, speed: 5, life: 0.4 });
    });
    if (!(await arrive(S, at, 'Cortocircuito: saqueo a oscuras'))) return { ok: false };
    const es = spotsAround(S, at, 4, 5, 14).map((p) => S.enemy('acolyte', p));
    S.objective('Echa a los saqueadores');
    await S.defeated(es);
    await S.interact(box.position, 'Absorber la carga del armario', 2.4);
    box.setState('on');
    g.powers.energy.value = g.powers.energy.max;
    return { ok: true };
  },
};

export const TRANVIA = {
  id: 'cero-ev-tranvia', kind: 'event', title: 'Tranvía sin frenos', after: ['cero-h4'],
  place: (d) => nearby(d, 50, 100),
  async run(S, { at }) {
    const g = S.g;
    const route = streets.routeThrough([at, ...streets.wander(at.x, at.z, 10).slice(1)]);
    const tram = S.prop(new Vehicle(g, { kind: 'tram', path: route, speed: 11 }));
    tram.target = 11;
    S.objective('¡Un tranvía sin frenos!', ['Corre a su lado y absorbe su carga']);
    let lost = false;
    const off = S.every(() => {
      S.markers([{ ...tram.roofPoint(0), y: 0, label: 'Tranvía' }]);
      if (tram.done) lost = true;
    });
    await Promise.race([
      interactMoving(S, () => ({ ...tram.roofPoint(tram.length / 2 - 1), y: 0.5 }), 'Absorber la carga', 3.2),
      S.until(() => lost),
    ]);
    off();
    if (lost) return { ok: false };
    tram.target = 0;
    tram.accel = 6;
    g.powers.energy.value = g.powers.energy.max;
    S.sfx('discharge');
    S.line('JON', 'Tranquilo… ya está.', 2);
    return { ok: true };
  },
};

export const LLAMADA = {
  id: 'cero-ev-llamada', kind: 'event', title: 'Llamada perdida', after: ['cero-h4'],
  place: (d) => {
    const p = d.game.player.motor.position;
    const booths = d.districts.get('cero').world.cabinas;
    const b = booths.map((x) => ({ x, dd: Math.hypot(x.position.x - p.x, x.position.z - p.z) })).filter((x) => x.dd > 25 && x.dd < 220).sort((a, c) => a.dd - c.dd)[0];
    return b ? { ...b.x.position, booth: b.x } : null;
  },
  async run(S, { at }) {
    const booth = at.booth;
    booth.setRinging(true);
    const ring = S.every(() => {
      if (Math.floor(S.d.time * 0.6) !== booth._lastRing) {
        booth._lastRing = Math.floor(S.d.time * 0.6);
        S.sfx('phone', booth.position);
      }
    });
    S.markers([{ ...at, label: 'Teléfono sonando', kind: 'city-event' }]);
    S.objective('Suena una cabina cercana');
    const t0 = S.d.time;
    let late = false;
    let picked = false;
    const it = S.g.interactions.add({ position: { x: at.x, y: 1, z: at.z }, radius: 2.6, label: 'Contestar', onInteract: () => (picked = true) });
    S.d._interactions.push(it);
    await S.until(() => {
      if (S.d.time - t0 > 45) late = true;
      return picked || late;
    });
    ring();
    booth.setRinging(false);
    S.g.interactions.remove(it);
    S.d._interactions = S.d._interactions.filter((x) => x !== it);
    if (late) return { ok: false };
    const dest = nearby(S.d, 150, 260);
    S.line('CENTRALITA', 'Un paquete en un portal. La PDC va de camino. Llega antes que ellos.', 3.5);
    S.countdown(55, 'La PDC ha llegado antes');
    S.markers([{ ...dest, label: 'Portal' }]);
    S.objective('Llega al portal antes que la PDC');
    await S.interact(dest, 'Recoger el paquete', 2.6);
    return { ok: true };
  },
};

export const EVENTS = [REDADA, CORTO, TRANVIA, LLAMADA];
