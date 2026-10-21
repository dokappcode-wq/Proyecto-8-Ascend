import * as THREE from 'three';
import {
  concreteTexture, metalPlateTexture, hazardTexture, corrugatedTexture, pdcBannerTexture, helipadTexture,
  windowTextures, textTexture, rng,
} from '../textures.js';
import { deco, staticMesh } from './common.js';
import { glowSprite } from '../../vfx/glowTexture.js';

/**
 * KIT DE LA PDC (propuesta de rediseño de la base y del bloqueo del puente):
 * hormigón brutalista con franjas de luz azul (los puestos de la DUP de
 * inFamous Second Son), muro perimetral con pasarela, torres de vigilancia
 * con foco, patio de contenedores con grúa pórtico, camiones, helipuerto con
 * helicóptero, antenas, estandartes y barreras. Todo con colisión donde se pisa.
 */

const tex = (t) => {
  const c = t.clone();
  c.needsUpdate = true;
  c.userData = t.userData;
  return c;
};

/** Malla de alambre en rombos (transparencia recortada: se fusiona como opaca). */
function chainLinkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(190,196,204,1)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 32);
  g.lineTo(32, 0);
  g.lineTo(64, 32);
  g.lineTo(32, 64);
  g.closePath();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { unit: 0.35 };
  return t;
}

export function baseMaterials(night = true) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const wet = night ? 0.55 : 0.9;
  const win = windowTextures('#2a2e34');
  const stripI = night ? 3.2 : 1.2;
  return {
    concrete: std({ map: tex(concreteTexture('#8c8f94', 7)), roughness: 0.92 * wet + 0.05 }),
    concreteDark: std({ map: tex(concreteTexture('#5e636a', 8)), roughness: 0.9 * wet + 0.05 }),
    concreteWarm: std({ map: tex(concreteTexture('#9a948a', 9)), roughness: 0.92 }),
    ground: std({ map: tex(concreteTexture('#5a5e64', 10)), roughness: 0.55 * wet + 0.2 }),
    metal: std({ color: 0x3a3f46, metalness: 0.7, roughness: 0.45 }),
    metalLight: std({ color: 0x8a9096, metalness: 0.6, roughness: 0.5 }),
    rust: std({ map: tex(metalPlateTexture('#6a4a3a', 92)), metalness: 0.4, roughness: 0.7 }),
    plate: std({ map: tex(metalPlateTexture('#4b5560', 91)), metalness: 0.5, roughness: 0.55 }),
    hazard: std({ map: tex(hazardTexture()), roughness: 0.7 }),
    yellow: std({ color: 0xe0b021, metalness: 0.3, roughness: 0.55 }),
    pdcBlue: std({ color: 0x1d4f8f, metalness: 0.3, roughness: 0.5 }),
    pdcDark: std({ color: 0x1a2230, metalness: 0.4, roughness: 0.5 }),
    // Franjas de luz azul de la PDC (bloom de noche)
    strip: std({ color: 0x0a1a30, emissive: 0x3aa0ff, emissiveIntensity: stripI }),
    stripWhite: std({ color: 0x1a1c20, emissive: 0xe6f0ff, emissiveIntensity: night ? 2.4 : 0.8 }),
    window: std({ map: win.map, emissiveMap: win.emissiveMap, emissive: 0xcfe0ff, emissiveIntensity: night ? 1.3 : 0.2, roughness: 0.3 }),
    windowDark: std({ map: win.map, roughness: 0.25, metalness: 0.3 }),
    glass: std({ color: 0x16202c, metalness: 0.6, roughness: 0.12 }),
    skylight: std({ color: 0x0e1824, emissive: 0x9fd0ff, emissiveIntensity: night ? 1.4 : 0.1, roughness: 0.15 }),
    lampGlow: std({ color: 0x2a2a20, emissive: 0xfff2d0, emissiveIntensity: night ? 4 : 0.6 }),
    redLight: std({ color: 0x300808, emissive: 0xff2a1a, emissiveIntensity: night ? 4 : 1.5 }),
    tire: std({ color: 0x18191b, roughness: 0.9 }),
    truck: std({ color: 0x4a5058, metalness: 0.4, roughness: 0.55 }),
    canvas: std({ color: 0x4e5a44, roughness: 0.95 }),
    sandbag: std({ color: 0x8a7a5a, roughness: 1 }),
    banner: std({ map: pdcBannerTexture(), roughness: 0.8, side: THREE.DoubleSide }),
    helipad: std({ map: Object.assign(tex(helipadTexture()), { userData: { unit: 17 } }), roughness: 0.6 * wet + 0.2 }),
    fence: std({ map: chainLinkTexture(), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }),
    heli: std({ color: 0x2a3038, metalness: 0.5, roughness: 0.4 }),
    sign: std({ map: textTexture(['CONTROL PDC', 'IDENTIFÍQUESE'], { width: 512, height: 192 }), roughness: 0.6, emissive: 0x222a33, emissiveMap: null }),
    containers: [
      ['#2a5d8a', 'PDCU 204718'], ['#a8432a', 'MSKU 771204'], ['#c9a23a', 'TGHU 450193'],
      ['#3d6a4a', 'CAIU 832050'], ['#d2d2cc', 'PDCU 990311'], ['#6a6d70', 'TCLU 118274'],
    ].map(([c, code], i) => std({ map: tex(corrugatedTexture(c, 61 + i, code)), metalness: 0.35, roughness: 0.55 * wet + 0.2 })),
  };
}

/**
 * Contenedor marítimo (6.1 × 2.6 × 2.44) con puertas en un extremo. Colisiona
 * y se trepa (cajas del patio para el sigilo). `along`: 'x' o 'z'.
 */
export function container(ctx, B, M, { x, y = 0, z, along = 'x', color = 0, len = 6.1 }) {
  const side = M.containers[color % M.containers.length];
  const w = along === 'x' ? len : 2.44;
  const d = along === 'x' ? 2.44 : len;
  const mats = along === 'x' ? [M.plate, side, side, M.metal, side, side] : [side, side, side, M.metal, M.plate, side];
  B.block({ x, z, w, d, y, h: 2.6, mat: mats, climbable: true });
  // Barras de cierre de las puertas
  for (const k of [-0.5, -0.17, 0.17, 0.5]) {
    if (along === 'x') deco(ctx.group, { x: x + len / 2 + 0.03, y: y + 0.2, z: z + k * 2, w: 0.06, h: 2.2, d: 0.06, mat: M.metalLight, cast: false });
    else deco(ctx.group, { x: x + k * 2, y: y + 0.2, z: z + len / 2 + 0.03, w: 0.06, h: 2.2, d: 0.06, mat: M.metalLight, cast: false });
  }
}

/** Muro perimetral de hormigón con pasarela arriba y pretil exterior. Recto en x o en z. */
export function perimeterWall(ctx, B, M, { x0, z0, x1, z1, y = 0, h = 5, outside = 1 }) {
  const { group } = ctx;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const T = 1.8;
  B.block({ x: cx, z: cz, w: alongX ? len : T, d: alongX ? T : len, y, h, mat: M.concrete, climbable: false });
  // Pretil exterior y franja de luz
  const off = (T / 2 - 0.2) * outside;
  B.block({ x: alongX ? cx : cx + off, z: alongX ? cz + off : cz, w: alongX ? len : 0.4, d: alongX ? 0.4 : len, y: y + h, h: 1.1, mat: M.concreteDark });
  deco(group, { x: alongX ? cx : cx - off * 1.05, y: y + h - 0.5, z: alongX ? cz - off * 1.05 : cz, w: alongX ? len : 0.05, h: 0.12, d: alongX ? 0.05 : len, mat: M.strip, cast: false });
  // Contrafuertes cada 8 m (relieve)
  for (let t = 4; t < len - 2; t += 8) {
    const px = alongX ? Math.min(x0, x1) + t : cx + (T / 2 + 0.3) * outside;
    const pz = alongX ? cz + (T / 2 + 0.3) * outside : Math.min(z0, z1) + t;
    deco(group, { x: px, y, z: pz, w: alongX ? 0.8 : 0.6, h: h - 0.3, d: alongX ? 0.6 : 0.8, mat: M.concreteDark });
  }
}

/** Valla de malla con postes (se ve a través). `gap`: [desde, hasta] hueco roto. */
export function chainFence(ctx, M, { x0, z0, x1, z1, y = 0, h = 2.8, gap = null }) {
  const { group, world } = ctx;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  const c = alongX ? z0 : x0;
  const pieces = gap ? [[a0, gap[0]], [gap[1], a1]] : [[a0, a1]];
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    if (len <= 0) continue;
    const mid = (p0 + p1) / 2;
    const geo = new THREE.PlaneGeometry(len, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 0.35, uv.getY(i) * h / 0.35);
    const m = staticMesh(group, geo, M.fence, { cast: false });
    m.position.set(alongX ? mid : c, y + h / 2, alongX ? c : mid);
    if (!alongX) m.rotation.y = Math.PI / 2;
    for (let p = p0; p <= p1 + 0.01; p += 3) deco(group, { x: alongX ? p : c, y, z: alongX ? c : p, w: 0.08, h: h + 0.3, d: 0.08, mat: M.metal });
    // Alambre de espino arriba
    deco(group, { x: alongX ? mid : c, y: y + h + 0.25, z: alongX ? c : mid, w: alongX ? len : 0.05, h: 0.05, d: alongX ? 0.05 : len, mat: M.metalLight, cast: false });
    world.addBox(
      alongX ? { x: p0, y, z: c - 0.1 } : { x: c - 0.1, y, z: p0 },
      alongX ? { x: p1, y: y + h, z: c + 0.1 } : { x: c + 0.1, y: y + h, z: p1 },
      { climbable: false, cameraBlocking: false },
    );
  }
  // Hueco roto: malla doblada hacia dentro
  if (gap) {
    const mid = (gap[0] + gap[1]) / 2;
    const geo = new THREE.PlaneGeometry(gap[1] - gap[0], h * 0.6);
    const m = staticMesh(group, geo, M.fence, { cast: false });
    m.position.set(alongX ? mid : c + 0.5, y + h * 0.3, alongX ? c + 0.5 : mid);
    m.rotation.set(alongX ? -1.1 : 0, alongX ? 0 : Math.PI / 2, alongX ? 0 : 1.1);
  }
}

/** Torre de vigilancia: patas de acero, garita con ventanas, foco y baliza roja. */
export function watchtower(ctx, B, M, { x, z, y = 0, h = 9, night = true }) {
  const { group } = ctx;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: x + sx * 1.3, y, z: z + sz * 1.3, w: 0.3, h, d: 0.3, mat: M.metal });
  for (const yy of [h * 0.33, h * 0.66]) {
    deco(group, { x, y: yy, z: z - 1.3, w: 2.9, h: 0.15, d: 0.15, mat: M.metal });
    deco(group, { x, y: yy, z: z + 1.3, w: 2.9, h: 0.15, d: 0.15, mat: M.metal });
  }
  B.block({ x, z, w: 3.4, d: 3.4, y: y + h, h: 0.25, mat: M.plate });
  // Garita: muros bajos de chapa, banda de ventanas y techo
  for (const [dx, dz, w, d] of [[0, -1.6, 3.4, 0.15], [0, 1.6, 3.4, 0.15], [-1.6, 0, 0.15, 3.4], [1.6, 0, 0.15, 3.4]]) {
    deco(group, { x: x + dx, y: y + h + 0.25, z: z + dz, w, h: 1.1, d, mat: M.pdcDark });
    deco(group, { x: x + dx, y: y + h + 1.35, z: z + dz, w, h: 0.9, d, mat: night ? M.window : M.glass, cast: false });
  }
  deco(group, { x, y: y + h + 2.25, z, w: 4, h: 0.3, d: 4, mat: M.concreteDark });
  deco(group, { x, y: y + h + 2.2, z, w: 4.02, h: 0.08, d: 4.02, mat: M.strip, cast: false });
  // Mástil y baliza
  deco(group, { x: x + 1.5, y: y + h + 2.55, z: z + 1.5, w: 0.1, h: 2.2, d: 0.1, mat: M.metal });
  deco(group, { x: x + 1.5, y: y + h + 4.75, z: z + 1.5, w: 0.25, h: 0.25, d: 0.25, mat: M.redLight, cast: false });
  if (night) {
    const g = glowSprite(new THREE.Color(0xff3020), 1.6, 0.8);
    g.position.set(x + 1.5, y + h + 4.9, z + 1.5);
    group.add(g);
  }
  return { lamp: { x, y: y + h + 2.9, z } };
}

/** Torre de focos (charcos de luz en el suelo, con zonas oscuras entre ellos). */
export function floodlight(ctx, B, M, { x, z, y = 0, h = 10, aim = { x: 0, z: 0 }, night = true, light = true, color = 0xfff0d8, intensity = 60 }) {
  const { group } = ctx;
  B.block({ x, z, w: 0.5, d: 0.5, y, h, mat: M.metal, cameraBlocking: false });
  deco(group, { x, y: y + h, z, w: 2.4, h: 0.15, d: 0.3, mat: M.metal });
  const dir = new THREE.Vector3(aim.x - x, -h, aim.z - z).normalize();
  for (const k of [-0.8, 0, 0.8]) {
    const lamp = deco(group, { x: x + k, y: y + h + 0.15, z, w: 0.55, h: 0.4, d: 0.3, mat: M.lampGlow, cast: false });
    lamp.lookAt(x + k + dir.x, y + h + dir.y, z + dir.z);
  }
  if (night) {
    const g = glowSprite(new THREE.Color(color), 4, 0.55);
    g.position.set(x, y + h + 0.3, z);
    group.add(g);
  }
  if (night && light) {
    const s = new THREE.SpotLight(color, intensity, h * 3.2, 0.62, 0.55, 1.4);
    s.position.set(x, y + h, z);
    s.target.position.set(aim.x, y, aim.z);
    group.add(s, s.target);
    return s;
  }
  return null;
}

/** Camión de la PDC: cabina, caja con lona, seis ruedas y faros. */
export function truck(ctx, B, M, { x, y = 0, z, ry = 0, pdc = true, lights = false }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const add = (geo, mat, px, py, pz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.levelStatic = true;
    g.add(m);
    return m;
  };
  const body = pdc ? M.pdcDark : M.truck;
  add(new THREE.BoxGeometry(2.2, 1.9, 2.4), body, 3, 1.75, 0); // cabina
  add(new THREE.BoxGeometry(0.05, 0.8, 2.1), M.glass, 4.12, 2.2, 0); // parabrisas
  add(new THREE.BoxGeometry(7, 0.4, 2.5), M.metal, 0.3, 0.85, 0); // chasis
  add(new THREE.BoxGeometry(4.6, 2.3, 2.5), M.canvas, -0.9, 2.2, 0); // caja con lona
  if (pdc) add(new THREE.BoxGeometry(4.62, 0.3, 2.52), M.pdcBlue, -0.9, 1.4, 0);
  for (const wx of [-2.6, -1.3, 3.1]) {
    for (const wz of [-1.15, 1.15]) {
      const w = add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14).rotateX(Math.PI / 2), M.tire, wx, 0.5, wz);
      void w;
    }
  }
  for (const wz of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.06, 0.2, 0.35), M.lampGlow, 4.13, 1.25, wz);
  if (lights) {
    const s = new THREE.SpotLight(0xfff4e0, 30, 30, 0.5, 0.6, 1.4);
    s.position.set(4.2, 1.3, 0);
    s.target.position.set(14, 0, 0);
    g.add(s, s.target);
  }
  ctx.group.add(g);
  // Colisión (caja girada a ejes: solo giros de 90°)
  const along = Math.abs(Math.cos(ry)) > 0.5;
  const cx = x + Math.cos(ry) * 0.3;
  const cz = z - Math.sin(ry) * 0.3;
  B.block({ x: cx, z: cz, w: along ? 7.4 : 2.5, d: along ? 2.5 : 7.4, y, h: 3.3, mat: M.metal, climbable: true }).visible = false;
}

/** Helicóptero de la PDC posado (fuselaje, cola, rotores y patines). */
export function helicopter(ctx, M, { x, y = 0, z, ry = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const add = (geo, mat, px, py, pz, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const body = add(new THREE.SphereGeometry(1.4, 18, 12), M.heli, 0, 1.9, 0);
  body.scale.set(1.9, 1, 1);
  add(new THREE.SphereGeometry(1.0, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 1.6, 1.9, 0, 0, -Math.PI / 2).scale.set(1, 1.1, 1.05);
  add(new THREE.CylinderGeometry(0.22, 0.42, 6, 10).rotateZ(Math.PI / 2), M.heli, -4.6, 2.3, 0);
  add(new THREE.BoxGeometry(1.1, 1.4, 0.12), M.heli, -7.4, 2.9, 0, 0, -0.3);
  add(new THREE.BoxGeometry(0.06, 1.6, 0.2), M.metal, -7.5, 2.9, 0.18);
  add(new THREE.BoxGeometry(2.8, 0.12, 0.04), M.pdcBlue, 0, 1.7, 1.42);
  add(new THREE.BoxGeometry(2.8, 0.12, 0.04), M.pdcBlue, 0, 1.7, -1.42);
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), M.metal, 0, 3.15, 0);
  for (let i = 0; i < 4; i++) {
    const b = add(new THREE.BoxGeometry(5.6, 0.05, 0.32), M.metal, 0, 3.42, 0);
    b.rotation.y = (i * Math.PI) / 2 + 0.3;
    b.position.set(Math.cos(b.rotation.y) * 2.8, 3.42, -Math.sin(b.rotation.y) * 2.8);
  }
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(4.2, 0.1, 0.1), M.metal, 0.2, 0.15, sz * 1.1);
    for (const sx of [-0.9, 1.1]) add(new THREE.BoxGeometry(0.08, 0.75, 0.08), M.metal, sx, 0.5, sz * 0.95, sz * 0.3);
  }
  ctx.group.add(g);
  ctx.world.addBox({ x: x - 3, y, z: z - 1.6 }, { x: x + 3, y: y + 3.2, z: z + 1.6 }, { climbable: false });
}

/** Antena parabólica en un pedestal (orientada al cielo). */
export function dish(ctx, M, { x, y, z, r = 2.2, ry = 0, tilt = 0.9 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.6, 10), M.metal);
  ped.position.y = 0.8;
  g.add(ped);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, 0.75), M.metalLight);
  bowl.material = bowl.material.clone();
  bowl.material.side = THREE.DoubleSide;
  bowl.position.y = 1.6 + r * 0.95;
  bowl.rotation.x = Math.PI + tilt;
  g.add(bowl);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, r * 1.1, 6), M.metal);
  arm.position.set(0, 1.6 + r * 0.95 - Math.cos(tilt) * r * 0.45, Math.sin(tilt) * r * 0.45);
  arm.rotation.x = tilt;
  g.add(arm);
  g.traverse((o) => { o.castShadow = true; });
  ctx.group.add(g);
  return g;
}

/** Radar giratorio (entidad: llamar a update). */
export function radar(ctx, M, { x, y, z }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 10), M.metal);
  base.position.y = 0.6;
  g.add(base);
  const head = new THREE.Group();
  head.position.y = 1.4;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.25), M.metalLight);
  bar.position.z = 0.2;
  head.add(bar);
  const led = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.02), M.strip);
  led.position.set(0, 0, 0.34);
  head.add(led);
  g.add(head);
  g.traverse((o) => { o.castShadow = true; });
  ctx.group.add(g);
  return { update(dt) { head.rotation.y += dt * 0.9; } };
}

/** Estandarte vertical de la PDC colgado de una barra. `ry` orienta la cara. */
export function banner(ctx, M, { x, y, z, ry = 0, w = 1.8, h = 4.2 }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.banner);
  m.position.set(x, y - h / 2, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.userData.levelStatic = true;
  ctx.group.add(m);
  const bar = deco(ctx.group, { x, y: y - 0.04, z, w: w + 0.3, h: 0.08, d: 0.08, mat: M.metal, ry });
  void bar;
}

/** Barrera de hormigón tipo New Jersey con franja de aviso (cobertura baja). */
export function jersey(ctx, B, M, { x, y = 0, z, along = 'x', len = 3 }) {
  const w = along === 'x' ? len : 0.7;
  const d = along === 'x' ? 0.7 : len;
  B.block({ x, z, w, d, y, h: 1.05, mat: M.concrete, climbable: true });
  deco(ctx.group, { x, y: y + 0.55, z, w: w + 0.02, h: 0.22, d: d + 0.02, mat: M.hazard, cast: false });
}

/** Sacos terreros en semicírculo (cobertura). */
export function sandbags(ctx, B, M, { x, y = 0, z, along = 'x', len = 3 }) {
  const r = rng(Math.round(x * 13 + z * 7));
  const n = Math.round(len / 0.75);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < n - (row % 2); i++) {
      const t = -len / 2 + 0.375 + i * 0.75 + (row % 2) * 0.375;
      const p = along === 'x' ? { x: x + t, z: z + (r() - 0.5) * 0.06 } : { x: x + (r() - 0.5) * 0.06, z: z + t };
      deco(ctx.group, { ...p, y: y + row * 0.32, w: along === 'x' ? 0.72 : 0.45, h: 0.32, d: along === 'x' ? 0.45 : 0.72, mat: M.sandbag, ry: (r() - 0.5) * 0.12 });
    }
  }
  ctx.world.addBox({ x: x - (along === 'x' ? len / 2 : 0.3), y, z: z - (along === 'x' ? 0.3 : len / 2) }, { x: x + (along === 'x' ? len / 2 : 0.3), y: y + 0.96, z: z + (along === 'x' ? 0.3 : len / 2) }, { climbable: true });
}

/** Puesto de control: garita, marquesina con luces, barreras levadizas y cartel. Paso a lo largo de z. */
export function gatehouse(ctx, B, M, { x, z, y = 0, w = 10, night = true }) {
  const { group } = ctx;
  // Garita (a un lado)
  const gx = x - w / 2 - 2.2;
  B.block({ x: gx, z, w: 3.2, d: 4, y, h: 1.1, mat: M.concrete });
  for (const [dx, dz, ww, dd] of [[0, -2, 3.2, 0.1], [0, 2, 3.2, 0.1], [1.6, 0, 0.1, 4], [-1.6, 0, 0.1, 4]]) {
    deco(group, { x: gx + dx, y: y + 1.1, z: z + dz, w: ww, h: 1.3, d: dd, mat: night ? M.window : M.glass, cast: false });
  }
  B.block({ x: gx, z, w: 3.6, d: 4.4, y: y + 2.4, h: 0.35, mat: M.concreteDark });
  // Marquesina sobre el paso
  for (const sx of [-1, 1]) B.block({ x: x + sx * (w / 2 + 0.3), z, w: 0.6, d: 0.6, y, h: 5.2, mat: M.concreteDark });
  B.block({ x, z, w: w + 1.6, d: 5, y: y + 5.2, h: 0.6, mat: M.concrete });
  deco(group, { x, y: y + 5.1, z, w: w + 1.6, h: 0.1, d: 5.02, mat: M.strip, cast: false });
  for (const sx of [-0.3, 0, 0.3]) deco(group, { x: x + sx * w, y: y + 5.08, z, w: 1.6, h: 0.05, d: 0.3, mat: M.stripWhite, cast: false });
  deco(group, { x, y: y + 5.85, z: z - 2.52, w: 4.6, h: 1.4, d: 0.06, mat: M.sign, cast: false });
  // Barreras levadizas (bajadas) a rayas
  for (const sz of [-1.6, 1.6]) {
    deco(group, { x: x - w / 2 + 0.2, y, z: z + sz, w: 0.4, h: 1.1, d: 0.4, mat: M.pdcDark });
    deco(group, { x: x + 0.2, y: y + 0.95, z: z + sz, w: w - 0.4, h: 0.14, d: 0.1, mat: M.hazard, cast: false });
  }
  if (night) {
    const l = new THREE.PointLight(0xe6f0ff, 14, 16, 1.4);
    l.position.set(x, y + 4.6, z);
    group.add(l);
  }
}

/**
 * Edificio brutalista de la PDC: masa de hormigón con forjados que asoman,
 * bandas de ventanas encendidas, aletas verticales, franjas de luz azul,
 * rejillas de ventilación (rutas de sigilo) y azotea con lucernario y equipos.
 * Planta x0…x1, z0…z1; `floors` plantas de `fh` m.
 */
export function facility(ctx, B, M, { x0, x1, z0, z1, y = 0, floors = 2, fh = 4, vents = [], night = true }) {
  const { group } = ctx;
  const W = x1 - x0;
  const D = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const H = floors * fh;
  B.block({ x: cx, z: cz, w: W, d: D, y, h: H, mat: M.concrete, climbable: false });
  // Forjados que asoman y bandas de ventanas en las cuatro fachadas
  for (let f = 0; f < floors; f++) {
    const fy = y + f * fh;
    deco(group, { x: cx, y: fy + fh - 0.35, z: cz, w: W + 0.6, h: 0.35, d: D + 0.6, mat: M.concreteDark });
    for (const [nx, nz, len] of [[1, 0, D], [-1, 0, D], [0, 1, W], [0, -1, W]]) {
      const px = cx + nx * (W / 2 + 0.02);
      const pz = cz + nz * (D / 2 + 0.02);
      const n = Math.floor(len / 3.2);
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * (len / n);
        if (vents.some((v) => Math.abs(v.x - (nx ? px : cx + t)) < 2 && Math.abs(v.z - (nz ? pz : cz + t)) < 2 && f === 0)) continue;
        const lit = ((i * 7 + f * 3 + Math.round(len)) % 5) !== 0;
        deco(group, { x: nx ? px : cx + t, y: fy + 1.2, z: nz ? pz : cz + t, w: nx ? 0.06 : 1.9, h: 1.6, d: nx ? 1.9 : 0.06, mat: lit ? M.window : M.windowDark, cast: false });
        // Aleta vertical entre ventanas
        deco(group, { x: nx ? px + nx * 0.3 : cx + t + len / n / 2, y: fy, z: nz ? pz + nz * 0.3 : cz + t + len / n / 2, w: nx ? 0.6 : 0.3, h: fh - 0.35, d: nx ? 0.3 : 0.6, mat: M.concreteWarm });
      }
    }
  }
  // Coronación: franja azul y pretil
  deco(group, { x: cx, y: y + H, z: cz, w: W + 0.8, h: 0.9, d: D + 0.8, mat: M.concreteDark });
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    deco(group, { x: cx + nx * (W / 2 + 0.42), y: y + H + 0.3, z: cz + nz * (D / 2 + 0.42), w: nx ? 0.04 : W + 0.8, h: 0.14, d: nz ? 0.04 : D + 0.8, mat: M.strip, cast: false });
  }
  // Rejillas de ventilación a ras de suelo (entradas de sigilo)
  for (const v of vents) {
    const onX = Math.abs(v.x - x0) < 0.5 || Math.abs(v.x - x1) < 0.5;
    deco(group, { x: v.x + (onX ? (v.x < cx ? -0.05 : 0.05) : 0), y, z: v.z + (onX ? 0 : (v.z < cz ? -0.05 : 0.05)), w: onX ? 0.12 : 1.6, h: 1.2, d: onX ? 1.6 : 0.12, mat: M.plate });
    for (let k = 0; k < 5; k++) deco(group, { x: v.x + (onX ? (v.x < cx ? -0.12 : 0.12) : 0), y: y + 0.15 + k * 0.22, z: v.z, w: onX ? 0.05 : 1.5, h: 0.05, d: onX ? 1.5 : 0.05, mat: M.metal, cast: false });
  }
  // Azotea: lucernario, climatizadores, mástil con balizas
  const roofY = y + H + 0.9;
  B.block({ x: cx - W * 0.2, z: cz, w: 4, d: 6, y: roofY, h: 0.5, mat: M.concreteDark });
  deco(group, { x: cx - W * 0.2, y: roofY + 0.5, z: cz, w: 3.4, h: 0.6, d: 5.4, mat: M.skylight, cast: false });
  for (const [dx, dz] of [[W * 0.25, -D * 0.25], [W * 0.25, D * 0.1], [-W * 0.35, -D * 0.3]]) {
    B.block({ x: cx + dx, z: cz + dz, w: 2.4, d: 1.6, y: roofY, h: 1.3, mat: M.plate });
    deco(group, { x: cx + dx, y: roofY + 1.3, z: cz + dz, w: 1.2, h: 0.2, d: 1.2, mat: M.metal });
  }
  const mx = x0 + 2.5;
  const mz = z0 + 2.5;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) deco(group, { x: mx + sx * 0.5, y: roofY, z: mz + sz * 0.5, w: 0.1, h: 9, d: 0.1, mat: M.metal });
  for (let k = 1; k < 9; k += 1.5) deco(group, { x: mx, y: roofY + k, z: mz, w: 1.1, h: 0.06, d: 1.1, mat: M.metal, cast: false });
  for (const k of [4.5, 9]) {
    deco(group, { x: mx, y: roofY + k, z: mz, w: 0.3, h: 0.3, d: 0.3, mat: M.redLight, cast: false });
    if (night) {
      const g = glowSprite(new THREE.Color(0xff3020), 1.4, 0.75);
      g.position.set(mx, roofY + k + 0.15, mz);
      group.add(g);
    }
  }
  return { roofY, mast: { x: mx, z: mz } };
}

/** Puerta enrollable de un garaje o almacén (con franja de aviso). */
export function rollDoor(ctx, M, { x, y = 0, z, w = 4, h = 4, face = 'z' }) {
  deco(ctx.group, { x, y, z, w: face === 'z' ? w : 0.1, h, d: face === 'z' ? 0.1 : w, mat: M.plate, cast: false });
  deco(ctx.group, { x, y: y + h - 0.3, z, w: face === 'z' ? w + 0.02 : 0.12, h: 0.3, d: face === 'z' ? 0.12 : w + 0.02, mat: M.hazard, cast: false });
}
