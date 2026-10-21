import * as THREE from 'three';
import { rockTexture, woodTexture, grassTexture, dirtTexture, veinTexture, waterfallTexture, hazardTexture, textTexture, rng } from '../textures.js';
import { deco, gableRoof, staticMesh, rockGeometry } from './common.js';
import { glowSprite, glowTexture } from '../../vfx/glowTexture.js';

/**
 * KIT DE NATURALEZA (bosque): campamento con hoguera (los campamentos base de
 * Tomb Raider), piedras planas y pilares de roca, cascada, torre de caza y
 * tienda. Ambiente de los bosques canadienses de Wolverine.
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

