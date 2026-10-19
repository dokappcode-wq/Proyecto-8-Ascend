/**
 * CharacterMotor — controlador cinemático del protagonista.
 *
 * Resuelve movimiento, gravedad, salto, sprint, esquiva, escalones y
 * colisiones contra un CollisionWorld. No depende de Three.js ni del input:
 * recibe una intención de movimiento ya expresada en coordenadas del mundo.
 */

import { PARKOUR_CONFIG, isClimbable, probeWall, findLedge, standSpot, hangSpot, wallAboveLedge, vaultLanding, ledgeTop } from './Parkour.js';

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
  /** Parkour (escalada, cornisas, obstáculos). Solo el protagonista. */
  parkour: false,
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
 * @property {boolean} [drop]   Soltarse de una pared o cornisa (solo el frame en que se pulsa).
 * @property {boolean} [jumpHeld] Salto mantenido (saltos de Gravedad: más altura y planeo).
 * @property {boolean} [noParkour] Desactiva el agarre (apuntando, a cubierto…).
 */

export class CharacterMotor {
  constructor(world, config = {}) {
    this.world = world;
    this.cfg = { ...DEFAULT_MOTOR_CONFIG, ...config };
    this.pk = { ...PARKOUR_CONFIG, ...(config.parkourConfig ?? {}) };
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
    /** Escalada: { mode: 'wall' | 'hang', nx, nz, ledgeY, time, leap, leapCd, moved } */
    this._climb = null;
    /** Subida a una cornisa o salto de obstáculo: { kind, from, to, t, duration, exit, crouch, then } */
    this._mantle = null;
    this._noGrab = 0;
    /**
     * Saltos de Gravedad (null = salto normal): { airJumps, airJumpVelocity,
     * holdGravityScale, holdTime, glideFallSpeed, glideSpeed }.
     */
    this.jumpAbilities = null;
    this._airJumpsLeft = 0;
    this._holdT = 0;
    this.gliding = false;

    /**
     * Eventos del último paso (para animación / efectos).
     * `landingImmune`: el aterrizaje no debe causar daño por caída (picado).
     * `diveLanded`: { fallHeight } al terminar un picado.
     */
    this.events = { jumped: false, landed: false, dodged: false, respawned: false, landingSpeed: 0, landingImmune: false, diveLanded: null, travelEnded: null, parkour: null, airJump: false };
  }

  /** 'wall' | 'hang' | 'mantle' | 'vault' | null */
  get climbState() {
    if (this._mantle) return this._mantle.kind;
    return this._climb?.mode ?? null;
  }

  /** Escalando, colgado o subiendo a una cornisa (sin poderes ni esquiva). */
  get isClimbing() {
    return this._climb !== null || this._mantle !== null;
  }

  /** Normal del muro al que está agarrado ({nx, nz}) o null. */
  get climbNormal() {
    const c = this._climb ?? this._mantle;
    return c ? { nx: c.nx, nz: c.nz } : null;
  }

  /** Progreso del ciclo de escalada (metros recorridos por la pared). */
  get climbDistance() {
    return this._climb?.moved ?? 0;
  }

  get mantleProgress() {
    return this._mantle?.t ?? 0;
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
    return this._burst !== null || this._dive !== null || this._travel !== null || this._climb !== null || this._mantle !== null;
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
    this._climb = null;
    this._mantle = null;
    this._noGrab = 0;
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
    ev.diveLanded = ev.travelEnded = ev.parkour = null;
    ev.airJump = false;
    this.gliding = false;
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this._noGrab = Math.max(0, this._noGrab - dt);

    if (this._mantle) return this._updateMantle(dt);
    if (this._climb) return this._updateClimb(dt, input);

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
      const J = this.jumpAbilities;
      const glide = !!J && this._glideNow(input);
      const maxSpeed = glide ? Math.max(J.glideSpeed, this.horizontalSpeed) : (input.sprint ? c.sprintSpeed : c.walkSpeed) * (input.speedScale ?? 1);
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
    const J = this.jumpAbilities;
    if (this.grounded) this._airJumpsLeft = J?.airJumps ?? 0;
    if (this._jumpBuffer > 0 && this._coyote > 0) {
      v.y = c.jumpVelocity;
      this._jumpBuffer = 0;
      this._coyote = 0;
      this.grounded = false;
      this._holdT = J?.holdTime ?? 0;
      ev.jumped = true;
    } else if (J && this._jumpBuffer > 0 && !this.grounded && this._airJumpsLeft > 0 && !burst) {
      // Saltos de Gravedad: hasta 3 en total (uno desde el suelo + 2 en el aire)
      v.y = J.airJumpVelocity;
      this._airJumpsLeft--;
      this._jumpBuffer = 0;
      this._holdT = J.holdTime;
      ev.jumped = true;
      ev.airJump = true;
    }
    this._holdT = Math.max(0, this._holdT - dt);

    // --- Gravedad (los impulsos aéreos suspenden brevemente la caída) ---
    if (!this.grounded) {
      let g = burst && burst.time > 0 ? c.gravity * burst.gravityScale : c.gravity;
      // Mantener el salto mientras sube: salto más alto
      if (J && input.jumpHeld && v.y > 0 && this._holdT > 0) g *= J.holdGravityScale;
      v.y = Math.max(v.y - g * dt, -c.maxFallSpeed);
      // Mantener el salto cayendo: planeo
      if (J && this._glideNow(input)) {
        v.y = Math.max(v.y, -J.glideFallSpeed);
        this.gliding = true;
      }
    }

    // Velocidad antes de chocar (para decidir si salta un obstáculo por encima)
    const approachSpeed = this.horizontalSpeed;
    this._integrate(dt);

    if (c.parkour && !input.noParkour && !this.isBusy && !this.crouched) this._tryParkour(mx, mz, mLen, approachSpeed);
  }

  /** ¿Planea ahora? (Gravedad: salto mantenido mientras cae) */
  _glideNow(input) {
    return !this.grounded && !!input.jumpHeld && this.velocity.y <= 0 && !this._burst && !this.crouched;
  }

  // ------------------------------------------------------------------ Parkour

  /** Agarre automático: obstáculos bajos en el suelo; cornisas y muros en el aire. */
  _tryParkour(mx, mz, mLen, approachSpeed) {
    if (mLen < 0.5) return;
    const c = this.cfg;
    const pk = this.pk;
    const p = this.position;
    const ux = mx / mLen;
    const uz = mz / mLen;

    if (this.grounded) {
      // Obstáculo bajo delante: saltarlo por encima o subirse
      const w = probeWall(this.world, p, ux, uz, p.y + c.stepHeight + 0.12, c.radius + 0.3);
      if (!w || !isClimbable(w.collider) || ux * w.nx + uz * w.nz > -0.6) return;
      const ledge = findLedge(this.world, p, w, c.radius, c.stepHeight + 0.02, pk.vaultMaxHeight);
      if (!ledge) return;
      if (approachSpeed >= pk.vaultMinSpeed) {
        const land = vaultLanding(this.world, p, ledge, c.radius, c.height, pk.vaultMaxDepth);
        if (land) return this._startMantle('vault', ledge, land, Math.max(approachSpeed, 5), null, approachSpeed);
      }
      const spot = standSpot(this.world, p, ledge, c.radius, c.height, c.crouchHeight);
      if (spot) this._startMantle('mantle', ledge, spot, 1.5);
      return;
    }

    if (this._noGrab > 0) return;
    const w = probeWall(this.world, p, ux, uz, p.y + 1.1, c.radius + pk.reach);
    const wHigh = w ?? probeWall(this.world, p, ux, uz, p.y + 1.7, c.radius + pk.reach);
    const wall = w ?? wHigh;
    if (!wall || !isClimbable(wall.collider) || ux * wall.nx + uz * wall.nz > -0.6) return;

    // Cornisa al alcance de las manos
    const ledge = findLedge(this.world, p, wall, c.radius, 0.3, pk.grabMax);
    if (ledge) {
      const rel = ledge.y - p.y;
      if (rel <= pk.vaultMaxHeight) {
        const spot = standSpot(this.world, p, ledge, c.radius, c.height, c.crouchHeight);
        if (spot) return this._startMantle('mantle', ledge, spot, 1.5);
      }
      if (this.velocity.y < 3) {
        const hang = hangSpot(this.world, p, ledge, c.radius, c.height, pk.hangReach);
        if (hang) return this._startHang(ledge, hang);
      }
      return;
    }
    // Muro trepable (el pecho toca la pared)
    if (w && this.velocity.y > pk.wallGrabMinVy) this._startWall(w);
  }

  _startWall(w) {
    const c = this.cfg;
    const p = this.position;
    p.x = Math.abs(w.nx) > 0.5 ? w.x + w.nx * (c.radius + 0.02) : p.x;
    p.z = Math.abs(w.nz) > 0.5 ? w.z + w.nz * (c.radius + 0.02) : p.z;
    this._climb = { mode: 'wall', nx: w.nx, nz: w.nz, ledgeY: null, time: 0, leap: 0, leapCd: 0, moved: 0 };
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.grounded = false;
    this.events.parkour = 'wall';
  }

  _startHang(ledge, spot) {
    const p = this.position;
    p.x = spot.x;
    p.y = spot.y;
    p.z = spot.z;
    this._climb = { mode: 'hang', nx: ledge.nx, nz: ledge.nz, ledgeY: ledge.y, front: ledge.front, time: 0, leap: 0, leapCd: 0, moved: 0 };
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.grounded = false;
    this.events.parkour = 'hang';
  }

  /**
   * Movimiento animado hasta `to` (sin colisiones: el destino ya se validó).
   * `then`: 'wall' para seguir escalando al terminar (fachadas con molduras).
   */
  _startMantle(kind, ledge, to, exitSpeed, then = null, speed = 5) {
    const p = this.position;
    const from = { x: p.x, y: p.y, z: p.z };
    const rise = Math.max(0, ledge.y - from.y);
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const duration = kind === 'vault' ? Math.max(0.28, Math.min(0.5, (dist + 0.5) / Math.max(speed, 5))) : 0.22 + rise * 0.12;
    this._climb = null;
    this._mantle = {
      kind, from, to: { x: to.x, y: to.y, z: to.z }, peakY: ledge.y + 0.08, t: 0, duration,
      nx: ledge.nx, nz: ledge.nz, exit: exitSpeed, crouch: !!to.crouch, then,
    };
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    this.grounded = false;
    this.events.parkour = kind;
  }

  _updateMantle(dt) {
    const m = this._mantle;
    const p = this.position;
    m.t = Math.min(1, m.t + dt / m.duration);
    const t = m.t;
    if (m.kind === 'vault') {
      // Arco por encima del obstáculo
      const h = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
      const base = m.from.y + (m.to.y - m.from.y) * t;
      const peak = Math.max(m.peakY + 0.1, base);
      p.y = t < 0.45 ? m.from.y + (peak - m.from.y) * Math.sin((h * Math.PI) / 2) : m.to.y + (peak - m.to.y) * Math.sin((h * Math.PI) / 2);
      p.x = m.from.x + (m.to.x - m.from.x) * t;
      p.z = m.from.z + (m.to.z - m.from.z) * t;
    } else {
      // Primero sube (manos en la cornisa), luego avanza sobre ella
      const ty = Math.min(1, t / 0.6);
      const th = Math.max(0, (t - 0.35) / 0.65);
      const ey = 1 - (1 - ty) * (1 - ty);
      const eh = th * th * (3 - 2 * th);
      p.y = m.from.y + (Math.max(m.to.y, m.peakY - 0.08) - m.from.y) * ey;
      if (t >= 1) p.y = m.to.y;
      p.x = m.from.x + (m.to.x - m.from.x) * eh;
      p.z = m.from.z + (m.to.z - m.from.z) * eh;
    }
    if (t < 1) return;

    this._mantle = null;
    p.x = m.to.x;
    p.y = m.to.y;
    p.z = m.to.z;
    if (m.crouch) this.crouched = true;
    if (m.then === 'wall') {
      this._climb = { mode: 'wall', nx: m.nx, nz: m.nz, ledgeY: null, time: 0, leap: 0, leapCd: 0, moved: 0 };
      return;
    }
    const hx = m.to.x - m.from.x;
    const hz = m.to.z - m.from.z;
    const hl = Math.hypot(hx, hz) || 1;
    this.velocity.x = (hx / hl) * m.exit;
    this.velocity.z = (hz / hl) * m.exit;
    this.velocity.y = 0;
    this.grounded = true;
    this._coyote = this.cfg.coyoteTime;
    this.events.landed = true;
    this.events.landingSpeed = 0;
    this.events.landingImmune = true;
  }

  /** Soltarse de la pared (opcionalmente con un impulso). */
  _detach(vx = 0, vy = 0, vz = 0, delay = this.pk.regrabDelay) {
    this._climb = null;
    this.velocity.x = vx;
    this.velocity.y = vy;
    this.velocity.z = vz;
    this.grounded = false;
    this._noGrab = delay;
  }

  _updateClimb(dt, input) {
    const c = this.cfg;
    const pk = this.pk;
    const cl = this._climb;
    const p = this.position;
    const n = { nx: cl.nx, nz: cl.nz };
    cl.time += dt;
    cl.leap = Math.max(0, cl.leap - dt);
    cl.leapCd = Math.max(0, cl.leapCd - dt);
    if (input.jump) this._jumpBuffer = c.jumpBuffer;
    else this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);

    // Intención relativa a la pared: hacia ella = subir, alejarse = bajar
    let mx = input.moveX || 0;
    let mz = input.moveZ || 0;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    const up = -(mx * n.nx + mz * n.nz);
    const tx = -n.nz;
    const tz = n.nx;
    const side = mx * tx + mz * tz;

    if (input.drop) return this._detach(n.nx * 1.5, 0, n.nz * 1.5, pk.dropRegrabDelay);
    if (this._jumpBuffer > 0 && up < -0.4) {
      // Salto hacia atrás, alejándose de la pared
      this._jumpBuffer = 0;
      this.events.jumped = true;
      this.events.parkour = 'walljump';
      return this._detach(n.nx * pk.wallJumpOut, pk.wallJumpUp, n.nz * pk.wallJumpOut);
    }

    if (cl.mode === 'hang') return this._updateHang(dt, input, n, up, side, tx, tz);

    if (this._jumpBuffer > 0 && cl.leapCd === 0) {
      this._jumpBuffer = 0;
      cl.leap = pk.leapTime;
      cl.leapCd = pk.leapCooldown;
      this.events.parkour = 'leap';
    }
    let vy = 0;
    if (cl.leap > 0) vy = pk.leapSpeed;
    else if (up > 0.3) vy = pk.climbUpSpeed * Math.min(1, up);
    else if (up < -0.3) vy = -pk.climbDownSpeed * Math.min(1, -up);
    const vs = Math.abs(side) > 0.3 ? pk.climbSideSpeed * Math.sign(side) * Math.min(1, Math.abs(side)) : 0;

    // Movimiento con colisiones (pegado a la pared)
    const prev = { x: p.x, y: p.y, z: p.z };
    p.x += (tx * vs - n.nx * 0.4) * dt;
    p.z += (tz * vs - n.nz * 0.4) * dt;
    this.world.resolveHorizontal(p, c.radius, p.y, c.height, 0.05);
    // Al desplazarse de lado, no salir del borde de la pared
    if (vs !== 0 && !this._wallAt(p, n, p.y + 1.1)) {
      p.x = prev.x;
      p.z = prev.z;
    }
    p.y += vy * dt;
    const ceil = this.world.ceilingHeight(p.x, p.z, c.radius * 0.9, prev.y + c.height - 0.01);
    if (p.y + c.height > ceil) p.y = ceil - c.height;
    const ground = this.world.groundHeight(p.x, p.z, c.radius * 0.85, prev.y + c.stepHeight);
    cl.moved += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    this.velocity.x = this.velocity.z = 0;
    this.velocity.y = 0;

    if (p.y <= ground) {
      // Ha bajado hasta el suelo
      p.y = ground;
      this._climb = null;
      this.grounded = true;
      this._noGrab = pk.regrabDelay;
      return;
    }

    // Cornisa al alcance: subir directamente si se sigue trepando, o colgarse
    const ledge = findLedge(this.world, p, n, c.radius, 1.0, pk.hangReach + 0.12);
    if (ledge && ledge.y - p.y <= pk.hangReach + 0.12 && vy >= 0) {
      if (up > 0.3 || cl.leap > 0) {
        if (this._climbOver(ledge)) return;
      }
      const hang = hangSpot(this.world, p, ledge, c.radius, c.height, pk.hangReach);
      if (hang) return this._startHang(ledge, hang);
    }

    // Sin pared delante: se suelta
    if (!this._wallAt(p, n, p.y + 1.1) && !this._wallAt(p, n, p.y + 1.6)) this._detach(0, 0, 0);
  }

  _updateHang(dt, input, n, up, side, tx, tz) {
    const c = this.cfg;
    const pk = this.pk;
    const cl = this._climb;
    const p = this.position;

    const wantsUp = up > 0.3 || this._jumpBuffer > 0;
    if (wantsUp && cl.time >= pk.hangMinTime) {
      const ledge = this._ledgeHere(p, cl);
      if (ledge && this._climbOver(ledge)) {
        this._jumpBuffer = 0;
        return;
      }
    }
    if (up < -0.3) {
      // Bajar a la pared si hay muro trepable debajo; si no, se queda colgado
      if (this._wallAt(p, { nx: cl.nx, nz: cl.nz }, p.y + 1.1)) {
        cl.mode = 'wall';
        return;
      }
    }
    // Desplazamiento lateral por la cornisa mientras siga existiendo
    if (Math.abs(side) > 0.3) {
      const prev = { x: p.x, z: p.z };
      const step = pk.shimmySpeed * Math.sign(side) * Math.min(1, Math.abs(side)) * dt;
      p.x += tx * step;
      p.z += tz * step;
      this.world.resolveHorizontal(p, c.radius, p.y, c.height, 0.05);
      const l = this._ledgeHere(p, cl);
      if (!l || Math.abs(l.y - cl.ledgeY) > 0.15) {
        p.x = prev.x;
        p.z = prev.z;
      } else cl.moved += Math.abs(step);
    }
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
  }

  /** Cornisa justo delante de las manos estando colgado. */
  _ledgeHere(p, cl) {
    const sx = Math.abs(cl.nx) > 0.5 ? cl.front - cl.nx * 0.12 : p.x;
    const sz = Math.abs(cl.nz) > 0.5 ? cl.front - cl.nz * 0.12 : p.z;
    const top = ledgeTop(this.world, sx, sz, cl.ledgeY + 0.4, cl.ledgeY - 0.3);
    if (!top || !isClimbable(top.collider)) return null;
    return { y: top.y, collider: top.collider, front: cl.front, nx: cl.nx, nz: cl.nz };
  }

  /** Subir por encima de una cornisa: de pie sobre ella o, si es estrecha, seguir trepando por el muro de arriba. */
  _climbOver(ledge) {
    const c = this.cfg;
    const p = this.position;
    const spot = standSpot(this.world, p, ledge, c.radius, c.height, c.crouchHeight);
    if (spot) {
      this._startMantle('mantle', ledge, spot, 1.5);
      return true;
    }
    const above = wallAboveLedge(this.world, p, ledge, c.radius, c.height);
    if (above) {
      this._startMantle('mantle', ledge, above, 0, 'wall');
      return true;
    }
    return false;
  }

  /** ¿Hay pared trepable delante (normal n) a la altura y? */
  _wallAt(p, n, y) {
    const w = probeWall(this.world, p, -n.nx, -n.nz, y, this.cfg.radius + 0.3);
    return !!w && isClimbable(w.collider) && Math.abs(w.nx - n.nx) < 0.1 && Math.abs(w.nz - n.nz) < 0.1;
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
