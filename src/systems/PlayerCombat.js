import * as THREE from 'three';
import { Health } from '../combat/Health.js';

/**
 * PlayerCombat — el protagonista como actor de combate: salud, daño
 * recibido (proyectiles, caídas), golpe cuerpo a cuerpo, neutralización y
 * reaparición.
 */
export const PLAYER_COMBAT = Object.freeze({
  health: 100,
  regenPerSecond: 8,
  regenDelay: 5,
  respawnTime: 3,
  respawnInvulnerability: 2,
  // Daño por caída: a partir de esta velocidad de impacto (≈ 7.7 m de caída)
  fallDamageSpeed: 21,
  fallDamagePerMs: 3.5,
  melee: {
    damage: 20, range: 2.1, arc: 65, knockback: 7, cooldown: 0.55, hitDelay: 0.12,
    // Golpe elemental (con la marca de Energía y energía suficiente)
    elementalDamage: 32, elementalCost: 5, elementalKnockback: 10,
    // Embestida: si hay un enemigo cerca y delante, se lanza hacia él
    lungeRange: 7.5, lungeArc: 40, lungeSpeed: 30, lungeStop: 1.1,
  },
});

export class PlayerCombat {
  constructor(game) {
    this.game = game;
    this.faction = 'player';
    this.radius = 0.4;
    this.health = new Health({ max: PLAYER_COMBAT.health, regenPerSecond: PLAYER_COMBAT.regenPerSecond, regenDelay: PLAYER_COMBAT.regenDelay });
    this.dead = false;
    this._deadTime = 0;
    this._meleeCd = 0;
    this._meleePending = -1;
    this._meleeElemental = false;
    this._lunge = null; // { target }
    this._fists = 0;
    this.registered = false;
  }

  get motor() {
    return this.game.player.motor;
  }

  get position() {
    return this.game.player.motor.position;
  }

  get alive() {
    return this.health.alive && !this.dead;
  }

  get center() {
    const p = this.position;
    return { x: p.x, y: p.y + this.game.player.motor.currentHeight * 0.55, z: p.z };
  }

  capsule() {
    const p = this.position;
    // Agachado (p. ej. tras una cobertura) el cuerpo es más bajo
    return { x: p.x, y: p.y, z: p.z, r: this.radius, h: this.game.player.motor.currentHeight };
  }

  /** Se registra en el combate al cargar un mapa (el registro se vacía al descargar). */
  attach() {
    this.game.combat.registerActor(this);
    this.registered = true;
  }

  takeDamage(amount, info = {}) {
    if (this.dead) return 0;
    const dealt = this.health.damage(amount);
    if (dealt <= 0) return 0;
    const g = this.game;
    g.player.model.trigger('hit');
    g.cameraController.shake(Math.min(0.5, 0.12 + dealt / 60));
    const src = info.source?.position ?? null;
    g.events.emit('player:damaged', { amount: dealt, kind: info.kind ?? 'generic', from: src ? { x: src.x, y: src.y, z: src.z } : null, dir: info.dir ?? null, health: this.health.value });
    if (!this.health.alive) this._die(info.kind ?? 'generic');
    return dealt;
  }

  applyImpulse(x, y, z) {
    const m = this.motor;
    if (this.dead || m.isBusy) return;
    m.velocity.x += x * 0.6;
    m.velocity.z += z * 0.6;
  }

  _die(cause) {
    this.dead = true;
    this._deadTime = 0;
    this.game.events.emit('player:died', { cause });
  }

  respawn() {
    const g = this.game;
    this.dead = false;
    this.health.reset(PLAYER_COMBAT.respawnInvulnerability);
    g.player.model.root.rotation.x = 0;
    g.player.motor.respawn();
    g.player.spawnAt({ ...g.player.motor.spawnPoint, yaw: g.mapManager.current?.spawn?.yaw });
    g.powers.energy.refill();
    g.powers.resetAbilities();
    g.enemies.forgetTarget();
    g.events.emit('player:respawned', { afterDeath: true });
  }

  /** Restaura la salud (depuración). */
  restore() {
    this.health.reset(0);
  }

  update(dt) {
    const g = this.game;
    this.health.godMode = !!g.save.data.debug?.invulnerable;
    this.health.update(dt);

    if (this.dead) {
      this._deadTime += dt;
      // Caída del cuerpo
      g.player.model.root.rotation.x = -Math.min(1, this._deadTime * 2.5) * (Math.PI / 2) * 0.95;
      if (this._deadTime >= PLAYER_COMBAT.respawnTime) this.respawn();
      return;
    }

    // Daño por caída (el aterrizaje del rayo y del dash dirigido es inmune)
    const ev = g.player.motor.events;
    if (ev.landed && !ev.landingImmune && ev.landingSpeed > PLAYER_COMBAT.fallDamageSpeed) {
      const dmg = Math.round((ev.landingSpeed - PLAYER_COMBAT.fallDamageSpeed) * PLAYER_COMBAT.fallDamagePerMs);
      if (dmg > 0) this.takeDamage(dmg, { kind: 'caída' });
    }

    // Cuerpo a cuerpo (F)
    this._meleeCd = Math.max(0, this._meleeCd - dt);
    const busy = g.player.motor.isBusy || g.acquisition?.active || g.player.disabled;
    if (g.input.wasPressed('melee') && this._meleeCd === 0 && !busy) this._startMelee();
    if (this._lunge) {
      const m = g.player.motor;
      this._lungeVfx();
      if (!m.isTraveling) {
        // Llegada: golpe inmediato
        this._lunge = null;
        g.player.faceAim(0.3);
        g.player.model.trigger('punch');
        this._meleePending = 0.06;
      }
    }
    if (this._meleePending >= 0) {
      this._meleePending -= dt;
      if (this._meleePending < 0) this._meleeHit();
    }
    // Puños eléctricos visibles mientras dura el golpe elemental
    this._fists = Math.max(0, this._fists - dt * 2.2);
    g.player.model.setFists(this._fists, g.powers.color);
    if (this._fists > 0.05 && Math.random() < 0.5) {
      g.player.updateModelMatrices();
      const hand = g.player.handWorldPosition();
      g.vfx.particles.burst(hand, { count: 2, speed: 2.5, color: new THREE.Color(g.powers.color), size: 0.06, life: 0.15 });
    }
  }

  /** ¿El golpe actual será elemental? Requiere la marca y energía suficiente. */
  canElemental() {
    const g = this.game;
    return g.powers.available && g.powers.energy.canSpend(PLAYER_COMBAT.melee.elementalCost);
  }

  _startMelee() {
    const g = this.game;
    const c = PLAYER_COMBAT.melee;
    this._meleeCd = c.cooldown;
    this._meleeElemental = this.canElemental();
    if (this._meleeElemental) {
      g.powers.energy.spend(c.elementalCost);
      this._fists = 1;
      g.marks.pulse(0.45, 0.15);
      // Embestida hacia el enemigo más cercano delante
      const target = this._lungeTarget();
      if (target) {
        const p = g.player.motor.position;
        const t = target.center;
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const d = Math.hypot(dx, dz);
        const stop = Math.max(0, d - c.lungeStop);
        const dest = { x: p.x + (dx / d) * stop, y: p.y, z: p.z + (dz / d) * stop };
        const gy = g.world.groundHeight(dest.x, dest.z, 0.3, p.y + 1.5);
        if (Number.isFinite(gy) && Math.abs(gy - p.y) < 1.5) dest.y = gy;
        if (g.player.motor.startTravel({ ...dest, speed: c.lungeSpeed })) {
          this._lunge = { target };
          this._fists = 1.6;
          g.events.emit('player:lunge', { target });
          return;
        }
      }
    }
    g.player.faceAim(0.35);
    g.player.model.trigger('punch');
    this._meleePending = c.hitDelay;
  }

  /** Enemigo vivo más cercano dentro del alcance de embestida, delante (según la cámara) y visible. */
  _lungeTarget() {
    const g = this.game;
    const c = PLAYER_COMBAT.melee;
    const p = g.player.motor.position;
    const f = g.cameraController.forward();
    let best = null;
    let bestD = Infinity;
    for (const a of g.combat.actors) {
      if (a === this || !a.alive || a.faction !== 'enemy') continue;
      const t = a.center;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > c.lungeRange || d < c.range * 0.8 || d >= bestD) continue;
      if ((dx * f.x + dz * f.z) / d < Math.cos(THREE.MathUtils.degToRad(c.lungeArc))) continue;
      const eye = { x: p.x, y: p.y + 1.2, z: p.z };
      const dir = { x: dx / d, y: (t.y - eye.y) / d, z: dz / d };
      const l = Math.hypot(dir.x, dir.y, dir.z);
      const hit = g.world.raycastHit(eye, { x: dir.x / l, y: dir.y / l, z: dir.z / l }, d, { ignoreTags: ['bounds'] });
      if (hit && hit.t < d - 0.5) continue;
      best = a;
      bestD = d;
    }
    return best;
  }

  _lungeVfx() {
    const g = this.game;
    const p = g.player.motor.position;
    g.vfx.afterimage(p, g.player.facing, g.powers.color);
    g.vfx.particles.burst({ x: p.x, y: p.y + 1, z: p.z }, { count: 4, speed: 2, color: new THREE.Color(g.powers.color), size: 0.08, life: 0.25 });
  }

  _meleeHit() {
    const g = this.game;
    const c = PLAYER_COMBAT.melee;
    const p = this.position;
    const f = g.player.facingVector();
    const energy = this._meleeElemental;
    const damage = energy ? c.elementalDamage : c.damage;
    const knockback = energy ? c.elementalKnockback : c.knockback;
    let hits = 0;
    for (const t of [...g.combat.targets]) {
      if (t === this || !t.alive) continue;
      const tc = t.center;
      const dx = tc.x - p.x;
      const dz = tc.z - p.z;
      const dy = tc.y - (p.y + 1);
      const d = Math.hypot(dx, dz) - (t.radius ?? 0.3);
      if (d > c.range || Math.abs(dy) > 1.6) continue;
      const l = Math.hypot(dx, dz) || 1;
      const cos = (dx * f.x + dz * f.z) / l;
      if (cos < Math.cos(THREE.MathUtils.degToRad(c.arc))) continue;
      const dir = { x: (dx / l) * 0.85, y: 0.35, z: (dz / l) * 0.85 };
      g.combat.applyDamage(t, damage, { point: tc, dir, knockback, kind: energy ? 'melee-energia' : 'melee', faction: 'player', source: this });
      hits++;
      if (energy) {
        g.player.updateModelMatrices();
        g.vfx.lightning(g.player.handWorldPosition(), tc, g.powers.color, { width: 0.05, duration: 0.2, jitter: 0.2, branches: 2 });
      }
    }
    if (hits) {
      g.player.updateModelMatrices();
      const hand = g.player.handWorldPosition();
      const color = energy ? g.powers.color : '#ffffff';
      g.vfx.impact(hand, null, color, energy ? 1.2 : 0.6);
      if (energy) g.marks.pulse(0.5, 0.1);
      g.cameraController.shake(0.15);
    }
    g.events.emit('player:melee', { hits, elemental: energy });
  }
}
