import * as THREE from 'three';
import { textTexture } from './textures.js';

/**
 * LevelBuilder — crea a la vez la malla visual y el colisionador de cada
 * elemento del mapa, para que lo que se ve y lo que colisiona coincidan.
 *
 * Convención: (x, z) es el centro de la huella, `y` la base, `h` la altura.
 */
export class LevelBuilder {
  constructor(group, world) {
    this.group = group;
    this.world = world;
    this._geoCache = new Map();
  }

  add(obj) {
    this.group.add(obj);
    return obj;
  }

  /**
   * Bloque sólido.
   * @param {object} o { x, z, w, d, y=0, h, mat (material o array de 6), collide=true, cast=true, receive=true, uvUnit }
   */
  block(o) {
    const { x, z, w, d, h } = o;
    const y = o.y ?? 0;
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUVs(geo, w, h, d, o.mat);
    const mesh = new THREE.Mesh(geo, o.mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = o.receive ?? true;
    mesh.userData.levelStatic = true;
    this.group.add(mesh);
    if (o.collide ?? true) {
      this.world.addBox(
        { x: x - w / 2, y, z: z - d / 2 },
        { x: x + w / 2, y: y + h, z: z + d / 2 },
        { tag: o.tag, cameraBlocking: o.cameraBlocking ?? true, climbable: o.climbable ?? true },
      );
    }
    return mesh;
  }

  /** Colisionador invisible (límites del mapa). */
  invisibleWall({ x, z, w, d, y = -5, h = 60 }) {
    this.world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { tag: 'bounds', cameraBlocking: false });
  }

  /**
   * Rampa sólida (cuña). `axis` es el eje de la pendiente y `dir` (+1/-1)
   * indica hacia dónde sube.
   */
  ramp({ x, z, w, d, axis = 'z', dir = 1, y0 = 0, y1, base, mat, collide = true }) {
    const lo = Math.min(y0, y1);
    const b = base ?? Math.min(lo, 0);
    const len = axis === 'z' ? d : w;
    const geo = new THREE.BoxGeometry(w, 1, d);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > 0;
      const a = axis === 'z' ? pos.getZ(i) : pos.getX(i);
      // t: 0 en el extremo bajo, 1 en el alto
      const t = (a * dir) / len + 0.5;
      pos.setY(i, top ? y0 + (y1 - y0) * t : b);
    }
    geo.computeVertexNormals();
    scaleBoxUVs(geo, w, Math.max(1, y1 - b), d, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.levelStatic = true;
    this.group.add(mesh);
    if (collide) {
      const minX = x - w / 2;
      const maxX = x + w / 2;
      const minZ = z - d / 2;
      const maxZ = z + d / 2;
      // CollisionWorld mide y0 en el mínimo del eje.
      const ry0 = dir > 0 ? y0 : y1;
      const ry1 = dir > 0 ? y1 : y0;
      this.world.addRamp({ minX, maxX, minZ, maxZ, axis, y0: ry0, y1: ry1, base: b });
    }
    return mesh;
  }

  /**
   * Tramo de escalera. Peldaños visuales + una rampa de colisión para que
   * subir y bajar sea fluido.
   * @param {object} o { x, z (inicio del tramo, centro del ancho), width, axis, dir, y0, y1, stepRise=0.3, stepRun=0.45, mat, solid=true }
   */
  stairs(o) {
    const { x, z, width, axis = 'z', dir = 1, y0 = 0, y1, mat } = o;
    const rise = o.stepRise ?? 0.3;
    const run = o.stepRun ?? 0.45;
    const n = Math.max(1, Math.round((y1 - y0) / rise));
    const h = (y1 - y0) / n;
    const solid = o.solid ?? true;
    const group = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const top = y0 + h * (i + 1);
      const bottom = solid ? Math.min(y0, 0) : top - Math.max(h, 0.18);
      const along = (i + 0.5) * run * dir;
      const sw = axis === 'z' ? width : run;
      const sd = axis === 'z' ? run : width;
      const geo = new THREE.BoxGeometry(sw, top - bottom, sd);
      scaleBoxUVs(geo, sw, top - bottom, sd, mat);
      const step = new THREE.Mesh(geo, mat);
      step.position.set(axis === 'x' ? x + along : x, (top + bottom) / 2, axis === 'z' ? z + along : z);
      step.castShadow = true;
      step.receiveShadow = true;
      step.userData.levelStatic = true;
      group.add(step);
    }
    this.group.add(group);
    const length = n * run;
    const cx = axis === 'x' ? x + (length / 2) * dir : x;
    const cz = axis === 'z' ? z + (length / 2) * dir : z;
    const minX = axis === 'x' ? Math.min(x, x + length * dir) : x - width / 2;
    const maxX = axis === 'x' ? Math.max(x, x + length * dir) : x + width / 2;
    const minZ = axis === 'z' ? Math.min(z, z + length * dir) : z - width / 2;
    const maxZ = axis === 'z' ? Math.max(z, z + length * dir) : z + width / 2;
    // La rampa de colisión parte de medio peldaño para coincidir con las huellas.
    const low = y0 + h * 0.5;
    this.world.addRamp({
      minX, maxX, minZ, maxZ, axis,
      y0: dir > 0 ? low : y1,
      y1: dir > 0 ? y1 : low,
      base: solid ? Math.min(y0, 0) : y0 - 0.2,
    });
    return { group, length, center: { x: cx, z: cz } };
  }

  /**
   * Escalera en zigzag (escalera de incendios / torre de acceso).
   * Dos carriles paralelos: los tramos pares suben por el carril A en
   * sentido `dir`; los impares vuelven por el carril B. Hay rellanos en
   * ambos extremos.
   *
   * @param {object} o { x, z: esquina de inicio del carril A a nivel de suelo,
   *   axis: eje de los tramos, dir: ±1 sentido del primer tramo,
   *   side: ±1 hacia qué lado (eje perpendicular) está el carril B,
   *   height, width=1.6, base=0, mat, landingMat }
   * @returns {{ top: number, landings: Array<{x:number,z:number,y:number}> }}
   */
  stairTower(o) {
    const { x, z, axis = 'z', dir = 1, side = 1, height, mat } = o;
    const width = o.width ?? 1.6;
    const base = o.base ?? 0;
    const landingMat = o.landingMat ?? mat;
    const n = Math.max(1, Math.ceil((height - base) / 3));
    const rise = (height - base) / n;
    const steps = Math.max(2, Math.round(rise / 0.3));
    const run = 0.45;
    const L = steps * run;
    // Convierte coordenadas (a lo largo, lateral) a (x, z).
    const P = (along, lat) =>
      axis === 'z' ? { x: x + lat * side, z: z + along * dir } : { x: x + along * dir, z: z + lat * side };
    const landings = [];
    const posts = [];
    for (let i = 0; i < n; i++) {
      const y0 = base + i * rise;
      const y1 = base + (i + 1) * rise;
      const even = i % 2 === 0;
      const lat = even ? width / 2 : width * 1.5;
      const startAlong = even ? 0 : L;
      const s = P(startAlong, lat);
      this.stairs({
        x: s.x, z: s.z, width, axis, dir: even ? dir : -dir, y0, y1,
        stepRise: rise / steps, stepRun: run, mat, solid: i === 0,
      });
      // Rellano que une ambos carriles
      const la = even ? L + width / 2 : -width / 2;
      const c = P(la, width);
      const lw = axis === 'z' ? width * 2 : width;
      const ld = axis === 'z' ? width : width * 2;
      this.block({ x: c.x, z: c.z, w: lw, d: ld, y: y1 - 0.25, h: 0.25, mat: landingMat });
      landings.push({ x: c.x, z: c.z, y: y1 });
      for (const lat2 of [0, width * 2]) posts.push({ ...P(la, lat2), top: y1 - 0.25 });
    }
    // Pilares visuales (sin colisión para no enganchar al jugador)
    const postGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
    for (const p of posts) {
      const h = p.top - base;
      if (h <= 0.1) continue;
      const m = new THREE.Mesh(postGeo, landingMat);
      m.scale.y = h;
      m.position.set(p.x, base + h / 2, p.z);
      m.castShadow = true;
      m.userData.levelStatic = true;
      this.group.add(m);
    }
    return { top: height, landings };
  }

  /**
   * Pasarela inclinada (losa fina) entre dos puntos alineados con un eje.
   * @param {object} o { from: {x,y,z}, to: {x,y,z}, width=2, thickness=0.3, mat, rails (material de las barandillas) }
   */
  bridge({ from, to, width = 2, thickness = 0.3, mat, rails = null }) {
    const axis = Math.abs(to.x - from.x) > Math.abs(to.z - from.z) ? 'x' : 'z';
    const run = axis === 'x' ? to.x - from.x : to.z - from.z;
    const rise = to.y - from.y;
    const len = Math.hypot(run, rise);
    const geo = new THREE.BoxGeometry(axis === 'x' ? len : width, thickness, axis === 'x' ? width : len);
    scaleBoxUVs(geo, axis === 'x' ? len : width, thickness, axis === 'x' ? width : len, mat);
    const mesh = new THREE.Mesh(geo, mat);
    const angle = Math.atan2(rise, Math.abs(run));
    const s = Math.sign(run);
    mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2 - thickness / 2, (from.z + to.z) / 2);
    if (axis === 'x') mesh.rotation.z = angle * s;
    else mesh.rotation.x = -angle * s;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.levelStatic = true;
    this.group.add(mesh);

    const lo = from.y < to.y ? from : to;
    const hi = from.y < to.y ? to : from;
    const minA = axis === 'x' ? Math.min(from.x, to.x) : Math.min(from.z, to.z);
    const loAtMin = (axis === 'x' ? lo.x : lo.z) === minA;
    const half = width / 2;
    const cx = (from.x + to.x) / 2;
    const cz = (from.z + to.z) / 2;
    this.world.addRamp({
      minX: axis === 'x' ? Math.min(from.x, to.x) : cx - half,
      maxX: axis === 'x' ? Math.max(from.x, to.x) : cx + half,
      minZ: axis === 'z' ? Math.min(from.z, to.z) : cz - half,
      maxZ: axis === 'z' ? Math.max(from.z, to.z) : cz + half,
      axis,
      y0: loAtMin ? lo.y : hi.y,
      y1: loAtMin ? hi.y : lo.y,
      base: lo.y - thickness - 0.1,
    });
    if (rails) this._bridgeRails({ from, to, axis, width, angle, s, mat: rails });
    return mesh;
  }

  /**
   * Barandillas de 1 m a ambos lados de una pasarela: barra superior y
   * postes (visuales) y colisión por tramos de 1 m que siguen la pendiente.
   * No se escalan ni bloquean la cámara.
   */
  _bridgeRails({ from, to, axis, width, angle, s, mat }) {
    const H = 1.0;
    const t = 0.08;
    const run = axis === 'x' ? to.x - from.x : to.z - from.z;
    const len = Math.abs(run);
    const slopeLen = Math.hypot(len, to.y - from.y);
    const yAt = (u) => from.y + (to.y - from.y) * u; // u: 0..1 de from a to
    const along = (u) => (axis === 'x' ? from.x + run * u : from.z + run * u);
    for (const side of [-1, 1]) {
      const off = side * (width / 2 - t / 2);
      const cx = axis === 'x' ? (from.x + to.x) / 2 : from.x + off;
      const cz = axis === 'z' ? (from.z + to.z) / 2 : from.z + off;
      // Barra superior inclinada
      const bar = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? slopeLen : t, 0.07, axis === 'x' ? t : slopeLen), mat);
      bar.position.set(cx, (from.y + to.y) / 2 + H, cz);
      if (axis === 'x') bar.rotation.z = angle * s;
      else bar.rotation.x = -angle * s;
      bar.castShadow = true;
      bar.userData.levelStatic = true;
      this.group.add(bar);
      // Postes cada ~2 m
      const posts = Math.max(2, Math.round(len / 2) + 1);
      for (let i = 0; i < posts; i++) {
        const u = i / (posts - 1);
        const p = new THREE.Mesh(new THREE.BoxGeometry(t, H, t), mat);
        p.position.set(axis === 'x' ? along(u) : cx, yAt(u) + H / 2, axis === 'z' ? along(u) : cz);
        p.userData.levelStatic = true;
        this.group.add(p);
      }
      // Colisión por tramos
      const n = Math.max(1, Math.ceil(len));
      for (let i = 0; i < n; i++) {
        const u0 = i / n;
        const u1 = (i + 1) / n;
        const a0 = along(u0);
        const a1 = along(u1);
        const y0 = Math.min(yAt(u0), yAt(u1));
        const y1 = Math.max(yAt(u0), yAt(u1));
        const min = axis === 'x' ? { x: Math.min(a0, a1), y: y0 - 0.3, z: cz - t / 2 } : { x: cx - t / 2, y: y0 - 0.3, z: Math.min(a0, a1) };
        const max = axis === 'x' ? { x: Math.max(a0, a1), y: y1 + H, z: cz + t / 2 } : { x: cx + t / 2, y: y1 + H, z: Math.max(a0, a1) };
        this.world.addBox(min, max, { tag: 'rail', cameraBlocking: false, climbable: false });
      }
    }
  }

  /** Cartel con texto. `facing` es el ángulo Y hacia el que mira el texto. */
  sign(lines, { x, y, z, w = 4, h = 2, facing = 0, opts = {} }) {
    const tex = textTexture(lines, opts);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = facing;
    this.group.add(mesh);
    return mesh;
  }

  /** Texto pintado en el suelo. */
  floorText(lines, { x, z, y = 0.02, w = 8, h = 4, rot = 0, opts = {} }) {
    const tex = textTexture(lines, { bg: null, ...opts });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    return mesh;
  }
}

/**
 * Ajusta las UV de una BoxGeometry para que la textura mantenga su escala
 * en metros independientemente del tamaño de la caja.
 */
export function scaleBoxUVs(geo, w, h, d, mat) {
  const mats = Array.isArray(mat) ? mat : [mat, mat, mat, mat, mat, mat];
  const uv = geo.attributes.uv;
  // Orden de caras en BoxGeometry: +X, -X, +Y, -Y, +Z, -Z (4 vértices cada una)
  const dims = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const m = mats[f];
    const tex = m?.map;
    const ud = tex?.userData || {};
    const ux = ud.unitX ?? ud.unit ?? 2;
    const uy = ud.unitY ?? ud.unit ?? 2;
    const [fw, fh] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * fw) / ux, (uv.getY(i) * fh) / uy);
    }
  }
  uv.needsUpdate = true;
}
