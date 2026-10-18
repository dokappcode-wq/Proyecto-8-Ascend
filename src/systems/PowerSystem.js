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
    this.targeting = null; // dash dirigido: { feet: Vector3 } mientras se mantiene Q apuntando
    this.dive = null; // { last: Vector3 } durante la caída en rayo
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

    this._buildTargetMarker(color);
  }

  /** Silueta del personaje (clon del modelo) y anillo que marcan el destino del dash dirigido. */
  _buildTargetMarker(color) {
    const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.3), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ghostMat = mat;
    this.ghost = this.game.player.model.root.clone(true);
    this.ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = o.receiveShadow = false;
      }
    });
    this.ghost.visible = false;
    this.game.scene.add(this.ghost);
    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.6, 40),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.5), transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.ghostRing.rotation.x = -Math.PI / 2;
    this.ghostRing.visible = false;
    this.game.scene.add(this.ghostRing);
  }

  get available() {
    return this.game.marks.activeFamily === 'energia';
  }

  get color() {
    return this.game.marks.activeDef?.color ?? '#2f8bff';
  }

  get isTargeting() {
    return this.targeting !== null;
  }

  get isDiving() {
    return this.dive !== null;
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
    this._cancelTargeting();
    this.dive = null;
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

    // El picado termina aunque se pierda la marca en pleno vuelo.
    if (this.dive) this._updateDive();

    if (!this.available) {
      this._cancelCharge();
      this._cancelTargeting();
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

    // --- Dash (apuntando + mantener Q = dash dirigido) ---
    if (input.wasPressed('special')) {
      if (aiming && !this.isCharging) this._startTargeting();
      else this._dash();
    }
    if (this.targeting) {
      if (!aiming || this.isCharging) this._cancelTargeting();
      else {
        this._updateTargeting();
        if (!input.isDown('special')) this._executeTargeted();
      }
    }
    if (this._dashVfx > 0 || motor.isTraveling) {
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

    // --- Onda expansiva (en el aire: caída en rayo) ---
    if (input.wasPressed('wave') && !this.dive) {
      if (this._heightAboveGround() >= CFG.wave.diveMinHeight && !motor.isBusy) this._startDive();
      else if (motor.grounded || this._heightAboveGround() < CFG.wave.diveMinHeight) this._wave();
    }
  }

  _heightAboveGround() {
    const m = this.game.player.motor;
    if (m.grounded) return 0;
    const g = this.game.world.groundHeight(m.position.x, m.position.z, m.cfg.radius * 0.85, m.position.y);
    return m.position.y - g;
  }

  // ------------------------------------------------------------------ Caída en rayo
  _startDive() {
    const g = this.game;
    const motor = g.player.motor;
    if (!this.abilities.wave.canActivate(this.energy)) return this._fail('wave');
    if (!motor.startDive(CFG.wave.diveSpeed)) return;
    this.abilities.wave.commit(this.energy);
    this._cancelCharge();
    this._cancelTargeting();
    const p = motor.position;
    this.dive = { start: new THREE.Vector3(p.x, p.y, p.z), last: new THREE.Vector3(p.x, p.y + 1, p.z) };
    g.marks.pulse(0.8, 0.4);
    g.vfx.lights.flash({ x: p.x, y: p.y + 1, z: p.z }, this.color, 35, 10, 0.3);
    g.events.emit('power:used', { id: 'rayo' });
  }

  _updateDive() {
    const g = this.game;
    const motor = g.player.motor;
    const p = motor.position;
    const now = new THREE.Vector3(p.x, p.y + 1, p.z);
    // Estela en forma de rayo durante la caída
    g.vfx.lightning(this.dive.last, now, this.color, { width: 0.07, duration: 0.25, jitter: 0.35, branches: 1 });
    g.vfx.afterimage(p, g.player.facing, this.color);
    g.marks.sustain(0.85);
    this.dive.last.copy(now);
    const landed = motor.events.diveLanded;
    if (landed) this._diveImpact(landed.fallHeight);
    else if (!motor.isDiving) this.dive = null; // interrumpido (reaparición)
  }

  _diveImpact(fallHeight) {
    const g = this.game;
    const c = CFG.wave;
    const p = g.player.motor.position;
    const radius = Math.min(c.diveRadiusMax, c.diveRadius + fallHeight * c.diveRadiusPerMeter);
    const damage = Math.round(Math.min(c.diveDamageMax, c.diveDamage + fallHeight * c.diveDamagePerMeter));
    const center = { x: p.x, y: p.y + 0.8, z: p.z };
    g.combat.radial(center, radius, damage, { knockback: c.diveKnockback, lift: 0.5, kind: 'rayo' });
    // Rayo que cae del cielo sobre el punto de impacto
    const top = { x: p.x + (Math.random() - 0.5) * 2, y: Math.max(this.dive.start.y, p.y) + 14, z: p.z + (Math.random() - 0.5) * 2 };
    g.vfx.lightning(top, { x: p.x, y: p.y + 0.05, z: p.z }, this.color, { width: 0.12, duration: 0.4, jitter: 1.1, branches: 4 });
    g.vfx.ring({ x: p.x, y: p.y, z: p.z }, radius, this.color, 0.55);
    g.vfx.particles.burst(center, { count: 140, speed: 22, color: new THREE.Color(this.color), size: 0.18, life: 0.6, drag: 3.5, gravity: 4 });
    g.vfx.particles.burst(center, { count: 30, speed: 5, color: new THREE.Color(0xffffff), size: 0.4, life: 0.25, drag: 2 });
    g.vfx.lights.flash(center, this.color, 90, radius * 2.5, 0.5);
    g.marks.pulse(1, 0.4);
    g.cameraController.shake(0.85);
    g.player.model.trigger('wave');
    g.events.emit('power:impact', { id: 'rayo', fallHeight, radius, damage });
    this.dive = null;
  }

  // ------------------------------------------------------------------ Dash dirigido
  _startTargeting() {
    const motor = this.game.player.motor;
    if (motor.isBusy) return;
    if (!this.abilities.dash.canActivate(this.energy, CFG.dash.targetedCost)) return this._fail('dash');
    this.targeting = { feet: new THREE.Vector3() };
    this._updateTargeting();
  }

  /** Calcula el destino (pies) a partir de lo que señala la mira, limitado en distancia. */
  targetedDestination(out = new THREE.Vector3()) {
    const g = this.game;
    const m = g.player.motor;
    const r = m.cfg.radius;
    const w = g.world;
    const chest = new THREE.Vector3(m.position.x, m.position.y + 1, m.position.z);
    const hit = this.aimHit();
    const point = hit.point.clone();
    let normal = hit.normal;
    const toPoint = point.clone().sub(chest);
    const max = CFG.dash.targetedMaxDistance;
    if (toPoint.length() > max) {
      point.copy(chest).addScaledVector(toPoint.normalize(), max);
      normal = null;
    }
    const dropToGround = (p, maxDrop) => {
      const gh = w.groundHeight(p.x, p.z, r * 0.85, p.y + 0.3);
      if (p.y - gh <= maxDrop) p.y = gh;
      return p;
    };
    let feet;
    if (normal && normal.y > 0.6) {
      feet = point; // suelo
    } else {
      // Pared o aire: se separa de la superficie y busca suelo debajo.
      const base = normal ? point.clone().addScaledVector(new THREE.Vector3(normal.x, 0, normal.z).normalize(), r + 0.2) : point.clone();
      base.y -= 0.9;
      feet = dropToGround(base, 3);
    }
    // El trayecto desde el pecho no puede atravesar geometría.
    const dest = feet.clone();
    dest.y += 1;
    const dir = dest.clone().sub(chest);
    const len = dir.length();
    if (len > 0.01) {
      dir.divideScalar(len);
      const block = w.raycastHit(chest, dir, len, { ignoreTags: ['bounds'] });
      if (block && block.t < len - 0.2) {
        feet.copy(chest).addScaledVector(dir, Math.max(0, block.t - (r + 0.25)));
        feet.y -= 1;
        dropToGround(feet, 3);
      }
    }
    return out.copy(feet);
  }

  _updateTargeting() {
    const g = this.game;
    const feet = this.targetedDestination(this.targeting.feet);
    const p = g.player.motor.position;
    this.ghost.visible = true;
    this.ghost.position.copy(feet);
    this.ghost.rotation.set(0, Math.atan2(feet.x - p.x, feet.z - p.z), 0);
    this.ghostMat.opacity = 0.25 + Math.sin(performance.now() * 0.012) * 0.08;
    this.ghostRing.visible = true;
    this.ghostRing.position.set(feet.x, feet.y + 0.04, feet.z);
    g.marks.sustain(0.3);
  }

  _executeTargeted() {
    const g = this.game;
    const motor = g.player.motor;
    const feet = this.targeting.feet.clone();
    this._cancelTargeting();
    if (!this.abilities.dash.canActivate(this.energy, CFG.dash.targetedCost)) return this._fail('dash');
    if (!motor.startTravel({ x: feet.x, y: feet.y, z: feet.z, speed: CFG.dash.targetedSpeed })) return;
    this.abilities.dash.commit(this.energy, CFG.dash.targetedCost);
    const p = motor.position;
    g.vfx.lightning({ x: p.x, y: p.y + 1, z: p.z }, { x: feet.x, y: feet.y + 1, z: feet.z }, this.color, { width: 0.05, duration: 0.3, jitter: 0.25, branches: 0 });
    g.vfx.lights.flash({ x: p.x, y: p.y + 1, z: p.z }, this.color, 25, 8, 0.3);
    g.marks.pulse(0.7, 0.2);
    g.cameraController.shake(0.15);
    g.events.emit('power:used', { id: 'dash-dirigido' });
  }

  _cancelTargeting() {
    this.targeting = null;
    if (this.ghost) this.ghost.visible = false;
    if (this.ghostRing) this.ghostRing.visible = false;
  }

  // ------------------------------------------------------------------
  /** Punto (y normal de la superficie, si la hay) al que apunta el centro de la pantalla. */
  aimHit() {
    const cam = this.game.camera;
    cam.getWorldDirection(this._camDir);
    const pivotDist = cam.position.distanceTo(this.game.cameraController.shoulderOrigin);
    const o = { x: cam.position.x + this._camDir.x * pivotDist, y: cam.position.y + this._camDir.y * pivotDist, z: cam.position.z + this._camDir.z * pivotDist };
    const d = { x: this._camDir.x, y: this._camDir.y, z: this._camDir.z };
    const hit = this.game.world.raycastHit(o, d, 200, { ignoreTags: ['bounds'] });
    const t = hit ? hit.t : 200;
    return { point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), normal: hit ? hit.normal : null };
  }

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
    if (motor.isBusy) return;
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
