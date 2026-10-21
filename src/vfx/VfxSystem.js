import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem.js';
import { SparkSystem } from './SparkSystem.js';
import { LightPool } from './LightPool.js';
import { glowSprite, ringTexture } from './glowTexture.js';

/**
 * VfxSystem — efectos visuales compartidos por todos los poderes:
 * partículas de energía, chispas, humo y polvo, destellos de luz, anillos
 * de onda, impactos y estelas.
 * Los efectos son puramente visuales; la lógica de juego vive en los poderes.
 */
export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = new ParticleSystem(5000);
    scene.add(this.particles.points);
    this.smoke = new ParticleSystem(900, { smoke: true });
    this.smoke.points.renderOrder = 9;
    scene.add(this.smoke.points);
    this.sparks = new SparkSystem(900);
    scene.add(this.sparks.lines);
    this.lights = new LightPool(scene, 6);
    this.transients = []; // { obj, life, maxLife, update(t) }
    this.group = new THREE.Group();
    this.group.name = 'VFX';
    scene.add(this.group);
    this._ringGeo = new THREE.RingGeometry(0.85, 1, 64);
    this._ghostGeo = new THREE.CapsuleGeometry(0.28, 1.1, 4, 12);
    this._segGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  /**
   * Rayo quebrado entre dos puntos (núcleo brillante + halo), con
   * ramificaciones y parpadeo. Puramente visual.
   * @param {object} o { width=0.08, duration=0.3, jitter=0.6, branches=2 }
   */
  lightning(from, to, color, { width = 0.08, duration = 0.3, jitter = 0.6, branches = 2 } = {}) {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const len = a.distanceTo(b);
    if (len < 0.05) return;
    const group = new THREE.Group();
    const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).lerp(new THREE.Color(color), 0.35).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.2), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const pts = this._jagged(a, b, Math.max(2, Math.ceil(len / 1.1)), jitter);
    this._addPolyline(group, pts, width, core, glow);
    for (let i = 0; i < branches; i++) {
      const k = 1 + Math.floor(Math.random() * (pts.length - 2));
      const start = pts[k];
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const side = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const end = start.clone().addScaledVector(dir, len * 0.15).addScaledVector(side, len * 0.12 + 0.5);
      this._addPolyline(group, this._jagged(start, end, 3, jitter * 0.6), width * 0.55, core, glow);
    }
    // Resplandor donde nace y donde golpea el rayo
    const hit = glowSprite(new THREE.Color(color).multiplyScalar(1.6), 0.9 + width * 6, 1);
    hit.position.copy(b);
    group.add(hit);
    const src = glowSprite(new THREE.Color(color).multiplyScalar(1.3), 0.5 + width * 3, 0.8);
    src.position.copy(a);
    group.add(src);
    this._addTransient(group, duration, (o, t) => {
      const flicker = 0.6 + Math.random() * 0.4;
      core.opacity = Math.min(1, t * 1.6) * flicker;
      glow.opacity = 0.25 * t * flicker;
      hit.material.opacity = t * flicker;
      src.material.opacity = 0.8 * t * flicker;
    }, false, [core, glow, hit.material, src.material]);
  }

  _jagged(a, b, n, jitter) {
    const pts = [a.clone()];
    const dir = new THREE.Vector3().subVectors(b, a);
    for (let i = 1; i < n; i++) {
      const p = a.clone().addScaledVector(dir, i / n);
      p.x += (Math.random() - 0.5) * 2 * jitter;
      p.y += (Math.random() - 0.5) * 2 * jitter * 0.4;
      p.z += (Math.random() - 0.5) * 2 * jitter;
      pts.push(p);
    }
    pts.push(b.clone());
    return pts;
  }

  _addPolyline(group, pts, width, core, glow) {
    const q = new THREE.Quaternion();
    const d = new THREE.Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      d.subVectors(pts[i + 1], pts[i]);
      const l = d.length();
      if (l < 1e-4) continue;
      q.setFromUnitVectors(this._up, d.divideScalar(l));
      for (const [mat, w] of [[core, width], [glow, width * 3]]) {
        const m = new THREE.Mesh(this._segGeo, mat);
        m.position.lerpVectors(pts[i], pts[i + 1], 0.5);
        m.quaternion.copy(q);
        m.scale.set(w, l, w);
        group.add(m);
      }
    }
  }

  setViewportHeight(h) {
    this.particles.setViewportHeight(h);
    this.smoke.setViewportHeight(h);
  }

  /**
   * Impacto: destello, chispas que salen rebotadas de la superficie, motas
   * de energía, onda de choque de frente y una bocanada de humo.
   */
  impact(point, normal, color, scale = 1) {
    const c = new THREE.Color(color);
    this.particles.burst(point, { count: Math.round(12 * scale), speed: 6 * scale, color: c, size: 0.11 * scale, life: 0.4, drag: 4, gravity: 6, normal, spread: 0.8 });
    this.particles.burst(point, { count: Math.round(5 * scale), speed: 1.5, color: new THREE.Color(0xffffff), size: 0.3 * scale, life: 0.18, drag: 2 });
    this.sparks.burst(point, { count: Math.round(10 * Math.sqrt(scale)), speed: 8 + 3 * scale, color: new THREE.Color(0xffffff).lerp(c, 0.5), life: 0.32 + 0.08 * scale, normal, spread: 0.85 });
    this.puff(point, { count: Math.round(2 + 2 * scale), size: 0.45 * scale, color: 0x6c6a68, rise: 0.8, life: 0.7 + 0.2 * scale });
    this.lights.flash(point, c, 25 * scale, 6 + 4 * scale, 0.2 + 0.1 * scale);
    const s = glowSprite(c, 1.4 * scale, 1);
    s.position.set(point.x, point.y, point.z);
    this._addTransient(s, 0.18, (o, t) => {
      o.material.opacity = t;
      o.scale.setScalar(1.4 * scale * (1.5 - 0.5 * t));
    });
    // Onda de choque (aro de frente a la cámara que se abre y se apaga)
    const shock = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), color: c.clone().multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    shock.position.copy(s.position);
    this._addTransient(shock, 0.22, (o, t) => {
      const k = 1 - t;
      o.scale.setScalar((0.3 + (1 - (1 - k) * (1 - k)) * 1.9) * scale);
      o.material.opacity = t * t;
    });
  }

  /**
   * Bocanada de humo o polvo (mezcla normal, no brilla).
   * @param {object} o { count, size, color, rise (m/s hacia arriba), life, spread (m/s laterales) }
   */
  puff(point, { count = 4, size = 0.5, color = 0x8a8680, rise = 0.6, life = 0.9, spread = 0.8 } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spread * (0.3 + Math.random() * 0.7);
      this.smoke.emit({
        x: point.x + (Math.random() - 0.5) * size * 0.4, y: point.y + (Math.random() - 0.5) * size * 0.3, z: point.z + (Math.random() - 0.5) * size * 0.4,
        vx: Math.cos(a) * v, vy: rise * (0.6 + Math.random() * 0.8), vz: Math.sin(a) * v,
        color: c.clone().multiplyScalar(0.85 + Math.random() * 0.3), size: size * (0.7 + Math.random() * 0.6), life: life * (0.7 + Math.random() * 0.5), drag: 2.2, gravity: 0,
      });
    }
  }

  /**
   * Polvo que se abre en anillo a ras de suelo (aterrizajes, golpes contra
   * el suelo, ondas expansivas).
   */
  dust(point, { count = 10, speed = 3, size = 0.5, color = 0x9a948a, life = 0.8 } = {}) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = speed * (0.6 + Math.random() * 0.5);
      this.smoke.emit({
        x: point.x + Math.cos(a) * 0.2, y: point.y + 0.12, z: point.z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * v, vy: 0.25 + Math.random() * 0.5, vz: Math.sin(a) * v,
        color: c.clone().multiplyScalar(0.85 + Math.random() * 0.3), size: size * (0.7 + Math.random() * 0.6), life: life * (0.7 + Math.random() * 0.5), drag: 3.2, gravity: 0,
      });
    }
  }

  /** Anillo que se expande horizontalmente (onda expansiva). */
  ring(center, radius, color, duration = 0.45) {
    this.dust(center, { count: Math.min(22, 8 + Math.round(radius * 2)), speed: radius * 2.2, size: 0.35 + radius * 0.08, life: 0.5 + duration });
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(this._ringGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(center.x, center.y + 0.1, center.z);
    this._addTransient(m, duration, (o, t) => {
      const k = 1 - t;
      const ease = 1 - (1 - k) * (1 - k);
      o.scale.setScalar(0.5 + ease * radius);
      o.material.opacity = t;
    });
    // Cúpula translúcida
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    dome.position.set(center.x, center.y, center.z);
    this._addTransient(dome, duration * 0.8, (o, t) => {
      const k = 1 - t;
      o.scale.set(0.5 + k * radius, 0.3 + k * radius * 0.45, 0.5 + k * radius);
      o.material.opacity = 0.35 * t;
    }, true);
  }

  /**
   * Silueta luminosa que se desvanece (estela del dash): borde brillante
   * (fresnel) y centro casi transparente, como un fantasma de energía.
   */
  afterimage(position, rotationY, color) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(color).multiplyScalar(1.5) }, opacity: { value: 0.6 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; uniform float opacity;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          gl_FragColor = vec4(color * (0.12 + rim * 1.4), opacity * (0.15 + rim));
        }`,
    });
    const m = new THREE.Mesh(this._ghostGeo, mat);
    m.position.set(position.x, position.y + 0.9, position.z);
    m.rotation.y = rotationY;
    this._addTransient(m, 0.3, (o, t) => {
      o.material.uniforms.opacity.value = 0.6 * t;
      o.scale.set(1 + (1 - t) * 0.3, 1 + (1 - t) * 0.06, 1 + (1 - t) * 0.3);
    }, true);
  }

  /**
   * Compila de antemano los shaders de los efectos (chispas, humo, aro de
   * choque, rayos, fantasma) con las luces y la niebla del mapa: sin esto, el
   * primer impacto de la partida da un tirón mientras se compilan. Los
   * efectos de prueba se crean lejos, bajo el mapa, y se borran al momento.
   */
  warmup(renderer, camera) {
    const p = { x: 0, y: -500, z: 0 };
    this.impact(p, { x: 0, y: 1, z: 0 }, 0xffffff, 1);
    this.afterimage(p, 0, 0xffffff);
    this.lightning(p, { x: 0, y: -499, z: 0 }, 0xffffff);
    this.ring(p, 1, 0xffffff);
    for (const s of [this.particles, this.smoke, this.sparks]) s.update(0);
    renderer.compile(this.scene, camera);
    this.clear();
  }

  /** @param {THREE.Material[]} [materials] materiales compartidos por un grupo, a liberar al terminar */
  _addTransient(obj, life, update, ownsMaterial = true, materials = null) {
    this.group.add(obj);
    this.transients.push({ obj, life, maxLife: life, update, ownsMaterial, materials });
  }

  update(dt) {
    this.particles.update(dt);
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.lights.update(dt);
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const tr = this.transients[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this._dispose(tr);
        this.transients.splice(i, 1);
        continue;
      }
      tr.update(tr.obj, tr.life / tr.maxLife);
    }
  }

  _dispose(tr) {
    this.group.remove(tr.obj);
    if (tr.materials) for (const m of tr.materials) m.dispose();
    if (tr.ownsMaterial) tr.obj.material?.dispose();
    // Los sprites comparten una geometría interna de Three.js: no se libera.
    if (!tr.obj.isSprite && tr.obj.geometry && ![this._ringGeo, this._ghostGeo, this._segGeo].includes(tr.obj.geometry)) tr.obj.geometry.dispose();
  }

  clear() {
    for (const tr of this.transients) this._dispose(tr);
    this.transients.length = 0;
    this.particles.clear();
    this.smoke.clear();
    this.sparks.clear();
    this.lights.clear();
  }
}
