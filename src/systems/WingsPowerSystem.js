import * as THREE from 'three';
import { EnergyPool } from '../powers/EnergyPool.js';
import { Ability } from '../powers/Ability.js';
import { WINGS_CONFIG } from '../powers/wings/wingsConfig.js';
import { WingsVisual, FEATHER_GEO, featherMaterial } from '../player/WingsVisual.js';

const PINK = '#ff6fa8';
const PINK_C = new THREE.Color(PINK);
const WHITE_C = new THREE.Color('#fff2f7');
const GRAVITY = 20; // caída de las plumas de la lluvia
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

/** Velocidad de vuelo según las plumas que quedan (0..1). Pura, para las pruebas. */
export function flightSpeed(cfg, ratio, add = 0) {
  const r = Math.max(0, Math.min(1, ratio));
  return cfg.minSpeed + (cfg.maxSpeed - cfg.minSpeed) * r + add;
}

/** Plumas y bonificación de la espada de un tamaño (0 = 20 plumas, +20 %). Pura. */
export function swordStats(cfg, level, bonusAdd = 0) {
  return {
    feathers: cfg.cost + level * cfg.growCost,
    damageMul: 1 + cfg.bonus + level * cfg.bonusPerLevel + bonusAdd,
    rangeAdd: cfg.rangeAdd + level * cfg.rangePerLevel,
  };
}

/**
 * Pasiva Plumaje: parte del daño la absorben las plumas, mientras queden.
 * Devuelve { taken, feathers } (daño que se recibe y plumas que se gastan). Pura.
 */
export function plumageAbsorb(amount, feathers, cfg) {
  const want = amount * cfg.absorb;
  const absorbed = Math.min(want, feathers / cfg.feathersPerPoint);
  return { taken: amount - absorbed, feathers: absorbed * cfg.feathersPerPoint };
}

/**
 * WingsPowerSystem — familia Alas. Misma interfaz que PowerSystem.
 *
 * Las plumas son la carga y la munición a la vez (`energy`): 100, se
 * regeneran solas. Cada disparo gasta una pluma.
 * - Q (alterna): modo vuelo; cuantas más plumas, más rápido.
 * - R: espada de plumas (20 plumas, +20 % de ataque físico); mantener R la
 *   agranda (10 plumas y +10 % por tamaño).
 * - G: lluvia de plumas (50) sobre la zona señalada: desde el aire caen desde
 *   tu posición; desde el suelo suben y luego caen.
 * - X: escudo de plumas (10) delante; aguanta un ataque.
 */
export class WingsPowerSystem {
  constructor(game) {
    this.game = game;
    this.id = 'alas';
    this.cfg = structuredClone(WINGS_CONFIG);
    this.energy = new EnergyPool(this.cfg.pool);
    this.abilities = {
      projectile: new Ability(this.cfg.projectile),
      dash: new Ability(this.cfg.flight),
      discharge: new Ability(this.cfg.sword),
      wave: new Ability(this.cfg.rain),
      grenade: new Ability(this.cfg.shield),
    };
    this.mods = null;
    this.flying = false;
    /** Espada activa: { level, t } */
    this.sword = null;
    this._grow = 0;
    this.rains = [];
    this.shields = [];
    this._lastFail = 0;
    this._hand = new THREE.Vector3();
    this.visual = new WingsVisual(game.player.model, PINK);
    this.featherMat = featherMaterial(PINK);
    game.events.on('map:unloaded', () => this.clear());
    game.events.on('projectile:hit', (e) => this._onProjectileHit(e));
  }

  // ---------------------------------------------------------------- Interfaz común
  get available() {
    return this.game.marks.activeFamily === 'alas';
  }

  get color() {
    return PINK;
  }

  get isCharging() {
    return false;
  }

  get chargeRatio() {
    return 0;
  }

  get isTargeting() {
    return false;
  }

  get isDiving() {
    return false;
  }

  /** Las plumas son la munición: el HUD muestra una pluma por cada 10. */
  get magazine() {
    const n = Math.floor(this.energy.value + 1e-6);
    return { ammo: n, size: Math.round(this.energy.max), reloading: false, canFire: n >= 1, reloadProgress: 0, iconStep: 10 };
  }

  get feathers() {
    return Math.floor(this.energy.value + 1e-6);
  }

  /** Bonificación del golpe con la espada (PlayerCombat). */
  get meleeWeapon() {
    if (!this.sword) return null;
    const st = swordStats(this.cfg.sword, this.sword.level, this.mods?.swordBonusAdd ?? 0);
    return { kind: 'espada', damageMul: st.damageMul, rangeAdd: st.rangeAdd, onSwing: (f, range) => this._swordVfx(f, range) };
  }

  applyModifiers(m) {
    this.mods = m;
    const c = structuredClone(WINGS_CONFIG);
    c.pool.regenPerSecond *= m.featherRegenMul;
    c.flight.maxSpeed += m.flySpeedAdd;
    c.flight.minSpeed += m.flySpeedAdd * 0.5;
    c.shield.hits += m.shieldHitsAdd;
    c.drain.rate *= m.drainMul;
    this.cfg = c;
    this.abilities.projectile.def = c.projectile;
    this.abilities.dash.def = c.flight;
    this.abilities.discharge.def = c.sword;
    this.abilities.wave.def = c.rain;
    this.abilities.grenade.def = c.shield;
    this.energy.regenPerSecond = c.pool.regenPerSecond;
    const max = c.pool.max + (m.energyMaxAdd ?? 0);
    const grow = max - this.energy.max;
    this.energy.max = max;
    this.energy.value = Math.min(max, this.energy.value + Math.max(0, grow));
  }

  resetAbilities() {
    for (const a of Object.values(this.abilities)) a.reset();
    this.stopFlight();
    this._setSword(null);
  }

  clear() {
    this.stopFlight();
    this._setSword(null);
    for (const r of this.rains) this.game.scene.remove(r.mesh);
    for (const s of this.shields) this._removeShield(s);
    this.rains.length = this.shields.length = 0;
  }

  _fail(id) {
    const now = performance.now();
    if (now - this._lastFail < 300) return;
    this._lastFail = now;
    this.game.events.emit('power:failed', { id });
  }

  _handPos() {
    this.game.player.updateModelMatrices();
    return this.game.player.handWorldPosition(this._hand);
  }

  // ---------------------------------------------------------------- Por frame
  update(dt) {
    const g = this.game;
    const input = g.input;
    const motor = g.player.motor;
    this.energy.infinite = !!g.save.data.debug?.infiniteEnergy;
    this.energy.update(dt);
    for (const a of Object.values(this.abilities)) a.tick(dt);
    this._updateRains(dt);
    this._updateShields(dt);
    if (this.sword) {
      this.sword.t += dt;
      if (this.sword.t >= this.cfg.sword.life) this._setSword(null);
    }

    // Alas visibles solo con la marca activa; tantas plumas como quedan
    this.visual.setVisible(this.available);
    if (this.available) {
      this.visual.setFeathers(this.energy.value / this.energy.max);
      this.visual.update(dt, this.flying && !motor.grounded);
    }

    const blocked = !this.available || g.playerCombat?.dead || g.acquisition?.active || g.drain?.active;
    if (blocked) {
      this.stopFlight();
      if (!this.available) this._setSword(null);
      return;
    }
    const aiming = input.isDown('aim');
    g.player.aiming = aiming;
    g.player.speedScale = aiming ? 0.65 : 1;

    if (input.isDown('attack') || input.wasPressed('attack')) this._fire();
    if (input.wasPressed('special')) {
      if (this.flying) this.stopFlight();
      else this._startFlight();
    }
    if (this.flying) {
      if (motor.isClimbing) this.stopFlight();
      else motor.fly = { speed: this.flySpeed, response: this.cfg.flight.response };
    }
    // Espada: pulsar la crea; mantener (o volver a pulsar) la agranda
    if (input.wasPressed('charged')) {
      this._grow = 0;
      if (this.sword) this._growSword();
      else this._makeSword();
    } else if (input.isDown('charged') && this.sword) {
      this._grow += dt;
      if (this._grow >= this.cfg.sword.growEvery) {
        this._grow = 0;
        this._growSword();
      }
    }
    if (input.wasPressed('wave')) this._rain();
    if (input.wasPressed('grenade')) this._shield();
  }

  get flySpeed() {
    return flightSpeed(this.cfg.flight, this.energy.value / this.energy.max);
  }

  // ---------------------------------------------------------------- Disparo
  _fire() {
    const g = this.game;
    const a = this.abilities.projectile;
    if (!a.ready) return;
    if (!a.commit(this.energy)) return this._fail('projectile');
    const c = this.cfg.projectile;
    g.player.faceAim(0.6);
    const hand = this._handPos();
    const dir = g.powers._aimDirFrom(hand);
    g.projectiles.spawn({
      origin: { x: hand.x, y: hand.y, z: hand.z }, dir, speed: c.speed, range: c.range, radius: c.radius,
      damage: c.damage, color: PINK, kind: 'pluma', knockback: 0.5,
    });
    g.marks.pulse(0.25, 0.08);
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'plumas' });
  }

  // ---------------------------------------------------------------- Vuelo (Q)
  _startFlight() {
    const g = this.game;
    const motor = g.player.motor;
    if (motor.isBusy) return;
    if (!this.abilities.dash.commit(this.energy)) return this._fail('dash');
    this.flying = true;
    motor.fly = { speed: this.flySpeed, response: this.cfg.flight.response };
    // Pequeño despegue desde el suelo
    if (motor.grounded) {
      motor.velocity.y = Math.max(motor.velocity.y, 6);
      motor.grounded = false;
    }
    const p = motor.position;
    g.vfx.particles.burst({ x: p.x, y: p.y + 1.2, z: p.z }, { count: 18, speed: 3, color: WHITE_C, size: 0.12, life: 0.6, drag: 2 });
    g.events.emit('power:used', { id: 'vuelo' });
    g.events.emit('wings:flight-start');
  }

  stopFlight() {
    if (!this.flying) return;
    this.flying = false;
    this.game.player.motor.fly = null;
    this.game.events.emit('wings:flight-end');
  }

  // ---------------------------------------------------------------- Espada (R)
  _setSword(level) {
    this.sword = level === null ? null : { level, t: 0 };
    this.visual.setSword(level);
  }

  _makeSword() {
    const g = this.game;
    if (!this.abilities.discharge.commit(this.energy)) return this._fail('discharge');
    this._setSword(0);
    this._swordFx();
    g.events.emit('power:used', { id: 'espada', level: 0 });
  }

  _growSword() {
    const g = this.game;
    const c = this.cfg.sword;
    if (this.sword.level >= c.maxLevel) return;
    if (!this.energy.spend(c.growCost)) return this._fail('discharge');
    this._setSword(this.sword.level + 1);
    this._swordFx();
    g.events.emit('power:used', { id: 'espada', level: this.sword.level });
  }

  _swordFx() {
    const g = this.game;
    const hand = this._handPos();
    g.vfx.particles.burst(hand, { count: 14, speed: 2.5, color: WHITE_C, size: 0.1, life: 0.4, drag: 2 });
    g.marks.pulse(0.5, 0.15);
  }

  _swordVfx(f, range) {
    const g = this.game;
    const p = g.player.motor.position;
    const base = Math.atan2(f.x, f.z);
    for (let i = 0; i <= 16; i++) {
      const a = base + (i / 16 - 0.5) * Math.PI * 0.8;
      g.vfx.particles.emit({ x: p.x + Math.sin(a) * range * 0.85, y: p.y + 1.1, z: p.z + Math.cos(a) * range * 0.85, vx: Math.cos(a) * 2, vy: 0.2, vz: -Math.sin(a) * 2, color: i % 3 ? WHITE_C : PINK_C, size: 0.12, life: 0.3, drag: 3 });
    }
  }

  // ---------------------------------------------------------------- Lluvia de plumas (G)
  /** Centro de la zona: lo que se señala en el suelo (o delante, si está lejos). */
  _rainTarget() {
    const g = this.game;
    const c = this.cfg.rain;
    const p = g.player.motor.position;
    const aim = g.powers.aimPoint(new THREE.Vector3());
    let dx = aim.x - p.x;
    let dz = aim.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > c.range || d < 0.5) {
      const f = g.cameraController.forward();
      const k = d > c.range ? c.range : 8;
      dx = (d > c.range ? dx / d : f.x) * k;
      dz = (d > c.range ? dz / d : f.z) * k;
    }
    const x = p.x + dx;
    const z = p.z + dz;
    const gy = g.world.groundHeight(x, z, 0.2, Math.max(aim.y, p.y) + 2);
    return { x, y: Number.isFinite(gy) ? gy : p.y, z };
  }

  _rain() {
    const g = this.game;
    const a = this.abilities.wave;
    const c = this.cfg.rain;
    if (!a.commit(this.energy)) return this._fail('wave');
    const motor = g.player.motor;
    const p = motor.position;
    const center = this._rainTarget();
    const air = !motor.grounded;
    const mesh = new THREE.InstancedMesh(FEATHER_GEO, this.featherMat, c.feathers);
    mesh.frustumCulled = false;
    g.scene.add(mesh);
    const feathers = [];
    for (let i = 0; i < c.feathers; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * c.radius;
      const to = { x: center.x + Math.cos(ang) * r, y: center.y, z: center.z + Math.sin(ang) * r };
      // Desde el aire caen desde tu posición; desde el suelo suben primero
      const from = { x: p.x + (Math.random() - 0.5) * 1.2, y: p.y + 1.4 + Math.random() * 0.6, z: p.z + (Math.random() - 0.5) * 1.2 };
      const T = (air ? c.airTime : c.groundTime) * (0.85 + Math.random() * 0.3);
      const vel = {
        x: (to.x - from.x) / T,
        y: (to.y - from.y + 0.5 * GRAVITY * T * T) / T,
        z: (to.z - from.z) / T,
      };
      feathers.push({ pos: { ...from }, vel, t: 0, T, to, done: false, delay: i * 0.012 });
    }
    this.rains.push({ mesh, feathers, center, radius: c.radius, damage: c.damage, hitRadius: c.hitRadius });
    g.player.faceAim(0.4);
    g.player.model.trigger(air ? 'wave' : 'cast');
    g.marks.pulse(0.8, 0.25);
    g.vfx.ring({ x: center.x, y: center.y + 0.05, z: center.z }, c.radius, PINK, 0.6);
    g.events.emit('power:used', { id: 'lluvia', air, center });
  }

  _updateRains(dt) {
    const g = this.game;
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      let alive = 0;
      r.feathers.forEach((f, k) => {
        if (f.done) {
          _m.makeScale(0, 0, 0);
          r.mesh.setMatrixAt(k, _m);
          return;
        }
        alive++;
        if (f.delay > 0) {
          f.delay -= dt;
          _m.makeScale(0, 0, 0);
          r.mesh.setMatrixAt(k, _m);
          return;
        }
        f.t += dt;
        f.vel.y -= GRAVITY * dt;
        f.pos.x += f.vel.x * dt;
        f.pos.y += f.vel.y * dt;
        f.pos.z += f.vel.z * dt;
        // La pluma apunta en la dirección en la que se mueve
        _d.set(f.vel.x, f.vel.y, f.vel.z).normalize().negate();
        _q.setFromUnitVectors(_up, _d.negate());
        _p.set(f.pos.x, f.pos.y, f.pos.z);
        r.mesh.setMatrixAt(k, _m.compose(_p, _q, _s));
        if (f.t >= f.T || f.pos.y <= f.to.y) {
          f.done = true;
          this._featherLand(r, f.to);
        }
      });
      r.mesh.instanceMatrix.needsUpdate = true;
      if (!alive) {
        g.scene.remove(r.mesh);
        r.mesh.dispose();
        this.rains.splice(i, 1);
      }
    }
  }

  _featherLand(r, at) {
    const g = this.game;
    for (const t of [...g.combat.targets]) {
      if (!t.alive || t === g.playerCombat || !t.position) continue;
      const tp = t.position;
      if (Math.hypot(tp.x - at.x, tp.z - at.z) > r.hitRadius + (t.radius ?? 0.4) || Math.abs(tp.y - at.y) > 2.5) continue;
      g.combat.applyDamage(t, r.damage, { point: t.center, kind: 'lluvia', faction: 'player', source: g.playerCombat });
    }
    if (Math.random() < 0.5) g.vfx.particles.burst({ x: at.x, y: at.y + 0.1, z: at.z }, { count: 3, speed: 1.5, color: WHITE_C, size: 0.08, life: 0.35, drag: 2 });
  }

  // ---------------------------------------------------------------- Escudo de plumas (X)
  _shield() {
    const g = this.game;
    const a = this.abilities.grenade;
    const c = this.cfg.shield;
    if (!a.commit(this.energy)) return this._fail('grenade');
    const p = g.player.motor.position;
    const f = g.cameraController.forward();
    const fl = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / fl;
    const fz = f.z / fl;
    const cx = p.x + fx * c.distance;
    const cz = p.z + fz * c.distance;
    // Colisionador: caja que envuelve el muro (las cajas son AABB)
    const hw = Math.abs(fz) * c.width / 2 + Math.abs(fx) * c.thickness / 2;
    const hd = Math.abs(fx) * c.width / 2 + Math.abs(fz) * c.thickness / 2;
    const collider = g.world.addBox({ x: cx - hw, y: p.y, z: cz - hd }, { x: cx + hw, y: p.y + c.height, z: cz + hd }, { tag: 'shield', cameraBlocking: false, climbable: false });
    // Muro de plumas superpuestas
    const cols = 9;
    const rows = 5;
    const mesh = new THREE.InstancedMesh(FEATHER_GEO, this.featherMat, cols * rows);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        _p.set((col / (cols - 1) - 0.5) * c.width + (r % 2 ? 0.12 : 0), c.height - r * (c.height / rows), 0);
        _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (col % 2 ? 0.12 : -0.12));
        _s.set(2.6, 1.1, 1);
        mesh.setMatrixAt(k++, _m.compose(_p, _q, _s));
      }
    }
    _s.set(1, 1, 1);
    mesh.position.set(cx, p.y, cz);
    mesh.rotation.y = Math.atan2(fx, fz);
    mesh.castShadow = true;
    g.scene.add(mesh);
    this.shields.push({ collider, mesh, hits: c.hits, t: 0, life: c.life, center: { x: cx, y: p.y + c.height / 2, z: cz } });
    g.player.faceAim(0.4);
    g.vfx.particles.burst({ x: cx, y: p.y + 1.2, z: cz }, { count: 20, speed: 3, color: WHITE_C, size: 0.12, life: 0.5, drag: 3 });
    g.marks.pulse(0.5, 0.15);
    g.events.emit('power:used', { id: 'escudo' });
  }

  _onProjectileHit(e) {
    if (e.faction === 'player' || !e.collider) return;
    const s = this.shields.find((x) => x.collider === e.collider);
    if (!s) return;
    s.hits--;
    this.game.events.emit('wings:shield-hit', { left: s.hits });
    if (s.hits <= 0) {
      // Deja de parar balas ya (otra bala en este mismo paso pasa) y se deshace en el siguiente
      s.collider.enabled = false;
      s.t = s.life;
    }
  }

  _updateShields(dt) {
    const g = this.game;
    for (let i = this.shields.length - 1; i >= 0; i--) {
      const s = this.shields[i];
      s.t += dt;
      if (s.t >= s.life) {
        g.vfx.particles.burst(s.center, { count: 30, speed: 4, color: WHITE_C, size: 0.12, life: 0.7, drag: 2, gravity: 4 });
        this._removeShield(s);
        this.shields.splice(i, 1);
        g.events.emit('wings:shield-broken');
      }
    }
  }

  _removeShield(s) {
    this.game.world.removeBox(s.collider);
    this.game.scene.remove(s.mesh);
    s.mesh.dispose();
  }
}
