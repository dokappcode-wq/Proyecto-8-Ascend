import * as THREE from 'three';
import { CharacterModel } from '../player/CharacterModel.js';
import { MarkVisual } from '../player/MarkVisual.js';
import { glowTexture } from '../vfx/glowTexture.js';

/** Paletas de los personajes del prólogo (ropa corriente; nada delata quién tiene marca). */
export const STORY_PALETTES = {
  iker: { skin: 0xc28d6a, jacket: 0x3f4a37, hoodie: 0x8b8e86, pants: 0x2b3038, boots: 0x3a2c22, hair: 0x1b1511, hairStyle: 'short' },
  abuela: { skin: 0xd8b09a, jacket: 0x4c3a46, hoodie: 0x9a8f86, pants: 0x3a3438, boots: 0x2a2224, hair: 0xd9d5cf, hairStyle: 'bun' },
  martin: { skin: 0xb98266, jacket: 0xd9a21b, hoodie: 0x24324a, pants: 0x2f3440, boots: 0x1f1c1a, hair: 0x7d7a74, hairStyle: 'buzz', beard: true },
  vendedora: { skin: 0xc99a7c, jacket: 0x7a3b3b, hoodie: 0xd9d0c0, pants: 0x34303a, boots: 0x2a2224, hair: 0x3a2418, hairStyle: 'long' },
  vecina: { skin: 0xd2a07e, jacket: 0x55708a, hoodie: 0xcfc6b8, pants: 0x3c4148, boots: 0x2a2624, hair: 0x5a3b26, hairStyle: 'long' },
  vecino: { skin: 0xa77e66, jacket: 0x6b5a3a, hoodie: 0x8a8f99, pants: 0x2b2f36, boots: 0x231a1a, hair: 0x2a2420, hairStyle: 'short', beard: true },
  // General Narbaiza: chaqueta de cuero negro sobre camisa gris
  narbaiza: { skin: 0xc49a80, jacket: 0x141519, hoodie: 0x5b616b, pants: 0x1a1b1f, boots: 0x0f0f11, hair: 0x221c18, hairStyle: 'slick', beard: true },
  // Encarnación de la Energía: ropa gastada y quemada
  encarnacion: { skin: 0xb07a5c, jacket: 0x2b3b52, hoodie: 0x5a5a5a, pants: 0x2a2a30, boots: 0x231d1a, hair: 0x2b201a, hairStyle: 'messy' },
};

/** Marca de Sangre del general (no copiable, solo visual). */
export const SANGRE_DEF = Object.freeze({
  id: 'sangre', name: 'Marca de Sangre', concept: 'Sangre', original: true,
  color: '#d1162b', glowColor: '#ff5a6a', symbol: 'sangre',
  bodyPattern: { side: 'R', seed: 66, regions: ['wrist', 'forearm', 'upperArm', 'shoulder', 'chest'] },
});

const UP = new THREE.Vector3(0, 1, 0);

/**
 * NPC del guion: modelo animado que camina por rutas (con saltos en arco
 * entre tejados), adopta poses (de rodillas, tumbado, esposado…) y mira a un punto.
 * No tiene física: sigue el suelo con `groundHeight`.
 */
export class Npc {
  /**
   * @param {object} ctx contexto del mapa
   * @param {object} o { id, name, x, y, z, yaw, variant, palette, scale, gear, marks: [def], lod }
   */
  constructor(ctx, o) {
    this.ctx = ctx;
    this.world = ctx.world;
    this.id = o.id;
    this.name = o.name ?? o.id;
    this.model = new CharacterModel({ variant: o.variant ?? 'incarnation', palette: o.palette ?? null, gear: o.gear ?? null });
    this.model.root.scale.setScalar(o.scale ?? 1);
    ctx.group.add(this.model.root);
    this.marks = (o.marks ?? []).map((def) => new MarkVisual(this.model, def));
    for (const m of this.marks) m.setWristVisibility?.(1);
    this.position = { x: o.x, y: o.y ?? 0, z: o.z };
    this.yaw = o.yaw ?? 0;
    this.pose = 'stand';
    this._path = null;
    this._speed = 0;
    this._look = null;
    this._time = Math.random() * 10;
    this.markIntensity = 0;
    this.lodRoot = this.model.root;
    this.lodDistance = o.lod ?? 50;
    this.hidden = false;
    this._sync();
  }

  get center() {
    return { x: this.position.x, y: this.position.y + 1.1, z: this.position.z };
  }

  /** Coloca al personaje (sin animación). */
  place(p, yaw = this.yaw) {
    this.position.x = p.x;
    this.position.y = p.y ?? this.position.y;
    this.position.z = p.z;
    this.yaw = yaw;
    this._path = null;
    this._sync();
  }

  setVisible(v) {
    this.hidden = !v;
    this.model.root.visible = v;
  }

  /** 'stand' | 'kneel' | 'lying' | 'sit' | 'cuffed' | 'hang' | 'lifted' */
  setPose(p) {
    this.pose = p;
  }

  /** Mira hacia un punto (null deja de hacerlo). */
  lookAt(p) {
    this._look = p ? { x: p.x, z: p.z } : null;
  }

  /**
   * Recorre puntos. Un punto con `hop` se alcanza con un salto en arco
   * (tejados, huecos). Devuelve una promesa que se cumple al llegar.
   */
  walkTo(points, { speed = 1.7, run = false } = {}) {
    const list = Array.isArray(points) ? points : [points];
    return new Promise((resolve) => {
      this._path = { list: list.map((p) => ({ ...p })), i: 0, speed: run ? Math.max(speed, 4.2) : speed, run, resolve, hop: null };
    });
  }

  stop() {
    if (this._path) this._path.resolve();
    this._path = null;
  }

  get moving() {
    return !!this._path;
  }

  update(dt) {
    this._time += dt;
    const path = this._path;
    let speed = 0;
    let air = false;
    if (path) {
      const t = path.list[path.i];
      const p = this.position;
      if (path.hop) {
        // Salto en arco hacia el siguiente punto
        const h = path.hop;
        h.t += dt;
        const k = Math.min(1, h.t / h.dur);
        p.x = h.from.x + (t.x - h.from.x) * k;
        p.z = h.from.z + (t.z - h.from.z) * k;
        p.y = h.from.y + (h.toY - h.from.y) * k + Math.sin(k * Math.PI) * h.peak;
        air = k < 1;
        speed = h.dist / h.dur;
        if (k >= 1) {
          path.hop = null;
          path.i++;
        }
      } else {
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const d = Math.hypot(dx, dz);
        if (t.hop && d > 0.3) {
          const toY = t.y ?? this._ground(t.x, t.z, p.y + 3);
          const dur = Math.max(0.45, d / 7.5);
          path.hop = { t: 0, dur, from: { x: p.x, y: p.y, z: p.z }, toY, peak: 0.8 + d * 0.12 + Math.max(0, toY - p.y), dist: d };
          this.yaw = Math.atan2(dx, dz);
        } else if (d < 0.15) {
          path.i++;
        } else {
          const step = Math.min(d, path.speed * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
          const gy = t.y !== undefined && t.snap ? t.y : this._ground(p.x, p.z, p.y + 0.6);
          p.y += (gy - p.y) * Math.min(1, dt * 14);
          speed = path.speed;
          const want = Math.atan2(dx, dz);
          let a = want - this.yaw;
          a = Math.atan2(Math.sin(a), Math.cos(a));
          this.yaw += a * (1 - Math.exp(-dt * 10));
        }
      }
      if (path.i >= path.list.length) {
        this._path = null;
        path.resolve();
      }
    } else if (this._look) {
      const want = Math.atan2(this._look.x - this.position.x, this._look.z - this.position.z);
      let a = want - this.yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      this.yaw += a * (1 - Math.exp(-dt * 6));
    }
    if (this.model.root.visible) {
      this.model.setReload(this.pose === 'cuffed' ? 0.5 : null);
      this.model.animate(dt, {
        speed, grounded: !air, sprinting: !!path?.run, dodging: false, verticalSpeed: air ? 2 : 0,
        aimWeight: this.pose === 'reach' ? 1 : 0, aimPitch: -0.2,
        crouch: this.pose === 'kneel' || this.pose === 'sit' ? 1 : 0,
        climb: this.pose === 'hang' ? 'hang' : null,
        swinging: this.pose === 'lifted',
      });
      for (const m of this.marks) m.setIntensity(this.markIntensity);
    }
    this._sync();
  }

  _ground(x, z, maxY) {
    const g = this.world.groundHeight(x, z, 0.2, maxY);
    return Number.isFinite(g) ? g : this.position.y;
  }

  _sync() {
    const r = this.model.root;
    const p = this.position;
    r.position.set(p.x, p.y, p.z);
    r.rotation.set(0, this.yaw, 0);
    if (this.pose === 'lying') {
      r.rotation.x = -Math.PI / 2;
      r.position.y = p.y + 0.18;
    } else if (this.pose === 'lifted') {
      r.position.y = p.y + 0.35 + Math.sin(this._time * 3) * 0.05;
    }
  }

  dispose() {
    for (const m of this.marks) m.dispose();
  }
}

/**
 * Guardia de sigilo (PDC): patrulla una ruta, se detiene a mirar a los lados
 * y proyecta su cono de visión en el suelo. La detección la calcula el
 * director (stealthMath); el guardia solo expone su posición y su mirada.
 */
export class StealthGuard {
  /**
   * @param {object} o { id, route: [{x,z,wait,look}], y, speed, range, fov (grados, semiángulo) }
   */
  constructor(ctx, o) {
    this.ctx = ctx;
    this.world = ctx.world;
    this.id = o.id;
    this.route = o.route;
    this.home = o.route.map((p) => ({ ...p }));
    this.speed = o.speed ?? 1.6;
    this.range = o.range ?? 13;
    this.fov = THREE.MathUtils.degToRad(o.fov ?? 38);
    this.model = new CharacterModel({ variant: 'pdc' });
    ctx.group.add(this.model.root);
    const start = o.route[0];
    this.position = { x: start.x, y: o.y ?? this._ground(start.x, start.z, 50), z: start.z };
    this.yaw = start.yaw ?? 0;
    this._i = 0;
    this._wait = start.wait ?? 0;
    this._scan = 0;
    this._override = null; // { points, i, wait, then }
    this.meter = 0;
    this.active = true;
    // Cono de visión en el suelo (abanico)
    const seg = 18;
    const geo = new THREE.BufferGeometry();
    const pos = [0, 0, 0];
    for (let i = 0; i <= seg; i++) {
      const a = -this.fov + (2 * this.fov * i) / seg;
      pos.push(Math.sin(a) * this.range, 0, Math.cos(a) * this.range);
    }
    const idx = [];
    for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.renderOrder = 2;
    ctx.group.add(this.cone);
    // Linterna en la mano (solo visual)
    this.lodRoot = this.model.root;
    this.lodDistance = 80;
    this._sync();
  }

  /** Ojo del guardia (para la línea de visión). */
  get eye() {
    return { x: this.position.x, y: this.position.y + 1.6, z: this.position.z };
  }

  /** Va a un punto, mira unos segundos y vuelve a su ruta (distracción). */
  investigate(p) {
    this._override = { points: [{ x: p.x, z: p.z }], i: 0, wait: 3.5, then: 'resume', look: true };
  }

  /** Se va por estos puntos y espera allí `stay` segundos antes de volver (cambio de guardia). */
  leave(points, stay = 30) {
    this._override = { points: points.map((p) => ({ ...p })), i: 0, wait: stay, then: 'resume' };
  }

  /** Vuelve a la ruta original desde su principio (recarga de punto de control). */
  reset() {
    this._override = null;
    this.route = this.home.map((p) => ({ ...p }));
    const s = this.route[0];
    this.position.x = s.x;
    this.position.z = s.z;
    this.position.y = this._ground(s.x, s.z, this.position.y + 3);
    this.yaw = s.yaw ?? 0;
    this._i = 0;
    this._wait = s.wait ?? 0;
    this.meter = 0;
  }

  setActive(v) {
    this.active = v;
    this.hidden = !v;
    this.model.root.visible = v;
    this.cone.visible = v;
  }

  update(dt) {
    if (!this.active) return;
    let moving = false;
    const ov = this._override;
    const list = ov ? ov.points : this.route;
    const idx = ov ? ov.i : this._i;
    const t = list[Math.min(idx, list.length - 1)];
    if (this._wait > 0) {
      // Mirando alrededor en el punto
      this._wait -= dt;
      this._scan += dt;
      const base = t.look ?? this.yaw;
      if (t.look !== undefined) this.yaw = base + Math.sin(this._scan * 0.9) * 0.6;
      if (this._wait <= 0) {
        if (ov && ov.i >= ov.points.length - 1) {
          this._override = null;
        } else if (ov) ov.i++;
        else this._i = (this._i + 1) % this.route.length;
      }
    } else {
      const dx = t.x - this.position.x;
      const dz = t.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        this._wait = ov ? (ov.i >= ov.points.length - 1 ? ov.wait : 0.01) : (t.wait ?? 1.5);
        this._scan = 0;
        if (t.look === undefined) t.look = this.yaw;
      } else {
        const step = Math.min(d, this.speed * dt);
        this.position.x += (dx / d) * step;
        this.position.z += (dz / d) * step;
        this.position.y += (this._ground(this.position.x, this.position.z, this.position.y + 0.6) - this.position.y) * Math.min(1, dt * 12);
        const want = Math.atan2(dx, dz);
        let a = want - this.yaw;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        this.yaw += a * (1 - Math.exp(-dt * 6));
        moving = true;
      }
    }
    // Cono: blanco → amarillo → rojo con el medidor
    const m = this.meter;
    this.coneMat.color.setRGB(1, 0.95 - m * 0.7, 0.7 - m * 0.65);
    this.coneMat.opacity = 0.14 + m * 0.2;
    if (this.model.root.visible) {
      this.model.animate(dt, { speed: moving ? this.speed : 0, grounded: true, sprinting: false, dodging: false, verticalSpeed: 0, aimWeight: m > 0.5 ? 1 : 0, aimPitch: -0.1 });
    }
    this._sync();
  }

  _ground(x, z, maxY) {
    const g = this.world.groundHeight(x, z, 0.2, maxY);
    return Number.isFinite(g) ? g : this.position?.y ?? 0;
  }

  _sync() {
    const p = this.position;
    this.model.root.position.set(p.x, p.y, p.z);
    this.model.root.rotation.y = this.yaw;
    this.cone.position.set(p.x, p.y + 0.06, p.z);
    this.cone.rotation.y = this.yaw;
  }
}

/**
 * Foco giratorio: un haz desde lo alto de una torre que barre el suelo entre
 * dos puntos. Quien queda dentro del círculo iluminado (y con línea de visión
 * desde el foco) es visto mucho antes.
 */
/**
 * Haz de luz «volumétrico» falso: más denso en el eje del cono (donde la
 * superficie mira a la cámara) y transparente en los bordes; se desvanece
 * junto al foco y hacia el suelo. Así no parece un cono sólido de cerca.
 */
function searchlightBeamMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vT;
      void main() {
        vT = -position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec3 vN;
      varying vec3 vV;
      varying float vT;
      void main() {
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = opacity * f * f * (1.0 - vT * 0.6) * smoothstep(0.0, 0.1, vT);
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export class Searchlight {
  /** @param {object} o { origin: {x,y,z}, a: {x,z}, b: {x,z}, y (suelo), radius, period } */
  constructor(ctx, o) {
    this.origin = o.origin;
    this.a = o.a;
    this.b = o.b;
    this.groundY = o.y ?? 0;
    this.radius = o.radius ?? 3.2;
    this.period = o.period ?? 9;
    this._t = o.phase ?? 0;
    this.spot = { x: o.a.x, y: this.groundY, z: o.a.z };
    this.active = true;
    const beamMat = searchlightBeamMaterial(0xfff4d0, 0.2);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1, 1, 18, 1, true).translate(0, -0.5, 0), beamMat);
    this.beam.frustumCulled = false;
    // Charco de luz de borde suave (no un disco recortado)
    this.discMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xfff4d0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), this.discMat);
    this.disc.renderOrder = 2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x1f2329, emissive: 0xfff1c0, emissiveIntensity: 1.6 }));
    head.position.set(o.origin.x, o.origin.y, o.origin.z);
    this.head = head;
    ctx.group.add(this.beam, this.disc, head);
    this._sync();
  }

  reset() {
    this._t = 0;
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt;
    const k = 0.5 - 0.5 * Math.cos((this._t / this.period) * Math.PI * 2);
    this.spot.x = this.a.x + (this.b.x - this.a.x) * k;
    this.spot.z = this.a.z + (this.b.z - this.a.z) * k;
    this._sync();
  }

  _sync() {
    const o = this.origin;
    const s = this.spot;
    const dx = s.x - o.x;
    const dy = this.groundY - o.y;
    const dz = s.z - o.z;
    const len = Math.hypot(dx, dy, dz);
    this.beam.position.set(o.x, o.y, o.z);
    this.beam.scale.set(this.radius, len, this.radius);
    this.beam.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-dx / len, -dy / len, -dz / len));
    this.disc.position.set(s.x, this.groundY + 0.07, s.z);
    this.disc.scale.setScalar(this.radius * 1.5);
    this.head.lookAt(s.x, this.groundY, s.z);
  }
}
