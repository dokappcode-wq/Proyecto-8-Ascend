import * as THREE from 'three';
import { CharacterMotor } from '../physics/CharacterMotor.js';
import { CharacterModel } from './CharacterModel.js';

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
    this.motor = new CharacterMotor(world);
    this.model = new CharacterModel();
    this.facing = 0; // ángulo Y del modelo
    this._fwd = { x: 0, z: -1 };
    /** Dirección de movimiento deseada (mundo, normalizada o cero). */
    this.moveIntent = new THREE.Vector3();
    /** Lo fijan los poderes: apuntando/cargando y multiplicador de velocidad. */
    this.aiming = false;
    this.speedScale = 1;
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

  /** Teletransporta sin cambiar el punto de reaparición del mapa. */
  spawnAt(p) {
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
    if (inp.isDown('moveForward')) iz += 1;
    if (inp.isDown('moveBack')) iz -= 1;
    if (inp.isDown('moveRight')) ix += 1;
    if (inp.isDown('moveLeft')) ix -= 1;
    let mx = f.x * iz + rx * ix;
    let mz = f.z * iz + rz * ix;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }

    this.moveIntent.set(mx, 0, mz);
    const aimLocked = this.aiming || this._faceAim > 0;
    const sprint = inp.isDown('sprint') && len > 0 && iz >= 0 && !this.aiming;
    // Pasos fijos (≤ 1/60 s): el movimiento es igual a cualquier tasa de frames.
    const steps = Math.max(1, Math.ceil(dt / (1 / 60) - 1e-6));
    const sdt = dt / steps;
    const agg = { jumped: false, landed: false, dodged: false, respawned: false, landingSpeed: 0 };
    for (let i = 0; i < steps; i++) {
      this.motor.update(sdt, {
        speedScale: this.speedScale,
        moveX: mx,
        moveZ: mz,
        sprint,
        jump: i === 0 && inp.wasPressed('jump'),
        dodge: i === 0 && inp.wasPressed('dodge'),
        facingX: Math.sin(this.facing),
        facingZ: Math.cos(this.facing),
      });
      const e = this.motor.events;
      agg.jumped ||= e.jumped;
      agg.dodged ||= e.dodged;
      agg.respawned ||= e.respawned;
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
    if (aimLocked && !this.motor.isBursting) {
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
    if (ev.landed) this.events.emit('player:landed', { speed: ev.landingSpeed });
    if (ev.dodged) this.events.emit('player:dodged');
    if (ev.respawned) this.events.emit('player:respawned');

    this._aimWeight += ((aimLocked ? 1 : 0) - this._aimWeight) * (1 - Math.exp(-dt * 18));
    cam.setAim(this.aiming ? 1 : 0);
    this.model.animate(dt, {
      aimWeight: this._aimWeight,
      aimPitch: cam.pitch,
      speed: hs,
      grounded: this.motor.grounded,
      sprinting: sprint,
      dodging: this.motor.isDodging,
      verticalSpeed: v.y,
      landed: ev.landed,
      landingSpeed: ev.landingSpeed,
    });
    this._syncModel();

    cam.update(dt, this.motor.position, sprint && hs > 6);
    this.sprinting = sprint;
  }

  _syncModel() {
    const p = this.motor.position;
    this.model.root.position.set(p.x, p.y, p.z);
    this.model.root.rotation.y = this.facing;
  }
}
