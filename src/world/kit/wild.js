import * as THREE from 'three';
import { rockTexture, woodTexture, grassTexture, dirtTexture, veinTexture, waterfallTexture, hazardTexture, textTexture, rng } from '../textures.js';
import { deco, gableRoof, staticMesh, rockGeometry, climbMark } from './common.js';
import { glowSprite, glowTexture } from '../../vfx/glowTexture.js';

/**
 * KIT DE NATURALEZA (propuesta de rediseño del bosque): cabañas de troncos,
 * campamento con hoguera (los campamentos base de Tomb Raider), puente de
 * cuerda transitable, paredes de cañón con estratos y repisas marcadas, y
 * troncos caídos. Ambiente de los bosques canadienses de Wolverine.
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

export function wildMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    rock: std({ map: tex(rockTexture('#6e6a63', 83)), roughness: 1, flatShading: true }),
    rockDark: std({ map: tex(rockTexture('#4d4a46', 84)), roughness: 1, flatShading: true }),
    rockWarm: std({ map: tex(rockTexture('#7d6a58', 85)), roughness: 1, flatShading: true }),
    log: std({ map: tex(woodTexture('#5b4330', 73)), roughness: 0.95 }),
    plank: std({ map: tex(woodTexture('#7a5a3c', 74)), roughness: 0.9 }),
    shingle: std({ color: 0x3a3430, roughness: 0.95 }),
    grass: std({ map: tex(grassTexture('#4b5d3d', 81)), roughness: 1 }),
    snow: std({ color: 0xeef3f7, roughness: 0.85 }),
    rope: std({ color: 0xa88c62, roughness: 1 }),
    whiteMark: std({ color: 0xf2efe6, roughness: 0.6, emissive: 0x2a2a28 }),
    ember: std({ color: 0x2a1408, emissive: 0xff7a2a, emissiveIntensity: 2.5 }),
    window: std({ color: 0x2a2018, emissive: 0xffb35c, emissiveIntensity: 1.6 }),
    tarp: std({ color: 0x3d5a4a, roughness: 0.9, side: THREE.DoubleSide }),
    metal: std({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 }),
    moss: std({ map: tex(grassTexture('#56693e', 87)), roughness: 1 }),
    dirt: std({ map: tex(dirtTexture('#6a5440', 95)), roughness: 1 }),
    plankLight: std({ map: tex(woodTexture('#9a7a56', 75)), roughness: 0.85 }),
    // Roca que solo rompe la Energía: vetas azules que laten (lenguaje común a todo el juego)
    veinRock: std({ map: tex(rockTexture('#55524e', 86)), emissiveMap: veinTexture(5), emissive: 0x58b8ff, emissiveIntensity: 2.2, roughness: 1, flatShading: true }),
    tape: std({ map: tex(hazardTexture()), roughness: 0.7, side: THREE.DoubleSide }),
    sign: std({ map: textTexture(['ZONA RESTRINGIDA', 'PDC · PASO CERRADO'], { width: 512, height: 192, bg: 'rgba(214,206,186,1)', fg: '#1a2230', accent: '#b8322a' }), roughness: 0.8 }),
    tarpOrange: std({ color: 0xb8642a, roughness: 0.9, side: THREE.DoubleSide }),
    relic: std({ color: 0x2a2010, emissive: 0xffc46a, emissiveIntensity: 2.4 }),
  };
}

/**
 * Roca de cima plana: piedras del arroyo, pilares y repisas. Devuelve la
 * geometría y la altura local de la cima (para alinear la colisión).
 */
export function flatRock(sx, sy, sz, seed, detail = 1, flat = 0.75) {
  const geo = rockGeometry(sx, sy, sz, seed, detail);
  const p = geo.attributes.position;
  const cap = sy * flat;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > cap) p.setY(i, cap);
  geo.computeVertexNormals();
  return { geo, top: cap };
}

/** Piedras para cruzar el arroyo saltando. `stones`: [{ x, z, top, s }]. */
export function steppingStones(ctx, M, stones) {
  const { group, world } = ctx;
  stones.forEach((st, i) => {
    const s = st.s ?? 1;
    const { geo, top } = flatRock(0.75 * s, 0.9, 0.65 * s, 70 + i * 3, 1);
    const m = staticMesh(group, geo, i % 2 ? M.rock : M.rockWarm);
    m.position.set(st.x, st.top - top, st.z);
    m.rotation.y = i * 1.3;
    // Musgo en la cima
    const moss = flatRock(0.5 * s, 0.12, 0.42 * s, 90 + i, 0, 0.5);
    const mm = staticMesh(group, moss.geo, M.moss, { cast: false });
    mm.position.set(st.x + 0.08, st.top - moss.top + 0.02, st.z - 0.05);
    world.addBox({ x: st.x - 0.55 * s, y: st.top - 2.5, z: st.z - 0.5 * s }, { x: st.x + 0.55 * s, y: st.top, z: st.z + 0.5 * s }, { climbable: false });
  });
}

/** Pilar de roca (saltos entre pilares sobre un barranco). Cima plana a `top`. */
export function rockPillar(ctx, M, { x, z, top, bottom, r = 1.2, seed = 1 }) {
  const { group, world } = ctx;
  const h = top - bottom;
  const parts = Math.max(2, Math.round(h / 3.5));
  for (let k = 0; k < parts; k++) {
    const t = k / parts;
    const sy = (h / parts) * 0.75;
    const w = r * (1.15 - t * 0.2) * (0.9 + ((k * 7 + seed) % 3) * 0.08);
    const m = staticMesh(group, rockGeometry(w, sy, w * 0.9, seed * 10 + k, 1), k % 2 ? M.rock : M.rockWarm);
    m.position.set(x + Math.sin(k * 2.1 + seed) * 0.15, bottom + (k + 0.5) * (h / parts), z + Math.cos(k * 1.7 + seed) * 0.15);
  }
  const cap = flatRock(r * 1.05, 1.1, r * 0.95, seed * 10 + 9, 1, 0.7);
  const cm = staticMesh(group, cap.geo, M.rockWarm);
  cm.position.set(x, top - cap.top, z);
  const moss = flatRock(r * 0.75, 0.14, r * 0.7, seed * 10 + 8, 0, 0.5);
  const mm = staticMesh(group, moss.geo, M.moss, { cast: false });
  mm.position.set(x, top - moss.top + 0.03, z);
  world.addBox({ x: x - r * 0.8, y: bottom, z: z - r * 0.75 }, { x: x + r * 0.8, y: top, z: z + r * 0.75 }, { climbable: true });
}

/**
 * Roca agrietada con vetas de energía: bloquea el paso hasta que un disparo
 * de Energía la revienta (en el juego, FragileDebris). Brillo azul que late.
 */
export function crackedBoulder(ctx, M, { x, y, z, r = 1.6, seed = 3 }) {
  const { group, world } = ctx;
  const g = new THREE.Group();
  const main = new THREE.Mesh(rockGeometry(r, r * 0.9, r * 0.85, seed, 1), M.veinRock);
  main.position.set(x, y + r * 0.55, z);
  main.castShadow = true;
  main.receiveShadow = true;
  g.add(main);
  for (let i = 0; i < 3; i++) {
    const s = r * (0.35 + i * 0.1);
    const m = new THREE.Mesh(rockGeometry(s, s * 0.8, s, seed + 10 + i, 0), i === 1 ? M.veinRock : M.rockDark);
    m.position.set(x + Math.cos(i * 2.2) * r * 0.9, y + s * 0.35, z + Math.sin(i * 2.2) * r * 0.9);
    m.castShadow = true;
    g.add(m);
  }
  const glow = glowSprite(new THREE.Color(0x58b8ff), r * 3.2, 0.45);
  glow.position.set(x, y + r * 0.6, z);
  g.add(glow);
  const light = new THREE.PointLight(0x6fc3ff, 5, r * 5, 1.6);
  light.position.set(x, y + r * 1.2, z);
  g.add(light);
  group.add(g);
  world.addBox({ x: x - r * 0.9, y, z: z - r * 0.85 }, { x: x + r * 0.9, y: y + r * 1.4, z: z + r * 0.85 }, { climbable: false });
  const t0 = seed;
  return {
    update(dt, time) {
      const k = 0.75 + 0.25 * Math.sin(time * 2.4 + t0);
      M.veinRock.emissiveIntensity = 2.2 * k;
      glow.material.opacity = 0.45 * k;
      light.intensity = 5 * k;
    },
  };
}

/**
 * Barricada de tablones (la PDC cortó la senda): postes, tablones clavados
 * en cruz, cinta de aviso y cartel. Se rompe a golpes (madera clara = frágil).
 * Cruza la senda a lo largo de z (ancho `w`) en x.
 */
export function plankBarricade(ctx, M, { x, y = 0, z, w = 5, h = 2.4 }) {
  const { group, world } = ctx;
  for (const dz of [-w / 2, 0, w / 2]) deco(group, { x, y: y - 0.3, z: z + dz, w: 0.22, h: h + 0.5, d: 0.22, mat: M.log });
  for (let i = 0; i < 4; i++) deco(group, { x: x + 0.14, y: y + 0.35 + i * 0.52, z, w: 0.06, h: 0.32, d: w + 0.4, mat: M.plankLight, rx: (i % 2 ? 0.05 : -0.04) });
  for (const sgn of [-1, 1]) deco(group, { x: x + 0.22, y: y + h / 2 - 0.2, z, w: 0.06, h: 0.26, d: Math.hypot(w, h) * 0.95, mat: M.plank, rx: sgn * Math.atan2(h, w) });
  // Tablón roto y astillas en el suelo
  deco(group, { x: x + 0.9, y, z: z + 1.1, w: 0.3, h: 0.06, d: 1.6, mat: M.plankLight, ry: 0.5 });
  // Cinta de aviso y cartel de la PDC
  deco(group, { x: x + 0.3, y: y + 1.05, z, w: 0.02, h: 0.12, d: w + 0.2, mat: M.tape, cast: false });
  deco(group, { x: x + 0.3, y: y + 1.55, z: z - 0.6, w: 0.04, h: 0.6, d: 1.6, mat: M.sign, cast: false });
  world.addBox({ x: x - 0.2, y, z: z - w / 2 - 0.2 }, { x: x + 0.4, y: y + h, z: z + w / 2 + 0.2 }, { climbable: false });
}

/**
 * Cascada: dos láminas de agua que se desplazan hacia abajo (curvadas hacia
 * fuera por la caída), espuma y bruma al pie. `ry` orienta la cara (+Z local).
 * Devuelve la entidad (update) para animarla.
 */
export function waterfall(ctx, { x, z, top, bottom, width = 4, ry = 0, lip = 0.35 }) {
  const { group } = ctx;
  const g = new THREE.Group();
  g.position.set(x, bottom, z);
  g.rotation.y = ry;
  const h = top - bottom;
  const sheets = [];
  for (const [k, speed, opacity, off] of [[0, 0.9, 0.85, 0], [1, 1.35, 0.5, 0.12]]) {
    const geo = new THREE.PlaneGeometry(width * (1 - k * 0.15), h, 1, 16);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const drop = h / 2 - p.getY(i);
      p.setZ(i, lip * Math.sqrt(Math.max(0, drop)) + off);
      p.setY(i, p.getY(i) + h / 2);
    }
    geo.computeVertexNormals();
    const map = waterfallTexture(3 + k).clone();
    map.needsUpdate = true;
    map.repeat.set(width / 3, h / 5);
    const mat = new THREE.MeshStandardMaterial({
      map, color: 0xeaf6fa, transparent: true, opacity, depthWrite: false, roughness: 0.25,
      emissive: 0x3a5560, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    g.add(m);
    sheets.push({ map, speed });
  }
  // Bruma y espuma al pie
  const mistTex = glowTexture();
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xf2f8fa, transparent: true, opacity: 0.3, depthWrite: false }));
    const s = width * (0.8 + (i % 3) * 0.35);
    sp.scale.set(s, s * 0.7, 1);
    sp.position.set((i / 6 - 0.5) * width * 1.2, 0.6 + (i % 2) * 0.8, lip * Math.sqrt(h) + 0.4);
    g.add(sp);
    puffs.push({ sp, s, ph: i * 1.7 });
  }
  const foam = new THREE.Mesh(new THREE.CircleGeometry(width * 0.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: mistTex, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  foam.position.set(0, 0.05, lip * Math.sqrt(h) + 0.3);
  g.add(foam);
  group.add(g);
  return {
    update(dt) {
      for (const s of sheets) s.map.offset.y += dt * s.speed;
      const t = performance.now() / 1000;
      for (const p of puffs) {
        const k = 1 + 0.12 * Math.sin(t * 1.3 + p.ph);
        p.sp.scale.set(p.s * k, p.s * 0.7 * k, 1);
        p.sp.material.opacity = 0.24 + 0.08 * Math.sin(t * 0.9 + p.ph);
      }
    },
  };
}

/** Torre de caza de troncos con escalera de mano (mirador y coleccionable arriba). */
export function huntersTower(ctx, B, M, { x, y = 0, z, h = 6, ry = 0 }) {
  const { group, world } = ctx;
  const half = 1.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = staticMesh(group, new THREE.CylinderGeometry(0.13, 0.18, h + 0.4, 7), M.log);
    leg.position.set(x + sx * (half - 0.15), y + h / 2, z + sz * (half - 0.15));
    leg.rotation.set(sz * 0.05, 0, -sx * 0.05);
  }
  // Riostras en cruz en dos caras
  for (const sz of [-1, 1]) {
    for (const sgn of [-1, 1]) deco(group, { x, y: y + h * 0.25, z: z + sz * (half - 0.15), w: Math.hypot(half * 2, h * 0.55), h: 0.1, d: 0.1, mat: M.log, rz: sgn * Math.atan2(h * 0.55, half * 2) });
  }
  // Plataforma, barandilla y tejadillo
  B.block({ x, z, w: half * 2 + 0.4, d: half * 2 + 0.4, y: y + h - 0.2, h: 0.2, mat: M.plank });
  for (const [dx, dz, w, d] of [[0, -half - 0.15, half * 2 + 0.4, 0.08], [0, half + 0.15, half * 2 + 0.4, 0.08], [-half - 0.15, 0, 0.08, half * 2 + 0.4]]) {
    deco(group, { x: x + dx, y: y + h + 0.9, z: z + dz, w, h: 0.1, d, mat: M.log });
    deco(group, { x: x + dx, y: y + h + 0.3, z: z + dz, w, h: 0.5, d, mat: M.plank });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: x + sx * half, y: y + h, z: z + sz * half, w: 0.1, h: 2.2, d: 0.1, mat: M.log });
  gableRoof(ctx, { x, z, w: half * 2, d: half * 2, y: y + h + 2.2, rise: 0.9, overhang: 0.4, along: 'z', roofMat: M.shingle, wallMat: M.plank, collide: false });
  // Escalera de mano (cara +X), trepable
  const lx = x + half + 0.3;
  for (const dz of [-0.35, 0.35]) deco(group, { x: lx, y, z: z + dz, w: 0.08, h: h + 1, d: 0.08, mat: M.log });
  for (let yy = 0.35; yy < h + 0.8; yy += 0.4) deco(group, { x: lx, y: y + yy, z, w: 0.06, h: 0.05, d: 0.7, mat: M.plankLight, cast: false });
  world.addBox({ x: lx - 0.1, y, z: z - 0.4 }, { x: lx + 0.1, y: y + h, z: z + 0.4 }, { climbable: true });
  void ry;
  return { top: y + h };
}

/** Tienda de campaña de lona (dos faldones en A). */
export function tent(ctx, M, { x, y = 0, z, ry = 0, mat }) {
  const { group } = ctx;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 2.6), mat ?? M.tarp);
    m.position.set(sx * 0.6, 0.62, 0);
    m.rotation.z = sx * 0.95;
    m.castShadow = true;
    m.userData.levelStatic = !(mat ?? M.tarp).transparent;
    g.add(m);
  }
  for (const dz of [-1.25, 1.25]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), M.log);
    p.position.set(0, 0.65, dz);
    g.add(p);
  }
  group.add(g);
}


/** Cabaña de troncos con porche, chimenea de piedra y ventana encendida. */
export function logCabin(ctx, B, M, { x, z, w = 7, d = 5.5, h = 3, ry = 0 }) {
  const { group } = ctx;
  B.block({ x, z, w, d, h, mat: M.log });
  // Troncos horizontales (relieve) y esquinas cruzadas
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  for (let y = 0.2; y < h; y += 0.36) {
    for (const [lx, lz, len, rot] of [[0, -d / 2 - 0.05, w + 0.6, 0], [0, d / 2 + 0.05, w + 0.6, 0], [-w / 2 - 0.05, 0, d + 0.6, Math.PI / 2], [w / 2 + 0.05, 0, d + 0.6, Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 7).rotateZ(Math.PI / 2), M.log);
      m.position.set(lx, y, lz);
      m.rotation.y = rot;
      m.castShadow = true;
      m.userData.levelStatic = true;
      g.add(m);
    }
  }
  group.add(g);
  gableRoof(ctx, { x, z, w, d, y: h, rise: 1.8, overhang: 0.6, along: 'x', roofMat: M.shingle, wallMat: M.log });
  // Chimenea de piedra
  const ch = staticMesh(group, rockGeometry(0.7, 3, 0.7, Math.round(x + z), 0), M.rock);
  ch.position.set(x - w / 2 + 0.2, 1.6, z);
  deco(group, { x: x - w / 2 + 0.2, y: 0, z, w: 1.2, h: h + 2.4, d: 1.2, mat: M.rockDark });
  // Porche y ventana
  deco(group, { x, y: 0, z: z + d / 2 + 1, w: w, h: 0.25, d: 2, mat: M.plank });
  for (const sx of [-1, 1]) deco(group, { x: x + sx * (w / 2 - 0.3), y: 0, z: z + d / 2 + 1.8, w: 0.2, h: h, d: 0.2, mat: M.log });
  deco(group, { x: x + 1.4, y: 1.1, z: z + d / 2 + 0.12, w: 1, h: 0.9, d: 0.05, mat: M.window, cast: false });
  deco(group, { x: x - 1, y: 0.25, z: z + d / 2 + 0.12, w: 1, h: 2, d: 0.06, mat: M.plank, cast: false });
}

/** Hoguera de campamento: piedras, leña, brasas, resplandor y luz cálida. */
export function campfire(ctx, M, { x, z, y = 0, light = true }) {
  const { group } = ctx;
  const r = rng(Math.round(x * 7 + z));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = staticMesh(group, rockGeometry(0.22, 0.16, 0.2, i + 3, 0), M.rockDark);
    s.position.set(x + Math.cos(a) * 0.7, y + 0.08, z + Math.sin(a) * 0.7);
  }
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1, 6), M.log);
    l.position.set(x, y + 0.25, z);
    l.rotation.set(1.1, (i / 4) * Math.PI * 2 + r(), 0);
    l.castShadow = true;
    group.add(l);
  }
  const ember = staticMesh(group, new THREE.SphereGeometry(0.32, 8, 6), M.ember, { cast: false });
  ember.position.set(x, y + 0.1, z);
  ember.scale.y = 0.4;
  const glow = glowSprite(new THREE.Color(0xff8a3a).multiplyScalar(1.6), 2.6, 0.9);
  glow.position.set(x, y + 0.6, z);
  group.add(glow);
  let pl = null;
  if (light) {
    pl = new THREE.PointLight(0xff9a50, 12, 14, 1.6);
    pl.position.set(x, y + 1, z);
    group.add(pl);
  }
  // Troncos para sentarse
  for (const a of [0.4, 2.3, 4.2]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 8).rotateZ(Math.PI / 2), M.log);
    seat.position.set(x + Math.cos(a) * 1.8, y + 0.22, z + Math.sin(a) * 1.8);
    seat.rotation.y = -a + Math.PI / 2;
    seat.castShadow = true;
    group.add(seat);
  }
  const t0 = r() * 10;
  return {
    update(dt, time) {
      const f = 0.85 + Math.sin(time * 13 + t0) * 0.08 + Math.sin(time * 7.3) * 0.07;
      glow.material.opacity = 0.75 * f;
      if (pl) pl.intensity = 12 * f;
    },
  };
}

/**
 * Puente de cuerda que cuelga (catenaria) entre dos puntos: tablones,
 * cuerdas y postes. Se puede cruzar: una rampa de colisión por tramo.
 */
export function ropeBridge(ctx, M, { from, to, width = 1.6, sag = 1.2, segments = 16 }) {
  const { group, world } = ctx;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  const ry = -Math.atan2(dz, dx);
  const ux = dx / len;
  const uz = dz / len;
  const yAt = (t) => from.y + (to.y - from.y) * t - sag * 4 * t * (1 - t);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({ x: from.x + dx * t, y: yAt(t), z: from.z + dz * t });
  }
  for (let i = 0; i < segments; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const pitch = Math.atan2(b.y - a.y, len / segments);
    const m = deco(group, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 0.05, z: (a.z + b.z) / 2, w: seg * 0.86, h: 0.08, d: width, mat: M.plank, ry, rz: pitch });
    void m;
    // Colisión: una rampa a lo largo del eje dominante
    const minX = Math.min(a.x, b.x) - Math.abs(uz) * width / 2;
    const maxX = Math.max(a.x, b.x) + Math.abs(uz) * width / 2;
    const minZ = Math.min(a.z, b.z) - Math.abs(ux) * width / 2;
    const maxZ = Math.max(a.z, b.z) + Math.abs(ux) * width / 2;
    const axis = Math.abs(ux) >= Math.abs(uz) ? 'x' : 'z';
    const lowFirst = axis === 'x' ? (a.x < b.x) : (a.z < b.z);
    world.addRamp({ minX, maxX, minZ, maxZ, axis, y0: lowFirst ? a.y : b.y, y1: lowFirst ? b.y : a.y, base: Math.min(a.y, b.y) - 0.3 });
  }
  // Cuerdas laterales (pasamanos) y péndolas
  for (const side of [-1, 1]) {
    const ox = -uz * side * (width / 2 + 0.05);
    const oz = ux * side * (width / 2 + 0.05);
    for (let i = 0; i < segments; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const pitch = Math.atan2(b.y - a.y, len / segments);
      deco(group, { x: (a.x + b.x) / 2 + ox, y: (a.y + b.y) / 2 + 0.95, z: (a.z + b.z) / 2 + oz, w: seg, h: 0.04, d: 0.04, mat: M.rope, ry, rz: pitch, cast: false });
      deco(group, { x: a.x + ox, y: a.y, z: a.z + oz, w: 0.03, h: 0.95, d: 0.03, mat: M.rope, cast: false });
    }
    for (const p of [from, to]) deco(group, { x: p.x + ox, y: p.y - 1, z: p.z + oz, w: 0.25, h: 2.4, d: 0.25, mat: M.log });
  }
  // Los bordes no se agarran: barandillas de cuerda (invisibles) para no caer
  return { pts };
}

/**
 * Pared de cañón: bloques de roca apilados en estratos con repisas (algunas
 * marcadas en blanco: ruta de escalada). Decorado sobre una caja de colisión.
 * La cara mira hacia `face` (+1: +X, −1: −X) entre z0 y z1.
 */
export function canyonWall(ctx, B, M, { x, z0, z1, h, face = 1, depth = 6, seed = 1, marks = [] }) {
  const { group } = ctx;
  const r = rng(seed);
  const zc = (z0 + z1) / 2;
  B.block({ x: x - face * depth / 2, z: zc, w: depth, d: z1 - z0, h, y: -1, mat: M.rockDark, climbable: true });
  // Estratos: hileras de masas de roca que sobresalen un poco de la cara
  for (let y = 0; y < h; y += 2.2 + r() * 1.4) {
    const mat = r() < 0.5 ? M.rock : M.rockWarm;
    for (let zz = z0; zz < z1; zz += 3 + r() * 3) {
      const sx = 0.8 + r() * 1.2;
      const sy = 0.8 + r() * 1.1;
      const sz = 1.6 + r() * 2;
      const m = staticMesh(group, rockGeometry(sx, sy, sz, Math.round(seed * 100 + y * 13 + zz), 1), mat);
      m.position.set(x - face * (sx * 0.55), y + sy * 0.6, zz + sz * 0.5);
    }
  }
  // Repisas marcadas (Tomb Raider): franja blanca en el borde agarrable
  for (const mk of marks) climbMark(group, M.whiteMark, { x: x + face * 0.02, y: mk.y, z: mk.z, w: 0.1, d: mk.len ?? 1.4 });
}

/** Tronco caído con raíces (cobertura y obstáculo). */
export function fallenLog(ctx, B, M, { x, z, len = 7, ry = 0, r = 0.45 }) {
  const { group } = ctx;
  const m = staticMesh(group, new THREE.CylinderGeometry(r, r * 1.15, len, 9).rotateZ(Math.PI / 2), M.log);
  m.position.set(x, r * 0.9, z);
  m.rotation.y = ry;
  const roots = staticMesh(group, rockGeometry(r * 1.6, r * 1.6, r * 1.2, Math.round(x * 3 + z), 0), M.log);
  roots.position.set(x + Math.cos(ry) * len / 2, r, z - Math.sin(ry) * len / 2);
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  B.block({ x, z, w: len * c + r * 2 * s, d: len * s + r * 2 * c, h: r * 1.8, mat: M.log, collide: true, climbable: true }).visible = false;
}
