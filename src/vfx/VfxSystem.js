import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem.js';
import { LightPool } from './LightPool.js';
import { glowSprite } from './glowTexture.js';

/**
 * VfxSystem — efectos visuales compartidos por todos los poderes:
 * partículas, destellos de luz, anillos de onda, impactos y estelas.
 * Los efectos son puramente visuales; la lógica de juego vive en los poderes.
 */
export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = new ParticleSystem(5000);
    scene.add(this.particles.points);
    this.lights = new LightPool(scene, 6);
    this.transients = []; // { obj, life, maxLife, update(t) }
    this.group = new THREE.Group();
    this.group.name = 'VFX';
    scene.add(this.group);
    this._ringGeo = new THREE.RingGeometry(0.85, 1, 64);
    this._ghostGeo = new THREE.CapsuleGeometry(0.28, 1.1, 4, 10);
  }

  setViewportHeight(h) {
    this.particles.setViewportHeight(h);
  }

  /** Destello e impacto de partículas en un punto. */
  impact(point, normal, color, scale = 1) {
    const c = new THREE.Color(color);
    this.particles.burst(point, { count: Math.round(18 * scale), speed: 7 * scale, color: c, size: 0.12 * scale, life: 0.4, drag: 4, gravity: 6, normal, spread: 0.8 });
    this.particles.burst(point, { count: Math.round(6 * scale), speed: 1.5, color: new THREE.Color(0xffffff), size: 0.3 * scale, life: 0.18, drag: 2 });
    this.lights.flash(point, c, 25 * scale, 6 + 4 * scale, 0.2 + 0.1 * scale);
    const s = glowSprite(c, 1.4 * scale, 1);
    s.position.set(point.x, point.y, point.z);
    this._addTransient(s, 0.18, (o, t) => {
      o.material.opacity = t;
      o.scale.setScalar(1.4 * scale * (1.5 - 0.5 * t));
    });
  }

  /** Anillo que se expande horizontalmente (onda expansiva). */
  ring(center, radius, color, duration = 0.45) {
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

  /** Silueta luminosa que se desvanece (estela del dash). */
  afterimage(position, rotationY, color) {
    const m = new THREE.Mesh(this._ghostGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(position.x, position.y + 0.9, position.z);
    m.rotation.y = rotationY;
    this._addTransient(m, 0.3, (o, t) => {
      o.material.opacity = 0.45 * t;
      o.scale.set(1 + (1 - t) * 0.3, 1, 1 + (1 - t) * 0.3);
    }, true);
  }

  _addTransient(obj, life, update, ownsMaterial = true) {
    this.group.add(obj);
    this.transients.push({ obj, life, maxLife: life, update, ownsMaterial });
  }

  update(dt) {
    this.particles.update(dt);
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
    if (tr.ownsMaterial) tr.obj.material?.dispose();
    // Los sprites comparten una geometría interna de Three.js: no se libera.
    if (!tr.obj.isSprite && tr.obj.geometry && tr.obj.geometry !== this._ringGeo && tr.obj.geometry !== this._ghostGeo) tr.obj.geometry.dispose();
  }

  clear() {
    for (const tr of this.transients) this._dispose(tr);
    this.transients.length = 0;
    this.particles.clear();
    this.lights.clear();
  }
}
