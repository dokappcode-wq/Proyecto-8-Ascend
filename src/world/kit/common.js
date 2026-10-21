import * as THREE from 'three';
import { scaleBoxUVs } from '../LevelBuilder.js';
import { rng } from '../textures.js';

/**
 * Piezas comunes del kit de escenarios. Todo lo que es decorado se marca
 * `levelStatic` para que MapManager lo fusione por material (pocas llamadas
 * de dibujo aunque haya miles de piezas).
 */

/** Malla estática (se fusiona al cargar el mapa). */
export function staticMesh(group, geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.userData.levelStatic = true;
  group.add(m);
  return m;
}

/** Caja decorativa con UV en metros (sin colisión). */
export function deco(group, { x, y = 0, z, w, h, d, mat, rx = 0, ry = 0, rz = 0, cast = true }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUVs(geo, w, h, d, mat);
  const m = staticMesh(group, geo, mat, { cast });
  m.position.set(x, y + h / 2, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

/** Triángulo plano (hastial) con UV en metros. `pts` son [u, v] en el plano local. */
function triangleGeo(pts, unit) {
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ShapeGeometry(shape);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / unit, uv.getY(i) / unit);
  return geo;
}

/**
 * Tejado a dos aguas TRANSITABLE: dos faldones de teja con alero, hastiales
 * del color del muro y dos rampas de colisión (se puede correr por encima,
 * como en los tejados de inFamous o Assassin's Creed).
 *
 * @param {object} o { x, z, w, d (planta del muro), y (altura del alero), rise,
 *   overhang, along ('x' | 'z': dirección de la cumbrera), roofMat, wallMat, collide }
 */
export function gableRoof(ctx, { x, z, w, d, y, rise, overhang = 0.35, along, roofMat, wallMat, collide = true, thickness = 0.18 }) {
  const { group, world } = ctx;
  const ax = along ?? (w >= d ? 'x' : 'z');
  const s = (ax === 'x' ? d : w) / 2; // media luz (perpendicular a la cumbrera)
  const len = (ax === 'x' ? w : d) + overhang * 2;
  const a = Math.atan2(rise, s);
  const run = s + overhang;
  const L = run / Math.cos(a);
  for (const sgn of [-1, 1]) {
    const dims = ax === 'x' ? [len, thickness, L] : [L, thickness, len];
    const geo = new THREE.BoxGeometry(...dims);
    scaleBoxUVs(geo, ...dims, roofMat);
    const m = staticMesh(group, geo, roofMat);
    const yc = y + rise - Math.tan(a) * run / 2 + thickness / 2 / Math.cos(a);
    if (ax === 'x') {
      m.position.set(x, yc, z + sgn * run / 2);
      m.rotation.x = sgn * a;
    } else {
      m.position.set(x + sgn * run / 2, yc, z);
      m.rotation.z = -sgn * a;
    }
  }
  // Hastiales (los dos extremos de la cumbrera)
  const unit = wallMat?.map?.userData?.unit ?? 3;
  const tri = triangleGeo([[-s, 0], [s, 0], [0, rise]], unit);
  for (const sgn of [-1, 1]) {
    const m = staticMesh(group, tri.clone(), wallMat, { cast: false });
    if (ax === 'x') {
      m.position.set(x + sgn * (w / 2), y, z);
      m.rotation.y = sgn * Math.PI / 2;
    } else {
      m.position.set(x, y, z + sgn * (d / 2));
      m.rotation.y = sgn > 0 ? 0 : Math.PI;
    }
  }
  tri.dispose();
  // Rampas de colisión: se anda por los faldones
  if (collide) {
    if (ax === 'x') {
      world.addRamp({ minX: x - w / 2, maxX: x + w / 2, minZ: z - s, maxZ: z, axis: 'z', y0: y, y1: y + rise, base: y });
      world.addRamp({ minX: x - w / 2, maxX: x + w / 2, minZ: z, maxZ: z + s, axis: 'z', y0: y + rise, y1: y, base: y });
    } else {
      world.addRamp({ minX: x - s, maxX: x, minZ: z - d / 2, maxZ: z + d / 2, axis: 'x', y0: y, y1: y + rise, base: y });
      world.addRamp({ minX: x, maxX: x + s, minZ: z - d / 2, maxZ: z + d / 2, axis: 'x', y0: y + rise, y1: y, base: y });
    }
  }
  return { ridge: y + rise, along: ax };
}

/**
 * Masa de roca: icosaedro deformado con sombreado plano (rocas, peñascos y
 * caras de acantilado). Determinista por semilla.
 */
export function rockGeometry(sx, sy, sz, seed = 1, detail = 1) {
  const r = rng(seed);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 3.1 + ph[0]) * Math.cos(z * 2.7 + ph[1]) + 0.1 * Math.sin(y * 4.3 + ph[2]);
    pos.setXYZ(i, x * sx * k, Math.max(y, -0.35) * sy * k, z * sz * k);
  }
  const out = geo.toNonIndexed();
  geo.dispose();
  out.computeVertexNormals();
  // UV planas (para las texturas de roca en metros)
  const uv = out.attributes.uv;
  const p = out.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 4, p.getY(i) / 4);
  return out;
}

/**
 * Marca blanca de escalada (lenguaje de Tomb Raider): una franja clara en el
 * borde de lo que se puede agarrar, para que la ruta se lea de un vistazo.
 */
export function climbMark(group, mat, { x, y, z, w = 1.2, d = 0.08, ry = 0 }) {
  const m = deco(group, { x, y: y - 0.06, z, w, h: 0.07, d, mat, ry, cast: false });
  return m;
}

/** Farola de pie con brazo y globo luminoso (emisivo; de noche hace bloom). */
export function lampPost(group, { x, z, y = 0, metal, glow, h = 4.2, ry = 0 }) {
  deco(group, { x, y, z, w: 0.16, h, d: 0.16, mat: metal });
  deco(group, { x, y: y + h - 0.05, z, w: 0.9, h: 0.08, d: 0.08, mat: metal, ry });
  const ox = Math.cos(ry) * 0.4;
  const oz = -Math.sin(ry) * 0.4;
  deco(group, { x: x + ox, y: y + h - 0.45, z: z + oz, w: 0.32, h: 0.4, d: 0.32, mat: glow, cast: false });
}
