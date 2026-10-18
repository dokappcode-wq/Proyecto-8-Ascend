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
  melee: { damage: 20, energyBonus: 8, range: 2.1, arc: 65, knockback: 7, cooldown: 0.55, hitDelay: 0.12 },
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
    return { x: p.x, y: p.y + 1, z: p.z };
  }

  capsule() {
    const p = this.position;
    return { x: p.x, y: p.y, z: p.z, r: this.radius, h: 1.8 };
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
    if (g.input.wasPressed('melee') && this._meleeCd === 0 && !g.player.motor.isBusy) {
      this._meleeCd = PLAYER_COMBAT.melee.cooldown;
      this._meleePending = PLAYER_COMBAT.melee.hitDelay;
      g.player.faceAim(0.35);
      g.player.model.trigger('punch');
    }
    if (this._meleePending >= 0) {
      this._meleePending -= dt;
      if (this._meleePending < 0) this._meleeHit();
    }
  }

  _meleeHit() {
    const g = this.game;
    const c = PLAYER_COMBAT.melee;
    const p = this.position;
    const f = g.player.facingVector();
    const energy = g.powers.available;
    const damage = c.damage + (energy ? c.energyBonus : 0);
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
      g.combat.applyDamage(t, damage, { point: tc, dir, knockback: c.knockback, kind: 'melee', faction: 'player', source: this });
      hits++;
    }
    if (hits) {
      g.player.updateModelMatrices();
      const hand = g.player.handWorldPosition();
      const color = energy ? g.powers.color : '#ffffff';
      g.vfx.impact(hand, null, color, energy ? 1.2 : 0.6);
      if (energy) g.marks.pulse(0.5, 0.1);
      g.cameraController.shake(0.15);
    }
    g.events.emit('player:melee', { hits });
  }
}
