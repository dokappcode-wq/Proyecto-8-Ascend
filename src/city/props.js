import * as THREE from 'three';
import { alongPolyline, polyLength } from './streets.js';

/**
 * Accesorios de las misiones de la ciudad. Cada uno tiene `object3d`, y si
 * hace falta `update(dt)` y `dispose()` (quita colisiones y registros).
 * Los que se pueden romper a disparos se registran en el combate como
 * actores neutrales (`alive`, `center`, `capsule()`, `takeDamage`).
 */

let M = null;
/** Materiales compartidos (se crean una vez). */
export function mats() {
  if (M) return M;
  const glow = (c, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
  M = {
    red: new THREE.MeshStandardMaterial({ color: 0xa3262b, roughness: 0.5, metalness: 0.2 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x1f2a44, metalness: 0.4, roughness: 0.45 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8c949e, metalness: 0.75, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.5, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fc8e0, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }),
    window: new THREE.MeshStandardMaterial({ color: 0x26323e, emissive: 0xffd9a0, emissiveIntensity: 0.55, roughness: 0.2 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xbdb8ae, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x4b2d5c, roughness: 0.95, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.9 }),
    blue: glow('#3aa0ff'),
    gold: glow('#ffc04a'),
    green: glow('#58f08a'),
    redGlow: glow('#ff4a3a'),
    white: glow('#fff2d8', 2.4),
    violet: glow('#b45cff'),
    cone: new THREE.MeshBasicMaterial({ color: 0xff7a5a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ color: new THREE.Color('#4aa3ff').multiplyScalar(2), transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }),
  };
  return M;
}

function box(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Cabina telefónica roja con luz que parpadea cuando suena. */
export class PhoneBooth {
  constructor(game, { x, z, yaw = 0 }) {
    const m = mats();
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    box(g, 1.1, 0.15, 1.1, m.red, 0, 2.45, 0);
    box(g, 1.15, 0.1, 1.15, m.red, 0, 0.05, 0);
    for (const [px, pz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) box(g, 0.1, 2.4, 0.1, m.red, px, 1.2, pz);
    for (const [w, d, px, pz] of [[1, 0.04, 0, -0.52], [0.04, 1, -0.52, 0], [0.04, 1, 0.52, 0]]) box(g, w, 2.1, d, m.glass, px, 1.25, pz);
    box(g, 0.32, 0.45, 0.16, m.dark, 0, 1.45, -0.42);
    this.lamp = box(g, 0.9, 0.18, 0.9, m.white, 0, 2.62, 0);
    this.light = new THREE.PointLight(0xffd9a0, 0, 7, 2);
    this.light.position.set(0, 2.2, 0);
    g.add(this.light);
    this.object3d = g;
    this.position = { x, y: 0, z };
    this.ringing = false;
    this._t = 0;
    this.collider = game.world.addBox({ x: x - 0.6, y: 0, z: z - 0.6 }, { x: x + 0.6, y: 2.55, z: z + 0.6 }, { tag: 'prop' });
    this.world = game.world;
  }

  setRinging(on) {
    this.ringing = on;
  }

  update(dt) {
    this._t += dt;
    const on = this.ringing && Math.sin(this._t * 14) > 0;
    this.lamp.material = on ? mats().gold : mats().white;
    this.light.intensity = this.ringing ? (on ? 3 : 0.4) : 0.6;
  }

  dispose() {
    this.world.removeBox(this.collider);
  }
}

/**
 * Caja de empalme en una fachada o poste. Estados: 'off', 'hint' (siguiente),
 * 'on', 'error'. Se activa con E o con un disparo (si `shootable`).
 */
export class JunctionBox {
  constructor(game, { x, y = 2.2, z, yaw = 0, label = '', shootable = true, onHit = null }) {
    const m = mats();
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    box(g, 0.12, y, 0.12, m.dark, 0, y / 2, 0);
    box(g, 0.7, 0.9, 0.35, m.steel, 0, y + 0.2, 0);
    this.led = box(g, 0.5, 0.12, 0.38, m.dark, 0, y + 0.72, 0);
    this.object3d = g;
    this.position = { x, y: y + 0.2, z };
    this.center = { x, y: y + 0.2, z };
    this.radius = 0.6;
    this.alive = true;
    this.faction = 'neutral';
    this.label = label;
    this.state = 'off';
    this.onHit = onHit;
    this._t = 0;
    this._unreg = shootable ? game.combat.registerActor(this) : null;
  }

  capsule() {
    return { x: this.center.x, y: this.center.y - 0.5, z: this.center.z, r: 0.5, h: 1.1 };
  }

  setState(s) {
    this.state = s;
    const m = mats();
    this.led.material = s === 'on' ? m.green : s === 'error' ? m.redGlow : s === 'hint' ? m.gold : m.dark;
  }

  takeDamage(amount) {
    this.onHit?.(this);
    return amount;
  }

  update(dt) {
    this._t += dt;
    if (this.state === 'hint') this.led.visible = Math.sin(this._t * 8) > -0.3;
    else this.led.visible = true;
  }

  dispose() {
    this._unreg?.();
  }
}

/**
 * Cámara de vigilancia en un poste: barre a un lado y a otro con su cono.
 * Expone lo mismo que un guardia de sigilo (eye, yaw, fov, range, meter,
 * position, active) para que el director calcule si ve a Jon.
 */
export class SecurityCam {
  constructor(game, { x, z, yaw = 0, sweep = 0.7, range = 16, fov = 26, height = 3.6, speed = 0.5 }) {
    const m = mats();
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    box(g, 0.14, height, 0.14, m.dark, 0, height / 2, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, height, 0);
    g.add(this.head);
    box(this.head, 0.3, 0.28, 0.7, m.steel, 0, 0, 0.25);
    this.lens = box(this.head, 0.18, 0.18, 0.05, m.redGlow, 0, 0, 0.62);
    // Cono de visión en el suelo
    const seg = 14;
    const pos = [0, 0, 0];
    const fr = THREE.MathUtils.degToRad(fov);
    for (let i = 0; i <= seg; i++) {
      const a = -fr + (2 * fr * i) / seg;
      pos.push(Math.sin(a) * range, 0, Math.cos(a) * range);
    }
    const idx = [];
    for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    this.cone = new THREE.Mesh(geo, m.cone);
    this.cone.position.set(x, 0.12, z);
    this.cone.renderOrder = 2;
    const root = new THREE.Group();
    root.add(g, this.cone);
    this.object3d = root;
    this.base = yaw;
    this.sweep = sweep;
    this.speed = speed;
    this.range = range;
    this.fov = fr;
    this.height = height;
    this.position = { x, y: 0, z };
    this.yaw = yaw;
    this.meter = 0;
    this.active = true;
    this._t = Math.random() * 6;
  }

  get eye() {
    return { x: this.position.x, y: this.height, z: this.position.z };
  }

  /** ¿Ve el punto p (cono horizontal; la línea de visión la mira quien llama)? */
  inCone(p) {
    const dx = p.x - this.position.x;
    const dz = p.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d > this.range || d < 0.5) return false;
    let a = Math.atan2(dx, dz) - this.yaw;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) <= this.fov;
  }

  destroy(game) {
    if (!this.active) return;
    this.active = false;
    this.cone.visible = false;
    this.lens.material = mats().dark;
    this.head.rotation.x = 0.9;
    game?.vfx?.sparks?.burst(this.eye, { count: 16, speed: 6, color: new THREE.Color('#ffc46a'), life: 0.5 });
  }

  update(dt) {
    if (!this.active) return;
    this._t += dt * this.speed;
    this.yaw = this.base + Math.sin(this._t) * this.sweep;
    this.head.rotation.y = this.yaw;
    this.cone.rotation.y = this.yaw;
  }
}

/** Aro de control (carreras): 'next' brillante, 'later' tenue, 'done' oculto. */
export class Ring {
  constructor({ x, y = 2, z, yaw = 0, r = 2.6 }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    this.mat = mats().ring.clone();
    this.torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 40), this.mat);
    g.add(this.torus);
    this.object3d = g;
    this.position = { x, y, z };
    this.r = r;
    this._t = 0;
    this.setState('later');
  }

  setState(s) {
    this.state = s;
    this.object3d.visible = s !== 'done';
    this.mat.opacity = s === 'next' ? 0.95 : 0.25;
    this.mat.color.set(s === 'next' ? '#4aa3ff' : '#9fb4cc').multiplyScalar(s === 'next' ? 2.2 : 1);
  }

  /** ¿Ha pasado el punto p por dentro del aro? */
  passed(p) {
    return Math.hypot(p.x - this.position.x, p.y + 1 - this.position.y, p.z - this.position.z) < this.r + 0.6;
  }

  update(dt) {
    this._t += dt;
    if (this.state === 'next') this.torus.rotation.z = this._t * 1.5;
  }
}

/** Paquete o caja pequeña (buzón muerto, medicinas, radio…). */
export class Package {
  constructor({ x, y = 0, z, color = 0xc9b48a, size = 0.45, glow = true }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    box(g, size, size * 0.7, size * 0.8, mat, 0, size * 0.35, 0);
    if (glow) {
      this.halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2), mats().gold);
      this.halo.position.y = 0.05;
      g.add(this.halo);
    }
    this.object3d = g;
    this.position = { x, y, z };
    this._t = 0;
  }

  update(dt) {
    this._t += dt;
    if (this.halo) this.halo.scale.setScalar(1 + Math.sin(this._t * 3) * 0.15);
  }
}

/**
 * Bloques de hormigón (base acólita, control): una fila de piezas con
 * colisión. `dispose` las quita del mundo.
 */
export class Blocks {
  constructor(game, pieces) {
    const m = mats();
    const g = new THREE.Group();
    this.world = game.world;
    this.colliders = [];
    for (const p of pieces) {
      const w = p.w ?? 2.4;
      const h = p.h ?? 1.1;
      const d = p.d ?? 0.7;
      const mesh = box(g, w, h, d, p.mat ?? m.concrete, p.x, h / 2, p.z);
      mesh.rotation.y = p.yaw ?? 0;
      const ex = Math.abs(Math.cos(p.yaw ?? 0)) * w / 2 + Math.abs(Math.sin(p.yaw ?? 0)) * d / 2;
      const ez = Math.abs(Math.sin(p.yaw ?? 0)) * w / 2 + Math.abs(Math.cos(p.yaw ?? 0)) * d / 2;
      this.colliders.push(game.world.addBox({ x: p.x - ex, y: 0, z: p.z - ez }, { x: p.x + ex, y: h, z: p.z + ez }, { tag: 'prop' }));
    }
    this.object3d = g;
  }

  dispose() {
    for (const c of this.colliders) this.world.removeBox(c);
  }
}

/** Hoguera acólita con resplandor violeta. */
export class Fire {
  constructor({ x, z }) {
    const m = mats();
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    for (let k = 0; k < 4; k++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6).rotateZ(Math.PI / 2).rotateY((k * Math.PI) / 4), m.wood);
      log.position.y = 0.18;
      g.add(log);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a3a').multiplyScalar(2.4), toneMapped: false }));
    this.flame.position.y = 0.55;
    g.add(this.flame);
    this.light = new THREE.PointLight(0xb45cff, 2.5, 14, 2);
    this.light.position.y = 1.5;
    g.add(this.light);
    this.object3d = g;
    this._t = Math.random() * 5;
  }

  update(dt) {
    this._t += dt;
    this.flame.scale.set(1, 1 + Math.sin(this._t * 9) * 0.15, 1);
    this.light.intensity = 2.2 + Math.sin(this._t * 13) * 0.5;
  }
}

/**
 * Obstáculo en la vía (barricada de la PDC): se rompe a disparos. Bloquea
 * el tranvía hasta que cae.
 */
export class TrackBarricade {
  constructor(game, { x, z, yaw = 0, health = 60 }) {
    const m = mats();
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.parts = new THREE.Group();
    g.add(this.parts);
    for (const dx of [-1.6, 0, 1.6]) box(this.parts, 1.4, 1.1, 0.6, m.concrete, dx, 0.55, 0);
    box(this.parts, 4.6, 0.14, 0.62, m.red, 0, 0.75, 0);
    this.lamp = box(this.parts, 0.25, 0.25, 0.25, m.redGlow, 0, 1.25, 0);
    this.object3d = g;
    this.center = { x, y: 0.7, z };
    this.position = { x, y: 0, z };
    this.radius = 1.9;
    this.alive = true;
    this.faction = 'neutral';
    this.health = health;
    this.game = game;
    this._unreg = game.combat.registerActor(this);
  }

  capsule() {
    return { x: this.center.x, y: 0, z: this.center.z, r: 1.6, h: 1.4 };
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.health -= amount;
    this.parts.position.x = (Math.random() - 0.5) * 0.12;
    if (this.health <= 0) {
      this.alive = false;
      this.parts.visible = false;
      this._unreg?.();
      this.game.vfx.particles.burst(this.center, { count: 50, speed: 7, color: new THREE.Color(0xbdb8ae), size: 0.2, life: 0.9, drag: 1.6, gravity: 14 });
      this.game.events.emit('city:barricade-broken', {});
    }
    return amount;
  }

  dispose() {
    this._unreg?.();
  }
}

/**
 * Vehículo que recorre una polilínea: tranvía, tren del elevado o furgón.
 * Jon puede subirse al techo: una plataforma de colisión le sigue bajo los
 * pies y el vehículo le arrastra al moverse.
 */
export class Vehicle {
  /**
   * @param {object} o { path: [{x,z}], kind: 'tram'|'train'|'van', y (altura del suelo de la vía), speed, s (inicio) }
   */
  constructor(game, o) {
    this.game = game;
    this.kind = o.kind ?? 'tram';
    const dims = { tram: [14, 2.6, 3.3], train: [36, 3, 3.6], van: [6, 2.3, 2.5] }[this.kind];
    [this.length, this.width, this.height] = dims;
    this.path = o.path;
    this.total = polyLength(o.path);
    this.y = o.y ?? 0;
    this.s = o.s ?? 0;
    this.speed = o.speed ?? 0;
    this.target = this.speed;
    this.accel = o.accel ?? 3;
    this.loop = !!o.loop;
    this.yaw = 0;
    this.position = { x: 0, y: this.y, z: 0 };
    this.object3d = this._build();
    this.plate = game.world.addBox({ x: 0, y: -50, z: 0 }, { x: 0.1, y: -49, z: 0.1 }, { tag: 'vehicle', cameraBlocking: false });
    this.riding = false;
    this.place(this.s, true);
  }

  /** Altura del techo (donde se pisa). */
  get roofY() {
    return this.y + this.height - 0.2;
  }

  get done() {
    return !this.loop && this.s >= this.total - 0.01;
  }

  _build() {
    const m = mats();
    const g = new THREE.Group();
    const [L, W, H] = [this.length, this.width, this.height];
    if (this.kind === 'tram') {
      box(g, W, H - 0.6, L, m.cream, 0, 0.3 + (H - 0.6) / 2, 0);
      box(g, W + 0.04, 0.5, L + 0.04, m.red, 0, 0.55, 0);
      for (const s of [-1, 1]) box(g, 0.04, 1, L - 2, m.window, s * (W / 2 + 0.02), 1.9, 0);
      box(g, W - 0.3, 0.1, L - 0.4, m.red, 0, H - 0.25, 0);
      this.pantograph = box(g, 0.08, 1.2, 0.08, m.dark, 0, H + 0.5, -2);
      box(g, 1.6, 0.06, 0.12, m.dark, 0, H + 1.1, -2);
      this.headlight = box(g, 1.2, 0.3, 0.06, m.white, 0, 1.3, L / 2 + 0.02);
    } else if (this.kind === 'train') {
      for (const off of [-9.3, 9.3]) {
        box(g, W, H - 0.4, 17.6, m.steel, 0, 0.2 + (H - 0.4) / 2, off);
        for (const s of [-1, 1]) box(g, 0.04, 0.9, 15, m.window, s * (W / 2 + 0.02), 2, off);
        box(g, W + 0.04, 0.3, 17.64, m.navy, 0, 1.1, off);
      }
      this.headlight = box(g, 1.4, 0.3, 0.06, m.white, 0, 1.6, L / 2 + 0.02);
    } else {
      box(g, W, H - 0.5, L, m.navy, 0, 0.5 + (H - 0.5) / 2, 0);
      box(g, W + 0.02, 0.18, L + 0.02, m.blue, 0, 1.6, 0);
      box(g, W - 0.2, 0.7, 0.05, m.window, 0, 1.9, L / 2 + 0.02);
      for (const [x, z] of [[-1, -1.9], [1, -1.9], [-1, 1.9], [1, 1.9]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(Math.PI / 2), m.dark);
        wheel.position.set(x * (W / 2 - 0.1), 0.42, z);
        g.add(wheel);
      }
    }
    g.traverse((c) => {
      if (c.isMesh) c.castShadow = true;
    });
    return g;
  }

  /** Punto de la vía a `s` metros. */
  pointAt(s) {
    return alongPolyline(this.path, this.loop ? ((s % this.total) + this.total) % this.total : Math.min(this.total, s));
  }

  /** Coloca el vehículo en `s` (y gira suavemente salvo `snap`). */
  place(s, snap = false, dt = 0) {
    const half = this.length / 2;
    const front = this.pointAt(s + half);
    const back = this.pointAt(s - half);
    const cx = (front.x + back.x) / 2;
    const cz = (front.z + back.z) / 2;
    const yaw = Math.atan2(front.x - back.x, front.z - back.z);
    let dy = yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw = snap ? yaw : this.yaw + dy * Math.min(1, dt * 6);
    this.position.x = cx;
    this.position.z = cz;
    this.object3d.position.set(cx, this.y, cz);
    this.object3d.rotation.y = this.yaw;
  }

  /** Coordenadas locales (u a lo largo, v a lo ancho) de un punto del mundo. */
  local(p) {
    const dx = p.x - this.position.x;
    const dz = p.z - this.position.z;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return { u: dx * fx + dz * fz, v: dx * fz - dz * fx };
  }

  world(u, v) {
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return { x: this.position.x + fx * u + fz * v, z: this.position.z + fz * u - fx * v };
  }

  /** ¿Está Jon de pie en el techo? */
  onRoof(motor) {
    const p = motor.position;
    const l = this.local(p);
    return Math.abs(l.u) <= this.length / 2 + 0.3 && Math.abs(l.v) <= this.width / 2 + 0.3 && Math.abs(p.y - this.roofY) < 0.45;
  }

  /** Punto del techo (para interacciones sobre el vehículo). */
  roofPoint(u = 0) {
    const w = this.world(u, 0);
    return { x: w.x, y: this.roofY, z: w.z };
  }

  update(dt) {
    const motor = this.game.player.motor;
    const was = this.onRoof(motor) && motor.grounded;
    const before = { ...this.position, yaw: this.yaw };
    const lp = was ? this.local(motor.position) : null;
    // Velocidad hacia la objetivo
    const dv = this.target - this.speed;
    this.speed += Math.sign(dv) * Math.min(Math.abs(dv), this.accel * dt);
    this.s += this.speed * dt;
    if (!this.loop && this.s > this.total) {
      this.s = this.total;
      this.speed = 0;
    }
    this.place(this.s, false, dt);
    this.riding = was;
    // Arrastra a Jon con el vehículo
    if (lp) {
      const w = this.world(lp.u, lp.v);
      motor.position.x = w.x;
      motor.position.z = w.z;
      motor.position.y = Math.max(motor.position.y, this.roofY);
      this.game.player.facing += this.yaw - before.yaw;
    }
    // Plataforma bajo los pies: el punto del techo más cercano a Jon
    const p = motor.position;
    const near = Math.hypot(p.x - this.position.x, p.z - this.position.z) < this.length;
    if (near) {
      const l = this.local(p);
      const u = Math.max(-this.length / 2 + 1, Math.min(this.length / 2 - 1, l.u));
      const v = Math.max(-this.width / 2 + 1, Math.min(this.width / 2 - 1, l.v));
      const c = this.world(u, v);
      const h = Math.min(1.3, this.width / 2);
      this.game.world.setBox(this.plate, { x: c.x - h, y: this.y + 0.3, z: c.z - h }, { x: c.x + h, y: this.roofY, z: c.z + h });
    } else this.game.world.setBox(this.plate, { x: 0, y: -50, z: 0 }, { x: 0.1, y: -49, z: 0.1 });
  }

  dispose() {
    this.game.world.removeBox(this.plate);
  }
}
