import * as THREE from 'three';
import { EnergyPool } from '../powers/EnergyPool.js';
import { Ability } from '../powers/Ability.js';
import { Magazine } from '../powers/Magazine.js';
import { GRAVITY_CONFIG } from '../powers/gravity/gravityConfig.js';
import { GravityStone } from '../powers/gravity/GravityStone.js';
import { enemyAtCrosshair } from '../powers/targeting.js';

const PURPLE = '#a24dff';

/**
 * GravityPowerSystem — familia Gravedad. Misma interfaz que PowerSystem
 * (energía, habilidades, cargador, `available`…) para que el HUD, el golpe y
 * la absorción funcionen con cualquier familia.
 *
 * - Clic izq.: disparo único (cargador de 1); el objetivo queda flotando.
 * - Q: eleva una roca bajo los pies; en el aire, otra (hasta 3 seguidas).
 * - R: Atraer (daño + aturdimiento; si flota, lo trae a tu lado).
 * - G: Empujar (cono delante, daño y retroceso).
 * - X / clic central: granada de gravedad (burbuja de antigravedad).
 * Los saltos especiales y la pasiva se gestionan en PlayerController y
 * PlayerCombat a partir de `cfg.jumps` y `cfg.passive`.
 */
export class GravityPowerSystem {
  constructor(game) {
    this.game = game;
    this.id = 'gravedad';
    this.cfg = structuredClone(GRAVITY_CONFIG);
    this.energy = new EnergyPool(this.cfg.pool);
    this.abilities = {
      projectile: new Ability(this.cfg.projectile),
      dash: new Ability(this.cfg.stones),
      discharge: new Ability(this.cfg.pull),
      wave: new Ability(this.cfg.push),
      grenade: new Ability(this.cfg.grenade),
    };
    this.abilities.projectile.magazine = new Magazine({ size: this.cfg.projectile.magazineSize, reloadTime: this.cfg.projectile.reloadTime });
    this.mods = null;
    this.stones = [];
    this._chain = 0; // rocas encadenadas desde el último apoyo en suelo firme
    this.grenades = [];
    this.bubbles = [];
    this._lastFail = 0;
    this._v = new THREE.Vector3();
    this._hand = new THREE.Vector3();
    game.events.on('map:unloaded', () => this.clear());
  }

  // ---------------------------------------------------------------- Interfaz común
  get available() {
    return this.game.marks.activeFamily === 'gravedad';
  }

  get color() {
    return PURPLE;
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

  get magazine() {
    return this.abilities.projectile.magazine;
  }

  get maxStones() {
    return this.cfg.stones.max + (this.mods?.stoneBonus ?? 0);
  }

  applyModifiers(m) {
    this.mods = m;
    const c = structuredClone(GRAVITY_CONFIG);
    c.pull.damage += m.pullDamageAdd;
    c.pull.stun += m.pullStunAdd;
    c.push.damage += m.pushDamageAdd;
    c.push.knockback += m.pushKnockbackAdd;
    c.grenade.radius += m.bubbleRadiusAdd;
    c.grenade.duration += m.bubbleTimeAdd;
    c.drain.rate *= m.drainMul;
    this.cfg = c;
    this.abilities.projectile.def = c.projectile;
    this.abilities.dash.def = c.stones;
    this.abilities.discharge.def = c.pull;
    this.abilities.wave.def = c.push;
    this.abilities.grenade.def = c.grenade;
    const max = c.pool.max + (m.energyMaxAdd ?? 0);
    const grow = max - this.energy.max;
    this.energy.max = max;
    this.energy.value = Math.min(max, this.energy.value + Math.max(0, grow));
  }

  resetAbilities() {
    for (const a of Object.values(this.abilities)) {
      a.reset();
      a.magazine?.refill();
    }
    this._chain = 0;
  }

  /** Quita rocas, granadas y burbujas (cambio de mapa). */
  clear() {
    for (const s of this.stones) s.dispose();
    this.stones.length = 0;
    for (const gr of this.grenades) this.game.scene.remove(gr.mesh);
    this.grenades.length = 0;
    for (const b of this.bubbles) this._removeBubble(b);
    this.bubbles.length = 0;
    this._chain = 0;
  }

  // ---------------------------------------------------------------- Por frame
  update(dt) {
    const g = this.game;
    const input = g.input;
    const motor = g.player.motor;

    this.energy.infinite = !!g.save.data.debug?.infiniteEnergy;
    this.energy.update(dt);
    for (const a of Object.values(this.abilities)) a.tick(dt);
    this._updateMagazine(dt);

    // Rocas: siguen existiendo aunque se cambie de marca
    this.stones = this.stones.filter((s) => s.update(dt, motor));
    const onStone = this.stones.some((s) => s.supports(motor.position, motor.cfg.radius));
    if (motor.grounded && !onStone) this._chain = 0;
    this._updateGrenades(dt);
    this._updateBubbles(dt);

    if (!this.available || g.playerCombat?.dead || g.acquisition?.active || g.drain?.active || motor.isClimbing) {
      if (this.available) {
        g.player.aiming = false;
        g.player.speedScale = 1;
      }
      return;
    }
    const aiming = input.isDown('aim');
    g.player.aiming = aiming;
    g.player.speedScale = aiming ? 0.65 : 1;

    if (input.isDown('attack') || input.wasPressed('attack')) this._fire();
    if (input.wasPressed('special')) this._stone();
    if (input.wasPressed('charged')) this._pull();
    if (input.wasPressed('wave')) this._push();
    if (input.wasPressed('grenade')) this._throwGrenade();
  }

  _updateMagazine(dt) {
    const g = this.game;
    const mag = this.magazine;
    const done = mag.update(dt);
    if (mag.reloading && this.available) {
      g.player.model.setReload(mag.reloadProgress);
      g.marks.sustain(0.2 + 0.25 * mag.reloadProgress);
    }
    if (done) {
      if (this.available) g.player.model.setReload(null);
      g.events.emit('power:reloaded', { id: 'disparo' });
    }
  }

  _fail(id) {
    const now = performance.now();
    if (now - this._lastFail < 300) return;
    this._lastFail = now;
    this.game.events.emit('power:failed', { id });
  }

  _handPos() {
    return this.game.player.handWorldPosition(this._hand);
  }

  // ---------------------------------------------------------------- Disparo
  _fire() {
    const g = this.game;
    const a = this.abilities.projectile;
    const mag = this.magazine;
    if (!a.ready || !mag.canFire) return;
    if (!a.commit(this.energy)) return this._fail('projectile');
    mag.consume();
    if (mag.reloading) g.events.emit('power:reloading', { id: 'disparo' });
    const c = this.cfg.projectile;
    g.player.faceAim(0.6);
    g.player.updateModelMatrices();
    const hand = this._handPos();
    const dir = g.powers._aimDirFrom(hand);
    g.projectiles.spawn({
      origin: { x: hand.x, y: hand.y, z: hand.z }, dir, speed: c.speed, range: c.range, radius: c.radius,
      damage: c.damage, color: PURPLE, kind: 'gravity', knockback: 0,
      onHit: (target) => {
        if (target?.float) {
          target.float(c.floatTime, c.floatHeight);
          g.events.emit('gravity:floated', { target });
        }
      },
    });
    g.marks.pulse(0.4, 0.12);
    g.vfx.particles.burst(hand, { count: 8, speed: 3, color: new THREE.Color(PURPLE), size: 0.12, life: 0.2 });
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'disparo' });
  }

  // ---------------------------------------------------------------- Rocas (Q)
  _stone() {
    const g = this.game;
    const a = this.abilities.dash;
    const motor = g.player.motor;
    const c = this.cfg.stones;
    if (motor.isBusy) return;
    if (this._chain >= this.maxStones) return this._fail('dash');
    if (!a.canActivate(this.energy)) return this._fail('dash');
    const p = motor.position;
    const ground = motor.grounded && !this.stones.some((s) => s.supports(p, motor.cfg.radius));
    const top = ground ? p.y + c.groundLift : p.y - 0.02;
    const bottom = ground ? p.y : top - c.thickness;
    if (!this._spaceFree(p.x, p.z, bottom, top, c.size, ground)) return this._fail('dash');
    a.commit(this.energy);
    // Máximo de rocas a la vez: la más antigua se desmorona
    while (this.stones.filter((s) => !s.crumbling).length >= this.maxStones) this.stones.find((s) => !s.crumbling).crumble();
    const stone = new GravityStone({ world: g.world, scene: g.scene, x: p.x, z: p.z, top, bottom, size: c.size, life: c.life, rise: c.riseTime, ground });
    this.stones.push(stone);
    this._chain++;
    if (!ground) {
      // Se posa sobre la roca al instante
      p.y = top;
      motor.velocity.y = 0;
      motor.grounded = true;
    }
    g.marks.pulse(0.55, 0.15);
    g.vfx.particles.burst({ x: p.x, y: top, z: p.z }, { count: 22, speed: 4, color: new THREE.Color(0x8a8090), size: 0.16, life: 0.5, drag: 3, gravity: 8 });
    g.vfx.ring({ x: p.x, y: top + 0.02, z: p.z }, c.size * 0.9, PURPLE, 0.3);
    g.cameraController.shake(0.12);
    g.events.emit('power:used', { id: 'rocas', chain: this._chain, ground });
  }

  /** ¿Cabe una roca aquí sin meterse en muros ni techos? */
  _spaceFree(x, z, bottom, top, size, ground) {
    const half = size / 2 - 0.1;
    for (const b of this.game.world.boxes) {
      if (!b.enabled || b.tag === 'stone') continue;
      if (b.maxX <= x - half || b.minX >= x + half || b.maxZ <= z - half || b.minZ >= z + half) continue;
      if (b.maxY <= bottom + (ground ? 0.5 : 0.05) || b.minY >= top + 1.8) continue;
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- Atraer (R)
  /** Enemigo vivo más cercano al centro de la mira, dentro del cono y con línea de visión. */
  pullTarget() {
    return enemyAtCrosshair(this.game, this.cfg.pull);
  }

  _pull() {
    const g = this.game;
    const a = this.abilities.discharge;
    const c = this.cfg.pull;
    const target = this.pullTarget();
    if (!target || !a.canActivate(this.energy)) return this._fail('discharge');
    a.commit(this.energy);
    const p = g.player.motor.position;
    const t = target.position;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const ux = dx / d;
    const uz = dz / d;
    const wasFloating = !!target.floating;
    g.combat.applyDamage(target, c.damage, { point: target.center, kind: 'atraer', faction: 'player', source: g.playerCombat });
    if (target.alive) {
      target.stun(c.stun);
      if (wasFloating) {
        // Lo trae flotando hasta tenerlo a distancia de golpe
        target.pullTo({ x: p.x + ux * c.meleeDistance, y: p.y + 0.1, z: p.z + uz * c.meleeDistance }, c.speed);
      } else {
        const stop = Math.max(c.meleeDistance, d - c.pullDistance);
        const dest = { x: p.x + ux * stop, y: t.y, z: p.z + uz * stop };
        const gy = g.world.groundHeight(dest.x, dest.z, 0.3, t.y + 1.5);
        if (Number.isFinite(gy) && Math.abs(gy - t.y) < 2) dest.y = gy;
        target.pullTo(dest, c.speed);
      }
    }
    g.player.faceAim(0.5);
    g.player.updateModelMatrices();
    const hand = this._handPos();
    g.vfx.lightning(hand, target.center, PURPLE, { width: 0.06, duration: 0.3, jitter: 0.08, branches: 0 });
    g.vfx.particles.burst(target.center, { count: 16, speed: 3, color: new THREE.Color(PURPLE), size: 0.12, life: 0.35 });
    g.marks.pulse(0.7, 0.2);
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'atraer', target, floating: wasFloating });
  }

  // ---------------------------------------------------------------- Empujar (G)
  _push() {
    const g = this.game;
    const a = this.abilities.wave;
    const c = this.cfg.push;
    if (!a.commit(this.energy)) return this._fail('wave');
    const p = g.player.motor.position;
    const f = g.cameraController.forward();
    const center = { x: p.x, y: p.y + 1, z: p.z };
    const cosArc = Math.cos(THREE.MathUtils.degToRad(c.arc));
    let hits = 0;
    for (const t of [...g.combat.targets]) {
      if (t === g.playerCombat || !t.alive) continue;
      const tc = t.center;
      const dx = tc.x - center.x;
      const dz = tc.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d > c.range + (t.radius ?? 0) || Math.abs(tc.y - center.y) > 4) continue;
      if (d > 0.5 && (dx * f.x + dz * f.z) / d < cosArc) continue;
      const k = 1 - Math.min(1, d / (c.range + 1)) * 0.5;
      const ux = d > 0.01 ? dx / d : f.x;
      const uz = d > 0.01 ? dz / d : f.z;
      const dir = { x: ux * (1 - c.lift), y: c.lift, z: uz * (1 - c.lift) };
      const dl = Math.hypot(dir.x, dir.y, dir.z);
      g.combat.applyDamage(t, Math.round(c.damage * k), { point: tc, dir: { x: dir.x / dl, y: dir.y / dl, z: dir.z / dl }, knockback: c.knockback * k, kind: 'empujar', faction: 'player', source: g.playerCombat });
      hits++;
    }
    g.player.faceAim(0.4);
    // Onda en abanico
    for (let i = 0; i < 40; i++) {
      const ang = Math.atan2(f.x, f.z) + (Math.random() - 0.5) * THREE.MathUtils.degToRad(c.arc * 2);
      const sp = 10 + Math.random() * 8;
      g.vfx.particles.emit({ x: center.x, y: center.y + (Math.random() - 0.5) * 0.8, z: center.z, vx: Math.sin(ang) * sp, vy: (Math.random() - 0.3) * 2, vz: Math.cos(ang) * sp, color: new THREE.Color(PURPLE), size: 0.14, life: 0.45, drag: 3 });
    }
    g.vfx.lights.flash(center, PURPLE, 30, 10, 0.25);
    g.cameraController.shake(0.3);
    g.marks.pulse(0.85, 0.25);
    g.player.model.trigger('wave');
    g.events.emit('power:used', { id: 'empujar', hits });
  }

  // ---------------------------------------------------------------- Granada (X)
  _throwGrenade() {
    const g = this.game;
    const a = this.abilities.grenade;
    const c = this.cfg.grenade;
    if (!a.commit(this.energy)) return this._fail('grenade');
    g.player.faceAim(0.5);
    g.player.updateModelMatrices();
    const hand = this._handPos();
    const dir = g.powers._aimDirFrom(hand);
    const vel = { x: dir.x * c.speed, y: dir.y * c.speed + 4, z: dir.z * c.speed };
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PURPLE).multiplyScalar(1.8), toneMapped: false }),
    );
    mesh.position.copy(hand);
    g.scene.add(mesh);
    this.grenades.push({ pos: { x: hand.x, y: hand.y, z: hand.z }, vel, t: 0, mesh });
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'granada' });
  }

  _updateGrenades(dt) {
    const g = this.game;
    const c = this.cfg.grenade;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.t += dt;
      gr.vel.y -= c.gravity * dt;
      const step = Math.hypot(gr.vel.x, gr.vel.y, gr.vel.z) * dt;
      const d = { x: gr.vel.x * dt / step, y: gr.vel.y * dt / step, z: gr.vel.z * dt / step };
      const hit = step > 0 ? g.world.raycastHit(gr.pos, d, step, { ignoreTags: ['bounds'] }) : null;
      const actor = step > 0 ? g.combat.raycastActors(gr.pos, d, hit ? hit.t : step, { excludeFaction: 'player' }) : null;
      let boom = null;
      if (actor) boom = { x: gr.pos.x + d.x * actor.t, y: gr.pos.y + d.y * actor.t, z: gr.pos.z + d.z * actor.t };
      else if (hit) boom = { x: gr.pos.x + d.x * hit.t, y: gr.pos.y + d.y * hit.t, z: gr.pos.z + d.z * hit.t };
      else {
        gr.pos.x += gr.vel.x * dt;
        gr.pos.y += gr.vel.y * dt;
        gr.pos.z += gr.vel.z * dt;
        if (gr.t >= c.fuse) boom = { ...gr.pos };
      }
      gr.mesh.position.set(gr.pos.x, gr.pos.y, gr.pos.z);
      if (Math.random() < 0.8) g.vfx.particles.emit({ x: gr.pos.x, y: gr.pos.y, z: gr.pos.z, vx: 0, vy: 0, vz: 0, color: new THREE.Color(PURPLE), size: 0.1, life: 0.3, drag: 1 });
      if (boom) {
        g.scene.remove(gr.mesh);
        gr.mesh.geometry.dispose();
        gr.mesh.material.dispose();
        this.grenades.splice(i, 1);
        this._spawnBubble(boom);
      }
    }
  }

  _spawnBubble(center) {
    const g = this.game;
    const c = this.cfg.grenade;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 18),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PURPLE).multiplyScalar(0.9), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    mesh.position.set(center.x, center.y, center.z);
    mesh.scale.setScalar(0.1);
    g.scene.add(mesh);
    const b = { center, radius: c.radius, t: 0, duration: c.duration, mesh };
    this.bubbles.push(b);
    g.combat.radial(center, c.radius, c.damage, { knockback: 0, kind: 'granada', faction: 'player', source: g.playerCombat });
    g.vfx.ring(center, c.radius, PURPLE, 0.5);
    g.vfx.lights.flash(center, PURPLE, 40, c.radius * 2.5, 0.4);
    g.cameraController.shake(0.25);
    g.events.emit('power:impact', { id: 'granada', center, radius: c.radius });
  }

  /** ¿Está un punto dentro de alguna burbuja activa? */
  inBubble(p) {
    return this.bubbles.some((b) => Math.hypot(p.x - b.center.x, p.y - b.center.y, p.z - b.center.z) <= b.radius);
  }

  _updateBubbles(dt) {
    const g = this.game;
    const c = this.cfg.grenade;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      const grow = Math.min(1, b.t / 0.25);
      const fade = Math.min(1, (b.duration - b.t) / 0.5);
      b.mesh.scale.setScalar(b.radius * grow);
      b.mesh.material.opacity = 0.18 * Math.max(0, fade) + Math.sin(b.t * 6) * 0.03;
      // Todo lo que queda dentro flota (se renueva mientras siga dentro)
      for (const t of g.combat.targets) {
        if (!t.alive || t === g.playerCombat || !t.float) continue;
        const tc = t.center;
        if (Math.hypot(tc.x - b.center.x, tc.y - b.center.y, tc.z - b.center.z) <= b.radius) t.float(0.6, c.floatHeight);
      }
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * b.radius;
        g.vfx.particles.emit({ x: b.center.x + Math.cos(a) * r, y: b.center.y - b.radius * 0.5 + Math.random() * b.radius, z: b.center.z + Math.sin(a) * r, vx: 0, vy: 1.2, vz: 0, color: new THREE.Color(PURPLE), size: 0.1, life: 0.8, drag: 0.5 });
      }
      if (b.t >= b.duration) {
        this._removeBubble(b);
        this.bubbles.splice(i, 1);
      }
    }
  }

  _removeBubble(b) {
    this.game.scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
  }
}
