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
  crouchHeight: 1.15,
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
  dodgeSpeed: 12,
  dodgeDuration: 0.18,
  dodgeExitFactor: 0.3,
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
    this.crouched = false;
    this.spawnPoint = { x: 0, y: 0, z: 0 };

    this._coyote = 0;
    this._jumpBuffer = 0;
    this._dodgeCooldown = 0;
    /** Impulso horizontal activo (esquiva o dash): { kind, x, z, speed, time, gravityScale, exitFactor } */
    this._burst = null;
    /** Caída en picado (rayo): { speed, startY } */
    this._dive = null;
    /** Desplazamiento dirigido a un punto: { from, to, t, duration } */
    this._travel = null;

    /**
     * Eventos del último paso (para animación / efectos).
     * `landingImmune`: el aterrizaje no debe causar daño por caída (picado).
     * `diveLanded`: { fallHeight } al terminar un picado.
     */
    this.events = { jumped: false, landed: false, dodged: false, respawned: false, landingSpeed: 0, landingImmune: false, diveLanded: null, travelEnded: null };
  }

  /** Altura actual del cuerpo (menor agachado). */
  get currentHeight() {
    return this.crouched ? this.cfg.crouchHeight : this.cfg.height;
  }

  /** ¿Hay sitio para ponerse de pie aquí? */
  canStand() {
    const p = this.position;
    const c = this.cfg;
    const ceil = this.world.ceilingHeight(p.x, p.z, c.radius * 0.9, p.y + c.crouchHeight - 0.01);
    return ceil >= p.y + c.height;
  }

  /** Agacharse o levantarse. Levantarse falla si hay un techo bajo. Devuelve el estado final. */
  setCrouch(v) {
    if (!v && this.crouched && !this.canStand()) return true;
    this.crouched = v;
    return this.crouched;
  }

  get isDiving() {
    return this._dive !== null;
  }

  get isTraveling() {
    return this._travel !== null;
  }

  /** Movimiento especial en curso (impulso, picado o desplazamiento dirigido). */
  get isBusy() {
    return this._burst !== null || this._dive !== null || this._travel !== null;
  }

  /**
   * Caída vertical a gran velocidad hasta tocar suelo. El aterrizaje se
   * marca como inmune al daño por caída.
   */
  startDive(speed = 42) {
    if (this.grounded || this.isBusy) return false;
    this._dive = { speed, startY: this.position.y };
    this.velocity.x = this.velocity.z = 0;
    this.velocity.y = -speed;
    return true;
  }

  /**
   * Desplazamiento rápido en línea hasta un punto (pies), con colisiones.
   * Si el destino está más alto, gana altura antes (curva) para poder
   * superar bordes de azoteas. Se detiene si algo lo bloquea.
   */
  startTravel({ x, y, z, speed = 45 }) {
    if (this.isBusy) return false;
    const from = { ...this.position };
    const dist = Math.hypot(x - from.x, y - from.y, z - from.z);
    if (dist < 0.5) return false;
    this._travel = { from, to: { x, y, z }, t: 0, duration: dist / speed };
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.grounded = false;
    return true;
  }

  get isDodging() {
    return this._burst?.kind === 'dodge';
  }

  get isDashing() {
    return this._burst?.kind === 'dash';
  }

  get isBursting() {
    return this._burst !== null || this._travel !== null;
  }

  /**
   * Inicia un impulso horizontal (usado por habilidades como el dash
   * energético). Devuelve false si ya hay uno en curso.
   * @param {object} o { x, z: dirección; speed; duration; gravityScale=0; exitFactor=0.5; kind='dash' }
   */
  startBurst({ x, z, speed, duration, gravityScale = 0, exitFactor = 0.5, kind = 'dash' }) {
    if (this.isBusy) return false;
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
    this._dive = null;
    this._travel = null;
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
    ev.jumped = ev.landed = ev.dodged = ev.respawned = ev.landingImmune = false;
    ev.landingSpeed = 0;
    ev.diveLanded = ev.travelEnded = null;
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);

    if (this._dive) return this._updateDive(dt);
    if (this._travel) return this._updateTravel(dt);

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
    if (input.dodge && this._dodgeCooldown === 0 && !this.isBusy) {
      let dx = mx;
      let dz = mz;
      if (Math.hypot(dx, dz) < 0.1) {
        dx = input.facingX ?? 0;
        dz = input.facingZ ?? 1;
      }
      if (this.startBurst({ x: dx, z: dz, speed: c.dodgeSpeed, duration: c.dodgeDuration, gravityScale: 0.15, exitFactor: c.dodgeExitFactor, kind: 'dodge' })) {
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
    if (this._jumpBuffer > 0 && this._coyote > 0 && this.crouched) {
      // Saltar estando agachado: primero se levanta (si hay sitio)
      if (!this.setCrouch(false)) this._jumpBuffer = 0;
    }
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

    this._integrate(dt);
  }

  /** Integración con sub-pasos (no atraviesa geometría) + eventos de aterrizaje y caída del mapa. */
  _integrate(dt) {
    const c = this.cfg;
    const v = this.velocity;
    const ev = this.events;
    const travel = Math.max(Math.hypot(v.x, v.z), Math.abs(v.y)) * dt;
    const steps = Math.min(16, Math.max(1, Math.ceil(travel / (c.radius * 0.5))));
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

  _updateDive(dt) {
    const v = this.velocity;
    v.x = v.z = 0;
    v.y = -this._dive.speed;
    this._integrate(dt);
    if (!this._dive) return; // reaparición
    if (this.grounded) {
      const ev = this.events;
      ev.landingImmune = true;
      ev.diveLanded = { fallHeight: Math.max(0, this._dive.startY - this.position.y) };
      this._dive = null;
      v.y = 0;
    }
  }

  _updateTravel(dt) {
    const tr = this._travel;
    const p = this.position;
    const v = this.velocity;
    tr.t = Math.min(1, tr.t + dt / tr.duration);
    const t = tr.t;
    const up = tr.to.y > tr.from.y;
    // Al subir, la altura se gana antes que la distancia horizontal.
    const ty = up ? 1 - (1 - t) * (1 - t) : t;
    const want = {
      x: tr.from.x + (tr.to.x - tr.from.x) * t,
      y: tr.from.y + (tr.to.y - tr.from.y) * ty,
      z: tr.from.z + (tr.to.z - tr.from.z) * t,
    };
    v.x = (want.x - p.x) / dt;
    v.y = (want.y - p.y) / dt;
    v.z = (want.z - p.z) / dt;
    this._integrate(dt);
    if (!this._travel) return; // reaparición
    const off = Math.hypot(want.x - p.x, want.y - p.y, want.z - p.z);
    const blocked = off > 0.6;
    if (t >= 1 || blocked) {
      const hx = tr.to.x - tr.from.x;
      const hz = tr.to.z - tr.from.z;
      const hl = Math.hypot(hx, hz) || 1;
      // Pequeña inercia de salida en la dirección del desplazamiento.
      v.x = (hx / hl) * 3;
      v.z = (hz / hl) * 3;
      v.y = 0;
      this.events.travelEnded = { blocked };
      this.events.landingImmune = true;
      this._travel = null;
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
    const h = this.currentHeight;
    if (w.resolveHorizontal(p, c.radius, p.y, h, c.stepHeight) > 0) {
      w.resolveHorizontal(p, c.radius, p.y, h, c.stepHeight);
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
      const ceil = w.ceilingHeight(p.x, p.z, c.radius * 0.9, prevFeet + h - 0.01);
      if (p.y + h > ceil) {
        p.y = ceil - h;
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
