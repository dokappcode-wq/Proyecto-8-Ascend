import * as THREE from 'three';
import { CharacterMotor } from '../physics/CharacterMotor.js';
import { CharacterModel } from '../player/CharacterModel.js';
import { Health } from '../combat/Health.js';
import { Magazine } from '../powers/Magazine.js';
import { EnemyBrain, STATE_NAMES } from './EnemyBrain.js';

const DT_STEP = 1 / 60;
const tmp = new THREE.Vector3();
const FLOAT_COLOR = new THREE.Color('#c58bff');
const STUN_COLOR = new THREE.Color('#9fd0ff');

/**
 * Enemy — actor enemigo: cuerpo físico (CharacterMotor), modelo animado,
 * salud, percepción, cerebro (EnemyBrain) y arma con cargador.
 * La PDC y el Acólito solo se diferencian por sus datos (enemyTypes.js).
 */
export class Enemy {
  /**
   * @param {object} sys EnemySystem (servicios: world, combat, projectiles, vfx, events, player)
   * @param {object} type definición de ENEMY_TYPES
   * @param {object} o { x, y, z, yaw, patrol: [{x,z}], tag }
   */
  constructor(sys, type, o) {
    this.sys = sys;
    this.type = type;
    this.tag = o.tag ?? null;
    this.faction = 'enemy';
    this.radius = 0.42;
    this.motor = new CharacterMotor(sys.world, { walkSpeed: type.runSpeed, sprintSpeed: type.runSpeed });
    this.motor.teleport({ x: o.x, y: o.y ?? 0.2, z: o.z });
    this.facing = o.yaw ?? 0;
    this.health = new Health({ max: type.health });
    this.brain = new EnemyBrain(type.brain);
    this.magazine = new Magazine({ size: type.weapon.magazineSize, reloadTime: type.weapon.reloadTime });
    this.patrol = o.patrol?.length ? o.patrol : [{ x: o.x, z: o.z }];
    this._patrolIdx = 0;
    this._patrolWait = 0;
    this._fireCd = 0.5;
    this._seeTimer = 0;
    this._canSee = false;
    /** Ve al jugador (con independencia de que su facción sea hostil). */
    this.seesPlayer = false;
    /** Le observa sin atacar (facción vigilante). */
    this.watching = false;
    this._heard = null;
    this._damagedFrom = null;
    this._heavy = false;
    this._stuck = 0;
    this._sidestep = 0;
    this._sideDir = 1;
    this._strafeDir = Math.random() < 0.5 ? -1 : 1;
    this._strafeTimer = 1 + Math.random() * 2;
    this._attackPos = null;
    this._attackPosFor = null;
    this._deadTime = 0;
    this._flash = 0;
    /** Gravedad: { t, y, pull, pullSpeed } mientras flota. */
    this._float = null;
    this._floatPh = Math.random() * 6;
    /** Segundos de aturdimiento (Atraer, pasiva de Energía). */
    this._stun = 0;
    this.intent = { move: 'patrol' };

    this.model = new CharacterModel({ variant: type.variant, glow: type.glow });
    this.root = new THREE.Group();
    this.root.add(this.model.root);
    sys.group.add(this.root);
    this._tintMats = [];
    this.model.root.traverse((m) => {
      if (m.isMesh && m.material?.isMeshStandardMaterial) this._tintMats.push(m.material);
    });

    // Barra de salud e indicador de estado sobre la cabeza
    this.barCanvas = document.createElement('canvas');
    this.barCanvas.width = 128;
    this.barCanvas.height = 40;
    this.barTex = new THREE.CanvasTexture(this.barCanvas);
    this.bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.barTex, depthTest: false, transparent: true }));
    this.bar.scale.set(1.1, 0.34, 1);
    this.bar.renderOrder = 20;
    this.bar.visible = false;
    sys.group.add(this.bar);
    this._barState = '';

    sys.combat.registerActor(this);
    this._sync();
  }

  // ---------------------------------------------------------------- Interfaz dañable
  get alive() {
    return this.health.alive;
  }

  get position() {
    return this.motor.position;
  }

  get center() {
    const p = this.motor.position;
    return { x: p.x, y: p.y + 1.0, z: p.z };
  }

  capsule() {
    const p = this.motor.position;
    return { x: p.x, y: p.y, z: p.z, r: this.radius, h: 1.8 };
  }

  get stateName() {
    return STATE_NAMES[this.brain.state];
  }

  takeDamage(amount, info = {}) {
    const dealt = this.health.damage(amount);
    if (dealt <= 0) return 0;
    this._flash = 1;
    this.model.trigger('hit');
    const pp = this.sys.player?.position;
    if (pp) this._damagedFrom = { x: pp.x, y: pp.y, z: pp.z };
    if (amount >= this.type.heavyHit || (info.knockback ?? 0) >= 6) this._heavy = true;
    if (!this.health.alive) this._die();
    return dealt;
  }

  applyImpulse(x, y, z) {
    if (!this.alive) return;
    // Un empujón saca de la flotación: sale despedido
    if (this._float && Math.hypot(x, y, z) > 3) this._endFloat();
    const v = this.motor.velocity;
    v.x += x / 1.4;
    v.z += z / 1.4;
    if (y > 0.5) {
      v.y = Math.max(v.y, y / 1.4);
      this.motor.grounded = false;
    }
  }

  /** Ruido que el enemigo puede oír (disparos, impactos). */
  hear(pos, radius) {
    if (!this.alive) return;
    const p = this.motor.position;
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    if (d <= Math.min(radius, this.type.hearRange)) this._heard = { x: pos.x, y: pos.y, z: pos.z };
  }

  // ---------------------------------------------------------------- Control (poderes)
  get floating() {
    return this._float !== null;
  }

  get stunned() {
    return this._stun > 0;
  }

  /** Flota `t` segundos a `height` m del suelo, indefenso (no se mueve ni dispara). */
  float(t, height = 1.8) {
    if (!this.alive) return;
    if (this._float) {
      this._float.t = Math.max(this._float.t, t);
      return;
    }
    const p = this.motor.position;
    const g = this.sys.world.groundHeight(p.x, p.z, 0.3, p.y + 0.5);
    this._float = { t, y: (Number.isFinite(g) ? Math.max(g, p.y) : p.y) + height, pull: null, pullSpeed: 0 };
    this.motor.velocity.x = this.motor.velocity.y = this.motor.velocity.z = 0;
    this.sys.events.emit('enemy:floated', { enemy: this });
  }

  /** Aturdido `t` segundos: no se mueve, no apunta y no dispara. */
  stun(t) {
    if (!this.alive) return;
    this._stun = Math.max(this._stun, t);
    this.sys.events.emit('enemy:stunned', { enemy: this, time: t });
  }

  /** Lo arrastra hacia `dest` (pies). Si flota, va por el aire; si no, por el suelo. */
  pullTo(dest, speed = 18) {
    if (!this.alive) return false;
    if (this._float) {
      this._float.pull = { ...dest };
      this._float.pullSpeed = speed;
      this._float.t = Math.max(this._float.t, 3);
      return true;
    }
    return this.motor.startTravel({ ...dest, speed });
  }

  _endFloat() {
    this._float = null;
    this.model.root.rotation.z = 0;
    this.motor.grounded = false;
  }

  /** Flotando o aturdido: sin percepción, IA ni disparos. */
  _updateControlled(dt) {
    const m = this.motor;
    const p = m.position;
    const w = this.sys.world;
    this._stun = Math.max(0, this._stun - dt);
    const f = this._float;
    if (f) {
      f.t -= dt;
      this._floatPh += dt;
      if (f.pull) {
        const dx = f.pull.x - p.x;
        const dy = f.pull.y - p.y;
        const dz = f.pull.z - p.z;
        const d = Math.hypot(dx, dy, dz);
        if (d < 0.35) {
          // Llega a distancia de cuerpo a cuerpo: deja de flotar y cae
          f.pull = null;
          f.t = 0;
        } else {
          const step = Math.min(d, f.pullSpeed * dt);
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
          p.z += (dz / d) * step;
          w.resolveHorizontal(p, m.cfg.radius, p.y, m.cfg.height, 0.05);
        }
      } else {
        const want = f.y + Math.sin(this._floatPh * 2) * 0.12;
        p.y += (want - p.y) * Math.min(1, dt * 4);
      }
      const ceil = w.ceilingHeight(p.x, p.z, m.cfg.radius * 0.9, p.y + 0.5);
      if (p.y + m.cfg.height > ceil) p.y = ceil - m.cfg.height;
      m.velocity.x = m.velocity.y = m.velocity.z = 0;
      m.grounded = false;
      this.model.root.rotation.z = Math.sin(this._floatPh * 1.3) * 0.25;
      if (f.t <= 0) this._endFloat();
      if (Math.random() < 0.3) {
        this.sys.vfx.particles.emit({ x: p.x + (Math.random() - 0.5), y: p.y + Math.random() * 1.8, z: p.z + (Math.random() - 0.5), vx: 0, vy: 0.6, vz: 0, color: FLOAT_COLOR, size: 0.08, life: 0.5, drag: 1 });
      }
    } else {
      // Aturdido: se queda quieto (la física sigue: si está en el aire, cae)
      const steps = Math.max(1, Math.ceil(dt / DT_STEP - 1e-6));
      for (let i = 0; i < steps; i++) m.update(dt / steps, { moveX: 0, moveZ: 0, sprint: false, jump: false, dodge: false });
      if (Math.random() < 0.25) {
        this.sys.vfx.particles.emit({ x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + 1.6 + Math.random() * 0.3, z: p.z + (Math.random() - 0.5) * 0.6, vx: 0, vy: 0.4, vz: 0, color: STUN_COLOR, size: 0.06, life: 0.3, drag: 1 });
      }
    }
    const v = m.velocity;
    this.model.animate(dt, {
      speed: 0, grounded: m.grounded, sprinting: false, dodging: false, verticalSpeed: f ? 0 : v.y,
      landed: m.events.landed, landingSpeed: m.events.landingSpeed, aimWeight: 0, aimPitch: 0,
    });
    this._sync();
  }

  /** Aviso por radio: acude a `pos` aunque no lo haya oído. */
  alertTo(pos) {
    if (this.alive) this._heard = { x: pos.x, y: pos.y, z: pos.z };
  }

  /** El jugador reaparece: los enemigos pierden el rastro y vuelven a patrullar. */
  forgetTarget() {
    if (!this.alive) return;
    this.brain.state = 'patrol';
    this.brain.lastKnown = null;
    this.brain.sinceSeen = Infinity;
    this._heard = this._damagedFrom = null;
  }

  _die() {
    this._deadTime = 0;
    if (this._float) {
      // Cae al suelo
      const p = this.motor.position;
      const g = this.sys.world.groundHeight(p.x, p.z, 0.3, p.y + 0.5);
      if (Number.isFinite(g)) p.y = g;
      this._float = null;
    }
    this._stun = 0;
    this.brain.update(0, { dead: true }); // estado: neutralizado
    this.sys.events.emit('enemy:neutralized', { enemy: this, type: this.type.id, tag: this.tag });
  }

  // ---------------------------------------------------------------- Percepción
  _computeCanSee(player) {
    if (!player || !player.alive) return false;
    const p = this.motor.position;
    const t = player.position;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > this.type.viewRange) return false;
    const engaged = this.brain.state !== 'patrol';
    if (!engaged && d > 4) {
      // Cono de visión (en patrulla); con el combate iniciado, conciencia de 360°.
      const fx = Math.sin(this.facing);
      const fz = Math.cos(this.facing);
      const cos = (fx * dx + fz * dz) / (d || 1);
      if (cos < Math.cos(THREE.MathUtils.degToRad(this.type.fov / 2))) return false;
    }
    return this._lineOfSight({ x: p.x, y: p.y + 1.6, z: p.z }, t);
  }

  /** Altura actual del objetivo (más baja si está agachado o a cubierto). */
  _targetHeight() {
    return this.sys.player?.capsule().h ?? 1.8;
  }

  /** ¿Hay línea de visión desde `eye` hasta el pecho o la cabeza del objetivo (pies en `t`)? */
  _lineOfSight(eye, t) {
    const H = this._targetHeight();
    for (const h of [H * 0.6, H * 0.93]) {
      const dx = t.x - eye.x;
      const dy = t.y + h - eye.y;
      const dz = t.z - eye.z;
      const len = Math.hypot(dx, dy, dz);
      const hit = this.sys.world.raycastHit(eye, { x: dx / len, y: dy / len, z: dz / len }, len, { ignoreTags: ['bounds'] });
      if (!hit || hit.t >= len - 0.3) return true;
    }
    return false;
  }

  /**
   * Busca una posición de ataque con línea de visión hacia `target`,
   * a la distancia preferida y alcanzable en línea recta.
   */
  _findAttackPosition(target) {
    const w = this.sys.world;
    const p = this.motor.position;
    const c = this.brain.cfg;
    const want = (c.preferredMin + c.preferredMax) / 2;
    let best = null;
    let bestD = Infinity;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      for (const r of [want, c.preferredMin]) {
        const q = { x: target.x + Math.cos(a) * r, y: target.y, z: target.z + Math.sin(a) * r };
        const gy = w.groundHeight(q.x, q.z, 0.3, target.y + 2);
        if (!Number.isFinite(gy)) continue;
        q.y = gy;
        if (!this._lineOfSight({ x: q.x, y: q.y + 1.6, z: q.z }, target)) continue;
        // Alcanzable en línea recta (a la altura de las rodillas)
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.5) {
          const hit = w.raycastHit({ x: p.x, y: p.y + 0.6, z: p.z }, { x: dx / len, y: 0, z: dz / len }, len, { ignoreTags: ['bounds'] });
          if (hit) continue;
        }
        if (len < bestD) {
          bestD = len;
          best = q;
        }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- Actualización
  update(dt) {
    const sys = this.sys;
    const player = sys.player;
    this.health.update(dt);
    this._flash = Math.max(0, this._flash - dt * 6);
    for (const m of this._tintMats) {
      if (m.emissive) m.emissive.setRGB(this._flash, this._flash * 0.3, this._flash * 0.2);
    }

    if (!this.alive) {
      this._updateDead(dt);
      return;
    }
    if (this.magazine.update(dt)) this.model.setReload(null);
    this._fireCd = Math.max(0, this._fireCd - dt);
    if (this._float || this._stun > 0) {
      this._updateControlled(dt);
      return;
    }

    // Visión (cada 0.15 s para ahorrar rayos)
    this._seeTimer -= dt;
    if (this._seeTimer <= 0) {
      this._seeTimer = 0.15;
      this.seesPlayer = this._computeCanSee(player);
    }
    // Solo ataca si su facción es hostil; vigilante: se detiene a observar
    const attitude = sys.attitude(this.type.faction ?? 'enemy');
    const hostile = attitude === 'hostile';
    this._canSee = hostile && this.seesPlayer;
    this.watching = !hostile && attitude === 'watchful' && this.seesPlayer;
    if (!hostile) this._heard = this._damagedFrom = null;

    const p = this.motor.position;
    const tp = player?.position;
    const goalForBrain = this._attackPos ?? this.brain.lastKnown;
    const atGoal = goalForBrain ? Math.hypot(goalForBrain.x - p.x, goalForBrain.z - p.z) < 1.2 : true;
    const intent = this.brain.update(dt, {
      selfPos: p,
      canSee: this._canSee,
      targetPos: tp ? { x: tp.x, y: tp.y, z: tp.z } : null,
      heard: this._heard,
      damagedFrom: this._damagedFrom,
      heavyHit: this._heavy,
      dead: false,
      atGoal,
    });
    if (this.watching && intent.move === 'patrol') {
      intent.move = 'hold';
      intent.face = tp ? { x: tp.x, z: tp.z } : null;
    }
    this.intent = intent;
    this._heard = this._damagedFrom = null;
    this._heavy = false;

    // --- Navegación ---
    let mx = 0;
    let mz = 0;
    let speed = this.type.walkSpeed;
    const toward = (g) => {
      const dx = g.x - p.x;
      const dz = g.z - p.z;
      const l = Math.hypot(dx, dz);
      return l > 0.4 ? { x: dx / l, z: dz / l, l } : { x: 0, z: 0, l };
    };
    switch (intent.move) {
      case 'patrol': {
        const wp = this.patrol[this._patrolIdx];
        const t = toward(wp);
        if (t.l < 0.6) {
          this._patrolWait -= dt;
          // Echa un vistazo alrededor mientras espera en cada punto de patrulla
          this.facing += Math.sin(this._patrolWait * 2.2) * dt * 1.6;
          if (this._patrolWait <= 0) {
            this._patrolIdx = (this._patrolIdx + 1) % this.patrol.length;
            this._patrolWait = 1.2 + Math.random();
          }
        } else {
          mx = t.x;
          mz = t.z;
        }
        this._attackPos = null;
        break;
      }
      case 'goto': {
        // En persecución, intenta una posición con visión antes que ir a ciegas.
        if (this.brain.state === 'chase' && intent.goal) {
          const g = intent.goal;
          if (!this._attackPosFor || Math.hypot(this._attackPosFor.x - g.x, this._attackPosFor.z - g.z) > 2) {
            this._attackPosFor = { ...g };
            this._attackPos = this._findAttackPosition(g);
          }
        }
        const g = this._attackPos ?? intent.goal;
        if (g) {
          const t = toward(g);
          mx = t.x;
          mz = t.z;
        }
        speed = intent.run ? this.type.runSpeed : this.type.walkSpeed;
        break;
      }
      case 'approach': {
        const t = toward(intent.goal);
        mx = t.x;
        mz = t.z;
        speed = intent.run ? this.type.runSpeed : this.type.walkSpeed * 1.3;
        this._attackPos = null;
        break;
      }
      case 'retreat': {
        const t = toward(intent.goal);
        mx = -t.x;
        mz = -t.z;
        speed = this.type.strafeSpeed;
        break;
      }
      case 'strafe': {
        const t = toward(intent.goal);
        this._strafeTimer -= dt;
        if (this._strafeTimer <= 0) {
          this._strafeDir *= -1;
          this._strafeTimer = 1.2 + Math.random() * 1.8;
        }
        mx = -t.z * this._strafeDir;
        mz = t.x * this._strafeDir;
        speed = this.type.strafeSpeed;
        this._attackPos = null;
        break;
      }
      default:
        break;
    }

    // Atascos: salta obstáculos bajos y, si sigue bloqueado, rodea.
    const wants = Math.hypot(mx, mz) > 0.1;
    let jump = false;
    if (wants && this.motor.grounded && this.motor.horizontalSpeed < speed * 0.3) this._stuck += dt;
    else this._stuck = Math.max(0, this._stuck - dt);
    if (this._stuck > 0.35 && this._stuck < 0.5) jump = true;
    if (this._stuck > 1.0) {
      this._sidestep = 0.8;
      this._sideDir = Math.random() < 0.5 ? -1 : 1;
      this._stuck = 0;
      if (intent.move === 'strafe') this._strafeDir *= -1;
    }
    if (this._sidestep > 0) {
      this._sidestep -= dt;
      const sx = -mz * this._sideDir;
      const sz = mx * this._sideDir;
      mx = mx * 0.3 + sx;
      mz = mz * 0.3 + sz;
      const l = Math.hypot(mx, mz) || 1;
      mx /= l;
      mz /= l;
    }

    // Orientación: hacia el objetivo si lo indica la intención; si no, hacia donde camina.
    const face = intent.face ?? (wants ? { x: p.x + mx, z: p.z + mz } : null);
    if (face) {
      const target = Math.atan2(face.x - p.x, face.z - p.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 8));
    }

    // Movimiento con pasos fijos (igual que el jugador)
    const steps = Math.max(1, Math.ceil(dt / DT_STEP - 1e-6));
    const sdt = dt / steps;
    const scale = speed / this.motor.cfg.walkSpeed;
    for (let i = 0; i < steps; i++) {
      this.motor.update(sdt, { moveX: mx, moveZ: mz, sprint: false, jump: jump && i === 0, dodge: false, speedScale: scale });
    }

    // --- Disparo ---
    if (intent.fire && tp) this._tryFire(tp);

    // --- Animación ---
    const v = this.motor.velocity;
    const engaged = this.brain.state === 'attack' || this.brain.state === 'alert';
    let aimPitch = 0;
    if (tp) {
      const dy = tp.y + 1.2 - (p.y + 1.4);
      aimPitch = Math.atan2(dy, Math.hypot(tp.x - p.x, tp.z - p.z));
    }
    this.model.setReload(this.magazine.reloading ? this.magazine.reloadProgress : null);
    this.model.animate(dt, {
      speed: Math.hypot(v.x, v.z), grounded: this.motor.grounded, sprinting: false, dodging: false,
      verticalSpeed: v.y, landed: this.motor.events.landed, landingSpeed: this.motor.events.landingSpeed,
      aimWeight: engaged && !this.magazine.reloading ? 1 : 0, aimPitch,
    });
    this._sync();
  }

  _tryFire(tp) {
    const w = this.type.weapon;
    if (this._fireCd > 0 || !this.magazine.canFire) return;
    const p = this.motor.position;
    // Solo dispara si está más o menos de cara al objetivo
    const want = Math.atan2(tp.x - p.x, tp.z - p.z);
    let d = want - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > 0.45) return;
    if (!this._canSee) return;

    this.root.updateMatrixWorld(true);
    const muzzle = (this.model.anchors.muzzle ?? this.model.anchors.wristR).getWorldPosition(tmp);
    const origin = { x: muzzle.x, y: muzzle.y, z: muzzle.z };
    const target = { x: tp.x, y: tp.y + this._targetHeight() * 0.6, z: tp.z };
    let dx = target.x - origin.x;
    let dy = target.y - origin.y;
    let dz = target.z - origin.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    // Dispersión: menos precisión a más distancia
    const spread = w.spread * (0.6 + len / 20);
    dx = dx / len + (Math.random() - 0.5) * 2 * spread;
    dy = dy / len + (Math.random() - 0.5) * 2 * spread * 0.6;
    dz = dz / len + (Math.random() - 0.5) * 2 * spread;
    const l2 = Math.hypot(dx, dy, dz);
    this.sys.projectiles.spawn({
      origin, dir: { x: dx / l2, y: dy / l2, z: dz / l2 }, speed: w.speed, range: w.range, radius: w.radius,
      damage: w.damage, color: w.color, kind: w.kind, faction: 'enemy', owner: this, knockback: w.knockback,
    });
    this.magazine.consume();
    this.sys.events.emit('enemy:fired', { kind: w.kind, pos: origin, enemy: this });
    this._fireCd = w.cadence * (0.85 + Math.random() * 0.3);
    this.model.trigger('cast');
    const c = new THREE.Color(w.color);
    this.sys.vfx.particles.burst(origin, { count: w.kind === 'bullet' ? 4 : 8, speed: 3, color: c, size: w.kind === 'bullet' ? 0.07 : 0.12, life: 0.12 });
    if (w.kind === 'bullet') this.sys.vfx.lights.flash(origin, c, 6, 4, 0.06);
  }

  _updateDead(dt) {
    this._deadTime += dt;
    // Cae de espaldas y se desvanece al cabo de unos segundos
    const fall = Math.min(1, this._deadTime * 2.5);
    this.model.root.rotation.x = -fall * (Math.PI / 2) * 0.95;
    this.model.root.position.y = fall * 0.15;
    this.bar.visible = false;
    if (this._deadTime > this.sys.corpseTime) this.sys.remove(this);
  }

  _sync() {
    const p = this.motor.position;
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.y = this.facing;
    this.bar.position.set(p.x, p.y + 2.25, p.z);
    const st = this.brain.state;
    const show = st !== 'patrol' || this.watching || this.health.value < this.health.max;
    this.bar.visible = show && this.alive;
    const key = `${Math.round(this.health.value)}|${st}|${this.brain.searching}|${this.watching}`;
    if (show && key !== this._barState) {
      this._barState = key;
      this._drawBar();
    }
  }

  _drawBar() {
    const g = this.barCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 40);
    const st = this.brain.state;
    const icon = st === 'alert' ? '!' : st === 'chase' ? (this.brain.searching ? '?' : '!') : st === 'recover' ? '✱' : this.watching ? '?' : '';
    if (icon) {
      g.font = '700 22px Rajdhani, Arial, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = st === 'alert' || (st === 'chase' && !this.brain.searching) ? '#ff6a3a' : this.watching ? '#9fd0ff' : '#f2c45a';
      g.fillText(icon, 64, 18);
    }
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(14, 24, 100, 12);
    const r = this.health.value / this.health.max;
    g.fillStyle = this.type.id === 'acolyte' ? '#b45cff' : '#e5533d';
    g.fillRect(16, 26, 96 * r, 8);
    this.barTex.needsUpdate = true;
  }

  dispose() {
    this.sys.combat.unregister(this);
    this.sys.group.remove(this.root);
    this.sys.group.remove(this.bar);
    this.barTex.dispose();
    this.bar.material.dispose();
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  }
}
