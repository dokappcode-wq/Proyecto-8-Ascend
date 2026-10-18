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

    const sprint = inp.isDown('sprint') && len > 0 && iz >= 0;
    this.motor.update(dt, {
      moveX: mx,
      moveZ: mz,
      sprint,
      jump: inp.wasPressed('jump'),
      dodge: inp.wasPressed('dodge'),
      facingX: Math.sin(this.facing),
      facingZ: Math.cos(this.facing),
    });

    // Orientación del modelo hacia la dirección de desplazamiento.
    const v = this.motor.velocity;
    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.5) {
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

    this.model.animate(dt, {
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
