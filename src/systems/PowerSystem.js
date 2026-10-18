import * as THREE from 'three';
import { EnergyPool } from '../powers/EnergyPool.js';
import { Ability } from '../powers/Ability.js';
import { ENERGY_CONFIG as CFG } from '../powers/energy/energyConfig.js';
import { glowSprite } from '../vfx/glowTexture.js';

/**
 * PowerSystem — gestiona la familia de poderes activa, su energía y la
 * activación de habilidades a partir del input.
 *
 * Etapa 2: familia Energía (proyectil, dash, descarga concentrada y onda
 * expansiva). Las habilidades solo funcionan si el MarkSystem indica que el
 * protagonista posee la marca de Energía.
 */
export class PowerSystem {
  constructor(game) {
    this.game = game;
    this.energy = new EnergyPool(CFG.pool);
    this.abilities = {
      projectile: new Ability(CFG.projectile),
      dash: new Ability(CFG.dash),
      discharge: new Ability(CFG.discharge),
      wave: new Ability(CFG.wave),
    };
    this.charge = null; // { time }
    this._airDashes = 0;
    this._dashVfx = 0;
    this._lastFail = 0;
    this.lastAimPoint = new THREE.Vector3();

    this._v = new THREE.Vector3();
    this._hand = new THREE.Vector3();
    this._camDir = new THREE.Vector3();

    // Orbe de carga (visible solo mientras se carga la descarga)
    const color = new THREE.Color(game.marks.activeDef?.color ?? '#2f8bff');
    this.orb = new THREE.Group();
    this.orbCore = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).lerp(color, 0.45).multiplyScalar(1.4), toneMapped: false }));
    this.orbHalo = glowSprite(color.clone().multiplyScalar(1.4), 1, 0.6);
    this.orb.add(this.orbCore, this.orbHalo);
    this.orb.visible = false;
    game.scene.add(this.orb);
  }

  get available() {
    return this.game.marks.activeFamily === 'energia';
  }

  get color() {
    return this.game.marks.activeDef?.color ?? '#2f8bff';
  }

  get isCharging() {
    return this.charge !== null;
  }

  get chargeRatio() {
    return this.charge ? Math.min(1, this.charge.time / CFG.discharge.fullCharge) : 0;
  }

  /** Reinicia tiempos de reutilización y cargas (depuración / cambio de mapa). */
  resetAbilities() {
    for (const a of Object.values(this.abilities)) a.reset();
    this._cancelCharge();
    this._airDashes = 0;
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const player = g.player;
    const motor = player.motor;

    this.energy.infinite = !!g.save.data.debug?.infiniteEnergy;
    this.energy.update(dt);
    for (const a of Object.values(this.abilities)) a.tick(dt);
    if (motor.grounded) this._airDashes = 0;

    if (!this.available) {
      this._cancelCharge();
      player.aiming = false;
      player.speedScale = 1;
      return;
    }

    const aiming = input.isDown('aim');
    player.aiming = aiming || this.isCharging;
    player.speedScale = this.isCharging ? 0.5 : aiming ? 0.65 : 1;

    // --- Proyectil (mantener pulsado = disparo continuo) ---
    // wasPressed: un clic rápido que empieza y termina entre dos frames también cuenta.
    if ((input.isDown('attack') || input.wasPressed('attack')) && !this.isCharging) this._fireProjectile();

    // --- Dash ---
    if (input.wasPressed('special')) this._dash();
    if (this._dashVfx > 0) {
      this._dashVfx -= dt;
      g.vfx.afterimage(motor.position, player.facing, this.color);
      g.vfx.particles.burst({ x: motor.position.x, y: motor.position.y + 0.9, z: motor.position.z }, { count: 8, speed: 2.5, color: new THREE.Color(this.color), size: 0.12, life: 0.35, drag: 3 });
    }

    // --- Descarga concentrada (mantener R para cargar, soltar para lanzar) ---
    if (input.wasPressed('charged') && !this.isCharging) {
      if (this.abilities.discharge.canActivate(this.energy)) this.charge = { time: 0 };
      else this._fail('discharge');
    }
    if (this.isCharging) {
      this.charge.time += dt;
      const r = this.chargeRatio;
      g.marks.sustain(0.35 + 0.65 * r);
      player.faceAim(0.2);
      this._updateOrb(r, dt);
      if (!input.isDown('charged')) {
        if (this.charge.time >= CFG.discharge.minCharge) this._releaseDischarge(r);
        this._cancelCharge();
      }
    }

    // --- Onda expansiva ---
    if (input.wasPressed('wave')) this._wave();
  }

  // ------------------------------------------------------------------
  /** Punto al que apunta el centro de la pantalla (para orientar los disparos). */
  aimPoint(out = this.lastAimPoint) {
    const cam = this.game.camera;
    cam.getWorldDirection(this._camDir);
    // Empieza a la altura del personaje para no impactar con lo que hay detrás de él.
    const pivotDist = cam.position.distanceTo(this.game.cameraController.shoulderOrigin);
    const o = { x: cam.position.x + this._camDir.x * pivotDist, y: cam.position.y + this._camDir.y * pivotDist, z: cam.position.z + this._camDir.z * pivotDist };
    const d = { x: this._camDir.x, y: this._camDir.y, z: this._camDir.z };
    const hit = this.game.world.raycastHit(o, d, 200, { ignoreTags: ['bounds'] });
    const t = hit ? hit.t : 200;
    out.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t);
    return out;
  }

  _handPosition(out = this._hand) {
    return this.game.player.handWorldPosition(out);
  }

  _aimDirFrom(origin) {
    const target = this.aimPoint();
    const dir = this._v.copy(target).sub(origin);
    const len = dir.length();
    this.game.camera.getWorldDirection(this._camDir);
    // Si el objetivo está demasiado cerca o detrás de la mano, usa la dirección de la cámara.
    if (len < 1.2 || dir.dot(this._camDir) <= 0) return { x: this._camDir.x, y: this._camDir.y, z: this._camDir.z };
    dir.divideScalar(len);
    return { x: dir.x, y: dir.y, z: dir.z };
  }

  _fireProjectile() {
    const a = this.abilities.projectile;
    if (!a.ready) return;
    if (!a.commit(this.energy)) return this._fail('projectile');
    const g = this.game;
    g.player.faceAim(0.6);
    g.player.updateModelMatrices();
    const hand = this._handPosition();
    const dir = this._aimDirFrom(hand);
    const c = CFG.projectile;
    g.projectiles.spawn({ origin: { x: hand.x, y: hand.y, z: hand.z }, dir, speed: c.speed, range: c.range, radius: c.radius, damage: c.damage, color: this.color, kind: 'bolt', knockback: 2 });
    g.marks.pulse(0.35, 0.1);
    g.vfx.particles.burst(hand, { count: 6, speed: 3, color: new THREE.Color(this.color), size: 0.1, life: 0.15 });
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'proyectil' });
  }

  _dash() {
    const g = this.game;
    const a = this.abilities.dash;
    const motor = g.player.motor;
    if (!motor.grounded && this._airDashes >= CFG.dash.airDashes) return this._fail('dash');
    if (motor.isBursting) return;
    if (!a.canActivate(this.energy)) return this._fail('dash');
    const d = g.player.moveIntent.lengthSq() > 0.01 ? g.player.moveIntent : g.player.facingVector();
    if (!motor.startBurst({ x: d.x, z: d.z, speed: CFG.dash.speed, duration: CFG.dash.duration, gravityScale: 0, exitFactor: 0.5 })) return;
    a.commit(this.energy);
    if (!motor.grounded) this._airDashes++;
    this._dashVfx = CFG.dash.duration;
    g.marks.pulse(0.6, 0.15);
    g.vfx.lights.flash({ x: motor.position.x, y: motor.position.y + 1, z: motor.position.z }, this.color, 20, 8, 0.3);
    g.cameraController.shake(0.15);
    g.events.emit('power:used', { id: 'dash' });
  }

  _updateOrb(r, dt) {
    const g = this.game;
    const hand = this._handPosition();
    this.orb.visible = true;
    this.orb.position.copy(hand);
    const s = 0.06 + 0.12 * r;
    this.orbCore.scale.setScalar(s * (1 + Math.sin(performance.now() * 0.03) * 0.08));
    this.orbHalo.scale.setScalar(s * 4.5);
    this.orbHalo.material.opacity = 0.45 + 0.35 * r;
    // Partículas que convergen hacia la mano
    if (Math.random() < 0.6 + r) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const R = 0.9;
      const px = hand.x + Math.cos(a) * Math.cos(b) * R;
      const py = hand.y + Math.sin(b) * R;
      const pz = hand.z + Math.sin(a) * Math.cos(b) * R;
      g.vfx.particles.emit({ x: px, y: py, z: pz, vx: (hand.x - px) * 3, vy: (hand.y - py) * 3, vz: (hand.z - pz) * 3, color: new THREE.Color(this.color), size: 0.09, life: 0.3, drag: 0 });
    }
    if (r >= 1) g.cameraController.shake(0.02 * dt * 60);
  }

  _releaseDischarge(r) {
    const g = this.game;
    const a = this.abilities.discharge;
    if (!a.commit(this.energy)) return this._fail('discharge');
    const c = CFG.discharge;
    g.player.updateModelMatrices();
    const hand = this._handPosition();
    const dir = this._aimDirFrom(hand);
    const damage = Math.round(c.damageMin + (c.damageMax - c.damageMin) * r);
    g.projectiles.spawn({
      origin: { x: hand.x, y: hand.y, z: hand.z }, dir, speed: c.speed, range: c.range,
      radius: c.radius * (0.6 + 0.4 * r), damage, color: this.color, kind: 'discharge',
      splashRadius: c.splashRadius, splashKnockback: c.splashKnockback, knockback: 6,
    });
    g.marks.pulse(0.85, 0.2);
    g.cameraController.shake(0.25 + 0.2 * r);
    g.vfx.lights.flash(hand, this.color, 40, 10, 0.25);
    g.player.model.trigger('cast');
    g.events.emit('power:used', { id: 'descarga', charge: r });
  }

  _cancelCharge() {
    this.charge = null;
    this.orb.visible = false;
  }

  _wave() {
    const g = this.game;
    const a = this.abilities.wave;
    if (!a.commit(this.energy)) return this._fail('wave');
    const c = CFG.wave;
    const p = g.player.motor.position;
    const center = { x: p.x, y: p.y + 1, z: p.z };
    g.combat.radial(center, c.radius, c.damage, { knockback: c.knockback, kind: 'wave' });
    g.vfx.ring({ x: p.x, y: p.y, z: p.z }, c.radius, this.color, 0.5);
    g.vfx.particles.burst(center, { count: 90, speed: 16, color: new THREE.Color(this.color), size: 0.16, life: 0.5, drag: 3.5 });
    g.vfx.lights.flash(center, this.color, 60, c.radius * 2, 0.4);
    g.marks.pulse(1, 0.35);
    g.cameraController.shake(0.5);
    g.player.model.trigger('wave');
    g.events.emit('power:used', { id: 'onda' });
  }

  _fail(id) {
    // Aviso visual (HUD) de energía insuficiente o habilidad no disponible.
    const now = performance.now();
    if (now - this._lastFail < 300) return;
    this._lastFail = now;
    this.game.events.emit('power:failed', { id });
  }
}
