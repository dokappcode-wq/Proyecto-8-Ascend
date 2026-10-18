/**
 * CharacterMotor — controlador cinemático del protagonista.
 *
 * Resuelve movimiento, gravedad, salto, sprint, esquiva, escalones y
 * colisiones contra un CollisionWorld. No depende de Three.js ni del input:
 * recibe una intención de movimiento ya expresada en coordenadas del mundo.
 */

export const DEFAULT_MOTOR_CONFIG = Object.freeze({
  radius: 0.38,
  height: 1.8,
  stepHeight: 0.45,
  walkSpeed: 5.2,
  sprintSpeed: 9.5,
  groundAccel: 60,
  groundDecel: 45,
  airAccel: 18,
  gravity: 26,
  maxFallSpeed: 45,
  jumpVelocity: 9.4,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  dodgeSpeed: 17,
  dodgeDuration: 0.22,
  dodgeCooldown: 0.55,
  killY: -40,
});

/**
 * @typedef {object} MotorInput
 * @property {number} moveX   Dirección deseada en X del mundo (-1..1).
 * @property {number} moveZ   Dirección deseada en Z del mundo (-1..1).
 * @property {boolean} sprint
 * @property {boolean} jump   true solo en el frame en que se pulsa.
 * @property {boolean} dodge  true solo en el frame en que se pulsa.
 * @property {number} [facingX] Dirección hacia la que mira (para esquivar sin moverse).
 * @property {number} [facingZ]
 * @property {number} [speedScale] Multiplicador de velocidad (apuntar, cargar…). Por defecto 1.
 */

export class CharacterMotor {
  constructor(world, config = {}) {
    this.world = world;
    this.cfg = { ...DEFAULT_MOTOR_CONFIG, ...config };
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.grounded = false;
    this.spawnPoint = { x: 0, y: 0, z: 0 };

    this._coyote = 0;
    this._jumpBuffer = 0;
    this._dodgeCooldown = 0;
    /** Impulso horizontal activo (esquiva o dash): { kind, x, z, speed, time, gravityScale, exitFactor } */
    this._burst = null;

    /** Eventos del último paso (para animación / efectos). */
    this.events = { jumped: false, landed: false, dodged: false, respawned: false, landingSpeed: 0 };
  }

  get isDodging() {
    return this._burst?.kind === 'dodge';
  }

  get isDashing() {
    return this._burst?.kind === 'dash';
  }

  get isBursting() {
    return this._burst !== null;
  }

  /**
   * Inicia un impulso horizontal (usado por habilidades como el dash
   * energético). Devuelve false si ya hay uno en curso.
   * @param {object} o { x, z: dirección; speed; duration; gravityScale=0; exitFactor=0.5; kind='dash' }
   */
  startBurst({ x, z, speed, duration, gravityScale = 0, exitFactor = 0.5, kind = 'dash' }) {
    if (this._burst) return false;
    const l = Math.hypot(x, z);
    if (l < 1e-6) return false;
    this._burst = { kind, x: x / l, z: z / l, speed, time: duration, gravityScale, exitFactor };
    // El dash anula la caída para poder cruzar huecos.
    if (kind === 'dash' && this.velocity.y < 0) this.velocity.y = 0;
    return true;
  }

  get dodgeCooldownRemaining() {
    return this._dodgeCooldown;
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  teleport(p) {
    this.position.x = p.x;
    this.position.y = p.y;
    this.position.z = p.z;
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.grounded = false;
    this._burst = null;
    this._dodgeCooldown = 0;
    this._coyote = 0;
    this._jumpBuffer = 0;
  }

  setSpawn(p) {
    this.spawnPoint = { x: p.x, y: p.y, z: p.z };
  }

  respawn() {
    this.teleport(this.spawnPoint);
  }

  /** @param {number} dt @param {MotorInput} input */
  update(dt, input) {
    const c = this.cfg;
    const ev = this.events;
    ev.jumped = ev.landed = ev.dodged = ev.respawned = false;
    ev.landingSpeed = 0;
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);

    // --- Temporizadores de salto (coyote time y buffer) ---
    if (input.jump) this._jumpBuffer = c.jumpBuffer;
    else this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);
    this._coyote = this.grounded ? c.coyoteTime : Math.max(0, this._coyote - dt);
    this._dodgeCooldown = Math.max(0, this._dodgeCooldown - dt);

    // --- Intención de movimiento ---
    let mx = input.moveX || 0;
    let mz = input.moveZ || 0;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) {
      mx /= mLen;
      mz /= mLen;
    }

    // --- Esquiva ---
    if (input.dodge && this._dodgeCooldown === 0 && !this._burst) {
      let dx = mx;
      let dz = mz;
      if (Math.hypot(dx, dz) < 0.1) {
        dx = input.facingX ?? 0;
        dz = input.facingZ ?? 1;
      }
      if (this.startBurst({ x: dx, z: dz, speed: c.dodgeSpeed, duration: c.dodgeDuration, gravityScale: 0.15, exitFactor: 0.45, kind: 'dodge' })) {
        this._dodgeCooldown = c.dodgeCooldown + c.dodgeDuration;
        ev.dodged = true;
      }
    }

    const v = this.velocity;
    const burst = this._burst;
    if (burst) {
      burst.time = Math.max(0, burst.time - dt);
      v.x = burst.x * burst.speed;
      v.z = burst.z * burst.speed;
      if (burst.time === 0) {
        // Conserva parte del impulso al terminar.
        v.x *= burst.exitFactor;
        v.z *= burst.exitFactor;
        this._burst = null;
      }
    } else {
      const maxSpeed = (input.sprint ? c.sprintSpeed : c.walkSpeed) * (input.speedScale ?? 1);
      const tx = mx * maxSpeed;
      const tz = mz * maxSpeed;
      const hasInput = mLen > 0.01;
      const accel = this.grounded ? (hasInput ? c.groundAccel : c.groundDecel) : c.airAccel;
      // En el aire no se frena por debajo de la velocidad actual si no hay input.
      if (this.grounded || hasInput) {
        const dx = tx - v.x;
        const dz = tz - v.z;
        const dl = Math.hypot(dx, dz);
        const maxDelta = accel * dt;
        if (dl <= maxDelta) {
          v.x = tx;
          v.z = tz;
        } else {
          v.x += (dx / dl) * maxDelta;
          v.z += (dz / dl) * maxDelta;
        }
      }
    }

    // --- Salto ---
    if (this._jumpBuffer > 0 && this._coyote > 0) {
      v.y = c.jumpVelocity;
      this._jumpBuffer = 0;
      this._coyote = 0;
      this.grounded = false;
      ev.jumped = true;
    }

    // --- Gravedad (los impulsos aéreos suspenden brevemente la caída) ---
    if (!this.grounded) {
      const g = burst && burst.time > 0 ? c.gravity * burst.gravityScale : c.gravity;
      v.y = Math.max(v.y - g * dt, -c.maxFallSpeed);
    }

    // --- Integración con sub-pasos para evitar atravesar geometría ---
    const travel = Math.max(Math.hypot(v.x, v.z), Math.abs(v.y)) * dt;
    const steps = Math.min(10, Math.max(1, Math.ceil(travel / (c.radius * 0.5))));
    const sdt = dt / steps;
    const wasGrounded = this.grounded;
    let landingSpeed = 0;
    for (let i = 0; i < steps; i++) {
      const vyBefore = v.y;
      this._substep(sdt);
      if (this.grounded && vyBefore < 0) landingSpeed = Math.max(landingSpeed, -vyBefore);
    }
    if (!wasGrounded && this.grounded) {
      ev.landed = true;
      ev.landingSpeed = landingSpeed;
    }

    // --- Caída fuera del mapa ---
    if (this.position.y < c.killY) {
      this.respawn();
      ev.respawned = true;
    }
  }

  _substep(dt) {
    const c = this.cfg;
    const p = this.position;
    const v = this.velocity;
    const w = this.world;

    // Horizontal
    const prevX = p.x;
    const prevZ = p.z;
    p.x += v.x * dt;
    p.z += v.z * dt;
    // Dos pasadas resuelven mejor las esquinas interiores.
    if (w.resolveHorizontal(p, c.radius, p.y, c.height, c.stepHeight) > 0) {
      w.resolveHorizontal(p, c.radius, p.y, c.height, c.stepHeight);
      // Ajusta la velocidad a lo que realmente se movió (deslizamiento por muros).
      if (dt > 0) {
        const ax = (p.x - prevX) / dt;
        const az = (p.z - prevZ) / dt;
        if (Math.abs(ax) < Math.abs(v.x)) v.x = ax;
        if (Math.abs(az) < Math.abs(v.z)) v.z = az;
      }
    }

    // Vertical
    const prevFeet = p.y;
    p.y += v.y * dt;

    if (v.y > 0) {
      const ceil = w.ceilingHeight(p.x, p.z, c.radius * 0.9, prevFeet + c.height - 0.01);
      if (p.y + c.height > ceil) {
        p.y = ceil - c.height;
        v.y = 0;
      }
    }

    const ground = w.groundHeight(p.x, p.z, c.radius * 0.85, prevFeet + c.stepHeight);
    if (p.y <= ground) {
      p.y = ground;
      if (v.y < 0) v.y = 0;
      this.grounded = v.y <= 0;
    } else if (this.grounded && v.y <= 0 && p.y - ground <= c.stepHeight) {
      // Mantiene el contacto al bajar rampas y escaleras.
      p.y = ground;
      v.y = 0;
    } else {
      this.grounded = false;
    }
  }
}
