import * as THREE from 'three';
import { CharacterMotor } from '../physics/CharacterMotor.js';
import { CharacterModel } from './CharacterModel.js';
import { findCover, wallBehind, findPeek } from './Cover.js';

/**
 * PlayerController — traduce el input en movimiento del protagonista.
 *
 * Es el mismo controlador en todos los mapas: el MapManager solo le
 * proporciona un CollisionWorld y un punto de aparición.
 */
export class PlayerController {
  constructor({ input, camera, world, events }) {
    this.input = input;
    this.cameraController = camera;
    this.events = events;
    this.motor = new CharacterMotor(world, { parkour: true });
    this.model = new CharacterModel();
    this.facing = 0; // ángulo Y del modelo
    this._fwd = { x: 0, z: -1 };
    /** Dirección de movimiento deseada (mundo, normalizada o cero). */
    this.moveIntent = new THREE.Vector3();
    /** Lo fijan los poderes: apuntando/cargando y multiplicador de velocidad. */
    this.aiming = false;
    this.speedScale = 1;
    /** Sin control (neutralizado, en contacto con una Encarnación…). */
    this.disabled = false;
    /** Punto hacia el que mira y extiende el brazo (contacto de adquisición). */
    this.lookTarget = null;
    /** Cobertura actual: { nx, nz, height, high, anchor: {x,z}, peek } o null. */
    this.cover = null;
    /** 'none' | 'cover' | 'peek' (para el HUD). */
    this.stance = 'none';
    this._faceAim = 0;
    this._aimWeight = 0;
  }

  /** Orienta el personaje hacia donde mira la cámara durante `seconds`. */
  faceAim(seconds) {
    this._faceAim = Math.max(this._faceAim, seconds);
  }

  facingVector(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  /** Posición en el mundo de la mano derecha (origen de los poderes). */
  handWorldPosition(out = new THREE.Vector3()) {
    const w = this.model.anchors.wristR;
    out.set(0, -0.1, 0.02);
    return w.localToWorld(out);
  }

  updateModelMatrices() {
    this.model.root.updateMatrixWorld(true);
  }

  get object3d() {
    return this.model.root;
  }

  get position() {
    return this.motor.position;
  }

  spawn(spawn) {
    this.motor.setSpawn(spawn);
    this.motor.teleport(spawn);
    this.facing = spawn.yaw ?? 0;
    // El modelo mira hacia +Z en local; la cámara con yaw=θ mira hacia (-sinθ, -cosθ).
    this.cameraController.reset(this.facing + Math.PI);
    this._syncModel();
  }

  get crouched() {
    return this.motor.crouched;
  }

  /** C: agacharse (y ponerse a cubierto si hay un muro al lado) o levantarse. */
  toggleCrouch() {
    const m = this.motor;
    if (m.crouched || this.cover) {
      if (!m.setCrouch(false)) return; // techo bajo: no puede levantarse
      this.cover = null;
      return;
    }
    m.setCrouch(true);
    this._enterCover();
  }

  _enterCover() {
    const m = this.motor;
    const c = findCover(m.world, m.position, m.cfg.radius);
    if (!c) return false;
    // Pegarse al muro
    const gap = c.distance - m.cfg.radius - 0.04;
    if (gap > 0) {
      m.position.x -= c.nx * gap;
      m.position.z -= c.nz * gap;
    }
    this.cover = { ...c, anchor: { x: m.position.x, z: m.position.z }, peek: null };
    this.facing = Math.atan2(-c.nx, -c.nz);
    this.events.emit('player:cover', { high: c.high });
    return true;
  }

  exitCover() {
    if (!this.cover) return;
    this.cover = null;
  }

  /** Teletransporta sin cambiar el punto de reaparición del mapa. */
  spawnAt(p) {
    this.cover = null;
    this.motor.setCrouch(false);
    this.motor.teleport(p);
    this.facing = p.yaw ?? this.facing;
    this.cameraController.reset(this.facing + Math.PI);
    this._syncModel();
  }

  update(dt) {
    const inp = this.input;
    const cam = this.cameraController;
    cam.applyMouse(inp.mouseDX, inp.mouseDY);

    // Movimiento relativo a la cámara.
    const f = cam.forward(this._fwd);
    const rx = -f.z;
    const rz = f.x;
    let ix = 0;
    let iz = 0;
    const on = !this.disabled;
    if (on && inp.isDown('moveForward')) iz += 1;
    if (on && inp.isDown('moveBack')) iz -= 1;
    if (on && inp.isDown('moveRight')) ix += 1;
    if (on && inp.isDown('moveLeft')) ix -= 1;
    let mx = f.x * iz + rx * ix;
    let mz = f.z * iz + rz * ix;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }

    // Agacharse / cobertura
    const m = this.motor;
    // C: agacharse, o soltarse si está escalando
    const drop = on && m.isClimbing && inp.wasPressed('crouch');
    if (on && !m.isClimbing && inp.wasPressed('crouch')) this.toggleCrouch();
    if (!on || m.isBusy) this.cover = null;
    let speedScale = this.speedScale;
    if (on && inp.isDown('sprint') && len > 0 && m.crouched && !this.cover) m.setCrouch(false);
    if (this.cover) ({ mx, mz } = this._coverMove(mx, mz, dt));
    if (m.crouched) speedScale *= 0.5;
    this.stance = this.cover ? (this.cover.peeking ? 'peek' : 'cover') : m.crouched ? 'crouch' : 'none';

    this.moveIntent.set(mx, 0, mz);
    const aimLocked = this.aiming || this._faceAim > 0;
    const sprint = on && inp.isDown('sprint') && Math.hypot(mx, mz) > 0 && iz >= 0 && !this.aiming && !m.crouched && !this.cover;
    // Pasos fijos (≤ 1/60 s): el movimiento es igual a cualquier tasa de frames.
    const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6));
    const sdt = dt / steps;
    const agg = { jumped: false, landed: false, dodged: false, respawned: false, landingSpeed: 0, landingImmune: false, diveLanded: null, travelEnded: null, parkour: null };
    for (let i = 0; i < steps; i++) {
      this.motor.update(sdt, {
        speedScale,
        moveX: mx,
        moveZ: mz,
        sprint,
        jump: on && i === 0 && inp.wasPressed('jump'),
        dodge: on && i === 0 && inp.wasPressed('dodge'),
        drop: drop && i === 0,
        noParkour: !on || this.aiming || !!this.cover,
        facingX: Math.sin(this.facing),
        facingZ: Math.cos(this.facing),
      });
      const e = this.motor.events;
      agg.jumped ||= e.jumped;
      agg.dodged ||= e.dodged;
      agg.respawned ||= e.respawned;
      agg.landingImmune ||= e.landingImmune;
      agg.diveLanded ??= e.diveLanded;
      agg.travelEnded ??= e.travelEnded;
      agg.parkour ??= e.parkour;
      if (e.landed) {
        agg.landed = true;
        agg.landingSpeed = Math.max(agg.landingSpeed, e.landingSpeed);
      }
    }
    Object.assign(this.motor.events, agg);

    // Orientación: hacia la cámara al apuntar o usar poderes; si no, hacia
    // la dirección de desplazamiento.
    const v = this.motor.velocity;
    const hs = Math.hypot(v.x, v.z);
    this._faceAim = Math.max(0, this._faceAim - dt);
    const wallN = this.motor.climbNormal;
    if (wallN) {
      // Escalando: de cara a la pared
      const target = Math.atan2(-wallN.nx, -wallN.nz);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 20));
    } else if (this.lookTarget) {
      const p = this.motor.position;
      const target = Math.atan2(this.lookTarget.x - p.x, this.lookTarget.z - p.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 12));
    } else if (this.cover && !aimLocked) {
      // A cubierto: de cara al muro
      const target = Math.atan2(-this.cover.nx, -this.cover.nz);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 14));
    } else if (aimLocked && !this.motor.isBursting) {
      const target = cam.yaw + Math.PI;
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * 30));
    } else if (hs > 0.5) {
      const target = Math.atan2(v.x, v.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * (this.motor.grounded ? 16 : 6)));
    }

    const ev = this.motor.events;
    if (ev.jumped) this.events.emit('player:jumped');
    if (ev.landed) this.events.emit('player:landed', { speed: ev.landingSpeed, immune: ev.landingImmune });
    if (ev.dodged) this.events.emit('player:dodged');
    if (ev.respawned) this.events.emit('player:respawned');
    if (ev.parkour) this.events.emit('player:parkour', { kind: ev.parkour });

    this._aimWeight += ((aimLocked || this.lookTarget ? 1 : 0) - this._aimWeight) * (1 - Math.exp(-dt * 18));
    cam.setAim(this.aiming ? 1 : 0);
    cam.setParkour(this.motor.isClimbing ? 1 : 0);
    this.model.animate(dt, {
      aimWeight: this._aimWeight,
      aimPitch: this.lookTarget ? -0.35 : cam.pitch,
      speed: hs,
      grounded: this.motor.grounded,
      sprinting: sprint,
      dodging: this.motor.isDodging,
      diving: this.motor.isDiving,
      crouch: this.motor.crouched ? 1 : 0,
      verticalSpeed: v.y,
      landed: ev.landed,
      landingSpeed: ev.landingSpeed,
      climb: this.motor.climbState,
      climbDistance: this.motor.climbDistance,
      mantleProgress: this.motor.mantleProgress,
    });
    this._syncModel();

    cam.update(dt, this.motor.position, sprint && hs > 6);
    this.sprinting = sprint;
  }

  /**
   * Movimiento a cubierto: deslizarse a lo largo del muro sin pasar del
   * borde; alejarse del muro sale de la cobertura. Al apuntar, se asoma:
   * se levanta (cobertura baja) o se desplaza al borde (cobertura alta).
   */
  _coverMove(mx, mz, dt) {
    const m = this.motor;
    const c = this.cover;
    const r = m.cfg.radius;
    const tx = -c.nz;
    const tz = c.nx;
    const p = m.position;

    if (this.aiming) {
      if (!c.high) {
        // Cobertura baja: se levanta para disparar por encima
        m.setCrouch(false);
        c.peeking = true;
        return { mx: 0, mz: 0 };
      }
      if (!c.peek) c.peek = findPeek(m.world, { x: c.anchor.x, y: p.y, z: c.anchor.z }, c, r);
      if (c.peek) {
        m.setCrouch(false);
        c.peeking = true;
        const dx = c.peek.x - p.x;
        const dz = c.peek.z - p.z;
        const d = Math.hypot(dx, dz);
        return d > 0.12 ? { mx: (dx / d) * Math.max(0.5, Math.min(1, d * 3)), mz: (dz / d) * Math.max(0.5, Math.min(1, d * 3)) } : { mx: 0, mz: 0 };
      }
      c.peeking = false; // muro alto sin borde cerca: no puede asomarse
      return { mx: 0, mz: 0 };
    }

    if (c.peeking) {
      // Vuelve a su sitio y se agacha
      const dx = c.anchor.x - p.x;
      const dz = c.anchor.z - p.z;
      const d = Math.hypot(dx, dz);
      c.returnTime = (c.returnTime ?? 0) + dt;
      // Vuelve hasta su sitio (con un límite de tiempo por si algo lo bloquea)
      if (d > 0.12 && c.returnTime < 1.5) return { mx: (dx / d) * Math.max(0.5, Math.min(1, d * 3)), mz: (dz / d) * Math.max(0.5, Math.min(1, d * 3)) };
      c.returnTime = 0;
      c.peeking = false;
      c.peek = null;
      m.setCrouch(true);
    }

    const along = mx * tx + mz * tz;
    const away = mx * c.nx + mz * c.nz;
    if (away > 0.7) {
      this.exitCover();
      return { mx, mz };
    }
    let ox = tx * along;
    let oz = tz * along;
    if (Math.abs(along) > 0.1) {
      // No pasar del borde de la cobertura
      const s = Math.sign(along);
      const probe = { x: p.x + tx * s * (r + 0.15), y: p.y, z: p.z + tz * s * (r + 0.15) };
      if (!wallBehind(m.world, probe, c, r)) {
        ox = 0;
        oz = 0;
      }
    }
    // Se mantiene pegado al muro
    ox -= c.nx * 0.15;
    oz -= c.nz * 0.15;
    c.anchor = { x: p.x, z: p.z };
    c.peek = null;
    return { mx: ox, mz: oz };
  }

  _syncModel() {
    const p = this.motor.position;
    this.model.root.position.set(p.x, p.y, p.z);
    this.model.root.rotation.y = this.facing;
  }
}
