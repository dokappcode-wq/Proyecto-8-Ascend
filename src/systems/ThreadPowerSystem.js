import * as THREE from 'three';
import { EnergyPool } from '../powers/EnergyPool.js';
import { Ability } from '../powers/Ability.js';
import { THREAD_CONFIG } from '../powers/thread/threadConfig.js';
import { enemyAtCrosshair } from '../powers/targeting.js';
import { CharacterMotor } from '../physics/CharacterMotor.js';
import { findSwingAnchor, SWING_ANCHOR_CONFIG } from '../physics/swingAnchors.js';

const WHITE = '#f2f4f8';
const UP = new THREE.Vector3(0, 1, 0);

/**
 * ThreadPowerSystem — familia Hilo. Misma interfaz que PowerSystem.
 *
 * - Clic izq.: el puño se convierte en hilo y golpea a distancia. No tiene
 *   cargador: no se puede volver a golpear hasta que el puño ha vuelto.
 * - Q (mantener): hilo a la estructura más próxima por encima y balanceo;
 *   soltar Q (o saltar) suelta el hilo conservando la velocidad.
 * - R: Atar (inmoviliza). G: Lanzar (por los aires). X: Atraer (te lleva
 *   hasta el enemigo o hasta la pared que señalas).
 * - F con carga: golpe de cadena (barrido con la cuerda gruesa), en PlayerCombat.
 * - Pasiva: mantener el salto da un salto alto (`cfg.jumps`, en el motor).
 */
export class ThreadPowerSystem {
  constructor(game) {
    this.game = game;
    this.id = 'hilo';
    this.cfg = structuredClone(THREAD_CONFIG);
    this.energy = new EnergyPool(this.cfg.pool);
    this.abilities = {
      projectile: new Ability(this.cfg.projectile),
      dash: new Ability(this.cfg.swing),
      discharge: new Ability(this.cfg.bind),
      wave: new Ability(this.cfg.launch),
      grenade: new Ability(this.cfg.zip),
    };
    this.mods = null;
    /** Puño de hilo en vuelo: { phase: 'out'|'back', pos, target, actor, t } */
    this.fist = null;
    this._zipPoint = null;
    this._flashes = []; // hilos que se ven un instante (atar, lanzar)
    this._lastFail = 0;
    this._hand = new THREE.Vector3();
    this._aimDir = new THREE.Vector3();
    this._reacquireCd = 0;
    this.anchorCfg = { ...SWING_ANCHOR_CONFIG, recheck: 0.2, cameraAssist: 1.6 };

    // Hilos visibles: el del balanceo/atraer y el del puño
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WHITE).multiplyScalar(1.2), toneMapped: false });
    this.rope = this._ropeMesh(mat, 0.022);
    this.fistRope = this._ropeMesh(mat, 0.03);
    this.fistTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
    this.fistTip.visible = false;
    game.scene.add(this.rope, this.fistRope, this.fistTip);
    game.events.on('map:unloaded', () => this.clear());
  }

  _ropeMesh(mat, r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6, 1, true).translate(0, 0.5, 0), mat);
    m.visible = false;
    m.frustumCulled = false;
    return m;
  }

  _setRope(mesh, a, b) {
    const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = d.length();
    mesh.visible = len > 0.05;
    if (!mesh.visible) return;
    mesh.position.set(a.x, a.y, a.z);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  }

  // ---------------------------------------------------------------- Interfaz común
  get available() {
    return this.game.marks.activeFamily === 'hilo';
  }

  get color() {
    return WHITE;
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

  /** Sin balas: el «cargador» del HUD indica si el puño está listo o volviendo. */
  get magazine() {
    const f = this.fist;
    return {
      ammo: f ? 0 : 1, size: 1, reloading: !!f, canFire: !f,
      reloadProgress: f ? (f.phase === 'out' ? 0.25 * f.t : 0.5 + 0.5 * f.t) : 0,
    };
  }

  /** Parámetros efectivos del golpe de cadena (con mejoras). */
  get chainCfg() {
    return this.cfg.chain;
  }

  applyModifiers(m) {
    this.mods = m;
    const c = structuredClone(THREAD_CONFIG);
    c.swing.range += m.swingRangeAdd;
    c.zip.range += m.swingRangeAdd;
    c.bind.time += m.bindTimeAdd;
    c.projectile.outSpeed *= m.fistSpeedMul;
    c.projectile.backSpeed *= m.fistSpeedMul;
    c.chain.damage += m.chainDamageAdd;
    if (m.chainDamageAdd) c.chain.range += 0.8;
    c.drain.rate *= m.drainMul;
    this.cfg = c;
    this.abilities.projectile.def = c.projectile;
    this.abilities.dash.def = c.swing;
    this.abilities.discharge.def = c.bind;
    this.abilities.wave.def = c.launch;
    this.abilities.grenade.def = c.zip;
    const max = c.pool.max + (m.energyMaxAdd ?? 0);
    const grow = max - this.energy.max;
    this.energy.max = max;
    this.energy.value = Math.min(max, this.energy.value + Math.max(0, grow));
  }

  resetAbilities() {
    for (const a of Object.values(this.abilities)) a.reset();
    this.fist = null;
  }

  clear() {
    this.fist = null;
    this._zipPoint = null;
    this.rope.visible = this.fistRope.visible = this.fistTip.visible = false;
    for (const f of this._flashes) f.mesh.visible = false;
    this._flashes.length = 0;
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
    this._updateFist(dt);
    this._updateFlashes(dt);

    const blocked = !this.available || g.playerCombat?.dead || g.acquisition?.active || g.drain?.active || motor.isClimbing;
    if (blocked) {
      if (motor.isSwinging) motor.endSwing();
    } else {
      const aiming = input.isDown('aim');
      g.player.aiming = aiming;
      g.player.speedScale = aiming ? 0.65 : 1;
      if (input.isDown('attack') || input.wasPressed('attack')) this._fireFist();
      if (input.wasPressed('special')) this._startSwing();
      if (motor.isSwinging && (!input.isDown('special') || input.wasPressed('jump'))) {
        const c = this.cfg.swing;
        const perfect = motor.releaseQuality() ? c.perfectBonus : 0;
        const jump = input.wasPressed('jump');
        motor.endSwing(c.releaseBoost + (jump ? 3 : 0), c.releaseHorizontal + perfect + (jump ? 2 : 0));
        g.events.emit('thread:release', { perfect: !!perfect });
      } else if (motor.isSwinging) {
        this._keepSwing(dt);
        this._assistCamera(dt);
      }
      if (input.wasPressed('charged')) this._bind();
      if (input.wasPressed('wave')) this._launch();
      if (input.wasPressed('grenade')) this._zip();
    }

    // Hilo visible del balanceo o del desplazamiento hacia un punto
    const anchor = motor.swingAnchor ?? (motor.isTraveling ? this._zipPoint : null);
    if (!motor.isTraveling) this._zipPoint = null;
    if (anchor) this._setRope(this.rope, this._handPos(), anchor);
    else this.rope.visible = false;
  }

  // ---------------------------------------------------------------- Puño de hilo
  _fireFist() {
    const g = this.game;
    const a = this.abilities.projectile;
    if (this.fist) return; // el puño todavía no ha vuelto
    if (!a.commit(this.energy)) return this._fail('projectile');
    const c = this.cfg.projectile;
    g.player.faceAim(0.5);
    const hand = this._handPos();
    const dir = g.powers._aimDirFrom(hand);
    const hit = g.world.raycastHit(hand, dir, c.range, { ignoreTags: ['bounds'] });
    const maxT = hit ? hit.t : c.range;
    const actor = g.combat.raycastActors(hand, dir, maxT, { excludeFaction: 'player' });
    const t = actor ? actor.t : maxT;
    this.fist = {
      phase: 'out', t: 0, dist: t,
      start: { x: hand.x, y: hand.y, z: hand.z },
      target: { x: hand.x + dir.x * t, y: hand.y + dir.y * t, z: hand.z + dir.z * t },
      pos: { x: hand.x, y: hand.y, z: hand.z },
      actor: actor?.actor ?? null, wall: !actor && !!hit, dir,
    };
    g.player.model.trigger('punch');
    g.marks.pulse(0.35, 0.1);
    g.events.emit('power:used', { id: 'hilos' });
  }

  _updateFist(dt) {
    const f = this.fist;
    const g = this.game;
    if (!f) {
      this.fistRope.visible = this.fistTip.visible = false;
      return;
    }
    const c = this.cfg.projectile;
    const hand = this._handPos();
    if (f.phase === 'out') {
      f.t = Math.min(1, f.t + (dt * c.outSpeed) / Math.max(0.5, f.dist));
      const k = f.t;
      f.pos = { x: f.start.x + (f.target.x - f.start.x) * k, y: f.start.y + (f.target.y - f.start.y) * k, z: f.start.z + (f.target.z - f.start.z) * k };
      if (f.t >= 1) {
        if (f.actor?.alive) {
          g.combat.applyDamage(f.actor, c.damage, { point: f.target, dir: f.dir, knockback: c.knockback, kind: 'hilo', faction: 'player', source: g.playerCombat });
          g.vfx.impact(f.target, null, WHITE, 0.8);
          g.cameraController.shake(0.08);
        } else if (f.wall) {
          g.vfx.particles.burst(f.target, { count: 6, speed: 2, color: new THREE.Color(WHITE), size: 0.08, life: 0.25 });
        }
        f.phase = 'back';
        f.t = 0;
        f.from = { ...f.pos };
      }
    } else {
      f.t = Math.min(1, f.t + (dt * c.backSpeed) / Math.max(0.5, f.dist));
      f.pos = { x: f.from.x + (hand.x - f.from.x) * f.t, y: f.from.y + (hand.y - f.from.y) * f.t, z: f.from.z + (hand.z - f.from.z) * f.t };
      if (f.t >= 1) {
        this.fist = null;
        this.fistRope.visible = this.fistTip.visible = false;
        g.events.emit('power:reloaded', { id: 'hilos' });
        return;
      }
    }
    this._setRope(this.fistRope, hand, f.pos);
    this.fistTip.visible = true;
    this.fistTip.position.set(f.pos.x, f.pos.y, f.pos.z);
  }

  // ---------------------------------------------------------------- Balanceo (Q)
  /** Dirección de la cámara (unitaria) y de la última intención de movimiento. */
  _view() {
    return this.game.camera.getWorldDirection(this._aimDir);
  }

  /** Dirección horizontal del movimiento: la velocidad si ya se va, si no la mirada. */
  _moveDir() {
    const v = this.game.player.motor.velocity;
    const h = Math.hypot(v.x, v.z);
    if (h > 2) return { x: v.x / h, z: v.z / h };
    const f = this.game.cameraController.forward();
    return { x: f.x, z: f.z };
  }

  /** Mejor punto de enganche ahora mismo (o null si no hay ninguno válido). */
  findAnchor(prev = null) {
    const m = this.game.player.motor;
    const o = { x: m.position.x, y: m.position.y + CharacterMotor.ROPE_POINT, z: m.position.z };
    return findSwingAnchor(this.game.world, o, {
      feetY: m.position.y,
      view: this._view(),
      move: this._moveDir(),
      prev,
      cfg: this.anchorCfg,
    });
  }

  _startSwing() {
    const g = this.game;
    const a = this.abilities.dash;
    const motor = g.player.motor;
    const c = this.cfg.swing;
    if (motor.isBusy || motor.isSwinging) return;
    if (!a.canActivate(this.energy)) return this._fail('dash');
    const anchor = this.findAnchor();
    // Sin punto válido el jugador sigue andando: no hay nada que frene de golpe
    if (!anchor) return this._fail('dash');
    if (motor.grounded) {
      // Pequeño salto para despegar y empezar a balancearse
      motor.velocity.y = Math.max(motor.velocity.y, c.hop);
      motor.grounded = false;
    }
    // La cuerda se acorta lo necesario para que el arco no toque el suelo
    const ground = g.world.groundHeight(motor.position.x, motor.position.z, 0.3, motor.position.y + 0.5);
    const maxLen = Math.max(3, anchor.y - (Number.isFinite(ground) ? ground : motor.position.y) - CharacterMotor.ROPE_POINT - 0.6);
    if (!motor.startSwing(anchor, { pump: c.pump, maxSpeed: c.maxSpeed, maxLen, reel: c.reel, minLen: c.minLen, drag: c.drag })) return this._fail('dash');
    this._reacquireCd = this.anchorCfg.recheck;
    a.commit(this.energy);
    g.vfx.particles.burst(anchor, { count: 8, speed: 2, color: new THREE.Color(WHITE), size: 0.08, life: 0.3 });
    g.marks.pulse(0.45, 0.15);
    g.events.emit('power:used', { id: 'balanceo', anchor });
  }

  /**
   * Durante el balanceo: cada poco se comprueba que el anclaje siga a la
   * vista y al alcance. Si se pierde, se engancha el mejor punto nuevo sin
   * frenar; si no hay ninguno, se suelta con la velocidad que llevaba.
   */
  _keepSwing(dt) {
    const g = this.game;
    const motor = g.player.motor;
    this._reacquireCd -= dt;
    if (this._reacquireCd > 0) return;
    this._reacquireCd = this.anchorCfg.recheck;
    const s = motor.swingAnchor;
    if (motor.swingOpen && Math.hypot(s.x - motor.position.x, s.y - motor.position.y, s.z - motor.position.z) < this.cfg.swing.range + 6) return;
    const next = this.findAnchor(s);
    if (next && motor.retarget(next, Infinity)) {
      g.events.emit('thread:retarget', { anchor: next });
      return;
    }
    motor.endSwing(0, 0);
    g.events.emit('thread:release');
  }

  /** La cámara se orienta suavemente hacia donde va el balanceo (si el jugador no mueve el ratón). */
  _assistCamera(dt) {
    const g = this.game;
    const motor = g.player.motor;
    const input = g.input;
    const v = motor.velocity;
    const h = Math.hypot(v.x, v.z);
    if (h < 6 || Math.hypot(input.mouseDX, input.mouseDY) > 0.5) return;
    const cam = g.cameraController;
    const target = Math.atan2(-v.x, -v.z);
    let d = target - cam.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * Math.min(1, dt * this.anchorCfg.cameraAssist);
  }

  // ---------------------------------------------------------------- Atar, lanzar, atraer
  _flash(from, to, time = 0.3) {
    let f = this._flashes.find((x) => !x.mesh.visible);
    if (!f) {
      f = { mesh: this._ropeMesh(this.rope.material, 0.02), t: 0 };
      this.game.scene.add(f.mesh);
    }
    f.t = time;
    f.to = to;
    f.from = from;
    this._setRope(f.mesh, from, to.center ?? to);
    if (!this._flashes.includes(f)) this._flashes.push(f);
  }

  _updateFlashes(dt) {
    for (const f of this._flashes) {
      if (!f.mesh.visible) continue;
      f.t -= dt;
      if (f.t <= 0) f.mesh.visible = false;
      else this._setRope(f.mesh, this._handPos(), f.to.center ?? f.to);
    }
  }

  _bind() {
    const g = this.game;
    const a = this.abilities.discharge;
    const c = this.cfg.bind;
    const target = enemyAtCrosshair(g, c);
    if (!target || !a.canActivate(this.energy)) return this._fail('discharge');
    a.commit(this.energy);
    g.combat.applyDamage(target, c.damage, { point: target.center, kind: 'atar', faction: 'player', source: g.playerCombat });
    if (target.alive) target.bind(c.time);
    g.player.faceAim(0.5);
    this._flash(this._handPos().clone(), target, 0.35);
    g.player.model.trigger('cast');
    g.marks.pulse(0.6, 0.2);
    g.events.emit('power:used', { id: 'atar', target });
  }

  _launch() {
    const g = this.game;
    const a = this.abilities.wave;
    const c = this.cfg.launch;
    const target = enemyAtCrosshair(g, c);
    if (!target || !a.canActivate(this.energy)) return this._fail('wave');
    a.commit(this.energy);
    g.combat.applyDamage(target, c.damage, { point: target.center, kind: 'lanzar', faction: 'player', source: g.playerCombat });
    if (target.alive) {
      target.stun?.(c.stun);
      target.applyImpulse(0, c.up * 1.4, 0);
    }
    g.player.faceAim(0.5);
    this._flash(this._handPos().clone(), target, 0.3);
    g.vfx.particles.burst(target.center, { count: 14, speed: 4, color: new THREE.Color(WHITE), size: 0.1, life: 0.4 });
    g.player.model.trigger('cast');
    g.cameraController.shake(0.12);
    g.marks.pulse(0.6, 0.2);
    g.events.emit('power:used', { id: 'lanzar', target });
  }

  _zip() {
    const g = this.game;
    const a = this.abilities.grenade;
    const c = this.cfg.zip;
    const motor = g.player.motor;
    if (motor.isBusy && !motor.isSwinging) return;
    if (!a.canActivate(this.energy)) return this._fail('grenade');
    const p = motor.position;
    let dest = null;
    let point = null;
    const enemy = enemyAtCrosshair(g, c);
    if (enemy) {
      // Hasta el enemigo, a distancia de cuerpo a cuerpo
      const t = enemy.position;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const stop = Math.max(0, d - c.meleeDistance);
      dest = { x: p.x + (dx / d) * stop, y: t.y, z: p.z + (dz / d) * stop };
      point = enemy.center;
    } else {
      // Hasta la pared (o superficie) que se señala
      const hit = g.powers.aimHit();
      const hp = hit.point;
      if (!hit.normal || hp.distanceTo(new THREE.Vector3(p.x, p.y + 1.4, p.z)) > c.range) return this._fail('grenade');
      const n = hit.normal;
      if (n.y > 0.6) dest = { x: hp.x, y: hp.y, z: hp.z };
      else dest = { x: hp.x + n.x * 0.55, y: Math.max(p.y, hp.y - 1.1), z: hp.z + n.z * 0.55 };
      point = { x: hp.x, y: hp.y, z: hp.z };
    }
    if (motor.isSwinging) motor.endSwing();
    if (!motor.startTravel({ ...dest, speed: c.speed })) return this._fail('grenade');
    a.commit(this.energy);
    this._zipPoint = point;
    g.marks.pulse(0.5, 0.15);
    g.events.emit('power:used', { id: 'atraer-hilo', enemy: !!enemy });
  }
}
