import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { markSymbolTexture } from '../player/markTextures.js';
import { DroneModel } from '../ai/DroneModel.js';

/**
 * Persiana o compuerta: un bloque sólido que baja (o sube) en `dur` segundos.
 * Mientras no está cerrada, su colisionador se ajusta a la parte bajada.
 */
export class Shutter {
  constructor(ctx, { x, z, w, d, y = 0, h, mat, open = true }) {
    this.ctx = ctx;
    this.box = { x, z, w, d, y, h };
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    this.mesh.castShadow = true;
    ctx.group.add(this.mesh);
    this.collider = ctx.world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { climbable: false });
    this.k = open ? 0 : 1; // 0 abierta (recogida arriba), 1 cerrada
    this._target = this.k;
    this._speed = 1;
    this._apply();
  }

  close(dur = 1.5) {
    this._target = 1;
    this._speed = 1 / dur;
  }

  open(dur = 1.5) {
    this._target = 0;
    this._speed = 1 / dur;
  }

  set(closed) {
    this.k = this._target = closed ? 1 : 0;
    this._apply();
  }

  update(dt) {
    if (this.k === this._target) return;
    const s = Math.sign(this._target - this.k);
    this.k = Math.max(0, Math.min(1, this.k + s * this._speed * dt));
    this._apply();
  }

  _apply() {
    const { x, z, w, d, y, h } = this.box;
    const vis = h * this.k;
    this.mesh.visible = vis > 0.02;
    this.mesh.scale.y = Math.max(0.001, this.k);
    this.mesh.position.set(x, y + h - vis / 2, z);
    this.collider.enabled = vis > 0.3;
    this.ctx.world.setBox(this.collider, { x: x - w / 2, y: y + h - vis, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 });
  }
}

/** Tirolina: cable entre dos postes (el viaje lo gestiona el director). */
export class Zipline {
  constructor(ctx, { from, to }) {
    this.from = from;
    this.to = to;
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const len = a.distanceTo(b);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.3 }));
    cable.position.copy(a).add(b).multiplyScalar(0.5);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    ctx.group.add(cable);
    const post = new THREE.MeshStandardMaterial({ color: 0x5a3b2c, metalness: 0.4, roughness: 0.7 });
    for (const p of [from, to]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3, 0.25), post);
      m.position.set(p.x, p.y - 1.3, p.z);
      m.castShadow = true;
      ctx.group.add(m);
    }
    this.length = len;
  }

  /** Punto del cable a la fracción k (0..1). */
  at(k) {
    const f = this.from;
    const t = this.to;
    // Comba ligera en el centro
    const sag = Math.sin(k * Math.PI) * Math.min(3, this.length * 0.04);
    return { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k - sag, z: f.z + (t.z - f.z) * k };
  }
}

const ENERGY_KINDS = new Set(['bolt', 'discharge', 'splash', 'wave', 'rayo']);

/**
 * Escombro frágil: bloquea el paso hasta que lo rompe un disparo (o varios).
 * Es un objetivo del combate: los proyectiles que tocan su caja le dañan.
 */
export class FragileDebris {
  constructor(ctx, { x, z, y = 0, w, d, h, health = 20, color = 0x7a6a5a }) {
    this.ctx = ctx;
    this.alive = true;
    this.faction = 'neutral';
    this.health = health;
    this.maxHealth = health;
    this.radius = Math.max(w, d) / 2;
    this.center = { x, y: y + h / 2, z };
    this.group = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.9 });
    this.glowMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0x6fc3ff, emissiveIntensity: 0.0 });
    const r = mulberry(7);
    for (let i = 0; i < 14; i++) {
      const s = 0.5 + r() * 0.9;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 4 === 0 ? this.glowMat : rock);
      m.position.set(x + (r() - 0.5) * w, y + s * 0.6 + r() * (h - s), z + (r() - 0.5) * d);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.castShadow = true;
      this.group.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, Math.max(w, d) * 1.1, 8), wood);
      log.position.set(x, y + 0.6 + i * 0.9, z);
      log.rotation.z = Math.PI / 2 + (r() - 0.5) * 0.5;
      log.rotation.y = w > d ? 0 : Math.PI / 2;
      log.castShadow = true;
      this.group.add(log);
    }
    ctx.group.add(this.group);
    this.collider = ctx.world.addBox({ x: x - w / 2, y, z: z - d / 2 }, { x: x + w / 2, y: y + h, z: z + d / 2 }, { owner: this, tag: 'debris', climbable: false });
    this._unreg = ctx.combat.register(this);
    this.box = { x, z, y, w, d, h };
  }

  /** Brillo azul que señala que se puede romper. */
  hint(v) {
    this.glowMat.emissiveIntensity = v;
  }

  takeDamage(amount, info = {}) {
    // Solo la energía lo rompe (golpes y patadas no le hacen nada)
    if (!this.alive || !ENERGY_KINDS.has(info.kind)) return 0;
    this.health -= amount;
    this.group.position.x = (Math.random() - 0.5) * 0.08;
    if (this.health <= 0) this.shatter();
    return amount;
  }

  shatter() {
    if (!this.alive) return;
    this.alive = false;
    this.collider.enabled = false;
    this.group.visible = false;
    this._unreg?.();
    const { x, y, z, h } = this.box;
    this.ctx.vfx?.particles.burst({ x, y: y + h / 2, z }, { count: 60, speed: 8, color: new THREE.Color(0x8a7a6a), size: 0.25, life: 1.1, drag: 1.5, gravity: 14 });
    this.ctx.vfx?.particles.burst({ x, y: y + h / 2, z }, { count: 24, speed: 5, color: new THREE.Color(0x6fc3ff), size: 0.16, life: 0.6, drag: 2 });
    this.ctx.events?.emit('story:debris-broken', {});
  }

  /** Vuelve a montarlo (recarga de punto de control). */
  reset() {
    this.alive = true;
    this.health = this.maxHealth;
    this.collider.enabled = true;
    this.group.visible = true;
    this._unreg = this.ctx.combat.register(this);
  }
}

/**
 * Roca con vetas de Energía (bosque, M05): bloquea la senda hasta que la
 * revientan los disparos de Energía (los golpes no le hacen nada). Las vetas
 * azules laten para indicar que se puede romper. Misma interfaz que
 * FragileDebris (`alive`, `hint`, `takeDamage`, `reset`).
 */
export class VeinBoulder {
  constructor(ctx, { x, z, y = 0, r = 1.8, health = 20, rockMat, veinMat }) {
    this.ctx = ctx;
    this.alive = true;
    this.faction = 'neutral';
    this.health = health;
    this.maxHealth = health;
    this.radius = r;
    this.center = { x, y: y + r * 0.6, z };
    this.box = { x, z, y, h: r * 1.4 };
    this.veinMat = veinMat;
    this._hint = 1;
    this._t = 0;
    this.group = new THREE.Group();
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    add(boulderGeometry(r, r * 0.9, r * 0.85, 7), veinMat, x, y + r * 0.55, z);
    for (let i = 0; i < 3; i++) {
      const s = r * (0.35 + i * 0.1);
      add(boulderGeometry(s, s * 0.8, s, 17 + i), i === 1 ? veinMat : rockMat, x + Math.cos(i * 2.2) * r * 0.95, y + s * 0.35, z + Math.sin(i * 2.2) * r * 0.95);
    }
    this.light = new THREE.PointLight(0x6fc3ff, 5, r * 5, 1.6);
    this.light.position.set(x, y + r * 1.2, z);
    this.group.add(this.light);
    ctx.group.add(this.group);
    this.collider = ctx.world.addBox({ x: x - r * 0.9, y, z: z - r * 0.9 }, { x: x + r * 0.9, y: y + r * 1.4, z: z + r * 0.9 }, { owner: this, tag: 'debris', climbable: false });
    this._unreg = ctx.combat?.register(this);
  }

  /** Intensidad del brillo de las vetas (1 = normal). */
  hint(v) {
    this._hint = v;
  }

  update(dt) {
    if (!this.alive) return;
    this._t += dt;
    const k = this._hint * (0.75 + 0.25 * Math.sin(this._t * 2.4));
    this.veinMat.emissiveIntensity = 2.2 * k;
    this.light.intensity = 5 * k;
  }

  takeDamage(amount, info = {}) {
    if (!this.alive || !ENERGY_KINDS.has(info.kind)) return 0;
    this.health -= amount;
    this.group.position.x = (Math.random() - 0.5) * 0.08;
    if (this.health <= 0) this.shatter();
    return amount;
  }

  shatter() {
    if (!this.alive) return;
    this.alive = false;
    this.collider.enabled = false;
    this.group.visible = false;
    this._unreg?.();
    const { x, y, z, h } = this.box;
    this.ctx.vfx?.particles.burst({ x, y: y + h / 2, z }, { count: 70, speed: 9, color: new THREE.Color(0x6e6a64), size: 0.28, life: 1.2, drag: 1.4, gravity: 14 });
    this.ctx.vfx?.particles.burst({ x, y: y + h / 2, z }, { count: 40, speed: 6, color: new THREE.Color(0x6fc3ff), size: 0.18, life: 0.8, drag: 2 });
    this.ctx.vfx?.lights?.flash({ x, y: y + h / 2, z }, '#6fc3ff', 40, 12, 0.4);
    this.ctx.events?.emit('story:debris-broken', {});
  }

  /** Ya roto (al cargar un punto de control posterior): sin efectos ni eventos. */
  clear() {
    if (!this.alive) return;
    this.alive = false;
    this.collider.enabled = false;
    this.group.visible = false;
    this._unreg?.();
  }

  reset() {
    this.alive = true;
    this.health = this.maxHealth;
    this.collider.enabled = true;
    this.group.visible = true;
    this.group.position.x = 0;
    this._unreg = this.ctx.combat?.register(this);
  }
}

/** Roca de caras planas (deformación determinista de un icosaedro). */
function boulderGeometry(sx, sy, sz, seed) {
  const r = mulberry(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
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
  const uv = out.attributes.uv;
  const p = out.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) / 4, p.getY(i) / 4);
  return out;
}

/**
 * Barricada de tablones de la PDC (bosque, M05): se rompe a golpes (o con
 * cualquier daño). Los postes quedan en pie; los tablones saltan en astillas.
 * Cruza la senda a lo largo de z (ancho `w`) en `x`.
 */
export class Barricade {
  constructor(ctx, { x, y = 0, z, w = 6, h = 2.4, health = 40, plankMat, postMat, tapeMat, signMat }) {
    this.ctx = ctx;
    this.alive = true;
    this.faction = 'neutral';
    this.health = health;
    this.maxHealth = health;
    this.radius = 1.2;
    this.center = { x, y: y + 1.1, z };
    this.box = { x, y, z, w, h };
    const box = (g, mat, bw, bh, bd, px, py, pz, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      m.position.set(px, py, pz);
      m.rotation.x = rx;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    // Postes (se quedan) y tablones (se rompen)
    this.posts = new THREE.Group();
    for (const dz of [-w / 2, 0, w / 2]) box(this.posts, postMat, 0.22, h + 0.5, 0.22, x, y + (h + 0.5) / 2 - 0.3, z + dz);
    this.planks = new THREE.Group();
    for (let i = 0; i < 4; i++) box(this.planks, plankMat, 0.06, 0.32, w + 0.4, x + 0.14, y + 0.5 + i * 0.52, z, i % 2 ? 0.05 : -0.04);
    for (const sgn of [-1, 1]) box(this.planks, plankMat, 0.06, 0.26, Math.hypot(w, h) * 0.95, x + 0.22, y + h / 2 - 0.2, z, sgn * Math.atan2(h, w));
    box(this.planks, tapeMat, 0.02, 0.12, w + 0.2, x + 0.3, y + 1.1, z);
    box(this.planks, signMat, 0.04, 0.6, 1.6, x + 0.3, y + 1.85, z - 0.6);
    ctx.group.add(this.posts, this.planks);
    this.collider = ctx.world.addBox({ x: x - 0.2, y, z: z - w / 2 - 0.2 }, { x: x + 0.4, y: y + h, z: z + w / 2 + 0.2 }, { owner: this, tag: 'barricade', climbable: false });
    this._unreg = ctx.combat?.register(this);
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.health -= amount;
    this.planks.position.x = (Math.random() - 0.5) * 0.1;
    if (this.health <= 0) this.shatter();
    return amount;
  }

  shatter() {
    if (!this.alive) return;
    this.alive = false;
    this.collider.enabled = false;
    this.planks.visible = false;
    this._unreg?.();
    const { x, y, z, h } = this.box;
    this.ctx.vfx?.particles.burst({ x, y: y + h / 2, z }, { count: 60, speed: 7, color: new THREE.Color(0xb08a5a), size: 0.18, life: 1, drag: 1.6, gravity: 14 });
    this.ctx.events?.emit('story:barricade-broken', {});
  }

  /** Ya roto (al cargar un punto de control posterior): sin efectos ni eventos. */
  clear() {
    if (!this.alive) return;
    this.alive = false;
    this.collider.enabled = false;
    this.planks.visible = false;
    this._unreg?.();
  }

  reset() {
    this.alive = true;
    this.health = this.maxHealth;
    this.collider.enabled = true;
    this.planks.visible = true;
    this.planks.position.x = 0;
    this._unreg = this.ctx.combat?.register(this);
  }
}

/** Lluvia: partículas que caen alrededor de la cámara (una sola llamada de dibujo). */
export class Rain {
  constructor(ctx, { count = 2600, area = 46, height = 26, color = 0xa8c0d8, follow = false } = {}) {
    this.area = area;
    this.height = height;
    const pos = new Float32Array(count * 6);
    this.drops = [];
    for (let i = 0; i < count; i++) {
      this.drops.push({ x: (Math.random() - 0.5) * area, y: Math.random() * height, z: (Math.random() - 0.5) * area, v: 18 + Math.random() * 8 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.name = 'Lluvia';
    ctx.group.add(this.lines);
    this.center = { x: 0, y: 0, z: 0 };
    this.intensity = 1;
    // `follow`: sigue a la cámara que la dibuja (mapas sin director de historia)
    if (follow) {
      this.lines.onBeforeRender = (r, s, cam) => {
        this.center.x = cam.position.x;
        this.center.y = cam.position.y - height / 2;
        this.center.z = cam.position.z;
      };
    }
    // Lo que tapa la lluvia (tejados, voladizos): altura de la superficie más
    // alta en celdas de 1 m, calculada al pasar por ellas y guardada
    this.world = ctx.world;
    this._cover = new Map();
  }

  /** Altura donde se corta la lluvia en (x, z): tejado, voladizo o suelo. */
  coverAt(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const k = (ix + 4096) * 8192 + (iz + 4096);
    let h = this._cover.get(k);
    if (h === undefined) {
      h = this.world ? this.world.groundHeight(ix + 0.5, iz + 0.5, 0.5, 500) : -Infinity;
      this._cover.set(k, h);
    }
    return h;
  }

  setIntensity(v) {
    this.intensity = v;
    this.lines.visible = v > 0.02;
    this.lines.material.opacity = 0.35 * v;
  }

  update(dt) {
    if (!this.lines.visible) return;
    const arr = this.lines.geometry.attributes.position.array;
    const c = this.center;
    const A = this.area;
    let j = 0;
    for (const d of this.drops) {
      d.y -= d.v * dt;
      // Al llegar a un tejado (o al suelo) la gota vuelve a caer desde arriba:
      // así no llueve dentro de los edificios ni bajo los voladizos
      if (d.y < -2 || c.y + d.y < this.coverAt(c.x + d.x, c.z + d.z)) {
        d.y = this.height;
        d.x = (Math.random() - 0.5) * A;
        d.z = (Math.random() - 0.5) * A;
      }
      const x = c.x + d.x;
      const y = c.y + d.y;
      const z = c.z + d.z;
      arr[j++] = x;
      arr[j++] = y;
      arr[j++] = z;
      arr[j++] = x - 0.05;
      arr[j++] = y + 0.55;
      arr[j++] = z;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

/** Luces de alarma: balizas rojas que parpadean (emisivas, sin luces reales). */
export class AlarmLights {
  constructor(ctx, points) {
    this.mat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a1a, emissiveIntensity: 0 });
    for (const p of points) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), this.mat);
      m.position.set(p.x, p.y, p.z);
      ctx.group.add(m);
    }
    this.on = false;
    this._t = 0;
    this.lights = [];
  }

  /** Luces puntuales reales creadas con el mapa (siempre existen; solo cambia su intensidad). */
  addLight(light) {
    this.lights.push(light);
    light.intensity = 0;
  }

  set(on) {
    this.on = on;
    if (!on) {
      this.mat.emissiveIntensity = 0;
      for (const l of this.lights) l.intensity = 0;
    }
  }

  update(dt) {
    if (!this.on) return;
    this._t += dt;
    const k = 0.5 + 0.5 * Math.sin(this._t * 7);
    this.mat.emissiveIntensity = 0.3 + 3 * k;
    for (const l of this.lights) l.intensity = 25 * k;
  }
}

/**
 * Cámara de contención: cinco vitrinas con cartas flotando. Cuatro símbolos
 * sin identificar y una carta dorada (Destino). La dorada se puede «absorber».
 */
export class CardVitrines {
  constructor(ctx, { x, z, y = 0, spacing = 2.4 }) {
    this.cards = [];
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const base = new THREE.MeshStandardMaterial({ color: 0x1d232b, metalness: 0.6, roughness: 0.4 });
    const strange = ['#7f9aa8', '#8a7fa8', '#7fa892', '#a8927f'];
    for (let i = 0; i < 5; i++) {
      const cx = x + (i - 2) * spacing;
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.9), base);
      ped.position.set(cx, y + 0.5, z);
      ped.castShadow = true;
      ctx.group.add(ped);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.8), glass);
      box.position.set(cx, y + 1.5, z);
      ctx.group.add(box);
      ctx.world.addBox({ x: cx - 0.45, y, z: z - 0.45 }, { x: cx + 0.45, y: y + 2, z: z + 0.45 }, { climbable: false });
      const golden = i === 2;
      const tex = golden ? markSymbolTexture('destino', '#ffe7a3') : strangeTexture(i);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), new THREE.MeshBasicMaterial({ map: tex, color: golden ? 0xffd27a : new THREE.Color(strange[i > 2 ? i - 1 : i]), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
      card.position.set(cx, y + 1.5, z);
      ctx.group.add(card);
      this.cards.push({ mesh: card, golden, base: card.position.y, cx });
    }
    this.golden = this.cards[2];
    this.goldenPos = { x, y: y + 1.5, z };
    this._t = 0;
    this.absorbed = false;
  }

  /** Quita la carta dorada (ya convertida en la marca). */
  setAbsorbed(v) {
    this.absorbed = v;
    this.golden.mesh.visible = !v;
  }

  update(dt) {
    this._t += dt;
    for (const [i, c] of this.cards.entries()) {
      c.mesh.position.y = c.base + Math.sin(this._t * 1.4 + i) * 0.05;
      c.mesh.rotation.y = this._t * (c.golden ? 0.9 : 0.4) + i;
    }
  }
}

/** Símbolo «sin identificar» para las cuatro cartas restantes (no se asignan a ninguna marca). */
function strangeTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,20,0.85)';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#dfe9f5';
  g.lineWidth = 5;
  const r = mulberry(seed * 31 + 3);
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2;
    const b = a + 1 + r() * 2;
    g.arc(64, 64, 18 + k * 8, a, b);
    g.moveTo(64 + Math.cos(b) * (26 + k * 8), 64 + Math.sin(b) * (26 + k * 8));
  }
  g.stroke();
  g.font = '700 26px serif';
  g.fillStyle = '#dfe9f5';
  g.textAlign = 'center';
  g.fillText('?', 64, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dron decorativo (no enemigo): flota y gira la lente. */
export class DecorDrone {
  constructor(ctx, { x, y, z, orbit = 0, speed = 0.4 }) {
    this.model = new DroneModel();
    ctx.group.add(this.model.root);
    this.c = { x, y, z };
    this.orbit = orbit;
    this.speed = speed;
    this._t = Math.random() * 10;
    this.lodRoot = this.model.root;
    this.lodDistance = 90;
  }

  update(dt) {
    this._t += dt;
    const a = this._t * this.speed;
    const r = this.model.root;
    r.position.set(this.c.x + Math.cos(a) * this.orbit, this.c.y + Math.sin(this._t * 1.3) * 0.2, this.c.z + Math.sin(a) * this.orbit);
    r.rotation.y = -a;
    this.model.animate(dt, { speed: this.orbit ? 2 : 0 });
  }
}

/**
 * Autobús de prisioneros (amarillo, con interior de asientos). Su grupo se
 * mueve y se inclina en la cinemática del vuelco.
 */
export class PrisonBus {
  constructor(ctx, { x, y, z, yaw = 0 }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe0a91b, roughness: 0.55, metalness: 0.2 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.15, metalness: 0.3, emissive: 0x0a1018 });
    const seat = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.8 });
    const L = 10;
    const W = 2.5;
    const H = 2.7;
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    // Carrocería hueca (suelo, techo, laterales con ventanas) para ver el interior
    add(new THREE.BoxGeometry(W, 0.15, L), black, 0, 0.55, 0);
    add(new THREE.BoxGeometry(W, 0.12, L), yellow, 0, 0.55 + H, 0);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.08, 1.1, L), yellow, s * W / 2, 1.15, 0);
      add(new THREE.BoxGeometry(0.06, 0.85, L - 0.6), glass, s * W / 2, 2.1, 0);
      add(new THREE.BoxGeometry(0.1, 0.3, L), yellow, s * W / 2, 2.7, 0);
      add(new THREE.BoxGeometry(0.12, 0.12, L), black, s * W / 2, 1.05, 0);
    }
    add(new THREE.BoxGeometry(W, H, 0.1), yellow, 0, 0.55 + H / 2, -L / 2);
    add(new THREE.BoxGeometry(W - 0.2, 1, 0.08), glass, 0, 2.2, L / 2);
    add(new THREE.BoxGeometry(W, 1.3, 0.1), yellow, 0, 1.2, L / 2);
    add(new THREE.BoxGeometry(W + 0.1, 0.3, 0.4), black, 0, 0.75, L / 2 + 0.15);
    for (const [px, pz] of [[-1, 3.3], [1, 3.3], [-1, -3.3], [1, -3.3]]) {
      const wheel = add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), black, px * (W / 2 - 0.1), 0.5, pz);
      wheel.rotation.z = Math.PI / 2;
    }
    // Asientos
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.8, 0.5, 0.5), seat, s * 0.7, 0.9, -3.5 + i * 1.3);
    }
    this.group = g;
    ctx.group.add(g);
    /** Asientos para los personajes (coordenadas locales). */
    this.seats = { jon: new THREE.Vector3(-0.7, 0.62, 0.4), iker: new THREE.Vector3(0.7, 0.62, 0.4) };
  }

  /** Posición en el mundo de un punto local del autobús. */
  worldPoint(local, out = new THREE.Vector3()) {
    this.group.updateMatrixWorld(true);
    return out.copy(local).applyMatrix4(this.group.matrixWorld);
  }
}

/** Disco luminoso que señala dónde aterrizar (tutorial del dash). */
export class LandingMarker {
  constructor(ctx, { x, y, z, r = 1.6 }) {
    this.mat = new THREE.MeshBasicMaterial({ color: 0x6fc3ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r, 32).rotateX(-Math.PI / 2), this.mat);
    this.mesh.position.set(x, y + 0.06, z);
    this.mesh.renderOrder = 2;
    ctx.group.add(this.mesh);
    this.point = { x, y, z };
    this._t = 0;
  }

  setVisible(v) {
    this.mesh.visible = v;
  }

  update(dt) {
    this._t += dt;
    this.mat.opacity = 0.35 + 0.25 * Math.sin(this._t * 4);
    this.mesh.rotation.y += dt * 0.6;
  }
}

/** Generador pseudoaleatorio reproducible (decoración). */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Copa de abeto: conos con el borde dentado (ramas), con color por vértice
 * (más oscuro abajo y por dentro, puntas más claras). Se genera una vez.
 */
let _pineFoliage = null;
function pineFoliageGeometry() {
  if (_pineFoliage) return _pineFoliage;
  const layers = [[2.35, 3.0, 3.1], [1.95, 2.7, 4.6], [1.5, 2.4, 6.0], [1.0, 2.0, 7.3], [0.55, 1.4, 8.4]];
  const parts = [];
  const dark = new THREE.Color(0x203826);
  const light = new THREE.Color(0x4f7a52);
  layers.forEach(([r, h, y], li) => {
    const g = new THREE.ConeGeometry(r, h, 12, 1).toNonIndexed();
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const a = Math.atan2(vz, vx);
      const rad = Math.hypot(vx, vz);
      // Borde dentado: ramas alternas que caen un poco
      const tooth = 0.78 + 0.22 * Math.abs(Math.cos(a * 7 + li));
      if (rad > 1e-3) {
        pos.setX(i, vx * tooth);
        pos.setZ(i, vz * tooth);
        if (vy < -h * 0.3) pos.setY(i, vy - (1 - tooth) * 0.6);
      }
      const t = (vy + h / 2) / h; // 0 abajo, 1 arriba
      c.copy(dark).lerp(light, Math.min(1, 0.25 + t * 0.55 + (tooth - 0.78) * 1.4 + li * 0.05));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.translate(0, y, 0);
    g.computeVertexNormals();
    parts.push(g);
  });
  _pineFoliage = mergeGeometries(parts, false);
  return _pineFoliage;
}

/** Copa simplificada para los pinos lejanos: tres conos de 6 lados con el mismo degradado. */
let _farFoliage = null;
function farFoliageGeometry() {
  if (_farFoliage) return _farFoliage;
  const parts = [];
  const dark = new THREE.Color(0x203826);
  const light = new THREE.Color(0x4f7a52);
  [[2.3, 3.6, 3.6], [1.6, 3.2, 5.6], [0.9, 2.6, 7.6]].forEach(([r, h, y], li) => {
    const g = new THREE.ConeGeometry(r, h, 6, 1).toNonIndexed();
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + h / 2) / h;
      c.copy(dark).lerp(light, Math.min(1, 0.3 + t * 0.5 + li * 0.08));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.translate(0, y, 0);
    g.computeVertexNormals();
    parts.push(g);
  });
  _farFoliage = mergeGeometries(parts, false);
  return _farFoliage;
}

/**
 * Bosque de pinos con InstancedMesh (pocas llamadas de dibujo para miles de
 * árboles; cada uno con un verde algo distinto). `positions`: [{x, y, z, s}].
 * Sin colisión salvo que se pida (`colliders`).
 *
 * Nivel de detalle: los pinos a menos de `near` m de la cámara usan la copa
 * detallada y proyectan sombra; el resto, la copa simplificada sin sombra, y
 * los que la niebla ya oculta no se dibujan. El reparto se rehace cuando la
 * cámara se mueve unos metros (`lod(eye)`, lo llama MapManager.cull).
 * `far`: todos con la copa simplificada y sin reparto (pinos de fondo).
 */
export function pineForest(ctx, positions, { colliders = false, snow = false, far = false, near = 55 } = {}) {
  const n = positions.length;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  const matrices = new Float32Array(n * 16);
  const colors = new Float32Array(n * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const snowC = new THREE.Color(1.4, 1.45, 1.5);
  const r = mulberry(n * 7 + 3);
  positions.forEach((t, i) => {
    q.setFromAxisAngle(up, (i * 2.39996) % (Math.PI * 2));
    const sc = t.s ?? 1;
    s.set(sc * (0.9 + r() * 0.2), sc * (0.9 + r() * 0.25), sc * (0.9 + r() * 0.2));
    p.set(t.x, t.y ?? 0, t.z);
    m.compose(p, q, s).toArray(matrices, i * 16);
    // Variación de color por árbol (más amarillo, más azulado o con nieve)
    const k = r();
    tint.setRGB(0.85 + k * 0.3, 0.9 + r() * 0.2, 0.85 + (1 - k) * 0.25);
    if (snow && r() < 0.5) tint.lerp(snowC, 0.35);
    tint.toArray(colors, i * 3);
    if (colliders) ctx.world.addBox({ x: t.x - 0.3, y: t.y ?? 0, z: t.z - 0.3 }, { x: t.x + 0.3, y: (t.y ?? 0) + 3, z: t.z + 0.3 }, { climbable: false, cameraBlocking: false });
  });
  const set = (detailed, cast) => {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.3, 3.4, detailed ? 7 : 4).translate(0, 1.7, 0), trunkMat, n);
    const crown = new THREE.InstancedMesh(detailed ? pineFoliageGeometry() : farFoliageGeometry(), leafMat, n);
    crown.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    for (const im of [trunk, crown]) {
      im.castShadow = cast;
      im.receiveShadow = true;
      ctx.group.add(im);
    }
    return { trunk, crown };
  };
  if (far) {
    const f = set(false, false);
    f.trunk.instanceMatrix.array.set(matrices);
    f.crown.instanceMatrix.array.set(matrices);
    f.crown.instanceColor.array.set(colors);
    return [f.trunk, f.crown];
  }
  const hi = set(true, true);
  const lo = set(false, false);
  // Cerca de la cámara cambian a menudo: sin caja envolvente (siempre se dibujan)
  for (const im of [hi.trunk, hi.crown, lo.trunk, lo.crown]) {
    im.frustumCulled = false;
    im.count = 0;
  }
  const last = { x: Infinity, z: Infinity, far: 0 };
  const xs = positions.map((t) => t.x);
  const zs = positions.map((t) => t.z);
  const lod = {
    lod(eye) {
      // Distancia a la que la niebla ya los oculta (≈1 % de visibilidad)
      const fog = ctx.scene?.fog;
      const farD = fog?.isFogExp2 ? Math.min(900, 2.2 / Math.max(1e-4, fog.density)) : fog?.far ?? 900;
      if (Math.hypot(eye.x - last.x, eye.z - last.z) < 4 && Math.abs(farD - last.far) < 20) return;
      last.x = eye.x;
      last.z = eye.z;
      last.far = farD;
      const n2 = near * near;
      const f2 = farD * farD;
      let a = 0;
      let b = 0;
      const put = (dst, j, i) => {
        dst.trunk.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), j * 16);
        dst.crown.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), j * 16);
        dst.crown.instanceColor.array.set(colors.subarray(i * 3, i * 3 + 3), j * 3);
      };
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - eye.x;
        const dz = zs[i] - eye.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < n2) put(hi, a++, i);
        else if (d2 < f2) put(lo, b++, i);
      }
      for (const [dst, c] of [[hi, a], [lo, b]]) {
        for (const im of [dst.trunk, dst.crown]) {
          im.count = c;
          im.instanceMatrix.needsUpdate = true;
        }
        dst.crown.instanceColor.needsUpdate = true;
      }
    },
  };
  ctx.addEntity(lod);
  return [hi.trunk, hi.crown, lo.trunk, lo.crown];
}

/** Rocas sueltas (instanciadas, con forma irregular). `positions`: [{x, y, z, s}]. */
export function scatterRocks(ctx, positions, color = 0x6b6862) {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const r = mulberry(17);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.78 + r() * 0.35;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }), positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  const tint = new THREE.Color();
  positions.forEach((t, i) => {
    q.setFromEuler(e.set(r() * 0.4, r() * Math.PI * 2, r() * 0.4));
    sc.set(t.s * (0.8 + r() * 0.5), t.s * (0.6 + r() * 0.5), t.s * (0.8 + r() * 0.5));
    m.compose(new THREE.Vector3(t.x, (t.y ?? 0) + t.s * 0.15, t.z), q, sc);
    im.setMatrixAt(i, m);
    const k = 0.8 + r() * 0.35;
    im.setColorAt(i, tint.setRGB(k, k, k * (0.95 + r() * 0.1)));
  });
  im.castShadow = true;
  im.receiveShadow = true;
  ctx.group.add(im);
  return im;
}

/** Matorrales y helechos (bolas de hojas aplastadas, instanciadas). */
export function scatterBushes(ctx, positions, color = 0x34502f) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const r = mulberry(29);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.75 + r() * 0.45;
    pos.setXYZ(i, pos.getX(i) * k, Math.max(-0.2, pos.getY(i)) * k * 0.75, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }), positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const tint = new THREE.Color();
  positions.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    sc.setScalar(t.s ?? 1);
    m.compose(new THREE.Vector3(t.x, t.y ?? 0, t.z), q, sc);
    im.setMatrixAt(i, m);
    im.setColorAt(i, tint.setRGB(0.8 + r() * 0.4, 0.85 + r() * 0.3, 0.75 + r() * 0.3));
  });
  im.castShadow = true;
  im.receiveShadow = true;
  ctx.group.add(im);
  return im;
}
