import * as THREE from 'three';
import { rockTexture, woodTexture, grassTexture, rng } from '../textures.js';
import { deco, gableRoof, staticMesh, rockGeometry, climbMark } from './common.js';
import { glowSprite } from '../../vfx/glowTexture.js';

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
  };
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
