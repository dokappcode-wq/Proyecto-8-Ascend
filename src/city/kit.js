import * as THREE from 'three';
import { Ring } from './props.js';

/**
 * Piezas de misión reutilizables (historia, secundarias, actividades y
 * sucesos de cualquier barrio). Todas reciben el guion `S` (CityScript) y
 * respetan la cancelación (fallo, abandono).
 */

/** Reloj del guion: devuelve los segundos desde la última llamada. */
export function clock(S) {
  let last = S.d.time;
  return () => {
    const dt = S.d.time - last;
    last = S.d.time;
    return dt;
  };
}

/** ¿Hay sitio libre (sin edificio) en (x, z)? */
export function freeAt(game, x, z, r = 0.6) {
  return game.world.groundHeight(x, z, r, 40) <= 0.35;
}

/**
 * Punto en la calle cerca de (x, z): en la acera (o en la calzada con
 * `road`), siempre fuera de los edificios.
 */
export function streetSpot(game, streets, x, z, { margin = 1.6, road = false } = {}) {
  const p = streets.project(x, z);
  if (!p) return { x, y: 0, z, yaw: 0 };
  const s = Math.sign((x - p.x) * p.side.x + (z - p.z) * p.side.z) || 1;
  const yawToStreet = Math.atan2(-p.side.x * s, -p.side.z * s);
  const off0 = road ? Math.min(p.w / 2 - 1, Math.hypot(x - p.x, z - p.z)) : p.w / 2 + margin;
  for (let off = off0; off >= -1; off -= 1.2) {
    const q = { x: p.x + p.side.x * off * s, z: p.z + p.side.z * off * s };
    if (freeAt(game, q.x, q.z)) return { x: q.x, y: 0, z: q.z, yaw: yawToStreet };
  }
  return { x: p.x, y: 0, z: p.z, yaw: yawToStreet };
}

/**
 * `n` puntos de calle alrededor de `c`, entre `minD` y `maxD` metros
 * (recorriendo la red de calles, así llegan por la calle y no por dentro de
 * un edificio).
 */
export function spotsAround(S, c, n, minD = 25, maxD = 60, rnd = Math.random) {
  const out = [];
  const st = S.streets;
  for (let k = 0; k < n * 8 && out.length < n; k++) {
    const walk = st.wander(c.x, c.z, 3 + (k % 7), rnd);
    for (let i = walk.length - 1; i >= 0; i--) {
      const q = walk[i];
      const d = Math.hypot(q.x - c.x, q.z - c.z);
      if (d < minD || d > maxD) continue;
      const jx = q.x + (rnd() - 0.5) * 6;
      const jz = q.z + (rnd() - 0.5) * 6;
      if (out.some((o) => Math.hypot(o.x - jx, o.z - jz) < 4)) continue;
      const sp = streetSpot(S.g, st, jx, jz, { road: true });
      out.push({ ...sp, yaw: Math.atan2(c.x - sp.x, c.z - sp.z) });
      break;
    }
  }
  // Si la red es pequeña, se completa en círculo
  while (out.length < n) {
    const a = rnd() * Math.PI * 2;
    const r = minD + rnd() * (maxD - minD);
    out.push(streetSpot(S.g, st, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, { road: true }));
  }
  return out;
}

/**
 * Oleadas de enemigos que llegan por las calles. `list`: [[{ type, n, mods }], …].
 * `leash`: si Jon se aleja más de esto del centro, la misión falla.
 */
export async function waves(S, list, { center, label = 'Oleada', text = 'Aguanta', leash = null, minD = 28, maxD = 55, onWave = null } = {}) {
  const all = [];
  for (let i = 0; i < list.length; i++) {
    const wave = list[i];
    const total = wave.reduce((s, w) => s + w.n, 0);
    const spots = spotsAround(S, center, total, minD, maxD);
    const es = [];
    let k = 0;
    for (const w of wave) for (let j = 0; j < w.n; j++) es.push(S.enemy(w.type, spots[k++], { mods: w.mods }));
    all.push(...es);
    onWave?.(i, es);
    S.sfx('radio');
    let t = 0;
    let away = 0;
    const tick = clock(S);
    await S.until(() => {
      const dt = tick();
      t -= dt;
      if (leash) {
        const d = Math.hypot(S.pos.x - center.x, S.pos.z - center.z);
        away = d > leash ? away + dt : 0;
        if (away > 3) {
          S.fail('Te has alejado demasiado');
          return false;
        }
      }
      if (t <= 0) {
        t = 0.25;
        S.objective(`${text} · ${label} ${i + 1}/${list.length}`, [`Quedan ${S.alive(es)} de ${es.length}`, ...(leash ? ['No te alejes'] : [])]);
      }
      return es.every((e) => !e.alive);
    });
  }
  return all;
}

/**
 * Mantener la posición: Jon tiene que quedarse cerca de `p` hasta llenar la
 * barra (`secs`). Fuera del radio, la barra se para (o baja con `decay`).
 */
export async function holdZone(S, p, secs, { radius = 6, text = 'Mantén la posición', decay = 0, extra = () => [] } = {}) {
  let v = 0;
  let t = 0;
  const tick = clock(S);
  await S.until(() => {
    const dt = tick();
    const inside = S.isNear(p, radius, 6);
    v = inside ? v + dt / secs : Math.max(0, v - decay * dt);
    t -= dt;
    if (t <= 0) {
      t = 0.2;
      S.objective(text, [`${Math.min(100, Math.round(v * 100))} %${inside ? '' : ' · vuelve a la zona'}`, ...extra()]);
    }
    return v >= 1;
  });
}

/** Varias interacciones a la vez: se cumple con el índice de la primera que se use. */
export async function interactAny(S, points, label, radius = 2) {
  let picked = -1;
  const its = points.map((p, i) => S.g.interactions.add({ position: { x: p.x, y: (p.y ?? 0) + 1, z: p.z }, radius, label: typeof label === 'function' ? label(i) : label, onInteract: () => (picked = i) }));
  S.d._interactions.push(...its);
  try {
    await S.until(() => picked >= 0);
  } finally {
    for (const it of its) S.g.interactions.remove(it);
    S.d._interactions = S.d._interactions.filter((x) => !its.includes(x));
  }
  return picked;
}

/** Interacción sobre algo que se mueve (posición calculada cada frame). */
export async function interactMoving(S, getPos, label, radius = 2.6) {
  let done = false;
  const it = S.g.interactions.add({ getPosition: getPos, radius, label, onInteract: () => (done = true) });
  S.d._interactions.push(it);
  try {
    await S.until(() => done);
  } finally {
    S.g.interactions.remove(it);
    S.d._interactions = S.d._interactions.filter((x) => x !== it);
  }
}

/**
 * Seguir a alguien sin que te vea: el personaje recorre `route`; si Jon se
 * acerca demasiado (y le ve) o se queda demasiado lejos, la misión falla.
 */
export async function tail(S, npc, route, { tooClose = 9, tooFar = 75, speed = 2.4, text = 'Síguele sin que te vea' } = {}) {
  let done = false;
  // (la velocidad del guion solo cambia en las pruebas, que lo aceleran)
  npc.walkTo(route, { speed: speed * (S.d.speed ?? 1), run: speed > 3.2 }).then(() => (done = true));
  let close = 0;
  let far = 0;
  let t = 0;
  const tick = clock(S);
  await S.until(() => {
    const dt = tick();
    const d = Math.hypot(S.pos.x - npc.position.x, S.pos.z - npc.position.z);
    // Mira hacia atrás de vez en cuando: de cerca y a la vista, te pilla
    const looking = Math.sin(S.d.time * 0.7) > 0.55;
    close = d < tooClose && looking ? close + dt : Math.max(0, close - dt);
    far = d > tooFar ? far + dt : 0;
    if (close > 0.8) S.fail('Te ha visto');
    if (far > 5) S.fail('Le has perdido');
    t -= dt;
    if (t <= 0) {
      t = 0.25;
      S.objective(text, [`Distancia ${Math.round(d)} m`, d < tooClose + 5 ? '¡Demasiado cerca!' : d > tooFar - 15 ? '¡Que no se escape!' : '']);
      S.markers([{ x: npc.position.x, y: npc.position.y, z: npc.position.z, label: npc.name, kind: 'target' }]);
    }
    return done;
  });
}

/**
 * Carrera por aros. `points`: [{x,y,z}…]. Devuelve el tiempo (s). Con
 * `limit` falla si se pasa del tiempo. `ghost` (Npc) corre la misma ruta en
 * `ghostTime` segundos.
 */
export async function race(S, points, { limit = null, ghost = null, ghostTime = 0, text = 'Pasa por los aros' } = {}) {
  const rings = points.map((p, i) => S.prop(new Ring({ x: p.x, y: (p.y ?? 0) + 2, z: p.z, yaw: Math.atan2((points[i + 1] ?? p).x - p.x, (points[i + 1] ?? p).z - p.z) })));
  rings[0].setState('next');
  const t0 = S.d.time;
  if (ghost && ghostTime) {
    const L = points.reduce((s, p, i) => s + (i ? Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) : 0), 0);
    ghost.walkTo(points.map((p) => ({ x: p.x, y: p.y, z: p.z, hop: (p.y ?? 0) > 0.5 })), { speed: Math.max(3, L / ghostTime), run: true });
  }
  const stop = limit ? S.countdown(limit, 'Se acabó el tiempo') : null;
  let i = 0;
  let t = 0;
  const tick = clock(S);
  await S.until(() => {
    const p = S.pos;
    const dt = tick();
    if (rings[i].passed(p)) {
      rings[i].setState('done');
      S.sfx('ui');
      i++;
      if (i < rings.length) rings[i].setState('next');
    }
    t -= dt;
    if (t <= 0 && i < rings.length) {
      t = 0.2;
      S.objective(text, [`Aro ${i + 1}/${rings.length}`, `Tiempo ${(S.d.time - t0).toFixed(1)} s`]);
      const r = rings[i].position;
      S.markers([{ x: r.x, y: r.y - 2, z: r.z, label: `Aro ${i + 1}`, kind: 'target' }]);
    }
    return i >= rings.length;
  });
  stop?.();
  return S.d.time - t0;
}

/**
 * Red de cámaras: las cámaras vigilan (si te ven, alarma) y se rompen con E
 * desde cerca. Regla: ninguna puede ver caer a otra.
 */
export async function cameraNet(S, cams, { text = 'Rompe las cámaras sin que te vean' } = {}) {
  const g = S.g;
  const director = S.d;
  director.setStealth({ guards: cams, lights: [] });
  let broken = 0;
  const its = [];
  for (const cam of cams) {
    const it = g.interactions.add({
      position: { x: cam.position.x, y: 1.4, z: cam.position.z },
      radius: 2.6,
      label: 'Arrancar el cable de la cámara',
      enabled: () => cam.active,
      onInteract: () => {
        // ¿La ve otra cámara activa?
        const witness = cams.find((o) => o !== cam && o.active && o.inCone(cam.position) && director._los(o.eye, { x: cam.position.x, y: 2, z: cam.position.z }));
        if (witness) {
          S.sfx('detected');
          S.fail('Otra cámara lo ha visto');
          return;
        }
        cam.destroy(g);
        S.sfx('zap');
        broken++;
      },
    });
    its.push(it);
    director._interactions.push(it);
  }
  let t = 0;
  const tick = clock(S);
  await S.until(() => {
    t -= tick();
    if (t <= 0) {
      t = 0.25;
      S.objective(text, [`Cámaras ${broken}/${cams.length}`, 'Que ninguna vea caer a otra']);
      S.markers(cams.filter((c) => c.active).map((c) => ({ x: c.position.x, y: 1.4, z: c.position.z, label: 'Cámara', kind: 'target' })));
    }
    return broken >= cams.length;
  });
  director.setStealth(null);
  for (const it of its) g.interactions.remove(it);
}

/**
 * Foto de un sitio (para los buzones muertos): se dibuja la escena desde una
 * cámara virtual y se devuelve una imagen en blanco y negro (data URL).
 */
export function snapshot(game, from, to, { w = 320, h = 200 } = {}) {
  const r = game.renderer;
  const cam = new THREE.PerspectiveCamera(55, w / h, 0.3, 900);
  cam.position.set(from.x, from.y, from.z);
  cam.lookAt(to.x, to.y, to.z);
  // Render en coma flotante (lineal, sin mapeo de tonos): se tonifica a mano
  const gl = r.getContext();
  const float = !!gl.getExtension?.('EXT_color_buffer_float');
  const rt = new THREE.WebGLRenderTarget(w, h, { type: float ? THREE.FloatType : THREE.UnsignedByteType });
  const prev = r.getRenderTarget();
  r.setRenderTarget(rt);
  r.render(game.scene, cam);
  const raw = float ? new Float32Array(w * h * 4) : new Uint8Array(w * h * 4);
  r.readRenderTargetPixels(rt, 0, 0, w, h, raw);
  r.setRenderTarget(prev);
  rt.dispose();
  const k = float ? 1 : 1 / 255;
  const tone = (v) => Math.pow(Math.max(0, v) / (1 + Math.max(0, v)), 1 / 2.2) * 255;
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const L = (raw[i * 4] * 0.3 + raw[i * 4 + 1] * 0.59 + raw[i * 4 + 2] * 0.11) * k * 1.6;
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = tone(L);
  }
  // Niveles automáticos: del 3 % más oscuro al 97 % más claro (contraste de foto en blanco y negro)
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) hist[px[i * 4]]++;
  const level = (q) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= q * w * h) return v;
    return 255;
  };
  const lo = level(0.03);
  const hi = Math.max(lo + 1, level(0.97));
  for (let i = 0; i < w * h; i++) px[i * 4] = Math.max(0, Math.min(255, ((px[i * 4] - lo) / (hi - lo)) * 255));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((h - 1 - y) * w + x) * 4;
      const o = (y * w + x) * 4;
      const l = Math.min(255, px[i] * 1.05 + 6);
      img.data[o] = img.data[o + 1] = img.data[o + 2] = l;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.8);
}

/** Muestra (o quita con null) una foto en pantalla, junto al objetivo. */
export function showPhoto(url, caption = '') {
  let el = document.getElementById('city-photo');
  if (!url) {
    el?.classList.remove('show');
    return;
  }
  if (!el) {
    el = document.createElement('figure');
    el.id = 'city-photo';
    el.className = 'city-photo';
    document.getElementById('hud')?.appendChild(el);
  }
  el.innerHTML = `<img alt="Foto del sitio" src="${url}"><figcaption></figcaption>`;
  el.querySelector('figcaption').textContent = caption;
  el.classList.add('show');
}

/**
 * Modo foto: apuntando (botón derecho) a alguien de la lista, a menos de
 * `range` metros y cerca del centro de la pantalla, E hace la foto.
 * `onPhoto(npc)` decide qué pasa. Devuelve una función para quitarlo.
 */
export function photoMode(S, npcs, onPhoto, { range = 40 } = {}) {
  const g = S.g;
  const pick = () => {
    if (!g.player.aiming) return null;
    const cam = g.camera;
    const f = new THREE.Vector3();
    cam.getWorldDirection(f);
    let best = null;
    for (const n of npcs) {
      if (n.hidden || n.photographed) continue;
      const c = n.center;
      const dx = c.x - cam.position.x;
      const dy = c.y - cam.position.y;
      const dz = c.z - cam.position.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > range) continue;
      const cos = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (cos < Math.cos(THREE.MathUtils.degToRad(5))) continue;
      if (!best || cos > best.cos) best = { n, cos };
    }
    return best?.n ?? null;
  };
  let target = null;
  // Para las pruebas: hacer la foto a alguien concreto (lo mismo que apuntar y pulsar E)
  S.d._photo = { targets: npcs, shoot: (n) => onPhoto(n) };
  const it = g.interactions.add({
    getPosition: () => g.player.motor.position,
    radius: 5,
    label: () => (target ? `Hacer foto · ${target.name}` : null),
    enabled: () => (target = pick()) !== null,
    onInteract: () => {
      if (!target) return;
      S.sfx('camera');
      g.ui.flash?.();
      onPhoto(target);
    },
  });
  S.d._interactions.push(it);
  return () => g.interactions.remove(it);
}
