import * as THREE from 'three';
import { stepProjectile } from '../combat/projectile.js';
import { glowSprite } from '../vfx/glowTexture.js';

/**
 * ProjectileSystem — proyectiles con colisión real (rayo por tramo), daño a
 * la entidad impactada, daño de área opcional y efectos visuales.
 */
export class ProjectileSystem {
  constructor({ scene, world, combat, vfx, events }) {
    this.scene = scene;
    this.world = world;
    this.combat = combat;
    this.vfx = vfx;
    this.events = events;
    this.list = [];
    this.group = new THREE.Group();
    this.group.name = 'Proyectiles';
    scene.add(this.group);
    this._sphere = new THREE.SphereGeometry(1, 14, 10);
    this._streak = new THREE.CylinderGeometry(0.6, 0.05, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
  }

  /**
   * @param {object} o { origin, dir, speed, range, radius, damage, color, kind, splashRadius, splashKnockback, knockback,
   *   faction='player' (no daña a su propia facción), owner (actor que dispara; nunca se impacta a sí mismo) }
   * kind: 'bolt' | 'discharge' (jugador), 'bullet' (PDC), 'orb' (Acólito)
   */
  spawn(o) {
    o = { faction: 'player', owner: null, ...o };
    const color = new THREE.Color(o.color);
    const big = o.kind === 'discharge';
    const bullet = o.kind === 'bullet';
    const obj = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).lerp(color, 0.25).multiplyScalar(2), toneMapped: false });
    const core = new THREE.Mesh(this._sphere, coreMat);
    core.scale.setScalar(o.radius);
    obj.add(core);
    const halo = glowSprite(color.clone().multiplyScalar(2), o.radius * (big ? 9 : bullet ? 5 : 8), bullet ? 0.6 : 0.9);
    obj.add(halo);
    const streakMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const streak = new THREE.Mesh(this._streak, streakMat);
    // Las balas son un trazo largo y fino; las esferas de energía, una estela corta.
    streak.scale.set(o.radius, o.radius, big ? 2.2 : bullet ? 3.5 : 1.4);
    obj.add(streak);
    obj.position.set(o.origin.x, o.origin.y, o.origin.z);
    obj.lookAt(o.origin.x + o.dir.x, o.origin.y + o.dir.y, o.origin.z + o.dir.z);
    this.group.add(obj);

    const light = bullet ? null : this.vfx.lights.acquire(obj);
    if (light) {
      light.color.copy(color);
      light.intensity = big ? 40 : 14;
      light.distance = big ? 12 : 7;
      light.position.copy(obj.position);
    }

    const p = {
      ...o,
      color,
      pos: { ...o.origin },
      traveled: 0,
      obj,
      light,
      materials: [coreMat, halo.material, streakMat],
    };
    this.list.push(p);
    return p;
  }

  /**
   * Estasis (pasiva de Gravedad): durante `duration` s los proyectiles
   * enemigos se quedan flotando donde estén; al terminar se deshacen.
   */
  stasis(duration) {
    this._stasis = Math.max(this._stasis ?? 0, duration);
  }

  get stasisActive() {
    return (this._stasis ?? 0) > 0;
  }

  update(dt) {
    const wasStasis = this.stasisActive;
    if (wasStasis) this._stasis = Math.max(0, this._stasis - dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.faction === 'enemy' && wasStasis) {
        if (!p.frozen) {
          p.frozen = true;
          p.obj.scale.setScalar(1.4);
        }
        p.obj.position.y = p.pos.y + Math.sin(performance.now() * 0.004 + i) * 0.04;
        if (!this.stasisActive) {
          this.vfx.particles.burst(p.pos, { count: 6, speed: 1.5, color: new THREE.Color('#c58bff'), size: 0.08, life: 0.4, gravity: 6 });
          this._remove(i);
        }
        continue;
      }
      const prev = { ...p.pos };
      const res = stepProjectile(p, dt, this.world, (o, d, t) => this.combat.raycastActors(o, d, t, { excludeFaction: p.faction, ignore: p.owner }));
      p.obj.position.set(p.pos.x, p.pos.y, p.pos.z);
      p.light?.position.copy(p.obj.position);
      // Estela de partículas a lo largo del tramo recorrido
      const n = p.kind === 'discharge' ? 6 : p.kind === 'bullet' ? 0 : 2;
      for (let k = 0; k < n; k++) {
        const t = Math.random();
        this.vfx.particles.emit({
          x: prev.x + (p.pos.x - prev.x) * t + (Math.random() - 0.5) * p.radius,
          y: prev.y + (p.pos.y - prev.y) * t + (Math.random() - 0.5) * p.radius,
          z: prev.z + (p.pos.z - prev.z) * t + (Math.random() - 0.5) * p.radius,
          vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.8,
          color: p.color, size: p.radius * (p.kind === 'discharge' ? 1.6 : 1.4), life: 0.25, drag: 2,
        });
      }
      if (!res) continue;
      if (res.type === 'hit') this._onHit(p, res);
      else this.vfx.particles.burst(res.point, { count: 6, speed: 2, color: p.color, size: 0.1, life: 0.3 });
      this._remove(i);
    }
  }

  _onHit(p, res) {
    const owner = res.actor ?? res.collider?.owner;
    const target = owner && this.combat.targets.has(owner) ? owner : null;
    p.onHit?.(target, res);
    if (target) {
      this.combat.applyDamage(target, p.damage, { point: res.point, dir: p.dir, knockback: p.knockback ?? 2, kind: p.kind, faction: p.faction, source: p.owner });
    }
    if (p.splashRadius) {
      this.combat.radial(res.point, p.splashRadius, Math.round(p.damage * 0.5), { knockback: p.splashKnockback ?? 0, exclude: target, kind: 'splash', faction: p.faction, source: p.owner });
    }
    const big = p.kind === 'discharge';
    this.vfx.impact(res.point, res.normal, p.color, big ? 2.2 : p.kind === 'bullet' ? 0.5 : 1);
    if (big) this.vfx.ring(res.point, p.splashRadius ?? 2, p.color, 0.35);
    this.events?.emit('projectile:hit', { kind: p.kind, point: res.point, target, faction: p.faction, collider: res.collider ?? null });
  }

  _remove(i) {
    const p = this.list[i];
    this.group.remove(p.obj);
    for (const m of p.materials) m.dispose();
    if (p.light) this.vfx.lights.release(p.light);
    this.list.splice(i, 1);
  }

  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this._remove(i);
  }
}
